"use strict";
/* core/backend-sync.js — React to the shared database. */
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
  await loadProfile();                       // works without the database too (this browser only)
  if (!ok) return;
  const t = cleanTrip(await BE.loadTrip());
  if (t){ saved = t; const slot = $('#resumeSlot'); if (slot){ slot.innerHTML = resumeBtn(); FX.bind(slot); } }
});

/* signed in or out: a different traveler from now on. Reload what belongs to them, and the first time an account is used in this
   browser, bring along the plan this browser saved before (unless the account already has the same plan). */
const sameTrip2 = (a, b) => a && b && a.destId === b.destId && a.month === b.month && JSON.stringify(a.plan.days.map(d => d.stops.map(s => s.title))) === JSON.stringify(b.plan.days.map(d => d.stops.map(s => s.title)));
async function importBrowserPlan(){
  if (!BE.account || !saved) return;
  const list = await BE.loadPlans();
  if (list.some(p => sameTrip2(cleanTrip(p.trip), saved))) return;
  try { await BE.savePlan({ name:`${destById(saved.destId).name} · ${MONTH_FULL[saved.month]}`, trip:saved }); toast('The plan saved in this browser is now in your account too.'); } catch (e) {}
}
BE.onIdentity(async () => {
  S.planId = null;
  await loadProfile();
  const t = cleanTrip(await BE.loadTrip()); if (t) saved = t;
  const slot = $('#resumeSlot'); if (slot){ slot.innerHTML = resumeBtn(); FX.bind(slot); }
  await importBrowserPlan();
  if (S.stage === 'planner') refreshPlan();
});
