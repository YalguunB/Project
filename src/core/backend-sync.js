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
  if (!ok) return;
  const t = cleanTrip(await BE.loadTrip());
  if (t){ saved = t; const slot = $('#resumeSlot'); if (slot){ slot.innerHTML = resumeBtn(); FX.bind(slot); } }
});
