/* features/place/maps-google.js — Place: Google Maps links and live Google details. */
/* A free-text Maps search can put an ad or a look-alike first, so a stop with a named venue opens that exact place by its Place ID
   (query_place_id wins over the text). Stops with no venue keep a plain search and say so. */
const mapsUrl = (title, d) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${title}, ${d.name}, ${d.country}`);
const spotUrl = sp => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(sp.name) + '&query_place_id=' + encodeURIComponent(sp.gid);
const ICON_OUT = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 3h7v7M13 3 4 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function spotHTML(sp){
  return `<section class="pl-spot" aria-labelledby="plSpotH"><p class="label accent" id="plSpotH">Our pick</p><h3 class="title">${esc(sp.name)}</h3>
    <a class="gmap" href="${esc(spotUrl(sp))}" target="_blank" rel="noopener noreferrer">Open on Google Maps${ICON_OUT}</a>
    ${GOOGLE_ON ? `<div class="gg" id="plGoogle" data-gid="${esc(sp.gid)}" aria-live="polite"><p class="fine">Loading Google Maps details…</p></div>`
                : '<p class="fine">Opens this exact place in a new tab. Its Google reviews, photos and opening hours live there, not in this page.</p>'}</section>`;
}
const genericMapHTML = (s, d) => `<a class="gmap" href="${esc(mapsUrl(s.title, d))}" target="_blank" rel="noopener noreferrer">Search Google Maps${ICON_OUT}</a>
      <p class="fine">Opens a text search in a new tab. Search results can include ads, so check the name before you go.</p>`;
/* ---------- Google Maps details: the Cloudflare build only. Its own server holds the API key and hands back rating, photos and reviews.
   Google's rules apply: every photo and review keeps its author, review text is shown as returned, the "Google Maps" mark stays on the block,
   and nothing is saved beyond this page view. ---------- */
const GOOGLE_ON = !!window.MT_GOOGLE;
const G_IMG = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.googleusercontent\.com\//i, G_LINK = /^https:\/\/(www\.google\.com|maps\.google\.com|google\.com)\//i, LANG_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;
const gOK = (u, re) => typeof u === 'string' && re.test(u) ? u : '';
const gcache = new Map();
const nf = new Intl.NumberFormat('en');
function gAuthor(a, strong){
  const name = esc((a && a.name) || 'A Google Maps user'), url = gOK(a && a.url, G_LINK);
  const t = url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${name}</a>` : name;
  return strong ? `<b>${t}</b>` : t;
}
function googleHTML(g, sp){
  const n = Math.max(0, +g.count || 0), rate = +g.rating > 0;
  const head = rate ? `<div class="gg-head"><b class="gg-num">${avgText(+g.rating)}</b>${starsHTML(+g.rating)}<small>${nf.format(n)} Google ${plural(n, 'review', 'reviews')}</small></div>` : '';
  const photos = (Array.isArray(g.photos) ? g.photos : []).filter(p => p && typeof p.ref === 'string').slice(0, 6).map(p => {
    const ref = encodeURIComponent(p.ref), who = (p.by && p.by.name) || 'a Google Maps user';
    return `<li><a class="ph" href="/api/photo?ref=${ref}&amp;w=1600" target="_blank" rel="noopener" aria-label="Open a larger photo of ${esc(sp.name)} by ${esc(who)}"><img src="/api/photo?ref=${ref}&amp;w=480" alt="${esc(sp.name)}, photo by ${esc(who)}" loading="lazy" decoding="async"></a><small>${gAuthor(p.by, false)}</small></li>`;
  }).join('');
  const revs = (Array.isArray(g.reviews) ? g.reviews : []).slice(0, 5).map(r => {
    const av = gOK(r.by && r.by.avatar, G_IMG), flag = gOK(r.flag, G_LINK), moved = r.o && r.ol && r.tl && r.ol !== r.tl && LANG_RE.test(r.ol);
    return `<li class="gg-rv"><div class="gg-top">${av ? `<img class="gg-av" src="${esc(av)}" alt="" width="32" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}<div>${gAuthor(r.by, true)}<span>${+r.rating > 0 ? starsHTML(+r.rating) : ''}${r.when ? esc(r.when) : ''}</span></div></div>
      ${r.t ? `<p>${esc(r.t)}</p>` : ''}${moved ? `<details class="gg-orig"><summary>Translated by Google · see original</summary><p lang="${esc(r.ol)}">${esc(r.o)}</p></details>` : ''}${flag ? `<a class="gg-flag" href="${esc(flag)}" target="_blank" rel="noopener noreferrer">Report this review</a>` : ''}</li>`;
  }).join('');
  const hours = Array.isArray(g.hours) && g.hours.length ? `<details class="gg-hours"><summary>Opening hours</summary><ul>${g.hours.slice(0, 7).map(h => `<li>${esc(h)}</li>`).join('')}</ul></details>` : '';
  const link = gOK(g.url, G_LINK) || spotUrl(sp);
  return `${head}${photos ? `<ul class="gg-photos" aria-label="Photos from Google Maps">${photos}</ul>` : ''}${hours}${revs ? `<ul class="gg-revs">${revs}</ul>` : ''}
    <p class="gg-attr"><span class="gg-mark" translate="no">Google Maps</span><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">See all reviews and photos${ICON_OUT}</a></p>`;
}
async function loadGoogle(sp){
  const mount = () => { const b = $('#plGoogle'); return b && b.dataset.gid === sp.gid ? b : null; };
  if (!GOOGLE_ON || !mount()) return;
  let g = gcache.get(sp.gid);
  if (!g){
    try {
      const res = await fetch('/api/place?id=' + encodeURIComponent(sp.gid), { headers:{ accept:'application/json' } });
      if (res.status === 503){ const b = mount(); if (b) b.remove(); try { console.info('MoodTrip: set GOOGLE_PLACES_API_KEY on the server to show Google reviews and photos.'); } catch (e) {} return; }
      if (!res.ok) throw new Error(String(res.status));
      g = await res.json(); gcache.set(sp.gid, g);
    } catch (e) { const b = mount(); if (b) b.innerHTML = '<p class="fine">Google Maps details are not available right now. The button above still opens the place.</p>'; return; }
  }
  const b = mount(); if (b) b.innerHTML = googleHTML(g, sp);
}
