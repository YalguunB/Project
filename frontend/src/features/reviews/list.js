"use strict";
/* features/reviews/list.js — Reviews: list, stars, aggregate. */
/* ---------- place panel: what a stop is like, plus live traveler reviews ---------- */
const REV_SHOWN = 6;
let placeId = null, placeOpener = null, revAll = false, lastPost = 0, agoTimer = 0, seenRev = null; // seenRev: reviews already on screen (null until the first live load)
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const starsHTML = v => `<span class="stars" style="--p:${Math.round(v / 5 * 100)}%" role="img" aria-label="${avgText(v)} out of 5"></span>`;
const revKey = x => x.uid + '|' + x.pid + '|' + x.at;
/* comments and votes: threads stay open, and a half-written comment survives the list being redrawn under it */
const openThreads = new Set(), cDrafts = new Map();
const THUMB = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M5 7.2V14H2.6a.6.6 0 0 1-.6-.6V7.8a.6.6 0 0 1 .6-.6H5Zm0 0 2.6-5c1.2 0 2 .9 1.8 2.1L9 6.4h3.6c.9 0 1.6.8 1.4 1.7l-1 4.8c-.2.6-.7 1.1-1.4 1.1H5"/></svg>';
const authorHTML = (u, fallback, mine) => `${u ? `<b class="who named" translate="no">@${esc(u)}</b>` : `<b class="who">${esc(fallback)}</b>`}${mine ? '<span class="you">you</span>' : ''}`;
function threadHTML(x, tg){
  const list = BE.commentsFor(tg);
  return `<div class="rv-thread" id="th-${tg.replace(/[^a-z0-9]/gi, '')}">
    ${list.length ? `<ul class="cmts">${list.map(c => `<li class="cmt${c.mine ? ' mine' : ''}"><div class="cmt-top">${authorHTML(c.u, 'Anonymous traveler', c.mine)}<time datetime="${new Date(c.at).toISOString()}">${ago(c.at)}</time>${c.mine ? `<button type="button" class="link-btn" data-act="delcomment" data-tg="${tg}" data-at="${c.at}">Delete</button>` : ''}</div><p translate="no">${esc(c.t)}</p></li>`).join('')}</ul>` : '<p class="fine">No comments yet. Ask something, or thank them.</p>'}
    ${BE.canPost ? `<form class="cform" data-tg="${tg}" novalidate><label class="sr" for="ct-${tg.replace(/[^a-z0-9]/gi, '')}">Your comment</label><textarea id="ct-${tg.replace(/[^a-z0-9]/gi, '')}" name="ctext" data-tg="${tg}" rows="2" maxlength="400" placeholder="Write a comment"></textarea>
      <div class="cform-foot">${postAsHTML('cas-' + tg.replace(/[^a-z0-9]/gi, ''), !!BE.account)}<button class="btn btn-primary btn-sm" type="submit">Post comment</button></div></form>` : ''}
  </div>`;
}
function revItemHTML(x, fresh){
  const f = x.f && FEEL.find(k => k.id === x.f), tg = BE.reviewKey(x), v = BE.votesFor(tg), n = BE.commentsFor(tg).length, open = openThreads.has(tg);
  const votes = x.mine || !BE.canPost
    ? (v.up || v.down ? `<span class="rv-score">${v.up} found this helpful</span>` : '')
    : `<button type="button" class="rv-act${v.mine > 0 ? ' on' : ''}" data-act="vote" data-tg="${tg}" data-v="1" aria-pressed="${v.mine > 0}">${THUMB}<span>Helpful</span>${v.up ? `<b>${v.up}</b>` : ''}</button>
       <button type="button" class="rv-act down${v.mine < 0 ? ' on' : ''}" data-act="vote" data-tg="${tg}" data-v="-1" aria-pressed="${v.mine < 0}">${THUMB}<span>Not helpful</span>${v.down ? `<b>${v.down}</b>` : ''}</button>`;
  return `<li class="rv${fresh ? ' fresh' : ''}${x.mine ? ' mine' : ''}"><div class="rv-top">${starsHTML(x.r)}${authorHTML(x.u, x.name, x.mine)}${x.tc >= 2 ? `<span class="tag outline rv-exp" title="This traveler has taken ${x.tc} trips with MoodTrip">${x.tc} trips</span>` : ''}${x.at ? `<time datetime="${new Date(x.at).toISOString()}">${ago(x.at)}</time>` : ''}</div>${f ? `<span class="tag">Felt ${esc(f.label.toLowerCase())}</span>` : ''}${x.t ? `<p translate="no">${esc(x.t)}</p>` : ''}${x.ph ? `<a class="rv-photo" href="/_blob/${x.ph}" target="_blank" rel="noopener" aria-label="Open this photo in a new tab"><img class="rev-img" src="/_blob/${x.ph}" alt="Photo shared with this review" loading="lazy" decoding="async"></a>` : ''}
    <div class="rv-acts">${votes}<button type="button" class="rv-act" data-act="thread" data-tg="${tg}" aria-expanded="${open}">${n ? `${n} ${plural(n, 'comment', 'comments')}` : 'Comment'}</button></div>
    ${open ? threadHTML(x, tg) : ''}</li>`;
}
const photosOf = R => R.list.filter(x => x.ph);
function photoStripHTML(R){
  const ph = photosOf(R); if (ph.length < 2) return '';
  return `<div class="ph-strip"><p class="label muted">Traveler photos · ${ph.length}</p><ul>${ph.slice(0, 10).map(x => `<li><a href="/_blob/${x.ph}" target="_blank" rel="noopener" aria-label="Open a traveler photo in a new tab"><img class="rev-img" src="/_blob/${x.ph}" alt="Traveler photo" loading="lazy" decoding="async"></a></li>`).join('')}</ul></div>`;
}
function reviewsHTML(pid, title){
  if (!BE.ready) return '<p class="small muted">Reviews need the shared version of this page. Once it is connected, what travelers say about this place appears here as they post it.</p>';
  if (!BE.reviewsAt) return '<p class="small muted">Connecting to the live reviews…</p>';
  const R = BE.reviewsFor(pid);
  if (!R.n) return `<div class="rev-empty"><p class="title">No reviews yet</p><p class="small muted">Nobody has reviewed ${esc(title)} so far. Been there? Be the first to tell the next traveler what it is really like.</p></div>`;
  const list = revAll ? R.list : R.list.slice(0, REV_SHOWN), newest = R.list[0];
  const fresh = x => !!seenRev && !seenRev.has(revKey(x));
  return `<div class="agg"><div class="agg-main"><b class="agg-num">${avgText(R.avg)}</b>${starsHTML(R.avg)}<small>${R.n} ${plural(R.n, 'review', 'reviews')}${newest.at ? ` · latest ${ago(newest.at)}` : ''}</small></div>
    <ul class="dist" aria-label="Rating breakdown">${[5, 4, 3, 2, 1].map(v => `<li><span>${v}</span><i><u style="width:${R.dist[v - 1] / R.n * 100}%"></u></i><span class="tnum">${R.dist[v - 1]}</span></li>`).join('')}</ul></div>
    ${photoStripHTML(R)}
    <ul class="rvs">${list.map(x => revItemHTML(x, fresh(x))).join('')}</ul>
    ${R.n > REV_SHOWN ? `<button type="button" class="crowd-link" data-act="morerev">${revAll ? 'Show fewer reviews' : `Show all ${R.n} reviews`}</button>` : ''}`;
}
