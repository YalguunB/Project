/* features/feel/index.js — Feel: entry points (screens, actions, after-render hooks). */
VIEWS.intro = () => `
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
      <div id="engageSlot" class="engage-slot" aria-live="polite"></div>
      <div class="who" data-fade><span class="label muted">Who it’s for</span><span class="tag outline">Solo travelers</span><span class="tag outline">Couples</span><span class="tag outline">Burnt-out professionals</span></div>
    </div>
    <div class="marquee" aria-hidden="true"><div class="track">${marq}${marq}</div></div>
    <div>
      <div class="sec-head" data-rise><p class="label accent">What makes it different</p><h2 class="display-m">Feelings first. Honest numbers after.</h2></div>
      <div class="pillars">
        <article class="pillar" data-rise><span class="n">01</span><h3>Feeling first, as a game</h3><p class="small muted">Five quick rounds read your mood and energy. The page and the little 3D traveler respond to every answer.</p></article>
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
  </section>`;
VIEWS.game = () => `<section class="game" aria-labelledby="h1">
    <header class="game-head">
      <p class="label accent" data-fade>The feeling game</p>
      <h1 class="display-l" id="h1" tabindex="-1" data-split>Tell us how you want to <em>feel.</em></h1>
      <p class="body-l muted" data-fade>Five quick rounds on one page. Answer in any order and jump around with the steps below. The traveler changes with every answer, and anything you skip gets a sensible default.</p>
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
  </section>`;
VIEWS.card = () => { const A = archetype(), snd = SOUND.find(s => s.id === S.sound);
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
    </div></section>`; };
AFTER.game = () => { bindBattery(); paintEnergy(); paintGame(); watchGame(); };
ACT.goround = el => scrollToRound(+el.dataset.n);
ACT.gnext = el => { const n = +el.dataset.n; if (PREFILLED.has(n)){ touch(n); if (n === 2) paintEnergy(); } scrollToRound(n + 1); };
ACT.share = async () => {
    const A = archetype(), snd = SOUND.find(s => s.id === S.sound);
    const text = `My MoodTrip feeling card: ${A.name}\n${A.headline}\nWindow: ${A.w.name} · Energy: ${S.energy}% (${A.lvl.label.toLowerCase()}, ${A.lvl.per} stops a day)\nBag: ${bagNames().join(', ') || 'nothing'} · Soundtrack: ${snd.name}\nI want to come home feeling ${A.f.label.toLowerCase()}.`;
    try { await navigator.clipboard.writeText(text); toast('Copied your feeling card as text.'); }
    catch (e) { const box = $('#copybox'); box.value = text; box.hidden = false; box.focus(); box.select(); toast('Copy blocked here. The text is selected, so you can copy it yourself.'); }
  };
