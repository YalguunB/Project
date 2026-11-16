"use strict";
/* features/feel/game.js — Feel: progress, the round in view, scrolling. */
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
