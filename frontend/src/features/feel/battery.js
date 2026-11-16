"use strict";
/* features/feel/battery.js — Feel: round 2, the battery. */
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
