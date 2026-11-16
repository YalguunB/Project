"use strict";
/* features/planner/index.js — Planner: entry points. */
VIEWS.planner = () => `<section aria-labelledby="h1"><div id="plan">${plannerHTML()}</div></section>`;
ACT.plan = el => { S.dest = destById(el.dataset.id); S.plan = genPlan(S.dest, S.nights, energyLevel().per); S.adder = null; S.planId = null; go('planner'); };
ACT.reset = () => { S.plan = genPlan(S.dest, S.nights, energyLevel().per); S.adder = null; refreshPlan(); toast('Plan reset to the suggested itinerary.'); };
ACT.addday = () => addDay();
ACT.rmday = el => { const k = +el.dataset.day; if (S.plan.days.length < 2) return; S.plan.days.splice(k, 1); S.adder = null; refreshPlan(); say(`Removed day ${k + 1}.`); };
ACT.month = el => { S.month = +el.dataset.m; refreshPlan(`.mcell[data-m="${S.month}"]`); };
ACT.adder = el => { const k = +el.dataset.day; S.adder = S.adder === k ? null : k; refreshPlan(`[data-act="adder"][data-day="${k}"]`); };
ACT.addstop = el => {
    const k = +el.dataset.day, c = catalog(S.dest).find(x => x.id === el.dataset.sid); if (!c) return;
    const at = insertByPart(S.plan.days[k], { id:c.id, part:c.part, title:c.title, cost:c.cost });
    S.adder = null; refreshPlan(`.grip[data-id="${c.id}"]`); say(`Added ${c.title} to day ${k + 1}, position ${at + 1}.`);
  };
ACT.rmstop = el => {
    const loc = locate(el.dataset.id); if (!loc) return; const [k, i] = loc;
    const [s] = S.plan.days[k].stops.splice(i, 1);
    const next = S.plan.days[k].stops[Math.min(i, S.plan.days[k].stops.length - 1)];
    refreshPlan(next ? `.grip[data-id="${next.id}"]` : `[data-act="adder"][data-day="${k}"]`); say(`Removed ${s.title}.`);
  };
ACT.save = async () => {
    const trip = { v:1, window:S.window, energy:S.energy, bag:S.bag, sound:S.sound, feel:S.feel, now:S.now, colors:S.colors, budget:S.budget, style:S.style, month:S.month, nights:S.nights, destId:S.dest.id, plan:S.plan };
    const where = []; let dbErr = null;
    if (BE.account){                                        // signed in: one of the account's plans (the same one again on the next save)
      try { S.planId = await BE.savePlan({ id:S.planId, name:S.planId ? '' : `${S.dest.name} · ${MONTH_FULL[S.month]}`, trip }); where.push('your account'); } catch (e) { dbErr = e; }
      if (BE.ready && BE.uid) BE.saveTrip(trip).catch(() => {});
    }
    else if (BE.ready && BE.uid){ try { await BE.saveTrip(trip); } catch (e) { dbErr = e; } }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(trip)); where.push('this browser'); } catch (e) {}
    const c = cleanTrip(trip); if (c && where.length){ saved = c; recordTrip(trip); }
    if (dbErr && dbErr.code === 'plans_full'){ toast(BE.explain(dbErr)); return; }
    toast(where.length ? `Plan saved to ${where.join(' and ')}.${dbErr ? ' The shared database could not be reached.' : BE.account ? ' Find it in My plans.' : BE.canAccount ? ' Sign in to keep it in your account.' : ''}` : dbErr ? BE.explain(dbErr) : 'This browser blocks saving here. Your plan is still on screen.');
  };
ACT.resume = () => { if (!saved) return; restoreTrip(saved); go('planner'); };
AFTER.planner = () => { mountRouteMap(); };
ACT.mapday = el => {
  mapDay = +el.dataset.day;
  $$('.rday').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.day === mapDay)));
  paintRoute(true);
};
