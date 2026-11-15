/* core/events.js — Global event delegation: click, change, input, submit, keys. */
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
