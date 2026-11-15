/* features/plans/index.js — My plans: entry points. */
VIEWS.plans = plansViewHTML;
AFTER.plans = () => { paintPlans(); };
BE.on(() => { if (S.stage === 'plans' && !(document.activeElement && document.activeElement.classList.contains('plan-name'))) paintPlans(); });
ACT.myplans = () => { closeSheet(true); if (!BE.account){ openAuth('login'); return; } if (S.stage !== 'plans') plansBack = S.stage; go('plans'); };
ACT.plansback = () => go(plansBack && plansBack !== 'plans' ? plansBack : 'intro');
ACT.openplan = async el => {
  const p = (await BE.loadPlans()).find(x => x.id === el.dataset.plan), t = p && cleanTrip(p.trip); if (!t) return;
  restoreTrip(t); S.planId = p.id; go('planner');
};
ACT.planrevs = el => { const id = el.dataset.plan; if (plansOpen.has(id)) plansOpen.delete(id); else plansOpen.add(id); paintPlans(); };
ACT.delplan = async el => {
  const id = el.dataset.plan;
  if (delArm !== id){ delArm = id; clearTimeout(delTimer); delTimer = setTimeout(() => { delArm = null; paintPlans(); }, 4000); paintPlans(); return; }
  delArm = null; clearTimeout(delTimer);
  try { await BE.removePlan(id); if (S.planId === id) S.planId = null; toast('Plan deleted.'); } catch (e) { toast(BE.explain(e)); }
  paintPlans();
};
ACT.revplace = el => openReviewSheet(el.dataset.pid);
ACT.revdelete = async () => {
  const mine = BE.myReview(revPid);
  try { await BE.removeReview(revPid); if (mine && mine.ph) BE.dropPhoto(mine.ph); closeSheet(); toast('Your review was removed.'); paintPlans(); }
  catch (e) { toast(BE.explain(e)); }
};
