/* features/reviews/actions.js — Reviews: repaint, post, delete. */
/* The list can change underneath the reader at any moment (that is the point), so only the reviews area is redrawn. The form is left alone. */
function paintReviews(){
  if (!placeId) return;
  const loc = locate(placeId); if (!loc) return;
  const s = S.plan.days[loc[0]].stops[loc[1]], pid = pidOf(s), box = $('#plReviews'); if (!pid || !box) return;
  const R = BE.reviewsFor(pid), others = seenRev ? R.list.filter(x => !x.mine && !seenRev.has(revKey(x))) : [];
  const h = reviewsHTML(pid, s.title);
  if (box.dataset.h !== h){                              // nothing changed: leave the DOM (and anything being typed) alone
    const scroller = $('.pl-scroll'), top = scroller ? scroller.scrollTop : 0, act = document.activeElement;
    const typing = act && act.name === 'ctext' ? { tg:act.dataset.tg, a:act.selectionStart, b:act.selectionEnd } : null;
    box.dataset.h = h; box.innerHTML = h; FX.bind(box);
    $$('textarea[name="ctext"]', box).forEach(t => { if (cDrafts.has(t.dataset.tg)) t.value = cDrafts.get(t.dataset.tg); });
    if (typing){ const t = $$('textarea[name="ctext"]', box).find(x => x.dataset.tg === typing.tg); if (t){ t.focus({ preventScroll:true }); t.setSelectionRange(typing.a, typing.b); } }
    if (scroller) scroller.scrollTop = top;
  }
  if (BE.reviewsAt){ if (!seenRev) seenRev = new Set(); R.list.forEach(x => seenRev.add(revKey(x))); }
  const live = $('#plLive'); if (live){ live.classList.toggle('off', !BE.ready); live.lastChild.textContent = BE.ready ? 'Live' : 'Offline'; }
  if (others.length) say(`${others.length} new ${plural(others.length, 'review', 'reviews')} of ${s.title}.`);
}
function paintStopRatings(){
  $$('[data-rate]').forEach(el => { const h = rateHTML(el.dataset.rate); if (el.innerHTML !== h) el.innerHTML = h; });
}
async function submitReview(form){
  const err = $('#perr'), btn = $('#psub'), r = +(form.elements.prate.value || 0), f = form.elements.pfeel.value || null, t = form.elements.ptext.value;
  const pid = placeId, loc = pid && locate(pid), s = loc && S.plan.days[loc[0]].stops[loc[1]], realPid = s && pidOf(s);
  if (!realPid) return;
  if (!(r >= 1 && r <= 5)){ err.textContent = 'Pick a star rating first.'; err.hidden = false; return; }
  if (Date.now() - lastPost < 4000){ err.textContent = 'One moment, you just posted. Try again in a few seconds.'; err.hidden = false; return; }
  btn.disabled = true; err.hidden = true;
  const old = BE.myReview(realPid), oldPh = old && old.ph || null, label = btn.textContent;
  let ph = photo.remove ? null : oldPh, fresh = null;
  try {
    if (photo.blob){ btn.textContent = 'Uploading photo…'; fresh = await BE.uploadPhoto(photo.blob); ph = fresh; btn.textContent = label; }
    await BE.submitReview(realPid, { r, t, f, ph, tc:tripsTaken(profile).length, named:postAsNamed(form, 'pas') });
    lastPost = Date.now();
    if (oldPh && oldPh !== ph) BE.dropPhoto(oldPh);
    if (placeId === pid) setReviewForm(realPid);
    paintStopRatings(); toast(`Thanks. Your review of ${s.title} is live.`);
  } catch (e) {
    if (fresh) BE.dropPhoto(fresh);                       // the review was not saved, so do not leave the upload behind
    btn.textContent = label; err.textContent = BE.explain(e); err.hidden = false; btn.disabled = false;
  }
}
async function deleteReview(btn){
  const loc = placeId && locate(placeId), s = loc && S.plan.days[loc[0]].stops[loc[1]], pid = pidOf(s); if (!pid) return;
  btn.disabled = true;
  const mine = BE.myReview(pid);
  try { await BE.removeReview(pid); if (mine && mine.ph) BE.dropPhoto(mine.ph); if (placeId) setReviewForm(pid); paintStopRatings(); toast('Your review was removed.'); }
  catch (e) { toast(BE.explain(e)); btn.disabled = false; }
}

/* ---------- comments and helpful votes ---------- */
async function submitComment(form){
  const tg = form.dataset.tg, ta = form.elements.ctext, text = ta.value.trim(), btn = $('button[type="submit"]', form);
  if (!text){ ta.focus(); return; }
  btn.disabled = true;
  try {
    const radio = $$('input[type="radio"]', form).find(i => i.checked);
    await BE.addComment(tg, text, !!BE.account && !!radio && radio.value === 'named');
    cDrafts.delete(tg); ta.value = ''; toast('Comment posted.');
  } catch (e) { toast(BE.explain(e)); }
  btn.disabled = false; paintReviews();
}
async function voteReview(el){
  el.disabled = true;
  try { await BE.vote(el.dataset.tg, +el.dataset.v); } catch (e) { toast(BE.explain(e)); }
  el.disabled = false; paintReviews();
}
