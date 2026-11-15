/* features/planner/views.js — Planner: cost, month grid, day cards. */
/* ---------- planner views ---------- */
const COST_PARTS = [['Stays', 'stays', 'var(--accent)'], ['Food', 'food', 'var(--glow)'], ['Stops', 'stops', 'color-mix(in srgb,var(--accent) 45%,var(--surface))'], ['Local transport', 'trans', 'color-mix(in srgb,var(--text) 55%,var(--surface))']];
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
