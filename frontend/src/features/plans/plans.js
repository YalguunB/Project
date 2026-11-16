"use strict";
/* features/plans/plans.js — My plans: every plan saved to the account, with its places and the traveler's own review of each. */
let plansBack = 'intro', plansOpen = new Set(), delArm = null, delTimer = 0;
const STAR_SVG = '<i class="rstar" aria-hidden="true"></i>';
/* the guide places of a saved plan, in plan order, with the day they are on */
function planPlaces(d, plan){
  const byTitle = new Map(catalog(d).map(c => [c.title, c])), seen = new Set(), out = [];
  plan.days.forEach((day, k) => day.stops.forEach(s => { const c = !s.custom && byTitle.get(s.title); if (c && !seen.has(c.id)){ seen.add(c.id); out.push({ pid:c.id, title:c.title, day:k + 1 }); } }));
  return out;
}
function plansViewHTML(){
  const a = BE.account;
  return `<section class="plans-view" aria-labelledby="h1">
    <header class="head"><button class="btn btn-ghost btn-sm btn-back" data-act="plansback">← Back</button>
      ${a ? `<p class="label accent" data-fade translate="no">@${esc(a.name)}</p>` : '<p class="label accent" data-fade>Your account</p>'}
      <h1 class="display-l" id="h1" tabindex="-1" data-split>My plans.</h1>
      <p class="body-l muted" data-fade>Every plan you saved to your account. Open one to keep editing, or rate its places once you have been.</p></header>
    <div id="plansList" class="plans-list" aria-live="polite">${a ? '<p class="small muted">Loading your plans…</p>' : signInPromptHTML()}</div>
  </section>`;
}
const signInPromptHTML = () => `<div class="panel empty-panel"><p class="title">Sign in to see your plans</p><p class="small muted">Plans saved to an account follow you to any device, and you can review their places later.</p><div class="row"><button class="btn btn-primary" data-act="signin">Sign in</button></div></div>`;
function planCardHTML(p){
  const t = cleanTrip(p.trip); if (!t) return '';
  const d = destById(t.destId), places = planPlaces(d, t.plan), done = places.filter(x => BE.myReview(x.pid)).length, open = plansOpen.has(p.id);
  const stops = t.plan.days.reduce((n, day) => n + day.stops.length, 0);
  return `<article class="plan-card" data-plan="${p.id}" data-mood="${esc(WIN.find(w => w.id === t.window).mood)}">
    <div class="pc-top">
      <span class="pc-mark" aria-hidden="true" translate="no">${esc(d.name.charAt(0))}</span>
      <div class="pc-title">
        <input class="plan-name" data-plan="${p.id}" value="${esc(p.name)}" maxlength="60" aria-label="Plan name" translate="no">
        <p class="small muted">${esc(d.name)}, ${esc(d.country)} · ${t.nights} ${plural(t.nights, 'night', 'nights')} · ${MONTH_FULL[t.month]}</p>
      </div>
      <time class="fine" datetime="${new Date(p.at).toISOString()}">Saved ${ago(p.at)}</time>
    </div>
    <dl class="pc-stats"><div><dt>Days</dt><dd>${t.plan.days.length}</dd></div><div><dt>Stops</dt><dd>${stops}</dd></div><div><dt>Budget</dt><dd>${money(t.budget)}</dd></div><div><dt>Reviewed</dt><dd>${done} / ${places.length}</dd></div></dl>
    <div class="row">
      <button class="btn btn-primary btn-sm" data-act="openplan" data-plan="${p.id}">Open plan</button>
      <button class="btn btn-secondary btn-sm" data-act="planrevs" data-plan="${p.id}" aria-expanded="${open}">${open ? 'Hide places' : 'Review places'}</button>
      <button class="btn btn-ghost btn-sm pc-del" data-act="delplan" data-plan="${p.id}">${delArm === p.id ? 'Tap again to delete' : 'Delete'}</button>
    </div>
    ${open ? `<ul class="pc-places">${places.map(x => { const m = BE.myReview(x.pid); return `<li>
        <div><span class="fine">Day ${x.day}</span><b>${esc(x.title)}</b>${m ? `<span class="pc-rate">${STAR_SVG}${m.r}${m.t ? ` · <q translate="no">${esc(m.t.length > 60 ? m.t.slice(0, 58) + '…' : m.t)}</q>` : ''}</span>` : '<span class="small muted">Not reviewed yet</span>'}</div>
        <button class="btn ${m ? 'btn-ghost' : 'btn-secondary'} btn-sm" data-act="revplace" data-pid="${x.pid}" data-plan="${p.id}">${m ? 'Edit review' : 'Write review'}</button></li>`; }).join('')}</ul>` : ''}
  </article>`;
}
async function paintPlans(){
  const box = $('#plansList'); if (!box || S.stage !== 'plans') return;
  if (!BE.account){ box.innerHTML = signInPromptHTML(); return; }
  const list = await BE.loadPlans();
  if (S.stage !== 'plans' || !$('#plansList')) return;
  const focus = document.activeElement && document.activeElement.classList.contains('plan-name') ? document.activeElement.dataset.plan : null;
  box.innerHTML = list.length ? list.map(planCardHTML).join('')
    : `<div class="panel empty-panel"><p class="title">No saved plans yet</p><p class="small muted">Plan a trip and press “Save plan”. It lands here, on every device you sign in on.</p><div class="row"><button class="btn btn-primary" data-act="start">Start the feeling game</button><button class="btn btn-ghost" data-act="skip">Skip the game</button></div></div>`;
  FX.bind(box);
  if (focus){ const i = $(`.plan-name[data-plan="${focus}"]`); if (i) i.focus(); }
}
async function renamePlan(input){
  const name = input.value.trim(); if (!name) { paintPlans(); return; }
  try { await BE.renamePlan(input.dataset.plan, name); toast('Plan renamed.'); } catch (e) { toast(BE.explain(e)); }
}

/* ---------- writing or editing a review from a saved plan ---------- */
let revPid = null;
function openReviewSheet(pid){
  const c = DEST.flatMap(catalog).find(x => x.id === pid); if (!c) return;
  revPid = pid;
  const mine = BE.myReview(pid), rate = mine ? mine.r : 0, feel = mine && mine.f || '', text = mine ? mine.t : '', named = mine ? !!mine.named : !!BE.account;
  const d = destById(pid.split(':')[0]);
  openSheetWith(`<div><p class="label accent">${esc(d.name)} · ${mine ? 'Your review' : 'New review'}</p><h2 class="heading" id="shTitle">${esc(c.title)}</h2></div>
    ${BE.canPost ? `<form id="revForm" class="rform" novalidate>
      <fieldset><legend class="label muted">Your rating</legend><div class="strength rate-pick" role="radiogroup">${STAR_WORDS.map((w, i) => `<label class="opt" data-cursor=""><input type="radio" name="rrate" value="${i + 1}" ${i + 1 === rate ? 'checked' : ''}><span class="face"><span class="sr">${i + 1} ${plural(i + 1, 'star', 'stars')}, </span><span class="pnr" aria-hidden="true">${i + 1}<i class="rstar"></i></span><small>${w}</small></span></label>`).join('')}</div></fieldset>
      <fieldset><legend class="label muted">How did it feel? Optional</legend><div class="chips" role="radiogroup"><label class="opt chip" data-cursor=""><input type="radio" name="rfeel2" value="" ${feel ? '' : 'checked'}><span class="face">Skip</span></label>${FEEL.map(f => `<label class="opt chip" data-cursor=""><input type="radio" name="rfeel2" value="${f.id}" ${f.id === feel ? 'checked' : ''}><span class="face">${f.label}</span></label>`).join('')}</div></fieldset>
      <label class="tfield"><span class="label muted">In your words · optional</span><textarea name="rtext" rows="4" maxlength="240" placeholder="What was it like? A line or two helps the next traveler.">${esc(text)}</textarea></label>
      ${postAsHTML('ras', named)}
      <p class="notice" id="rverr" hidden></p>
      <div class="sheet-foot">${mine ? '<button type="button" class="btn btn-ghost" data-act="revdelete">Delete review</button>' : '<button type="button" class="btn btn-ghost" data-act="closesheet">Cancel</button>'}<button class="btn btn-primary" type="submit" id="rvsub">${mine ? 'Update review' : 'Post review'}</button></div>
    </form>` : `<p class="notice">Reviews need the shared version of this page.</p><div class="sheet-foot"><button type="button" class="btn btn-secondary" data-act="closesheet">Close</button></div>`}`);
}
async function submitPlanReview(form){
  const err = $('#rverr'), btn = $('#rvsub'), r = +(form.elements.rrate.value || 0);
  if (!(r >= 1 && r <= 5)){ err.textContent = 'Pick a star rating first.'; err.hidden = false; return; }
  btn.disabled = true; err.hidden = true;
  const old = BE.myReview(revPid);
  try {
    await BE.submitReview(revPid, { r, t:form.elements.rtext.value, f:form.elements.rfeel2.value || null, ph:old && old.ph || null, tc:tripsTaken(profile).length, named:postAsNamed(form, 'ras') });
    closeSheet(); toast('Thanks. Your review is live.'); paintPlans();
  } catch (e) { err.textContent = BE.explain(e); err.hidden = false; btn.disabled = false; }
}
