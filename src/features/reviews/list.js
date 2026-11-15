/* features/reviews/list.js — Reviews: list, stars, aggregate. */
/* ---------- place panel: what a stop is like, plus live traveler reviews ---------- */
const STAR_WORDS = ['Poor', 'Fair', 'Good', 'Great', 'Superb'];
const REV_SHOWN = 6;
let placeId = null, placeOpener = null, revAll = false, lastPost = 0, agoTimer = 0, seenRev = null; // seenRev: reviews already on screen (null until the first live load)
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function ago(ms){
  if (!ms) return '';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); if (s < 45) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); return d < 30 ? `${d} ${plural(d, 'day', 'days')} ago` : new Date(ms).toLocaleDateString('en-US', { month:'short', year:'numeric' });
}
const starsHTML = v => `<span class="stars" style="--p:${Math.round(v / 5 * 100)}%" role="img" aria-label="${avgText(v)} out of 5"></span>`;
const revKey = x => x.uid + '|' + x.pid + '|' + x.at;
function revItemHTML(x, fresh){
  const f = x.f && FEEL.find(k => k.id === x.f);
  return `<li class="rv${fresh ? ' fresh' : ''}${x.mine ? ' mine' : ''}"><div class="rv-top">${starsHTML(x.r)}<b>${esc(x.name)}${x.mine ? ' · you' : ''}</b>${x.at ? `<time datetime="${new Date(x.at).toISOString()}">${ago(x.at)}</time>` : ''}</div>${f ? `<span class="tag">Felt ${esc(f.label.toLowerCase())}</span>` : ''}${x.t ? `<p>${esc(x.t)}</p>` : ''}${x.ph ? `<a class="rv-photo" href="/_blob/${x.ph}" target="_blank" rel="noopener" aria-label="Open this photo in a new tab"><img class="rev-img" src="/_blob/${x.ph}" alt="Photo shared with this review" loading="lazy" decoding="async"></a>` : ''}</li>`;
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
