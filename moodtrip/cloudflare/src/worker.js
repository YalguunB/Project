/* MoodTrip on Cloudflare: one Worker for everything dynamic. Static files (public/) are served by Cloudflare itself.

   GET  /api/place?id=<Place ID>             Google rating, photos and reviews for one of the venues this site uses
   GET  /api/photo?ref=<photo name>&w=<px>   redirects to one Google photo (so the API key never reaches the browser)
   GET  /api/db/<collection>[?since=<tag>]   shared documents (feelings, cards, reviews), readable by everyone
   GET|PUT|DELETE /api/db/<collection>/<id>  one document, writable only by the browser that owns <id>
   GET|PUT|DELETE /api/db/trip/<id>          a private saved trip, readable and writable only by its owner
   GET  /api/health                          which parts are configured

   Bindings: DB (D1), secret GOOGLE_PLACES_API_KEY (optional), secret ADMIN_TOKEN (optional, for moderation), var PLACES_BASE. */
import SPOTS from './spots.json';

const ALLOWED = new Set(SPOTS);                      // the API key only ever asks Google about these places
const SHARED = new Set(['feelings', 'cards', 'reviews']);
const ID_RE = /^[0-9a-f]{32}$/, KEY_RE = /^[0-9a-f]{64}$/;
const MAX_BYTES = { feelings:2048, cards:1024, reviews:40000, trip:40000 };
const MAX_DOCS = 20000;                              // total documents kept; new ones are refused beyond this
const WRITES_PER_MINUTE = 30;                        // per visitor address
const G_IMG = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.googleusercontent\.com\//i;

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff', ...headers }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status:404 });
    try {
      if (path === '/api/place') return await place(request, env, url);
      if (path === '/api/photo') return await photo(request, env, url);
      if (path.startsWith('/api/db/')) return await store(request, env, url);
      if (path === '/api/health') return json({ ok:true, database:!!env.DB, google:!!env.GOOGLE_PLACES_API_KEY, moderation:!!env.ADMIN_TOKEN });
      return json({ error:'not_found' }, 404);
    } catch (e) {
      return json({ error:'server_error' }, 500);
    }
  }
};

/* ---------------------------------------------------------------- Google Places ---------------------------------------------------------------- */
const placesBase = env => (env.PLACES_BASE || 'https://places.googleapis.com/v1').replace(/\/+$/, '');
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const who = a => ({ name:str(a && a.displayName, 120), url:str(a && a.uri, 400), avatar:str(a && a.photoUri, 500) });

async function place(request, env, url) {
  if (request.method !== 'GET') return json({ error:'method_not_allowed' }, 405);
  const id = url.searchParams.get('id') || '';
  if (!ALLOWED.has(id)) return json({ error:'unknown_place' }, 404);
  if (!env.GOOGLE_PLACES_API_KEY) return json({ error:'not_configured' }, 503);
  const res = await fetch(`${placesBase(env)}/places/${id}?languageCode=en`, {
    headers:{
      'X-Goog-Api-Key':env.GOOGLE_PLACES_API_KEY,
      // ask only for what the page shows: the price depends on the fields requested
      'X-Goog-FieldMask':'id,displayName,rating,userRatingCount,googleMapsUri,regularOpeningHours.weekdayDescriptions,photos,reviews'
    }
  });
  if (!res.ok) return json({ error:'upstream', status:res.status }, 502);
  const p = await res.json();
  // Google's content is passed through unchanged and never stored here: not in the database, not in a cache.
  return json({
    id,
    name:str(p.displayName && p.displayName.text, 160),
    rating:Number(p.rating) || 0,
    count:Number(p.userRatingCount) || 0,
    url:str(p.googleMapsUri, 400),
    hours:((p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions) || []).slice(0, 7).map(h => str(h, 100)),
    photos:(p.photos || []).map(ph => ({ ref:str(ph.name, 700), w:ph.widthPx | 0, h:ph.heightPx | 0, by:who((ph.authorAttributions || [])[0]) }))
      .filter(ph => ph.ref.startsWith(`places/${id}/photos/`)).slice(0, 6),
    reviews:(p.reviews || []).slice(0, 5).map(r => ({
      rating:Number(r.rating) || 0, when:str(r.relativePublishTimeDescription, 60),
      t:str(r.text && r.text.text, 5000), tl:str(r.text && r.text.languageCode, 16),
      o:str(r.originalText && r.originalText.text, 5000), ol:str(r.originalText && r.originalText.languageCode, 16),
      by:who(r.authorAttribution), flag:str(r.flagContentUri, 500)
    }))
  });
}

async function photo(request, env, url) {
  if (request.method !== 'GET') return new Response('Method not allowed', { status:405 });
  const m = /^places\/([A-Za-z0-9_-]{20,200})\/photos\/([A-Za-z0-9_-]{10,600})$/.exec(url.searchParams.get('ref') || '');
  if (!m || !ALLOWED.has(m[1])) return new Response('Not found', { status:404 });
  if (!env.GOOGLE_PLACES_API_KEY) return new Response('Not configured', { status:503 });
  const w = Math.min(1600, Math.max(100, parseInt(url.searchParams.get('w'), 10) || 480));
  const res = await fetch(`${placesBase(env)}/${m[0]}/media?maxWidthPx=${w}&skipHttpRedirect=true&key=${encodeURIComponent(env.GOOGLE_PLACES_API_KEY)}`);
  if (!res.ok) return new Response('Photo unavailable', { status:502 });
  const j = await res.json();
  if (typeof j.photoUri !== 'string' || !G_IMG.test(j.photoUri)) return new Response('Photo unavailable', { status:502 });
  return new Response(null, { status:302, headers:{ location:j.photoUri, 'cache-control':'private, no-store', 'referrer-policy':'no-referrer' } });
}

/* ---------------------------------------------------------------- shared documents (D1) ---------------------------------------------------------------- */
async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const same = (a, b) => { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

function isAdmin(request, env) {
  const t = env.ADMIN_TOKEN, h = request.headers.get('authorization') || '';
  return !!t && t.length >= 16 && h.startsWith('Bearer ') && same(h.slice(7), t);
}
/* An id belongs to whoever first wrote with it. Later requests must present the same secret. */
async function owns(env, id, key, claim) {
  if (!KEY_RE.test(key)) return false;
  const hash = await sha256('moodtrip:' + key);
  const row = await env.DB.prepare('SELECT hash FROM owners WHERE id = ?').bind(id).first();
  if (row) return same(row.hash, hash);
  if (!claim) return false;
  await env.DB.prepare('INSERT OR IGNORE INTO owners (id, hash, created) VALUES (?, ?, ?)').bind(id, hash, Date.now()).run();
  const again = await env.DB.prepare('SELECT hash FROM owners WHERE id = ?').bind(id).first();
  return !!again && same(again.hash, hash);
}
async function tooMany(env, request) {
  const bucket = Math.floor(Date.now() / 60000);
  const k = (await sha256('ip:' + (request.headers.get('cf-connecting-ip') || 'local'))).slice(0, 24);
  await env.DB.prepare('INSERT INTO hits (k, bucket, n) VALUES (?, ?, 1) ON CONFLICT(k, bucket) DO UPDATE SET n = n + 1').bind(k, bucket).run();
  const row = await env.DB.prepare('SELECT n FROM hits WHERE k = ? AND bucket = ?').bind(k, bucket).first();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM hits WHERE bucket < ?').bind(bucket - 5).run();
  return !!row && row.n > WRITES_PER_MINUTE;
}
function valid(coll, d) {
  if (!isObj(d)) return false;
  if (coll === 'feelings') return d.v === 1 && isObj(d.reports) && Object.keys(d.reports).length <= 12;
  if (coll === 'cards') return d.v === 1 && typeof d.w === 'string' && typeof d.f === 'string';
  if (coll === 'reviews') return d.v === 1 && isObj(d.items) && Object.keys(d.items).length <= 300;
  return coll === 'trip';
}

async function store(request, env, url) {
  if (!env.DB) return json({ error:'no_database' }, 503);
  const [coll, id] = url.pathname.split('/').filter(Boolean).slice(2);
  const trip = coll === 'trip';
  if (!SHARED.has(coll) && !trip) return json({ error:'not_found' }, 404);
  const key = request.headers.get('x-mt-key') || '', method = request.method;

  if (!id) {                                                   // list a shared collection
    if (method !== 'GET' || trip) return json({ error:'method_not_allowed' }, 405);
    const stat = await env.DB.prepare('SELECT COUNT(*) AS c, COALESCE(MAX(updated), 0) AS m FROM docs WHERE coll = ?').bind(coll).first();
    const tag = `${stat.c}:${stat.m}`;
    if (url.searchParams.get('since') === tag) return json({ tag, unchanged:true });
    const { results } = await env.DB.prepare('SELECT id, data FROM docs WHERE coll = ? ORDER BY updated DESC LIMIT 500').bind(coll).all();
    const docs = [];
    for (const r of results) { try { docs.push({ id:r.id, data:JSON.parse(r.data) }); } catch (e) {} }
    return json({ tag, docs });
  }

  if (!ID_RE.test(id)) return json({ error:'bad_id' }, 400);

  if (method === 'GET') {
    if (trip && !(await owns(env, id, key, false))) return json({ error:'not_found' }, 404);
    const row = await env.DB.prepare('SELECT data FROM docs WHERE coll = ? AND id = ?').bind(coll, id).first();
    if (!row) return json({ error:'not_found' }, 404);
    try { return json({ id, data:JSON.parse(row.data) }); } catch (e) { return json({ error:'not_found' }, 404); }
  }

  if (method === 'DELETE') {
    if (!isAdmin(request, env) && !(await owns(env, id, key, false))) return json({ error:'forbidden' }, 403);
    await env.DB.prepare('DELETE FROM docs WHERE coll = ? AND id = ?').bind(coll, id).run();
    return new Response(null, { status:204, headers:{ 'cache-control':'no-store' } });
  }

  if (method === 'PUT') {
    if (await tooMany(env, request)) return json({ error:'rate_limited' }, 429, { 'retry-after':'60' });
    const text = await request.text();
    if (text.length > MAX_BYTES[coll]) return json({ error:'too_large' }, 413);
    let data; try { data = JSON.parse(text); } catch (e) { return json({ error:'bad_json' }, 400); }
    if (!valid(coll, data)) return json({ error:'invalid' }, 400);
    const have = await env.DB.prepare('SELECT 1 AS x FROM docs WHERE coll = ? AND id = ?').bind(coll, id).first();
    if (!have) {
      const n = await env.DB.prepare('SELECT COUNT(*) AS c FROM docs').first();
      if (n.c >= MAX_DOCS) return json({ error:'full' }, 507);
    }
    if (!(await owns(env, id, key, true))) return json({ error:'forbidden' }, 403);
    await env.DB.prepare('INSERT INTO docs (coll, id, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data, updated = excluded.updated')
      .bind(coll, id, JSON.stringify(data), Date.now()).run();
    return new Response(null, { status:204, headers:{ 'cache-control':'no-store' } });
  }
  return json({ error:'method_not_allowed' }, 405);
}
