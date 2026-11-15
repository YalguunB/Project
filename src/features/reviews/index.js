/* features/reviews/index.js — Reviews: entry points. */
ACT.morerev = () => { revAll = !revAll; paintReviews(); const b = $('[data-act="morerev"]'); if (b) b.focus({ preventScroll:true }); };
ACT.delreview = el => deleteReview(el);
ACT.phremove = () => { resetPhoto(); photo.remove = true; paintPhotoField('Photo removed. It stays off your review once you post.'); const b = $('#ppBtn'); if (b) b.focus({ preventScroll:true }); };
