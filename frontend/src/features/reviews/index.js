"use strict";
/* features/reviews/index.js — Reviews: entry points. */
ACT.morerev = () => { revAll = !revAll; paintReviews(); const b = $('[data-act="morerev"]'); if (b) b.focus({ preventScroll:true }); };
ACT.delreview = el => deleteReview(el);
ACT.phremove = () => { resetPhoto(); photo.remove = true; paintPhotoField('Photo removed. It stays off your review once you post.'); const b = $('#ppBtn'); if (b) b.focus({ preventScroll:true }); };
ACT.vote = el => voteReview(el);
ACT.thread = el => { const tg = el.dataset.tg; if (openThreads.has(tg)) openThreads.delete(tg); else openThreads.add(tg); paintReviews(); if (openThreads.has(tg)){ const t = $$('textarea[name="ctext"]').find(x => x.dataset.tg === tg); if (t) t.focus({ preventScroll:false }); } };
ACT.delcomment = async el => { el.disabled = true; try { await BE.removeComment(el.dataset.tg, +el.dataset.at); toast('Comment deleted.'); } catch (e) { toast(BE.explain(e)); } paintReviews(); };
