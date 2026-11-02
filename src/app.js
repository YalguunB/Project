/* ============ APP: views, events, wiring (GL scene, motion layer, shared backend) ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const stageEl = $('#stage');
const GROUP = { intro:-1, game:0, card:0, budget:1, matches:2, planner:3, field:-1 };
const STAGE_NAMES = ['Feel', 'Budget', 'Matches', 'Plan'];
const STAGE_LABEL = { intro:'MoodTrip', game:'The game', card:'Your feeling', budget:'Budget & timing', matches:'Your matches', planner:'Your plan', field:'The field' };
const SAVE_KEY = 'moodtrip:saved:v1';
const GRIP = '<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="1.7"/><circle cx="10" cy="4" r="1.7"/><circle cx="4" cy="10" r="1.7"/><circle cx="10" cy="10" r="1.7"/><circle cx="4" cy="16" r="1.7"/><circle cx="10" cy="16" r="1.7"/></svg>';
/* where the 3D orb sits on each screen: [desktop, phone] = [x, y, size] as fractions of the viewport.
   r1..r5 are the five rounds of the one-page game: the orb moves to the round that is in view. */
const ANCHOR = {
  intro:   [[.73, .52, .86], [.5, .26, .98]],
  r1:      [[.5, .66, .62],  [.5, .56, .7]],
  r2:      [[.5, .52, .6],   [.5, .46, .6]],
  r3:      [[.5, .60, .58],  [.5, .50, .72]],
  r4:      [[.5, .62, .58],  [.5, .52, .72]],
  r5:      [[.5, .56, .74],  [.5, .48, .8]],
  card:    [[.22, .52, .52], [.5, .2, .55]],
  budget:  [[.93, .20, .42], [.82, .12, .42]],
  matches: [[.98, .07, .34], [.85, .09, .4]],
  planner: [[.97, .05, .3],  [.86, .08, .36]]
};
const BAG_STAGES = new Set(['card']);   // the game shows the bag from round 3 on (see bagOn)
let picked = false;         // has the traveler chosen a window yet (round 1 shifts the whole mood)
let prevStage = 'intro';

/* ---------- the game: five rounds on one page ---------- */
const ROUNDS = [
  { n:1, key:'Window',   title:'Pick a window.',          sub:'Which view would you want to wake up to?' },
  { n:2, key:'Battery',  title:'Drag your battery level.', sub:'How much energy do you have for this trip? Drag the battery, or use the arrow keys.' },
  { n:3, key:'Bag',      title:'What goes in your bag?',   sub:'Pick up to three things.' },
  { n:4, key:'Sound',    title:'Pick a soundtrack.',       sub:'What would be playing in your headphones?' },
  { n:5, key:'Feeling',  title:'Finish the sentence.',     sub:'Choose the feeling you want to bring home.' }
];
const PREFILLED = new Set([2, 3]);   // rounds that start with a suggested answer: "Keep this" counts as answering
const touched = new Set();           // rounds the traveler has answered
let gRound = 1;                      // the round currently in view
let gIO = null;

/* ---------- small utilities ---------- */
let toastTimer;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3600); }
const say = msg => { $('#live').textContent = ''; setTimeout(() => { $('#live').textContent = msg; }, 30); };
const plural = (n, a, b) => n === 1 ? a : b;

/* ---------- saved trip: validated before it is trusted (it comes from storage or the shared database) ---------- */
function cleanTrip(v){
  if (!v || typeof v !== 'object') return null;
  const d = destById(v.destId); if (!d || !v.plan || !Array.isArray(v.plan.days)) return null;
  const str = (s, n) => String(s == null ? '' : s).slice(0, n);
  const days = v.plan.days.slice(0, 14).map(day => ({
    title:str(day && day.title, 60) || 'Open day',
    stops:(Array.isArray(day && day.stops) ? day.stops : []).slice(0, 12).map(s => ({
      id:str(s && s.id, 24) || 'c:' + Math.random().toString(36).slice(2, 8),
      part:PARTS.includes(s && s.part) ? s.part : null, title:str(s && s.title, 60),
      cost:clamp(Math.round(+(s && s.cost) || 0), 0, 9999), ...(s && s.custom ? { custom:true } : {})
    })).filter(s => s.title)
  }));
  if (!days.length) return null;
  const has = (list, id, dflt) => list.some(x => x.id === id) ? id : dflt;
  return {
    window:has(WIN, v.window, 'sea'), energy:clamp(Math.round(+v.energy) || 0, 0, 100), bag:(Array.isArray(v.bag) ? v.bag : []).filter(b => BAG.some(x => x.id === b)).slice(0, 3),
    sound:has(SOUND, v.sound, 'lofi'), feel:has(FEEL, v.feel, 'rested'), budget:clamp(Math.round(+v.budget) || 1800, 500, 5000),
    style:has(STYLE, v.style, 'comfy'), month:clamp(Math.round(+v.month) || 0, 0, 11), nights:clamp(Math.round(+v.nights) || 7, 3, 8),
    destId:d.id, plan:{ days }
  };
}
function loadSaved(){
  try { return cleanTrip(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); } catch (e) { return null; }
}
let saved = loadSaved();
const resumeBtn = () => saved ? `<button class="btn btn-secondary" data-act="resume">Continue your ${esc(destById(saved.destId).name)} plan</button>` : '';

/* ---------- chrome: mood, 3D scene sync, stage nav ---------- */
function moodFor(stage){
  return stage === 'intro' ? 'start' : stage === 'field' ? 'dusk' : stage === 'game' ? (picked ? archetype().mood : 'start') : archetype().mood;
}
function anchorFor(stage){
  const a = (ANCHOR[stage] || ANCHOR.intro)[innerWidth <= 860 ? 1 : 0];   // same breakpoint as the single-column layout
  const k = innerWidth > 560 && innerWidth <= 860 ? .78 : 1;               // tablets in portrait: same layout as a phone, smaller orb
  return { x:a[0], y:a[1], s:a[2] * k };
}
/* the game's orb follows the round in view; round 2 also swells with the battery level */
function gameAnchor(){
  const a = anchorFor('r' + gRound);
  return gRound === 2 ? { x:a.x, y:a.y, s:a.s * (.72 + S.energy / 100 * .5) } : a;
}
const bagOn = stage => stage === 'game' ? gRound >= 3 : BAG_STAGES.has(stage);
function pushTraits(){ if (GL.ok) GL.setTraits({ window:S.window, energy:S.energy, sound:S.sound, feel:S.feel }); }
function syncGL(stage){
  if (!GL.ok) return;
  GL.setMood(moodFor(stage));
  pushTraits();
  GL.setBag(bagOn(stage) ? S.bag : []);
  GL.setAnchor(stage === 'game' ? gameAnchor() : anchorFor(stage));
  GL.setOrbVisible(stage !== 'field');
  GL.setFieldMode(stage === 'field');
  GL.kick(.8);
}
function paintHorizon(){          // CSS fallback scenery, used only when WebGL is unavailable
  const h = $('#horizon');
  h.classList.toggle('on', S.stage !== 'intro');
  $$('svg', h).forEach(s => s.classList.toggle('on', s.dataset.scene === S.window));
}
function paintChrome(){
  const g = GROUP[S.stage];
  $('#stages').innerHTML = STAGE_NAMES.map((n, i) => {
    const ok = i <= S.reached && (i !== 3 || S.plan);
    return `<button class="stagebtn ${i < g ? 'done' : ''}" data-nav="${i}" ${ok ? '' : 'disabled'} ${i === g ? 'aria-current="step"' : ''}><i></i><span>${n}</span></button>`;
  }).join('');
  $('#meta').textContent = S.stage === 'intro' ? 'Prototype · five places, made-up prices' : S.stage === 'field' ? 'Live · anonymous'
    : S.stage === 'game' ? `${touched.size} of 5 answered` : archetype().name;
  const fb = $('#fieldBtn'); if (S.stage === 'field') fb.setAttribute('aria-current', 'page'); else fb.removeAttribute('aria-current');
  FX.bind($('.top'));
}
function updateFieldCount(){
  const b = $('#fieldCount'); b.hidden = !BE.ready; if (BE.ready) b.textContent = BE.cards().length;
  $('#fieldBtn').setAttribute('aria-label', BE.ready ? `The field, ${BE.cards().length} ${plural(BE.cards().length, 'card', 'cards')} floating` : 'The field');
}

/* render a screen (inside the page curtain when there is one); returns the paused entrance timeline */
function render(stage, opts = {}){
  try {
    if (opts.before) opts.before();
    closeSheet(true); closePlace(true); unwatchGame();
    if (stage === 'field' && S.stage !== 'field') prevStage = S.stage;
    S.stage = stage;
    if (GROUP[stage] > S.reached) S.reached = GROUP[stage];
    if (stage === 'card') S.cardSeen = true;
    if (stage === 'game') gRound = 1;
    document.documentElement.classList.toggle('in-game', stage === 'game');
    document.documentElement.dataset.mood = moodFor(stage);
    syncGL(stage); paintHorizon(); paintChrome();
    stageEl.innerHTML = VIEWS[stage]();
    window.scrollTo(0, 0);
    if (AFTER[stage]) AFTER[stage]();
    FX.bind(stageEl);
    const tl = FX.enter(stageEl);
    if (opts.focus !== false){ const h = $('#h1'); if (h) h.focus({ preventScroll:true }); }
    return tl;
  } catch (e) { console.error(e); return null; }
}
let navBusy = false;
function go(stage, opts = {}){
  if (navBusy || (stage === S.stage && !opts.force)) return;
  if (opts.instant){ const tl = render(stage, opts); if (tl) tl.play(); return; }
  navBusy = true;
  const m = MOODS[moodFor(stage)] || MOODS.start;
  FX.curtain(STAGE_LABEL[stage] || '', m.accent, m.accentInk, () => render(stage, opts)).then(() => { navBusy = false; }, () => { navBusy = false; });
}

/* ---------- shared view pieces ---------- */
const CHECK = '<svg class="ck" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 8.4l3 3 6-6.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const packedText = () => touched.has(3) ? ['Nothing packed yet · pick up to three', '1 of 3 packed', '2 of 3 packed · room for one more', '3 of 3 packed · you travel light'][S.bag.length] : 'A suggested bag · change it or keep it';
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const dflt = n => touched.has(n) ? '' : ' <span class="muted">· default</span>';
const bagNames = () => S.bag.map(id => BAG.find(b => b.id === id).name.toLowerCase());
const marq = FEEL.map(f => `<span>${f.label}</span><span class="sep">✺</span>`).join('');

/* ---------- crowd: what other travelers said about a place ---------- */
function crowdHTML(r){
  const c = r.crowd, mine = BE.myReport(r.d.id);
  const body = c
    ? `<p class="small"><b>${c.n} ${plural(c.n, 'traveler', 'travelers')}</b> told us how ${esc(r.d.name)} felt.</p>
       <div class="tags">${c.top.map(([f, n]) => `<span class="tag">${esc((FEEL.find(x => x.id === f) || { label:f }).label)} · ${n}</span>`).join('')}</div>
       ${r.base !== undefined ? `<p class="fine">Feeling score: ${r.base} from your answers, ${r.feel} with their notes blended in.</p>` : ''}`
    : `<p class="small muted">${BE.ready ? `No traveler notes for ${esc(r.d.name)} yet.` : 'Traveler notes show up in the shared version of this page.'}</p>`;
  const btn = BE.ready ? `<button class="crowd-link" type="button" data-act="report" data-id="${r.d.id}">${mine ? 'Edit my note' : 'Been here? Share how it felt'}</button>` : '';
  return `<div class="crowd" data-crowd="${r.d.id}">${body}${btn}</div>`;
}

/* ---------- the game: one section per round ---------- */
const ROUND_BODY = {
  1: () => `<div class="arches" role="radiogroup" aria-label="Window view">
    ${WIN.map(w => `<label class="opt arch"><input type="radio" name="window" value="${w.id}" ${touched.has(1) && S.window === w.id ? 'checked' : ''}><span class="face"><span class="pic" data-liquid>${scene(w.id)}</span><span class="txt"><span class="nm"><i></i>${w.name}</span><span class="small muted">${w.sub}</span></span></span></label>`).join('')}
    </div>`,
  2: () => { const L = energyLevel();
    return `<div class="energy-read ${touched.has(2) ? '' : 'unset'}"><div class="num" id="enNum">${S.energy}%</div><p class="title" id="enWord">${energyWord(S.energy)}</p><p class="small muted" id="enHint">Plans about ${L.per} stops a day</p></div>
      <div class="battery" id="battery" role="slider" tabindex="0" aria-label="Energy level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${S.energy}" aria-valuetext="${S.energy} percent, ${energyWord(S.energy)}" style="--p:${S.energy / 100}"><div class="charge"></div><div class="knob" aria-hidden="true"><b></b><b></b></div></div>
      <div class="scale" aria-hidden="true"><span>Drained</span><span>Steady</span><span>Buzzing</span></div>
      <p class="rule">Low energy gives 2 stops a day · high energy gives 4</p>`; },
  3: () => `<div class="tiles" role="group" aria-label="Bag items, pick up to three">
    ${BAG.map(b => `<label class="opt tile"><input type="checkbox" name="bag" value="${b.id}" ${S.bag.includes(b.id) ? 'checked' : ''}><span class="face"><span class="gl">${icon(b.id)}</span><span class="nm">${b.name}</span><span class="ht">${b.hint}</span></span></label>`).join('')}
    </div><p class="rule packed" id="packed" aria-live="polite">${packedText()}</p>`,
  4: () => `<div class="sounds" role="radiogroup" aria-label="Soundtrack">
    ${SOUND.map(s => `<label class="opt sound"><input type="radio" name="sound" value="${s.id}" ${touched.has(4) && S.sound === s.id ? 'checked' : ''}><span class="face"><span class="wave" aria-hidden="true">${s.bars.map((h, i) => `<i style="--h:${h};--i:${i}"></i>`).join('')}</span><span class="nm">${s.name}</span><span class="ht">${s.hint}</span></span></label>`).join('')}
    </div>`,
  5: () => `<div class="sentence"><p class="display-l">I want to come home feeling</p><p class="fill"><span class="pill-word ${touched.has(5) ? '' : 'empty'}" id="pillWord" aria-live="polite">${touched.has(5) ? FEEL.find(f => f.id === S.feel).label.toLowerCase() : '…'}</span><span class="dot">.</span></p></div>
    <div class="chips" id="feelChips" role="radiogroup" aria-label="Feeling">
    ${FEEL.map(f => `<label class="opt chip" data-cursor=""><input type="radio" name="feel" value="${f.id}" ${touched.has(5) && S.feel === f.id ? 'checked' : ''}><span class="face">${f.label}</span></label>`).join('')}
    </div>`
};
const roundSection = r => `<section class="gr" id="gr${r.n}" data-n="${r.n}" aria-labelledby="gt${r.n}"><div class="gr-in" data-rise>
  <header class="gr-head"><p class="label muted gr-lbl">Round ${r.n} of 5<span class="tag gr-ok" hidden>Answered</span></p><h2 class="display-m" id="gt${r.n}" tabindex="-1">${r.title}</h2><p class="body-l muted">${r.sub}</p></header>
  <div class="gr-body">${ROUND_BODY[r.n]()}</div>
  ${r.n < 5 ? `<button class="btn btn-ghost btn-sm gr-next" type="button" data-act="gnext" data-n="${r.n}">Skip this round</button>` : ''}
</div></section>`;

/* ---------- views ---------- */
const VIEWS = {
  intro: () => `
  <section class="intro" aria-labelledby="h1">
    <div class="hero">
      <p class="label accent" data-fade>The core concept</p>
      <h1 class="display-xxl" id="h1" tabindex="-1" data-split>Plan your trip around <em>how you feel.</em></h1>
      <p class="body-l muted lead" data-fade>Travel sites start with “where to?” and “what dates?”. People travel to feel something: rested, inspired, free. MoodTrip reads your mood and energy in a one-minute game, then shapes your matches, your month and a plan that moves at your pace.</p>
      <div class="row" data-fade>
        <button class="btn btn-primary" data-act="start" data-cursor="Play">Start the feeling game</button>
        <button class="btn btn-ghost" data-act="skip">Skip the game</button>
        <span id="resumeSlot">${resumeBtn()}</span>
      </div>
      <div class="who" data-fade><span class="label muted">Who it’s for</span><span class="tag outline">Solo travelers</span><span class="tag outline">Couples</span><span class="tag outline">Burnt-out professionals</span></div>
    </div>
    <div class="marquee" aria-hidden="true"><div class="track">${marq}${marq}</div></div>
    <div>
      <div class="sec-head" data-rise><p class="label accent">What makes it different</p><h2 class="display-m">Feelings first. Honest numbers after.</h2></div>
      <div class="pillars">
        <article class="pillar" data-rise><span class="n">01</span><h3>Feeling first, as a game</h3><p class="small muted">Five quick rounds read your mood and energy. The page and 3D orb respond to every answer.</p></article>
        <article class="pillar" data-tilt data-rise><span class="n">02</span><h3>Real feelings from travelers</h3><p class="small muted">Anyone can add an anonymous note on how a place felt. Notes blend into the matches, and you can float your own card in the shared field.</p></article>
        <article class="pillar" data-tilt data-rise><span class="n">03</span><h3>Honest planning</h3><p class="small muted">Budget and best-time estimates sit right beside the plan, so you see the trade-offs early.</p></article>
      </div>
    </div>
    <p class="grow body-l" data-rise><b>How it could grow.</b> Free planning first, then partner bookings, travel-brand partnerships, or a premium tier with deeper personalization.</p>
    <ol class="flow" aria-label="How it works">
      <li data-rise><b>Feeling game</b><span class="small muted">Five rounds, about a minute</span></li>
      <li data-rise><b>Budget &amp; timing</b><span class="small muted">What you’d spend, and when</span></li>
      <li data-rise><b>Matches</b><span class="small muted">Top three, scored</span></li>
      <li data-rise><b>Planner</b><span class="small muted">Day by day, editable</span></li>
    </ol>
    <p class="fine" data-rise><b>Prototype limits.</b> Five destinations with made-up prices and best months. Costs exclude flights. Place notes are hand-written guides, not live listings. Traveler notes, reviews and field cards come from real visitors, so they start empty. No real map and no AI planner yet.</p>
  </section>`,

  game: () => `<section class="game" aria-labelledby="h1">
    <header class="game-head">
      <p class="label accent" data-fade>The feeling game</p>
      <h1 class="display-l" id="h1" tabindex="-1" data-split>Tell us how you want to <em>feel.</em></h1>
      <p class="body-l muted" data-fade>Five quick rounds on one page. Answer in any order and jump around with the steps below. The orb changes with every answer, and anything you skip gets a sensible default.</p>
      <div class="row" data-fade><button class="btn btn-ghost btn-sm" type="button" data-act="skip">Skip the game</button><button class="btn btn-ghost btn-sm" type="button" id="gStartOver" data-act="restart" ${touched.size ? '' : 'hidden'}>Start over</button></div>
    </header>
    <nav class="gp" id="gp" aria-label="Game progress"><div class="gp-in">
      <ol class="gp-steps">${ROUNDS.map(r => `<li><button class="gp-step" type="button" data-act="goround" data-n="${r.n}"><span class="gp-n" aria-hidden="true"><b class="no">${r.n}</b>${CHECK}</span><span class="gp-l">${r.key}</span></button></li>`).join('')}</ol>
      <div class="gp-bar" id="gpBar" role="progressbar" aria-label="Rounds answered" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${touched.size}"><i></i></div>
      <p class="gp-count" id="gpCount"></p>
      <button class="btn btn-primary btn-sm gp-go" id="gpGo" type="button" data-act="next" hidden>Reveal my card</button>
    </div></nav>
    ${ROUNDS.map(r => roundSection(r)).join('')}
    <footer class="gfoot">
      <p class="body-l" id="gSum"></p>
      <button class="btn btn-primary" id="gCta" type="button" data-act="next" data-cursor="Go">See my feeling card</button>
    </footer>
  </section>`,

  card: () => { const A = archetype(), snd = SOUND.find(s => s.id === S.sound);
    return `<section class="reveal" aria-labelledby="h1">
    <article class="postcard" data-tilt data-rot="-1.4" data-pop>
      <div class="pic" data-liquid>${scene(A.w.id)}<span class="stamp">MoodTrip · feeling card</span></div>
      <div class="pc-body">
        <p class="label muted">Your feeling</p>
        <h1 class="display-l" id="h1" tabindex="-1">${A.name}</h1>
        <div class="pc-meter"><div class="row"><span class="small muted">Energy</span><span class="small tnum"><b>${S.energy}%</b> · ${A.lvl.label} · ${A.lvl.per} stops a day</span></div><div class="bar"><i style="width:${S.energy}%"></i></div></div>
        <div class="row">${A.traits.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </div>
    </article>
    <div class="reveal-copy">
      <p class="label accent" data-fade>${touched.size === 5 ? 'Your five answers, added up' : 'Your answers, added up'}</p>
      <h2 class="display-m" data-split>${A.headline}</h2>
      <p class="body-l muted" data-fade>Next we’ll weigh this against what you can spend and when you can go, then match it to places that fit.</p>
      <dl class="picks" data-fade>
        <dt>Window</dt><dd>${A.w.name}${dflt(1)}</dd>
        <dt>Battery</dt><dd>${S.energy}%, ${A.lvl.label.toLowerCase()}${dflt(2)}</dd>
        <dt>Bag</dt><dd>${S.bag.length ? capFirst(bagNames().join(', ')) : 'Nothing, very light'}${dflt(3)}</dd>
        <dt>Soundtrack</dt><dd>${snd.name}${dflt(4)}</dd>
        <dt>Come home feeling</dt><dd>${A.f.label}${dflt(5)}</dd>
      </dl>
      <div class="row" data-fade><button class="btn btn-primary" data-act="next">Set budget &amp; timing</button><button class="btn btn-secondary" data-act="share">Share card</button><button class="btn btn-ghost" data-act="change">Change my answers</button></div>
      <textarea class="copybox" id="copybox" readonly hidden aria-label="Feeling card text, ready to copy"></textarea>
    </div></section>`; },

  budget: () => `<section aria-labelledby="h1">
    <header class="head"><p class="label accent" data-fade>Step 2 of 4</p><h1 class="display-l" id="h1" tabindex="-1" data-split>Budget and timing.</h1><p class="body-l muted" data-fade>Set what you’d spend and when you can go. Everything is per person, and flights are not included.</p></header>
    <div class="two">
      <div class="controls" data-fade>
        <div class="field">
          <div class="field-top"><label class="label muted" for="budget">Budget</label><span class="small muted">per person · flights not included</span></div>
          <div class="big-money" id="budgetVal">${money(S.budget)}</div>
          <input type="range" id="budget" min="500" max="5000" step="50" value="${S.budget}" aria-label="Total budget in US dollars">
          <div class="range-scale" aria-hidden="true"><span>$500</span><span>$5,000</span></div>
        </div>
        <div class="field"><p class="label muted" id="styleLbl">Travel style</p>
          <div class="styles" role="radiogroup" aria-labelledby="styleLbl">
          ${STYLE.map(s => `<label class="opt style"><input type="radio" name="style" value="${s.id}" ${S.style === s.id ? 'checked' : ''}><span class="face"><span class="nm">${s.name}</span><span class="ds">${s.desc}</span><span class="pd" id="sc-${s.id}"></span></span></label>`).join('')}
          </div></div>
        <div class="field"><p class="label muted" id="monthLbl">When</p>
          <div class="months" role="radiogroup" aria-labelledby="monthLbl">
          ${MONTHS.map((m, i) => `<label class="opt chip" data-cursor=""><input type="radio" name="month" value="${i}" ${S.month === i ? 'checked' : ''} aria-label="${MONTH_FULL[i]}"><span class="face">${m}</span></label>`).join('')}
          </div></div>
        <div class="field"><p class="label muted" id="lenLbl">Trip length</p>
          <div class="stepper" role="group" aria-labelledby="lenLbl"><button type="button" data-act="nights" data-d="-1" aria-label="One fewer night">−</button><output id="nightsOut" aria-live="polite"></output><button type="button" data-act="nights" data-d="1" aria-label="One more night">+</button></div></div>
      </div>
      <aside class="summary" aria-label="Your trip so far" data-pop>
        <p class="label muted">Your trip so far</p>
        <dl class="sum-rows">
          <div><dt>Feeling</dt><dd>${archetype().name}</dd></div>
          <div><dt>Energy</dt><dd>${S.energy}% · ${energyLevel().per} stops a day</dd></div>
          <div><dt>Budget</dt><dd id="sumBudget"></dd></div>
          <div><dt>Style</dt><dd id="sumStyle"></dd></div>
          <div><dt>When</dt><dd id="sumWhen"></dd></div>
        </dl>
        <div class="perday"><span class="small muted">About</span><b><span id="perDay"></span> a day</b><span class="small muted">before flights</span></div>
        <p class="status small" id="fit"></p>
        <button class="btn btn-primary" data-act="next">See my matches</button>
        <button class="btn btn-ghost btn-sm" data-act="back">Back to my feeling card</button>
      </aside>
    </div></section>`,

  matches: () => { const R = rank().slice(0, 3);
    const lvlWord = ['off season', 'a good month', 'a best month'];
    return `<section aria-labelledby="h1">
    <header class="head"><p class="label accent" data-fade>Step 3 of 4</p><h1 class="display-l" id="h1" tabindex="-1" data-split>Three places that feel like you.</h1>
      <p class="body-l muted" data-fade>Matched on your feeling, ${MONTH_FULL[S.month]}, and a ${money(S.budget)} budget.</p>
      <div class="formula" aria-label="How the match is weighed" data-fade><span class="tag">50% feeling</span><span class="tag">25% month</span><span class="tag">25% budget</span></div></header>
    <div class="cards">
    ${R.map((r, i) => { const over = r.cost.total > S.budget, diff = Math.abs(S.budget - r.cost.total), br = bestRange(r.d);
      const score = (name, v) => `<div class="score"><span>${name}</span><div class="bar"><i style="width:${v}%"></i></div><span class="tnum">${v}</span></div>`;
      return `<article class="dcard ${i === 0 ? 'first' : ''}" data-pop data-tilt><div class="pic" data-liquid>${scene(r.d.scene)}<span class="badge ${i === 0 ? 'first' : ''}">#${i + 1}${i === 0 ? ' · Best match' : ''}</span></div>
      <div class="dbody"><div class="dhead"><div><h2 class="heading">${r.d.name}</h2><p class="small muted">${r.d.country} · ${r.d.blurb}</p></div><div class="pct"><b>${r.match}%</b><span class="caption muted">match</span></div></div>
      <div class="scores">${score('Feeling', r.feel)}${score('Month', r.month)}${score('Budget', r.budget)}</div>
      <p class="small muted">${MONTH_FULL[S.month]} is ${lvlWord[mlevel(r.month)]} here${br ? ` · best ${br}` : ''}.</p>
      ${crowdHTML(r)}
      <div class="cost-line"><span class="small muted">Est. cost · ${S.nights} nights</span><span class="title tnum">${money(r.cost.total)}</span></div>
      <p class="status ${over ? 'warn' : 'ok'}">${over ? `${money(diff)} over budget` : `${money(diff)} under budget`}</p>
      <button class="btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}" data-act="plan" data-id="${r.d.id}" data-cursor="Plan">Plan this trip</button></div></article>`; }).join('')}
    </div>
    <div class="foot split" data-fade><button class="btn btn-ghost" data-act="back">Change budget or timing</button><p class="fine">Prototype data: prices and best months are illustrative. Costs exclude flights. Traveler notes come from other visitors.</p></div></section>`; },

  planner: () => `<section aria-labelledby="h1"><div id="plan">${plannerHTML()}</div></section>`,

  field: () => `<section class="field-view" aria-labelledby="h1">
    <div class="field-top">
      <p class="label accent" data-fade>Live · anonymous</p>
      <h1 class="display-l" id="h1" tabindex="-1" data-split>Everyone’s feeling, floating.</h1>
      <p class="body-l muted" id="fieldLead" data-fade></p>
    </div>
    <div class="field-bot" data-fade>
      <div class="field-actions" id="fieldActions"></div>
      <div class="detail" id="fieldDetail" hidden aria-live="polite"></div>
    </div>
    <ul class="sr" id="fieldList" aria-label="Feeling cards in the field"></ul>
  </section>`
};

/* ---------- the field: everyone's shared feeling cards ---------- */
function cardDetail(c){
  const w = WIN.find(x => x.id === c.w), f = FEEL.find(x => x.id === c.f), s = SOUND.find(x => x.id === c.s), d = c.d ? destById(c.d) : null;
  const bag = c.bag.map(id => BAG.find(b => b.id === id).name.toLowerCase());
  return `<p class="label accent">${c.mine ? 'Your card' : 'A traveler'}</p><h2 class="heading">${esc(c.name)}</h2>
    <dl><dt>Window</dt><dd>${w.name}</dd><dt>Energy</dt><dd>${c.e}% · ${energyLevel(c.e).label.toLowerCase()}</dd><dt>Wants to feel</dt><dd>${f.label}</dd>
    <dt>Soundtrack</dt><dd>${s.name}</dd><dt>Bag</dt><dd>${bag.length ? capFirst(bag.join(', ')) : 'Nothing, very light'}</dd>${d ? `<dt>Eyeing</dt><dd>${esc(d.name)}</dd>` : ''}</dl>`;
}
function showDetail(c){
  const el = $('#fieldDetail'); if (!el) return;
  if (!c){ el.hidden = true; return; }
  el.innerHTML = cardDetail(c); el.hidden = false;
  if (FX.on && !FX.reduced) gsap.fromTo(el, { y:18, opacity:0 }, { y:0, opacity:1, duration:.5, ease:'power3.out' });
}
function paintField(){
  if (S.stage !== 'field') return;
  const cards = BE.cards(), mine = BE.myCard(), n = cards.length;
  $('#fieldLead').textContent = !BE.ready ? 'The shared field lives in the signed-in version of this page. The rest of MoodTrip works on its own.'
    : !n ? 'Nobody has added a feeling card yet. Add yours and it floats here as an anonymous orb that others can hover and read.'
    : `${n} ${plural(n, 'traveler is', 'travelers are')} floating right now. Hover an orb to see their mood, click one to read their card.`;
  const a = $('#fieldActions');
  if (!BE.ready) a.innerHTML = `<button class="btn btn-secondary" data-act="fieldback">Back to my trip</button>`;
  else if (!BE.canPost) a.innerHTML = `<p class="small muted">You can look around, but adding a card is switched off for your access level. Ask the owner for Contributor access.</p><button class="btn btn-secondary" data-act="fieldback">Back to my trip</button>`;
  else if (!S.cardSeen && !mine) a.innerHTML = `<p class="small muted">Play the feeling game first, so your card says something true about you.</p><div class="row"><button class="btn btn-primary" data-act="start">Play the game</button><button class="btn btn-ghost" data-act="fieldback">Back</button></div>`;
  else a.innerHTML = `<div class="row">${mine
      ? `<button class="btn btn-primary" data-act="addcard">Update my card</button><button class="btn btn-secondary" data-act="removecard">Remove my card</button>`
      : `<button class="btn btn-primary" data-act="addcard">Add my card to the field</button>`}<button class="btn btn-ghost" data-act="fieldback">Back</button></div>
    <p class="fine">Shares your window, energy, up to three bag items, soundtrack, feeling and the place you’re eyeing. No name, no email. Remove it any time.</p>`;
  $('#fieldList').innerHTML = cards.map(c => `<li>${esc(c.name)}${c.mine ? ' (you)' : ''}: ${WIN.find(w => w.id === c.w).name}, energy ${c.e}%</li>`).join('');
  FX.bind($('#fieldActions'));
  if (GL.ok) GL.setField(cards);
}
const tip = $('#tip');
function tipFor(c){ const f = FEEL.find(x => x.id === c.f), d = c.d ? destById(c.d) : null; return `<b>${esc(c.name)}${c.mine ? ' · you' : ''}</b>${c.e}% energy · wants to feel ${f.label.toLowerCase()}${d ? ` · eyeing ${esc(d.name)}` : ''}`; }
function moveTip(x, y){
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.transform = `translate(${Math.max(8, Math.min(x + 18, innerWidth - w - 8))}px,${Math.max(8, Math.min(y + 18, innerHeight - h - 8))}px)`;
}
if (GL.ok){
  GL.hoverCb = c => {
    if (!c){ tip.hidden = true; return; }
    tip.innerHTML = tipFor(c); tip.hidden = false; moveTip(lastX, lastY);
  };
  GL.pickCb = c => { showDetail(c); say(`${c.name}. ${c.e}% energy.`); };
}
let lastX = 0, lastY = 0;
addEventListener('pointermove', e => { lastX = e.clientX; lastY = e.clientY; if (!tip.hidden) moveTip(lastX, lastY); }, { passive:true });

/* ---------- report sheet: how did a place feel? ---------- */
let sheetFor = null, sheetOpener = null;
const STRENGTH = ['A hint', 'Mild', 'Clearly', 'Strong', 'Deeply'];
function openReport(destId){
  const d = destById(destId); if (!d) return;
  sheetFor = destId; sheetOpener = document.activeElement;
  const mine = BE.myReport(destId), can = BE.canPost, feel = mine ? mine.feel : S.feel, score = mine ? mine.score : 3;
  $('#shBody').innerHTML = `
    <div><p class="label accent">Traveler note · anonymous</p><h2 class="heading" id="shTitle">How did ${esc(d.name)} make you feel?</h2>
    <p class="small muted" style="margin-top:8px">One note per place. Only the feeling and how strongly you felt it are shared, nothing else. You can change it later.</p></div>
    ${can ? `<form id="reportForm" class="rform" novalidate>
      <fieldset><legend class="label muted">The feeling</legend><div class="chips" role="radiogroup">${FEEL.map(f => `<label class="opt chip" data-cursor=""><input type="radio" name="rfeel" value="${f.id}" ${f.id === feel ? 'checked' : ''}><span class="face">${f.label}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend class="label muted">How strongly</legend><div class="strength" role="radiogroup">${STRENGTH.map((t, i) => `<label class="opt" data-cursor=""><input type="radio" name="rscore" value="${i + 1}" ${i + 1 === score ? 'checked' : ''}><span class="face">${i + 1}<small>${t}</small></span></label>`).join('')}</div></fieldset>
      <p class="notice" id="rerr" hidden></p>
      <div class="sheet-foot"><button type="button" class="btn btn-ghost" data-act="closesheet">Cancel</button><button class="btn btn-primary" type="submit" id="rsub">${mine ? 'Update my note' : 'Send my note'}</button></div>
    </form>` : `<p class="notice">${BE.ready ? 'Adding notes is switched off for your access level. Ask the owner for Contributor access.' : 'Notes need the shared version of this page.'}</p>
      <div class="sheet-foot"><button type="button" class="btn btn-secondary" data-act="closesheet">Close</button></div>`}`;
  const wrap = $('#sheet'); wrap.hidden = false;
  if (FX.on && !FX.reduced){ gsap.fromTo('.sheet-bd', { opacity:0 }, { opacity:1, duration:.3 }); gsap.fromTo('.sheet', { y:50, opacity:0, scale:.97 }, { y:0, opacity:1, scale:1, duration:.55, ease:'power4.out' }); }
  FX.bind(wrap);
  $('.sheet').focus();
}
function closeSheet(quiet){
  const wrap = $('#sheet'); if (wrap.hidden) return;
  wrap.hidden = true; sheetFor = null;
  if (!quiet && sheetOpener && sheetOpener.isConnected) sheetOpener.focus({ preventScroll:true });
  sheetOpener = null;
}
async function submitReport(form){
  const feel = form.elements.rfeel.value, score = +form.elements.rscore.value, btn = $('#rsub'), err = $('#rerr');
  if (!feel || !score){ err.textContent = 'Pick a feeling and how strongly you felt it.'; err.hidden = false; return; }
  btn.disabled = true; err.hidden = true;
  try {
    await BE.submitReport(sheetFor, feel, score);
    const d = destById(sheetFor), n = CROWD[sheetFor] ? CROWD[sheetFor].n : 1;
    closeSheet(); toast(`Thanks. Your note on ${d.name} is in, with ${n} ${plural(n, 'traveler', 'travelers')} so far.`);
  } catch (e) { err.textContent = BE.explain(e); err.hidden = false; btn.disabled = false; }
}

/* ---------- place panel: what a stop is like, plus live traveler reviews ---------- */
const STAR_WORDS = ['Poor', 'Fair', 'Good', 'Great', 'Superb'];
const REV_SHOWN = 6;
let placeId = null, placeOpener = null, revAll = false, lastPost = 0, agoTimer = 0, seenRev = null;   // seenRev: reviews already on screen (null until the first live load)
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function ago(ms){
  if (!ms) return '';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); if (s < 45) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); return d < 30 ? `${d} ${plural(d, 'day', 'days')} ago` : new Date(ms).toLocaleDateString('en-US', { month:'short', year:'numeric' });
}
const starsHTML = v => `<span class="stars" style="--p:${Math.round(v / 5 * 100)}%" role="img" aria-label="${avgText(v)} out of 5"></span>`;
const revKey = x => x.uid + '|' + x.pid + '|' + x.at;
function revItemHTML(x, fresh){
  const f = x.f && FEEL.find(k => k.id === x.f);
  return `<li class="rv${fresh ? ' fresh' : ''}${x.mine ? ' mine' : ''}"><div class="rv-top">${starsHTML(x.r)}<b>${esc(x.name)}${x.mine ? ' · you' : ''}</b>${x.at ? `<time datetime="${new Date(x.at).toISOString()}">${ago(x.at)}</time>` : ''}</div>${f ? `<span class="tag">Felt ${esc(f.label.toLowerCase())}</span>` : ''}${x.t ? `<p>${esc(x.t)}</p>` : ''}${x.ph ? `<a class="rv-photo" href="/_blob/${x.ph}" target="_blank" rel="noopener" aria-label="Open this photo in a new tab"><img class="rev-img" src="/_blob/${x.ph}" alt="Photo shared with this review" loading="lazy" decoding="async"></a>` : ''}</li>`;
}
const photosOf = R => R.list.filter(x => x.ph);
function photoStripHTML(R){
  const ph = photosOf(R); if (ph.length < 2) return '';
  return `<div class="ph-strip"><p class="label muted">Traveler photos · ${ph.length}</p><ul>${ph.slice(0, 10).map(x => `<li><a href="/_blob/${x.ph}" target="_blank" rel="noopener" aria-label="Open a traveler photo in a new tab"><img class="rev-img" src="/_blob/${x.ph}" alt="Traveler photo" loading="lazy" decoding="async"></a></li>`).join('')}</ul></div>`;
}
function reviewsHTML(pid, title){
  if (!BE.ready) return '<p class="small muted">Reviews need the shared version of this page. Once it is connected, what travelers say about this place appears here as they post it.</p>';
  if (!BE.reviewsAt) return '<p class="small muted">Connecting to the live reviews…</p>';
  const R = BE.reviewsFor(pid);
  if (!R.n) return `<div class="rev-empty"><p class="title">No reviews yet</p><p class="small muted">Nobody has reviewed ${esc(title)} so far. Been there? Be the first to tell the next traveler what it is really like.</p></div>`;
  const list = revAll ? R.list : R.list.slice(0, REV_SHOWN), newest = R.list[0];
  const fresh = x => !!seenRev && !seenRev.has(revKey(x));
  return `<div class="agg"><div class="agg-main"><b class="agg-num">${avgText(R.avg)}</b>${starsHTML(R.avg)}<small>${R.n} ${plural(R.n, 'review', 'reviews')}${newest.at ? ` · latest ${ago(newest.at)}` : ''}</small></div>
    <ul class="dist" aria-label="Rating breakdown">${[5, 4, 3, 2, 1].map(v => `<li><span>${v}</span><i><u style="width:${R.dist[v - 1] / R.n * 100}%"></u></i><span class="tnum">${R.dist[v - 1]}</span></li>`).join('')}</ul></div>
    ${photoStripHTML(R)}
    <ul class="rvs">${list.map(x => revItemHTML(x, fresh(x))).join('')}</ul>
    ${R.n > REV_SHOWN ? `<button type="button" class="crowd-link" data-act="morerev">${revAll ? 'Show fewer reviews' : `Show all ${R.n} reviews`}</button>` : ''}`;
}
/* ---------- review photos: picked, shrunk in the browser, uploaded as an asset only when the review is posted ---------- */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
let photo = { blob:null, url:null, remove:false };
function resetPhoto(){ if (photo.url){ try { URL.revokeObjectURL(photo.url); } catch (e) {} } photo = { blob:null, url:null, remove:false }; }
function photoFieldHTML(mine){
  const has = !!(mine && mine.ph);
  return `<div class="pphoto" id="pPhoto"><span class="label muted">A photo · optional</span>
    <div class="pp-row">
      <div class="pp-thumb" id="ppThumb" ${has ? '' : 'hidden'}><img id="ppImg" class="pp-img" alt="Your photo" ${has ? `src="/_blob/${mine.ph}"` : ''}><button type="button" class="icon-btn" data-act="phremove" aria-label="Remove photo">×</button></div>
      <input type="file" id="pfile" class="sr" accept="image/jpeg,image/png,image/webp,image/gif"><label for="pfile" class="btn btn-secondary btn-sm pp-pick" id="ppBtn">${has ? 'Change photo' : 'Add a photo'}</label>
    </div>
    <small class="fine" id="ppNote">JPEG, PNG, WebP or GIF. It is shrunk to fit before it is uploaded.</small></div>`;
}
function paintPhotoField(note, bad){
  const thumb = $('#ppThumb'), img = $('#ppImg'), btn = $('#ppBtn'), n = $('#ppNote'); if (!thumb) return;
  const mine = BE.myReview(pidOf(S.plan.days[locate(placeId)[0]].stops[locate(placeId)[1]]));
  const shown = photo.blob ? photo.url : (!photo.remove && mine && mine.ph ? '/_blob/' + mine.ph : null);
  thumb.hidden = !shown; if (shown) img.src = shown;
  btn.textContent = shown ? 'Change photo' : 'Add a photo';
  n.textContent = note || 'JPEG, PNG, WebP or GIF. It is shrunk to fit before it is uploaded.';
  n.classList.toggle('bad', !!bad);
}
async function shrinkPhoto(file, max = 1280){
  let bmp = null;
  try { bmp = await createImageBitmap(file); } catch (e) {}
  let w, h, src;
  if (bmp){ w = bmp.width; h = bmp.height; src = bmp; }
  else {                                            // older browsers: decode through an <img>
    const u = URL.createObjectURL(file);
    try { src = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = u; }); w = src.naturalWidth; h = src.naturalHeight; }
    finally { URL.revokeObjectURL(u); }
  }
  if (!w || !h) throw new Error('empty');
  const k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height);
  if (bmp && bmp.close) bmp.close();
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', .82));
  if (!blob) throw new Error('encode');
  return blob;
}
async function pickPhoto(file){
  if (!file || !placeId) return;
  if (!PHOTO_TYPES.includes(file.type)){ paintPhotoField('Pick a JPEG, PNG, WebP or GIF image.', true); return; }
  if (file.size > 30 * 1024 * 1024){ paintPhotoField('That file is very large. Pick a smaller photo.', true); return; }
  paintPhotoField('Preparing your photo…');
  try {
    const blob = await shrinkPhoto(file);
    if (!placeId) return;
    resetPhoto(); photo = { blob, url:URL.createObjectURL(blob), remove:false };
    paintPhotoField(`Ready · ${Math.max(1, Math.round(blob.size / 1024))} KB. It uploads when you post.`);
  } catch (e) { paintPhotoField('Could not read that image. Try a JPEG or PNG.', true); }
}
function setReviewForm(pid){
  resetPhoto(); const box = $('#plForm'); if (!box) return;
  box.innerHTML = reviewFormHTML(pid); FX.bind(box);
}
function reviewFormHTML(pid){
  if (!BE.canPost) return `<p class="notice">${BE.ready ? 'Posting reviews is switched off for your access level. Ask the owner for Contributor access.' : 'Reviews need the shared version of this page.'}</p>`;
  const mine = BE.myReview(pid), rate = mine ? mine.r : 0, feel = mine && mine.f || '', text = mine ? mine.t : '';
  return `<form id="placeForm" class="rform pform" novalidate>
    <p class="label muted">${mine ? 'Your review' : 'Been here? Add yours'}</p>
    <fieldset><legend class="sr">Your rating</legend><div class="strength rate-pick" role="radiogroup">${STAR_WORDS.map((w, i) => `<label class="opt" data-cursor=""><input type="radio" name="prate" value="${i + 1}" ${i + 1 === rate ? 'checked' : ''}><span class="face"><span class="sr">${i + 1} ${plural(i + 1, 'star', 'stars')}, </span><span class="pnr" aria-hidden="true">${i + 1}<i class="rstar"></i></span><small>${w}</small></span></label>`).join('')}</div></fieldset>
    <fieldset><legend class="label muted">How did it feel? Optional</legend><div class="chips" role="radiogroup"><label class="opt chip" data-cursor=""><input type="radio" name="pfeel" value="" ${feel ? '' : 'checked'}><span class="face">Skip</span></label>${FEEL.map(f => `<label class="opt chip" data-cursor=""><input type="radio" name="pfeel" value="${f.id}" ${f.id === feel ? 'checked' : ''}><span class="face">${f.label}</span></label>`).join('')}</div></fieldset>
    <label class="tfield"><span class="label muted">In your words · optional</span><textarea name="ptext" rows="3" maxlength="240" placeholder="What was it like? A line or two helps the next traveler.">${esc(text)}</textarea><small class="count tnum" id="pcount">${text.length} / 240</small></label>
    ${BE.canPhoto ? photoFieldHTML(mine) : ''}
    <p class="notice" id="perr" hidden></p>
    <div class="sheet-foot">${mine ? '<button type="button" class="btn btn-ghost btn-sm" data-act="delreview">Delete my review</button>' : ''}<button class="btn btn-primary btn-sm" type="submit" id="psub">${mine ? 'Update my review' : 'Post review'}</button></div>
  </form>`;
}
/* A free-text Maps search can put an ad or a look-alike first, so a stop with a named venue opens that exact place by its Place ID
   (query_place_id wins over the text). Stops with no venue keep a plain search and say so. */
const mapsUrl = (title, d) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${title}, ${d.name}, ${d.country}`);
const spotUrl = sp => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(sp.name) + '&query_place_id=' + encodeURIComponent(sp.gid);
const ICON_OUT = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 3h7v7M13 3 4 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function spotHTML(sp){
  return `<section class="pl-spot" aria-labelledby="plSpotH"><p class="label accent" id="plSpotH">Our pick</p><h3 class="title">${esc(sp.name)}</h3>
    <a class="gmap" href="${esc(spotUrl(sp))}" target="_blank" rel="noopener noreferrer">Open on Google Maps${ICON_OUT}</a>
    ${GOOGLE_ON ? `<div class="gg" id="plGoogle" data-gid="${esc(sp.gid)}" aria-live="polite"><p class="fine">Loading Google Maps details…</p></div>`
                : '<p class="fine">Opens this exact place in a new tab. Its Google reviews, photos and opening hours live there, not in this page.</p>'}</section>`;
}
const genericMapHTML = (s, d) => `<a class="gmap" href="${esc(mapsUrl(s.title, d))}" target="_blank" rel="noopener noreferrer">Search Google Maps${ICON_OUT}</a>
      <p class="fine">Opens a text search in a new tab. Search results can include ads, so check the name before you go.</p>`;

/* ---------- Google Maps details: the Cloudflare build only. Its own server holds the API key and hands back rating, photos and reviews.
   Google's rules apply: every photo and review keeps its author, review text is shown as returned, the "Google Maps" mark stays on the block,
   and nothing is saved beyond this page view. ---------- */
const GOOGLE_ON = !!window.MT_GOOGLE;
const G_IMG = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.googleusercontent\.com\//i, G_LINK = /^https:\/\/(www\.google\.com|maps\.google\.com|google\.com)\//i, LANG_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;
const gOK = (u, re) => typeof u === 'string' && re.test(u) ? u : '';
const gcache = new Map();
const nf = new Intl.NumberFormat('en');
function gAuthor(a, strong){
  const name = esc((a && a.name) || 'A Google Maps user'), url = gOK(a && a.url, G_LINK);
  const t = url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${name}</a>` : name;
  return strong ? `<b>${t}</b>` : t;
}
function googleHTML(g, sp){
  const n = Math.max(0, +g.count || 0), rate = +g.rating > 0;
  const head = rate ? `<div class="gg-head"><b class="gg-num">${avgText(+g.rating)}</b>${starsHTML(+g.rating)}<small>${nf.format(n)} Google ${plural(n, 'review', 'reviews')}</small></div>` : '';
  const photos = (Array.isArray(g.photos) ? g.photos : []).filter(p => p && typeof p.ref === 'string').slice(0, 6).map(p => {
    const ref = encodeURIComponent(p.ref), who = (p.by && p.by.name) || 'a Google Maps user';
    return `<li><a class="ph" href="/api/photo?ref=${ref}&amp;w=1600" target="_blank" rel="noopener" aria-label="Open a larger photo of ${esc(sp.name)} by ${esc(who)}"><img src="/api/photo?ref=${ref}&amp;w=480" alt="${esc(sp.name)}, photo by ${esc(who)}" loading="lazy" decoding="async"></a><small>${gAuthor(p.by, false)}</small></li>`;
  }).join('');
  const revs = (Array.isArray(g.reviews) ? g.reviews : []).slice(0, 5).map(r => {
    const av = gOK(r.by && r.by.avatar, G_IMG), flag = gOK(r.flag, G_LINK), moved = r.o && r.ol && r.tl && r.ol !== r.tl && LANG_RE.test(r.ol);
    return `<li class="gg-rv"><div class="gg-top">${av ? `<img class="gg-av" src="${esc(av)}" alt="" width="32" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}<div>${gAuthor(r.by, true)}<span>${+r.rating > 0 ? starsHTML(+r.rating) : ''}${r.when ? esc(r.when) : ''}</span></div></div>
      ${r.t ? `<p>${esc(r.t)}</p>` : ''}${moved ? `<details class="gg-orig"><summary>Translated by Google · see original</summary><p lang="${esc(r.ol)}">${esc(r.o)}</p></details>` : ''}${flag ? `<a class="gg-flag" href="${esc(flag)}" target="_blank" rel="noopener noreferrer">Report this review</a>` : ''}</li>`;
  }).join('');
  const hours = Array.isArray(g.hours) && g.hours.length ? `<details class="gg-hours"><summary>Opening hours</summary><ul>${g.hours.slice(0, 7).map(h => `<li>${esc(h)}</li>`).join('')}</ul></details>` : '';
  const link = gOK(g.url, G_LINK) || spotUrl(sp);
  return `${head}${photos ? `<ul class="gg-photos" aria-label="Photos from Google Maps">${photos}</ul>` : ''}${hours}${revs ? `<ul class="gg-revs">${revs}</ul>` : ''}
    <p class="gg-attr"><span class="gg-mark" translate="no">Google Maps</span><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">See all reviews and photos${ICON_OUT}</a></p>`;
}
async function loadGoogle(sp){
  const mount = () => { const b = $('#plGoogle'); return b && b.dataset.gid === sp.gid ? b : null; };
  if (!GOOGLE_ON || !mount()) return;
  let g = gcache.get(sp.gid);
  if (!g){
    try {
      const res = await fetch('/api/place?id=' + encodeURIComponent(sp.gid), { headers:{ accept:'application/json' } });
      if (res.status === 503){ const b = mount(); if (b) b.remove(); try { console.info('MoodTrip: set GOOGLE_PLACES_API_KEY on the server to show Google reviews and photos.'); } catch (e) {} return; }
      if (!res.ok) throw new Error(String(res.status));
      g = await res.json(); gcache.set(sp.gid, g);
    } catch (e) { const b = mount(); if (b) b.innerHTML = '<p class="fine">Google Maps details are not available right now. The button above still opens the place.</p>'; return; }
  }
  const b = mount(); if (b) b.innerHTML = googleHTML(g, sp);
}
function placeHTML(s, k, i){
  const d = S.dest, n = S.plan.days[k].stops.length, pid = pidOf(s), info = pid ? placeInfo(d.id, s.title) : null, cost = stopCost(s), spot = info ? spotOf(d.id, s.title) : null;
  const facts = [['When', `Day ${k + 1} · ${fmtHour(slotHour(i, n))}`], ['Cost', cost ? `${money(cost)}` : 'Free'], info && ['Usually', info.time], s.part && ['Best time', cap(PART_WORD[s.part])]].filter(Boolean);
  return `<div class="pl-top"><div><p class="label accent">${info ? esc(info.cat) : 'Your own stop'} · ${esc(d.name)}</p><h2 class="heading" id="plTitle">${esc(s.title)}</h2></div>
      <button type="button" class="icon-btn pl-close" data-act="closeplace" aria-label="Close place details" data-cursor="Close">×</button></div>
    <div class="pl-scroll">
      <dl class="pl-facts">${facts.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
      <p class="pl-about">${info ? esc(info.about) : 'You added this stop yourself, so there is no guide entry or traveler reviews for it. You can still move it or remove it in your plan.'}</p>
      ${info ? `<div class="pl-tip"><p class="label muted">Local tip</p><p>${esc(info.tip)}</p></div><p class="fine">A hand-written guide note for this prototype, not a live listing. Times and prices are typical, so check hours and tickets before you go.</p>
      ${spot ? spotHTML(spot) : genericMapHTML(s, d)}` : ''}
      ${pid ? `<section class="pl-rev" aria-labelledby="plRevH">
        <div class="pl-rev-head"><h3 class="title" id="plRevH">Traveler reviews</h3><span class="live ${BE.ready ? '' : 'off'}" id="plLive"><i aria-hidden="true"></i>${BE.ready ? 'Live' : 'Offline'}</span></div>
        <div id="plReviews">${reviewsHTML(pid, s.title)}</div>
        <div id="plForm">${reviewFormHTML(pid)}</div>
      </section>` : ''}
    </div>`;
}
function lockScroll(on){
  const root = document.documentElement;
  if (on){ root.style.setProperty('--sbw', Math.max(0, innerWidth - root.clientWidth) + 'px'); root.classList.add('pl-open'); }
  else { root.classList.remove('pl-open'); root.style.removeProperty('--sbw'); }
}
function openPlace(id, opener){
  const loc = locate(id); if (!loc || S.stage !== 'planner') return;
  const [k, i] = loc, s = S.plan.days[k].stops[i], pid = pidOf(s);
  closeSheet(true);
  placeId = id; placeOpener = opener || document.activeElement; revAll = false; resetPhoto();
  seenRev = BE.reviewsAt ? new Set(pid ? BE.reviewsFor(pid).list.map(revKey) : []) : null;
  $('#plBody').innerHTML = placeHTML(s, k, i);
  const wrap = $('#place'); wrap.hidden = false; lockScroll(true);
  const panel = $('.place'), narrow = innerWidth <= 760;
  if (FX.on && !FX.reduced){
    gsap.fromTo('.place-bd', { opacity:0 }, { opacity:1, duration:.3 });
    gsap.fromTo(panel, narrow ? { yPercent:12, opacity:0 } : { xPercent:8, opacity:0 }, { yPercent:0, xPercent:0, opacity:1, duration:.55, ease:'power4.out', clearProps:'transform,opacity' });
  }
  FX.bind(wrap);
  panel.focus({ preventScroll:true });
  const sp = pid ? spotOf(S.dest.id, s.title) : null; if (sp) loadGoogle(sp);
  clearInterval(agoTimer); agoTimer = setInterval(paintReviews, 20000);
  say(`${s.title}. Place details${pid ? ' and traveler reviews' : ''}.`);
}
function closePlace(quiet){
  const wrap = $('#place'); if (wrap.hidden) return;
  const id = placeId; wrap.hidden = true; placeId = null; resetPhoto(); clearInterval(agoTimer); lockScroll(false);
  const back = placeOpener && placeOpener.isConnected ? placeOpener : id ? $(`.stop-main[data-id="${id}"]`) : null;
  placeOpener = null;
  if (!quiet && back) back.focus({ preventScroll:true });
}
/* The list can change underneath the reader at any moment (that is the point), so only the reviews area is redrawn. The form is left alone. */
function paintReviews(){
  if (!placeId) return;
  const loc = locate(placeId); if (!loc) return;
  const s = S.plan.days[loc[0]].stops[loc[1]], pid = pidOf(s), box = $('#plReviews'); if (!pid || !box) return;
  const R = BE.reviewsFor(pid), others = seenRev ? R.list.filter(x => !x.mine && !seenRev.has(revKey(x))) : [];
  const scroller = $('.pl-scroll'), top = scroller ? scroller.scrollTop : 0;
  box.innerHTML = reviewsHTML(pid, s.title);
  if (scroller) scroller.scrollTop = top;
  if (BE.reviewsAt){ if (!seenRev) seenRev = new Set(); R.list.forEach(x => seenRev.add(revKey(x))); }
  const live = $('#plLive'); if (live){ live.classList.toggle('off', !BE.ready); live.lastChild.textContent = BE.ready ? 'Live' : 'Offline'; }
  if (others.length) say(`${others.length} new ${plural(others.length, 'review', 'reviews')} of ${s.title}.`);
}
function paintStopRatings(){
  $$('[data-rate]').forEach(el => { const h = rateHTML(el.dataset.rate); if (el.innerHTML !== h) el.innerHTML = h; });
}
async function submitReview(form){
  const err = $('#perr'), btn = $('#psub'), r = +(form.elements.prate.value || 0), f = form.elements.pfeel.value || null, t = form.elements.ptext.value;
  const pid = placeId, loc = pid && locate(pid), s = loc && S.plan.days[loc[0]].stops[loc[1]], realPid = s && pidOf(s);
  if (!realPid) return;
  if (!(r >= 1 && r <= 5)){ err.textContent = 'Pick a star rating first.'; err.hidden = false; return; }
  if (Date.now() - lastPost < 4000){ err.textContent = 'One moment, you just posted. Try again in a few seconds.'; err.hidden = false; return; }
  btn.disabled = true; err.hidden = true;
  const old = BE.myReview(realPid), oldPh = old && old.ph || null, label = btn.textContent;
  let ph = photo.remove ? null : oldPh, fresh = null;
  try {
    if (photo.blob){ btn.textContent = 'Uploading photo…'; fresh = await BE.uploadPhoto(photo.blob); ph = fresh; btn.textContent = label; }
    await BE.submitReview(realPid, { r, t, f, ph });
    lastPost = Date.now();
    if (oldPh && oldPh !== ph) BE.dropPhoto(oldPh);
    if (placeId === pid) setReviewForm(realPid);
    paintStopRatings(); toast(`Thanks. Your review of ${s.title} is live.`);
  } catch (e) {
    if (fresh) BE.dropPhoto(fresh);                       // the review was not saved, so do not leave the upload behind
    btn.textContent = label; err.textContent = BE.explain(e); err.hidden = false; btn.disabled = false;
  }
}
async function deleteReview(btn){
  const loc = placeId && locate(placeId), s = loc && S.plan.days[loc[0]].stops[loc[1]], pid = pidOf(s); if (!pid) return;
  btn.disabled = true;
  const mine = BE.myReview(pid);
  try { await BE.removeReview(pid); if (mine && mine.ph) BE.dropPhoto(mine.ph); if (placeId) setReviewForm(pid); paintStopRatings(); toast('Your review was removed.'); }
  catch (e) { toast(BE.explain(e)); btn.disabled = false; }
}

/* ---------- planner views ---------- */
const COST_PARTS = [['Stays', 'stays', 'var(--accent)'], ['Food', 'food', 'var(--glow)'], ['Stops', 'stops', 'color-mix(in srgb,var(--accent) 45%,var(--surface))'], ['Local transport', 'trans', 'color-mix(in srgb,var(--ink) 55%,var(--surface))']];

function plannerHTML(){
  const d = S.dest, P = S.plan, A = archetype(), C = planCost(d, P), n = P.days.length;
  const left = S.budget - C.total, over = left < 0, tight = !over && left < S.budget * .1;
  const scale = Math.max(C.total, S.budget), markPct = S.budget / scale * 100;
  const lvM = mlevel(d.months[S.month]), br = bestRange(d);
  const verdict = lvM === 2 ? `${MONTH_FULL[S.month]} is one of the best months for ${d.name}.`
    : lvM === 1 ? `${MONTH_FULL[S.month]} is a good month for ${d.name}${br ? `, with the best weather in ${br}` : ''}.`
    : `${MONTH_FULL[S.month]} is off season for ${d.name}${br ? `. Best time: ${br}` : ''}.`;
  return `
  <div class="plan-head">
    <div class="head" style="margin:0">
      <button class="btn btn-ghost btn-sm btn-back" data-act="tomatches">← Back to matches</button>
      <p class="label accent" data-fade>Step 4 of 4 · your plan</p>
      <h1 class="display-l" id="h1" tabindex="-1" data-split>${d.name}, ${d.country}</h1>
      <p class="body-l muted" data-fade>${n} ${n === 1 ? 'night' : 'nights'} · ${MONTH_FULL[S.month]} · ${A.name} · ${A.lvl.label.toLowerCase()} energy · ${A.lvl.per} stops a day</p>
    </div>
    <div class="actions" data-fade><button class="btn btn-secondary btn-sm" data-act="reset">Reset</button><button class="btn btn-secondary btn-sm" data-act="addday">Add a day</button><button class="btn btn-primary btn-sm" data-act="save">Save plan</button></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:16px;margin-top:32px">
    <div class="panel" data-pop>
      <div class="cost-top"><div><p class="label muted">Estimated cost · per person</p><p class="cost-big">${money(C.total)} <span>of ${money(S.budget)}</span></p></div>
        <p class="status ${over ? 'warn' : 'ok'}" role="status">${over ? `Over budget · ${money(-left)} over` : tight ? `Within budget, but tight · ${money(left)} left` : `Within budget · ${money(left)} left`}</p></div>
      <div class="cost-bar-wrap"><div class="cbar" role="img" aria-label="Cost split: ${COST_PARTS.map(([l, k]) => `${l} ${money(C[k])}`).join(', ')}">
        ${COST_PARTS.map(([l, k, c]) => `<i style="width:${C[k] / scale * 100}%;background:${c}"></i>`).join('')}
        <span class="mark ${markPct > 92 ? 'end' : ''}" style="left:calc(${markPct}% - 1px)"></span></div></div>
      <div class="legend">${COST_PARTS.map(([l, k, c]) => `<span><i style="background:${c}"></i>${l} <b>${money(C[k])}</b></span>`).join('')}</div>
      <p class="fine">Flights not included. Stops are priced for the “${STYLE[styleIdx()].name}” style. Prototype data is illustrative.</p>
    </div>
    <div class="panel" data-pop>
      <div class="cost-top"><div><p class="label muted">Best time to go · ${d.name}</p><p class="title" style="margin-top:4px">${verdict}</p></div><p class="small muted">Tap a month to try it</p></div>
      <div class="mgrid" role="radiogroup" aria-label="Travel month">
      ${MONTHS.map((m, i) => { const l = mlevel(d.months[i]); return `<button class="mcell ${['off', 'good', 'best'][l]} ${i === S.month ? 'sel' : ''}" role="radio" aria-checked="${i === S.month}" data-act="month" data-m="${i}" aria-label="${MONTH_FULL[i]}, ${['off season', 'good', 'best'][l]}">${m}<small>${['Off', 'Good', 'Best'][l]}</small></button>`; }).join('')}
      </div>
    </div>
    <div class="panel" data-pop id="crowdPanel">${crowdPanelHTML(d)}</div>
    <div class="days">
      ${P.days.map(dayHTML).join('')}
      <button class="add-day" data-act="addday">＋ Add a day</button>
    </div>
  </div>`;
}
function crowdPanelHTML(d){
  return `<div class="cost-top"><div><p class="label muted">What travelers felt here</p><p class="title" style="margin-top:4px">Notes from other visitors on ${esc(d.name)}</p></div></div>${crowdHTML({ d, crowd:crowdFor(d) })}`;
}
function dayHTML(day, k){
  const n = day.stops.length;
  return `<section class="day" data-day="${k}" aria-label="Day ${k + 1}: ${esc(day.title)}">
    <div class="day-head"><div><p class="label muted">Day ${k + 1}</p><h3 class="title">${esc(day.title)}</h3></div>
      <button class="icon-btn" data-act="rmday" data-day="${k}" aria-label="Remove day ${k + 1}" ${S.plan.days.length < 2 ? 'disabled' : ''}>×</button></div>
    <ol class="stops" data-day="${k}">${n ? day.stops.map((s, i) => stopHTML(s, i, n)).join('') : '<li class="empty">No stops yet. Add one below, or drag one in.</li>'}</ol>
    <button class="btn btn-secondary btn-sm" data-act="adder" data-day="${k}" aria-expanded="${S.adder === k}">＋ Add a stop</button>
    ${S.adder === k ? adderHTML(k) : ''}
  </section>`;
}
/* a stop's guide entry and review id come from its title, so a saved or edited plan can never point reviews at the wrong place */
const pidMaps = new WeakMap();
function pidOf(s){
  if (!s || s.custom || !S.dest) return null;
  let m = pidMaps.get(S.dest); if (!m){ m = new Map(catalog(S.dest).map(c => [c.title, c.id])); pidMaps.set(S.dest, m); }
  return m.get(s.title) || null;
}
const avgText = v => (Math.round(v * 10) / 10).toFixed(1);
function rateHTML(pid){
  if (!pid || !BE.ready) return '';
  const R = BE.reviewsFor(pid);
  return R.n ? `<span class="rate" title="${avgText(R.avg)} out of 5 from ${R.n} ${plural(R.n, 'traveler', 'travelers')}"><i class="rstar" aria-hidden="true"></i>${avgText(R.avg)}<small>(${R.n})</small></span>` : '';
}
const CHEV = '<svg class="chev" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 1.5L6.5 7l-5 5.5"/></svg>';
function stopHTML(s, i, n){
  const h = slotHour(i, n), cost = stopCost(s), pid = pidOf(s);
  const mis = s.part && partGap(s.part, slotPart(h)) >= 2 ? `Best in the ${PART_WORD[s.part]}` : '';
  return `<li class="stop" data-id="${esc(s.id)}">
    <button class="grip" data-id="${esc(s.id)}" aria-label="Move ${esc(s.title)}. Drag, or use the up and down arrow keys." data-cursor="Drag">${GRIP}</button>
    <button class="stop-main" type="button" data-act="place" data-id="${esc(s.id)}" data-cursor="Open" aria-haspopup="dialog" aria-label="${esc(s.title)}, ${fmtHour(h)}, ${cost ? money(cost) : 'free'}. Open place details${pid ? ' and reviews' : ''}">
      <span class="sm-text"><span class="time">${fmtHour(h)}</span><span class="st">${esc(s.title)}</span><span class="sub">${mis ? `<span class="hint">${mis}</span>` : ''}<span class="rate-slot" data-rate="${esc(pid || '')}">${rateHTML(pid)}</span></span></span>
      <span class="price ${cost ? '' : 'free'}">${cost ? money(cost) : 'Free'}</span>${CHEV}
    </button>
    <button class="icon-btn" data-act="rmstop" data-id="${esc(s.id)}" aria-label="Remove ${esc(s.title)}">×</button></li>`;
}
function adderHTML(k){
  const used = new Set(S.plan.days.flatMap(x => x.stops.map(s => s.id)));
  const pool = catalog(S.dest).filter(c => !used.has(c.id));
  return `<div class="adder"><p class="label muted">Add from ${esc(S.dest.name)} ideas</p>
    <div class="adder-list">${pool.length ? pool.map(c => `<button class="pick" data-act="addstop" data-day="${k}" data-sid="${esc(c.id)}"><span>${esc(c.title)}<small>Best in the ${PART_WORD[c.part]}</small></span><b class="tnum">${c.cost ? money(scaleCost(c.cost)) : 'Free'}</b></button>`).join('') : '<p class="small muted">All the ideas are already in your plan.</p>'}</div>
    <p class="label muted">Or add your own</p>
    <form class="custom" data-day="${k}"><input name="title" type="text" placeholder="What’s the stop?" aria-label="Stop name" maxlength="60" autocomplete="off"><input name="cost" type="number" min="0" max="9999" inputmode="numeric" placeholder="$ cost" aria-label="Cost in dollars"><button class="btn btn-primary btn-sm" type="submit">Add</button></form></div>`;
}
function refreshPlan(focusSel){
  const root = $('#plan'); if (!root) return;
  root.innerHTML = plannerHTML();
  FX.bind(root);
  if (focusSel){ const el = $(focusSel, root); if (el) el.focus({ preventScroll:true }); }
}
function locate(id){ for (let k = 0; k < S.plan.days.length; k++){ const i = S.plan.days[k].stops.findIndex(s => s.id === id); if (i >= 0) return [k, i]; } return null; }
function insertByPart(day, stop){
  if (!stop.part){ day.stops.push(stop); return day.stops.length - 1; }
  const pi = PARTS.indexOf(stop.part); let at = 0;
  day.stops.forEach((s, i) => { if (s.part && PARTS.indexOf(s.part) <= pi) at = i + 1; });
  day.stops.splice(at, 0, stop); return at;
}
function addDay(){
  const P = S.plan;
  if (P.days.length >= 14){ toast('That’s the longest trip this prototype plans: 14 days.'); return; }
  const used = new Set(P.days.flatMap(x => x.stops.map(s => s.id)));
  const picks = catalog(S.dest).filter(c => !used.has(c.id)).slice(0, energyLevel().per).map(({ id, part, title, cost }) => ({ id, part, title, cost }));
  picks.sort((a, b) => PARTS.indexOf(a.part) - PARTS.indexOf(b.part));
  P.days.push({ title:'Open day', stops:picks });
  refreshPlan(`.day[data-day="${P.days.length - 1}"] [data-act="adder"]`);
  say(`Added day ${P.days.length}.`);
}

/* ---------- budget paint ---------- */
function paintBudget(){
  if (!$('#budgetVal')) return;
  const r = $('#budget'), st = STYLE[styleIdx()], perDay = S.budget / S.nights, avg = avgDaily(S.style);
  $('#budgetVal').textContent = money(S.budget);
  r.style.setProperty('--fill', ((S.budget - 500) / 4500 * 100) + '%');
  STYLE.forEach(s => { $('#sc-' + s.id).textContent = `≈ ${money(avgDaily(s.id))} a day`; });
  $('#nightsOut').textContent = `${S.nights} nights`;
  $('[data-act="nights"][data-d="-1"]').disabled = S.nights <= 3;
  $('[data-act="nights"][data-d="1"]').disabled = S.nights >= 8;
  $('#sumBudget').textContent = money(S.budget);
  $('#sumStyle').textContent = st.name;
  $('#sumWhen').textContent = `${MONTH_FULL[S.month]} · ${S.nights} nights`;
  $('#perDay').textContent = money(perDay);
  const fit = $('#fit'), ok = perDay >= avg, some = perDay >= avg * .75;
  fit.className = 'status small ' + (ok ? 'ok' : some ? '' : 'warn');
  fit.textContent = ok ? `${st.name} averages ${money(avg)} a day across our five places, so you have room to spare.`
    : some ? `${st.name} averages ${money(avg)} a day here. That covers some of our five places, not all.`
    : `${st.name} averages ${money(avg)} a day here. Try a lighter style, fewer nights or a bigger budget.`;
}

/* ---------- the game: progress, the round in view, battery ---------- */
function resetAnswers(){
  Object.assign(S, ANSWER_DEFAULTS, { bag:ANSWER_DEFAULTS.bag.slice() });
  touched.clear(); picked = false; paintHorizon();
  document.documentElement.style.setProperty('--energy', S.energy / 100);
}
function paintGame(){
  if (S.stage !== 'game' || !$('#gp')) return;
  const n = touched.size;
  $$('.gp-step').forEach(b => {
    const i = +b.dataset.n, done = touched.has(i);
    b.classList.toggle('done', done);
    if (i === gRound) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.setAttribute('aria-label', `Round ${i}, ${ROUNDS[i - 1].key}${done ? ', answered' : ''}`);
  });
  $$('.gr').forEach(sec => {
    const i = +sec.dataset.n, done = touched.has(i);
    sec.classList.toggle('done', done); sec.classList.toggle('cur', i === gRound);
    $('.gr-ok', sec).hidden = !done;
    const nx = $('.gr-next', sec);
    if (nx){
      nx.textContent = done ? 'Next round' : PREFILLED.has(i) ? 'Keep this and continue' : 'Skip this round';
      nx.classList.toggle('btn-primary', done); nx.classList.toggle('btn-ghost', !done);
    }
  });
  const bar = $('#gpBar'); bar.style.setProperty('--p', n / 5); bar.setAttribute('aria-valuenow', n);
  bar.setAttribute('aria-valuetext', `${n} of 5 rounds answered`);
  $('#gpCount').innerHTML = `<b>${n}</b> of 5 answered`;
  $('#gpCount').hidden = n === 5; $('#gpGo').hidden = n < 5;
  $('#gStartOver').hidden = n === 0;
  $('#gSum').textContent = n === 5 ? 'All five rounds answered. Ready when you are.' : n === 0 ? 'Nothing answered yet. You can still go on, and we will use sensible defaults.' : `${n} of 5 rounds answered. Anything you skipped uses a sensible default.`;
  $('#gCta').textContent = n === 5 ? 'Reveal my feeling card' : 'See my feeling card';
  $('#meta').textContent = `${n} of 5 answered`;
}
function touch(n){
  if (touched.has(n)) return;
  touched.add(n); paintGame();
  say(`Round ${n} answered. ${touched.size} of 5 done.`);
}
/* the round in view drives the orb: its spot, whether the bag satellites show */
function activate(n){
  if (n === gRound) return;
  gRound = n; paintGame();
  if (GL.ok){ GL.setBag(bagOn('game') ? S.bag : []); GL.setAnchor(gameAnchor()); GL.kick(.6); }
}
function unwatchGame(){ if (gIO){ gIO.disconnect(); gIO = null; } }
function watchGame(){
  unwatchGame();
  if (!('IntersectionObserver' in window)) return;
  gIO = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) activate(+en.target.dataset.n); }), { rootMargin:'-49% 0px -49% 0px' });
  $$('.gr').forEach(sec => gIO.observe(sec));
}
function scrollToRound(n){
  const sec = $('#gr' + n); if (!sec) return;
  sec.scrollIntoView({ behavior:FX.reduced ? 'auto' : 'smooth', block:'start' });
  activate(n);
  const h = $('h2', sec); if (h) h.focus({ preventScroll:true });
}
function paintEnergy(){
  const b = $('#battery'); if (!b) return;
  const L = energyLevel();
  b.style.setProperty('--p', S.energy / 100);
  b.setAttribute('aria-valuenow', S.energy);
  b.setAttribute('aria-valuetext', `${S.energy} percent, ${energyWord(S.energy)}`);
  $('#enNum').textContent = S.energy + '%';
  $('#enWord').textContent = energyWord(S.energy);
  $('#enHint').textContent = `Plans about ${L.per} stops a day`;
  $('.energy-read').classList.toggle('unset', !touched.has(2));
  document.documentElement.style.setProperty('--energy', S.energy / 100);
  if (GL.ok){ pushTraits(); GL.setAnchor(gameAnchor()); }
}
function bindBattery(){
  const b = $('#battery'); if (!b) return;
  const set = v => { S.energy = clamp(Math.round(v), 0, 100); touch(2); paintEnergy(); };
  const fromPointer = e => { const r = b.getBoundingClientRect(), inner = r.width - 8 - 20; set((e.clientX - r.left - 4 - 10) / inner * 100); };
  /* mouse and pen set the level at once. A finger first has to show it means to drag sideways (or tap),
     so a swipe that starts on the battery still scrolls the page instead of changing the answer. */
  let pend = null;
  b.addEventListener('pointerdown', e => {
    b.setPointerCapture(e.pointerId); b.focus({ preventScroll:true });
    if (e.pointerType === 'touch'){ pend = { x:e.clientX, y:e.clientY, id:e.pointerId }; return; }
    b.classList.add('drag'); fromPointer(e);
  });
  b.addEventListener('pointermove', e => {
    if (pend && pend.id === e.pointerId){
      const dx = Math.abs(e.clientX - pend.x), dy = Math.abs(e.clientY - pend.y);
      if (dx > 6 && dx > dy){ pend = null; b.classList.add('drag'); fromPointer(e); }
      return;
    }
    if (b.hasPointerCapture(e.pointerId)) fromPointer(e);
  });
  const end = e => {
    if (pend && pend.id === e.pointerId && e.type === 'pointerup' && Math.abs(e.clientX - pend.x) < 8 && Math.abs(e.clientY - pend.y) < 8) fromPointer(e);   // a tap
    pend = null; b.classList.remove('drag');
  };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
  b.addEventListener('keydown', e => {
    const step = e.shiftKey ? 10 : 1, k = e.key;
    const to = k === 'ArrowRight' || k === 'ArrowUp' ? S.energy + step : k === 'ArrowLeft' || k === 'ArrowDown' ? S.energy - step
      : k === 'PageUp' ? S.energy + 10 : k === 'PageDown' ? S.energy - 10 : k === 'Home' ? 0 : k === 'End' ? 100 : null;
    if (to === null) return; e.preventDefault(); set(to);
  });
}
const AFTER = { game:() => { bindBattery(); paintEnergy(); paintGame(); watchGame(); }, budget:paintBudget, field:() => { paintField(); } };

/* ---------- actions ---------- */
const ACT = {
  start: () => go('game'),
  skip: () => go('budget'),
  next: () => go(ORDER[ORDER.indexOf(S.stage) + 1]),
  back: () => go(ORDER[ORDER.indexOf(S.stage) - 1]),
  restart: () => go('game', { force:true, before:resetAnswers }),
  change: () => go('game'),
  goround: el => scrollToRound(+el.dataset.n),
  gnext: el => { const n = +el.dataset.n; if (PREFILLED.has(n)){ touch(n); if (n === 2) paintEnergy(); } scrollToRound(n + 1); },
  nights: el => { S.nights = clamp(S.nights + (+el.dataset.d), 3, 8); paintBudget(); },
  plan: el => { S.dest = destById(el.dataset.id); S.plan = genPlan(S.dest, S.nights, energyLevel().per); S.adder = null; go('planner'); },
  tomatches: () => go('matches'),
  reset: () => { S.plan = genPlan(S.dest, S.nights, energyLevel().per); S.adder = null; refreshPlan(); toast('Plan reset to the suggested itinerary.'); },
  addday: () => addDay(),
  rmday: el => { const k = +el.dataset.day; if (S.plan.days.length < 2) return; S.plan.days.splice(k, 1); S.adder = null; refreshPlan(); say(`Removed day ${k + 1}.`); },
  month: el => { S.month = +el.dataset.m; refreshPlan(`.mcell[data-m="${S.month}"]`); },
  adder: el => { const k = +el.dataset.day; S.adder = S.adder === k ? null : k; refreshPlan(`[data-act="adder"][data-day="${k}"]`); },
  addstop: el => {
    const k = +el.dataset.day, c = catalog(S.dest).find(x => x.id === el.dataset.sid); if (!c) return;
    const at = insertByPart(S.plan.days[k], { id:c.id, part:c.part, title:c.title, cost:c.cost });
    S.adder = null; refreshPlan(`.grip[data-id="${c.id}"]`); say(`Added ${c.title} to day ${k + 1}, position ${at + 1}.`);
  },
  rmstop: el => {
    const loc = locate(el.dataset.id); if (!loc) return; const [k, i] = loc;
    const [s] = S.plan.days[k].stops.splice(i, 1);
    const next = S.plan.days[k].stops[Math.min(i, S.plan.days[k].stops.length - 1)];
    refreshPlan(next ? `.grip[data-id="${next.id}"]` : `[data-act="adder"][data-day="${k}"]`); say(`Removed ${s.title}.`);
  },
  save: async () => {
    const trip = { v:1, window:S.window, energy:S.energy, bag:S.bag, sound:S.sound, feel:S.feel, budget:S.budget, style:S.style, month:S.month, nights:S.nights, destId:S.dest.id, plan:S.plan };
    const where = []; let dbErr = null;
    if (BE.ready && BE.uid){ try { await BE.saveTrip(trip); where.push('your account'); } catch (e) { dbErr = e; } }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(trip)); where.push('this browser'); } catch (e) {}
    const c = cleanTrip(trip); if (c && where.length) saved = c;
    toast(where.length ? `Plan saved to ${where.join(' and ')}.${dbErr ? ' The shared database could not be reached.' : ''}` : dbErr ? BE.explain(dbErr) : 'This browser blocks saving here. Your plan is still on screen.');
  },
  resume: () => {
    if (!saved) return;
    const { destId, plan, ...rest } = saved; Object.assign(S, rest, { dest:destById(destId), plan, adder:null, cardSeen:true, reached:3 });
    picked = true; [1, 2, 3, 4, 5].forEach(n => touched.add(n)); document.documentElement.style.setProperty('--energy', S.energy / 100); go('planner');
  },
  share: async () => {
    const A = archetype(), snd = SOUND.find(s => s.id === S.sound);
    const text = `My MoodTrip feeling card: ${A.name}\n${A.headline}\nWindow: ${A.w.name} · Energy: ${S.energy}% (${A.lvl.label.toLowerCase()}, ${A.lvl.per} stops a day)\nBag: ${bagNames().join(', ') || 'nothing'} · Soundtrack: ${snd.name}\nI want to come home feeling ${A.f.label.toLowerCase()}.`;
    try { await navigator.clipboard.writeText(text); toast('Copied your feeling card as text.'); }
    catch (e) { const box = $('#copybox'); box.value = text; box.hidden = false; box.focus(); box.select(); toast('Copy blocked here. The text is selected, so you can copy it yourself.'); }
  },
  field: () => { if (S.stage === 'field') ACT.fieldback(); else go('field'); },
  fieldback: () => go(prevStage && prevStage !== 'field' ? prevStage : 'intro'),
  addcard: async el => {
    if (el) el.disabled = true;
    try { await BE.publishCard(S.dest ? S.dest.id : null); toast('Your card is floating in the field.'); }
    catch (e) { toast(BE.explain(e)); }
    paintField();
  },
  removecard: async el => {
    if (el) el.disabled = true;
    try { await BE.removeCard(); showDetail(null); toast('Your card was removed from the field.'); }
    catch (e) { toast(BE.explain(e)); }
    paintField();
  },
  report: el => openReport(el.dataset.id),
  closesheet: () => closeSheet(),
  place: el => openPlace(el.dataset.id, el),
  closeplace: () => closePlace(),
  morerev: () => { revAll = !revAll; paintReviews(); const b = $('[data-act="morerev"]'); if (b) b.focus({ preventScroll:true }); },
  delreview: el => deleteReview(el),
  phremove: () => { resetPhoto(); photo.remove = true; paintPhotoField('Photo removed. It stays off your review once you post.'); const b = $('#ppBtn'); if (b) b.focus({ preventScroll:true }); }
};
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (nav){ const g = +nav.dataset.nav; go(g === 0 ? (S.cardSeen ? 'card' : 'game') : ['', 'budget', 'matches', 'planner'][g]); return; }
  if (e.target.closest('#brand')){ go('intro'); return; }
  const a = e.target.closest('[data-act]'); if (a && ACT[a.dataset.act]) ACT[a.dataset.act](a);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'window'){
    S.window = t.value; picked = true; touch(1); paintHorizon();
    document.documentElement.dataset.mood = moodFor('game');
    if (GL.ok){ GL.setMood(moodFor('game')); pushTraits(); GL.kick(1.2); }
  }
  else if (t.name === 'bag'){
    if ($$('input[name="bag"]:checked').length > 3){ t.checked = false; const p = $('#packed'); p.textContent = 'Your bag is full. Unpack one first.'; p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); return; }
    S.bag = $$('input[name="bag"]:checked').map(i => i.value); touch(3); $('#packed').textContent = packedText();
    if (GL.ok){ GL.setBag(S.bag); GL.kick(.8); }
  }
  else if (t.name === 'sound'){ S.sound = t.value; touch(4); if (GL.ok){ pushTraits(); GL.kick(1.4); } }
  else if (t.name === 'feel'){ S.feel = t.value; touch(5); const pw = $('#pillWord'); pw.textContent = FEEL.find(f => f.id === t.value).label.toLowerCase(); pw.classList.remove('empty'); if (GL.ok){ pushTraits(); GL.kick(1.2); } }
  else if (t.id === 'pfile'){ const f = t.files && t.files[0]; t.value = ''; pickPhoto(f); }
  else if (t.name === 'style'){ S.style = t.value; paintBudget(); }
  else if (t.name === 'month'){ S.month = +t.value; paintBudget(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'budget'){ S.budget = +e.target.value; paintBudget(); }
  else if (e.target.name === 'ptext'){ const c = $('#pcount'); if (c) c.textContent = `${e.target.value.length} / 240`; }
});
document.addEventListener('error', e => {      // a photo that no longer loads is replaced by a quiet note (error events do not bubble, so capture)
  const i = e.target; if (!i || !i.classList) return;
  if (i.classList.contains('rev-img')){
    const li = i.closest('.ph-strip li');
    if (li){ const strip = li.closest('.ph-strip'); li.remove(); const n = $$('li', strip).length; if (n) $('.label', strip).textContent = `Traveler photos · ${n}`; else strip.remove(); }
    else { const sp = document.createElement('span'); sp.className = 'rev-miss'; sp.textContent = 'Photo unavailable'; (i.closest('a') || i).replaceWith(sp); }
  }
  else if (i.classList.contains('pp-img')){ const th = $('#ppThumb'); if (th) th.hidden = true; }
}, true);
document.addEventListener('submit', e => {
  const rf = e.target.closest('#reportForm'); if (rf){ e.preventDefault(); submitReport(rf); return; }
  const pf = e.target.closest('#placeForm'); if (pf){ e.preventDefault(); submitReview(pf); return; }
  const f = e.target.closest('.custom'); if (!f) return; e.preventDefault();
  const title = f.elements.title.value.trim(), cost = clamp(Math.round(+f.elements.cost.value || 0), 0, 9999), k = +f.dataset.day;
  if (!title){ f.elements.title.focus(); return; }
  const id = 'c:' + Math.random().toString(36).slice(2, 8);
  S.plan.days[k].stops.push({ id, part:null, title, cost, custom:true });
  S.adder = null; refreshPlan(`.grip[data-id="${id}"]`); say(`Added ${title} to day ${k + 1}.`);
});
document.addEventListener('keydown', e => {
  const sheetOpen = !$('#sheet').hidden, placeOpen = !$('#place').hidden;
  if (sheetOpen || placeOpen){
    if (e.key === 'Escape'){ e.preventDefault(); if (sheetOpen) closeSheet(); else closePlace(); return; }
    if (e.key === 'Tab'){                                   // keep focus inside the dialog
      const box = $(sheetOpen ? '.sheet' : '.place');
      const f = $$('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]', box).filter(x => x.offsetParent !== null || x.type === 'radio');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box)){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
    return;
  }
  const g = e.target.closest && e.target.closest('.grip'); if (!g) return;
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){ e.preventDefault(); moveStop(g.dataset.id, e.key === 'ArrowUp' ? -1 : 1); }
});

/* ---------- planner: move stops (keyboard) ---------- */
function moveStop(id, dir){
  const loc = locate(id); if (!loc) return; const P = S.plan; const [k, i] = loc;
  let nk = k, ni = i + dir;
  if (ni < 0){ if (k === 0) return; nk = k - 1; ni = P.days[nk].stops.length; }
  else if (ni >= P.days[k].stops.length){ if (k === P.days.length - 1) return; nk = k + 1; ni = 0; }
  const [s] = P.days[k].stops.splice(i, 1); P.days[nk].stops.splice(ni, 0, s);
  refreshPlan(`.grip[data-id="${id}"]`); say(`Moved ${s.title} to day ${nk + 1}, position ${ni + 1}.`);
}

/* ---------- planner: move stops (pointer drag, works for mouse and touch) ---------- */
let drag = null;
document.addEventListener('pointerdown', e => {
  const g = e.target.closest && e.target.closest('.grip'); if (!g || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  const li = g.closest('.stop'), r = li.getBoundingClientRect();
  const ghost = li.cloneNode(true); ghost.classList.add('ghost'); ghost.removeAttribute('data-id');
  ghost.style.cssText = `width:${r.width}px;left:${r.left}px;top:${r.top}px`;
  document.body.appendChild(ghost);
  const ph = document.createElement('li'); ph.className = 'drop-line'; ph.style.height = r.height + 'px';
  li.classList.add('dragging'); li.parentNode.insertBefore(ph, li.nextSibling);
  document.body.classList.add('dragging');
  drag = { li, ghost, ph, id:li.dataset.id, dx:e.clientX - r.left, dy:e.clientY - r.top, pid:e.pointerId };
});
window.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.pid) return;
  drag.ghost.style.left = (e.clientX - drag.dx) + 'px'; drag.ghost.style.top = (e.clientY - drag.dy) + 'px';
  if (e.clientY < 70) window.scrollBy(0, -16); else if (e.clientY > innerHeight - 70) window.scrollBy(0, 16);
  const el = document.elementFromPoint(e.clientX, e.clientY); if (!el) return;
  const day = el.closest('.day');
  $$('.day.over').forEach(d => { if (d !== day) d.classList.remove('over'); });
  if (!day) return;
  day.classList.add('over');
  const list = $('.stops', day), over = el.closest('.stop:not(.dragging)');
  if (over){ const r = over.getBoundingClientRect(); list.insertBefore(drag.ph, e.clientY > r.top + r.height / 2 ? over.nextSibling : over); }
  else { const stops = $$('.stop:not(.dragging)', list), last = stops[stops.length - 1]; if (!last || e.clientY > last.getBoundingClientRect().bottom) list.appendChild(drag.ph); }
});
function endDrag(e, cancel){
  if (!drag || e.pointerId !== drag.pid) return;
  const d = drag; drag = null;
  d.ghost.remove(); document.body.classList.remove('dragging'); $$('.day.over').forEach(x => x.classList.remove('over'));
  const list = d.ph.parentNode;
  if (!cancel && list && list.classList.contains('stops')){
    const k = +list.dataset.day;
    const seq = [...list.children].map(c => c === d.ph ? d.id : c === d.li ? null : c.dataset.id).filter(Boolean);
    const all = {}; S.plan.days.forEach(dy => dy.stops.forEach(s => { all[s.id] = s; }));
    S.plan.days.forEach(dy => { dy.stops = dy.stops.filter(s => s.id !== d.id); });
    S.plan.days[k].stops = seq.map(id => all[id]);
    refreshPlan(`.grip[data-id="${d.id}"]`); say(`Moved ${all[d.id].title} to day ${k + 1}.`);
  } else { d.li.classList.remove('dragging'); d.ph.remove(); }
}
window.addEventListener('pointerup', e => endDrag(e, false));
window.addEventListener('pointercancel', e => endDrag(e, true));

/* ---------- backend: react to the shared database ---------- */
let crowdSig = '';
const sigOf = () => BE.ready + '|' + DEST.map(d => CROWD[d.id] ? CROWD[d.id].n + ':' + CROWD[d.id].total : '-').join(',') + '|' + BE.reportCount();
BE.on(() => {
  updateFieldCount();
  const sig = sigOf();
  if (S.stage === 'field') paintField();
  else if (S.stage === 'matches' && sig !== crowdSig){
    const y = scrollY; stageEl.innerHTML = VIEWS.matches(); FX.bind(stageEl); scrollTo(0, y);
  }
  else if (S.stage === 'planner' && sig !== crowdSig){
    const p = $('#crowdPanel'); if (p){ p.innerHTML = crowdPanelHTML(S.dest); }
  }
  if (S.stage === 'planner'){ paintStopRatings(); if (placeId) paintReviews(); }
  crowdSig = sig;
});
BE.init().then(async ok => {
  updateFieldCount();
  if (!ok) return;
  const t = cleanTrip(await BE.loadTrip());
  if (t){ saved = t; const slot = $('#resumeSlot'); if (slot){ slot.innerHTML = resumeBtn(); FX.bind(slot); } }
});

/* ---------- boot ---------- */
$('#horizon').innerHTML = Object.entries(HORIZON).map(([k, v]) => v.replace('<svg ', `<svg data-scene="${k}" `)).join('');
if (GL.ok) document.documentElement.classList.add('gl');
document.documentElement.style.setProperty('--energy', S.energy / 100);
const introTl = render('intro', { focus:false });
FX.loader(() => { if (introTl) gsap.delayedCall(.3, () => introTl.play()); }, () => { const h = $('#h1'); if (h) h.focus({ preventScroll:true }); });
let rsz; addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { if (GL.ok && S.stage !== 'field') GL.setAnchor(S.stage === 'game' ? gameAnchor() : anchorFor(S.stage)); }, 120); });
