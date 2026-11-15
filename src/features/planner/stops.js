/* features/planner/stops.js — Planner: stops, adding, removing, days. */
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
