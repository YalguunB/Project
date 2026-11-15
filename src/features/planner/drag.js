/* features/planner/drag.js — Planner: move stops by keyboard and by pointer drag. */
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
