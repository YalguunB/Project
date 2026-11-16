"use strict";
/* features/budget/budget.js — Budget: slider, styles, nights. */
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
