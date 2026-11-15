/* features/planner/index.js — Planner: entry points. */
VIEWS.planner = () => `<section aria-labelledby="h1"><div id="plan">${plannerHTML()}</div></section>`;
ACT.plan = el => { S.dest = destById(el.dataset.id); S.plan = genPlan(S.dest, S.nights, energyLevel().per); S.adder = null; go('planner'); };
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
    const trip = { v:1, window:S.window, energy:S.energy, bag:S.bag, sound:S.sound, feel:S.feel, budget:S.budget, style:S.style, month:S.month, nights:S.nights, destId:S.dest.id, plan:S.plan };
    const where = []; let dbErr = null;
    if (BE.ready && BE.uid){ try { await BE.saveTrip(trip); where.push('your account'); } catch (e) { dbErr = e; } }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(trip)); where.push('this browser'); } catch (e) {}
    const c = cleanTrip(trip); if (c && where.length) saved = c;
    toast(where.length ? `Plan saved to ${where.join(' and ')}.${dbErr ? ' The shared database could not be reached.' : ''}` : dbErr ? BE.explain(dbErr) : 'This browser blocks saving here. Your plan is still on screen.');
  };
ACT.resume = () => {
    if (!saved) return;
    const { destId, plan, ...rest } = saved; Object.assign(S, rest, { dest:destById(destId), plan, adder:null, cardSeen:true, reached:3 });
    picked = true; [1, 2, 3, 4, 5].forEach(n => touched.add(n)); document.documentElement.style.setProperty('--energy', S.energy / 100); go('planner');
  };
