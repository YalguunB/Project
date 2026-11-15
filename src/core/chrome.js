/* core/chrome.js — Chrome: mood, 3D scene sync, stage nav, render and go(). */
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
