/* MoodTrip on Cloudflare: one Worker for everything dynamic. Static files (public/) are served by Cloudflare itself.

   GET  /api/place?id=<Place ID>             Google rating, photos and reviews for one of the venues this site uses
   GET  /api/photo?ref=<photo name>&w=<px>   redirects to one Google photo (so the API key never reaches the browser)
   GET  /api/db/<collection>[?since=<tag>]   shared documents (feelings, cards, reviews), readable by everyone
   GET|PUT|DELETE /api/db/<collection>/<id>  one document, writable only by the browser that owns <id>
   GET|PUT|DELETE /api/db/trip/<id>          a private saved trip, readable and writable only by its owner
   GET|PUT|DELETE /api/db/profile/<id>       a private profile (visits, trips taken), readable and writable only by its owner
   GET  /api/health                          which parts are configured

   Bindings: DB (D1), secret GOOGLE_PLACES_API_KEY (optional), secret ADMIN_TOKEN (optional, for moderation), var PLACES_BASE. */
import SPOTS from './spots.json';

const ALLOWED = new Set(SPOTS);                      // the API key only ever asks Google about these places
const SHARED = new Set(['feelings', 'cards', 'reviews']);
const PRIVATE = new Set(['trip', 'profile']);         // only the owner can read these
const ID_RE = /^[0-9a-f]{32}$/, KEY_RE = /^[0-9a-f]{64}$/;
const MAX_BYTES = { feelings:2048, cards:1024, reviews:40000, trip:40000, profile:12000 };
const MAX_DOCS = 20000;                              // total documents kept; new ones are refused beyond this
const WRITES_PER_MINUTE = 30;                        // per visitor address
const G_IMG = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.googleusercontent\.com\//i;

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff', ...headers }
});

/* Server-Timing: every response says how many database round trips it made and how long they and Google took.
   Open DevTools > Network > a request > Timing to see it. Each D1 round trip is a trip from the Worker to the database's
   home region, so the count matters more than the SQL: keep it low and batch what can be batched. */
function timer(env) {
  const t = { db:0, dbMs:0, gMs:0, start:Date.now() };
  const wrap = stmt => ({
    first: async () => { const a = Date.now(); try { return await stmt.first(); } finally { t.db++; t.dbMs += Date.now() - a; } },
    all:   async () => { const a = Date.now(); try { return await stmt.all();   } finally { t.db++; t.dbMs += Date.now() - a; } },
    run:   async () => { const a = Date.now(); try { return await stmt.run();   } finally { t.db++; t.dbMs += Date.now() - a; } },
    raw:   stmt
  });
  t.q = (sql, ...args) => wrap(env.DB.prepare(sql).bind(...args));
  t.batch = async list => { const a = Date.now(); try { return await env.DB.batch(list.map(x => x.raw)); } finally { t.db++; t.dbMs += Date.now() - a; } };
  t.google = async (...args) => { const a = Date.now(); try { return await fetch(...args); } finally { t.gMs += Date.now() - a; } };
  t.header = () => `db;desc="${t.db} D1 round trips";dur=${t.dbMs}, google;dur=${t.gMs}, total;dur=${Date.now() - t.start}`;
  return t;
}
const timed = (res, t) => {
  const h = new Headers(res.headers); h.set('server-timing', t.header());
  return new Response(res.body, { status:res.status, statusText:res.statusText, headers:h });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status:404 });
    const t = timer(env);
    try {
      if (path === '/api/place') return timed(await place(request, env, url, t), t);
      if (path === '/api/photo') return timed(await photo(request, env, url, t), t);
      if (path.startsWith('/api/db/')) return timed(await store(request, env, url, t), t);
      if (path === '/api/health') return json({ ok:true, database:!!env.DB, google:!!env.GOOGLE_PLACES_API_KEY, moderation:!!env.ADMIN_TOKEN });
      return json({ error:'not_found' }, 404);
    } catch (e) {
      return timed(json({ error:'server_error' }, 500), t);
    }
  }
};

/* ---------------------------------------------------------------- Google Places ---------------------------------------------------------------- */
const placesBase = env => (env.PLACES_BASE || 'https://places.googleapis.com/v1').replace(/\/+$/, '');
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const who = a => ({ name:str(a && a.displayName, 120), url:str(a && a.uri, 400), avatar:str(a && a.photoUri, 500) });

async function place(request, env, url, t) {
  if (request.method !== 'GET') return json({ error:'method_not_allowed' }, 405);
  const id = url.searchParams.get('id') || '';
  if (!ALLOWED.has(id)) return json({ error:'unknown_place' }, 404);
  if (!env.GOOGLE_PLACES_API_KEY) return json({ error:'not_configured' }, 503);
  const res = await t.google(`${placesBase(env)}/places/${id}?languageCode=en`, {
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

async function photo(request, env, url, t) {
  if (request.method !== 'GET') return new Response('Method not allowed', { status:405 });
  const m = /^places\/([A-Za-z0-9_-]{20,200})\/photos\/([A-Za-z0-9_-]{10,600})$/.exec(url.searchParams.get('ref') || '');
  if (!m || !ALLOWED.has(m[1])) return new Response('Not found', { status:404 });
  if (!env.GOOGLE_PLACES_API_KEY) return new Response('Not configured', { status:503 });
  const w = Math.min(1600, Math.max(100, parseInt(url.searchParams.get('w'), 10) || 480));
  const res = await t.google(`${placesBase(env)}/${m[0]}/media?maxWidthPx=${w}&skipHttpRedirect=true&key=${encodeURIComponent(env.GOOGLE_PLACES_API_KEY)}`);
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
/* An id belongs to whoever first wrote with it. Later requests must present the same secret.
   Reading: one query. Claiming (on a write): the insert and the read-back go together in one batch, so one round trip. */
async function owns(t, id, key, claim) {
  if (!KEY_RE.test(key)) return false;
  const hash = await sha256('moodtrip:' + key);
  let row;
  if (claim) {
    const out = await t.batch([
      t.q('INSERT OR IGNORE INTO owners (id, hash, created) VALUES (?, ?, ?)', id, hash, Date.now()),
      t.q('SELECT hash FROM owners WHERE id = ?', id)
    ]);
    row = out[1].results[0];
  } else row = await t.q('SELECT hash FROM owners WHERE id = ?', id).first();
  return !!row && same(row.hash, hash);
}
/* One statement counts the write and returns the new count (it used to be an insert and then a select). */
async function tooMany(t, request) {
  const bucket = Math.floor(Date.now() / 60000);
  const k = (await sha256('ip:' + (request.headers.get('cf-connecting-ip') || 'local'))).slice(0, 24);
  const row = await t.q('INSERT INTO hits (k, bucket, n) VALUES (?, ?, 1) ON CONFLICT(k, bucket) DO UPDATE SET n = n + 1 RETURNING n', k, bucket).first();
  if (Math.random() < 0.02) await t.q('DELETE FROM hits WHERE bucket < ?', bucket - 5).run();
  return !!row && row.n > WRITES_PER_MINUTE;
}
function valid(coll, d) {
  if (!isObj(d)) return false;
  if (coll === 'feelings') return d.v === 1 && isObj(d.reports) && Object.keys(d.reports).length <= 12;
  if (coll === 'cards') return d.v === 1 && typeof d.w === 'string' && typeof d.f === 'string';
  if (coll === 'reviews') return d.v === 1 && isObj(d.items) && Object.keys(d.items).length <= 300;
  if (coll === 'profile') return d.v === 1 && Array.isArray(d.trips) && d.trips.length <= 30 && d.trips.every(isObj);
  return coll === 'trip';
}

async function store(request, env, url, t) {
  if (!env.DB) return json({ error:'no_database' }, 503);
  const [coll, id] = url.pathname.split('/').filter(Boolean).slice(2);
  const priv = PRIVATE.has(coll);
  if (!SHARED.has(coll) && !priv) return json({ error:'not_found' }, 404);
  const key = request.headers.get('x-mt-key') || '', method = request.method;

  if (!id) {                                                   // list a shared collection
    if (method !== 'GET' || priv) return json({ error:'method_not_allowed' }, 405);
    // most polls change nothing: answer those with one cheap query, and only read the documents when something changed
    const stat = await t.q('SELECT COUNT(*) AS c, COALESCE(MAX(updated), 0) AS m FROM docs WHERE coll = ?', coll).first();
    const tag = `${stat.c}:${stat.m}`;
    if (url.searchParams.get('since') === tag) return json({ tag, unchanged:true });
    const { results } = await t.q('SELECT id, data FROM docs WHERE coll = ? ORDER BY updated DESC LIMIT 500', coll).all();
    const docs = [];
    for (const r of results) { try { docs.push({ id:r.id, data:JSON.parse(r.data) }); } catch (e) {} }
    return json({ tag, docs });
  }

  if (!ID_RE.test(id)) return json({ error:'bad_id' }, 400);

  if (method === 'GET') {
    let row;
    if (priv) {                                                // owner check and read in one round trip
      if (!KEY_RE.test(key)) return json({ error:'not_found' }, 404);
      const hash = await sha256('moodtrip:' + key);
      const out = await t.batch([t.q('SELECT hash FROM owners WHERE id = ?', id), t.q('SELECT data FROM docs WHERE coll = ? AND id = ?', coll, id)]);
      const o = out[0].results[0];
      if (!o || !same(o.hash, hash)) return json({ error:'not_found' }, 404);
      row = out[1].results[0];
    } else row = await t.q('SELECT data FROM docs WHERE coll = ? AND id = ?', coll, id).first();
    if (!row) return json({ error:'not_found' }, 404);
    try { return json({ id, data:JSON.parse(row.data) }); } catch (e) { return json({ error:'not_found' }, 404); }
  }

  if (method === 'DELETE') {
    if (!isAdmin(request, env) && !(await owns(t, id, key, false))) return json({ error:'forbidden' }, 403);
    await t.q('DELETE FROM docs WHERE coll = ? AND id = ?', coll, id).run();
    return new Response(null, { status:204, headers:{ 'cache-control':'no-store' } });
  }

  if (method === 'PUT') {
    const text = await request.text();                         // cheap checks first: a bad request costs no database trip
    if (text.length > MAX_BYTES[coll]) return json({ error:'too_large' }, 413);
    let data; try { data = JSON.parse(text); } catch (e) { return json({ error:'bad_json' }, 400); }
    if (!valid(coll, data)) return json({ error:'invalid' }, 400);
    if (!KEY_RE.test(key)) return json({ error:'forbidden' }, 403);
    if (await tooMany(t, request)) return json({ error:'rate_limited' }, 429, { 'retry-after':'60' });
    // "is this document new?" and "how many documents are there?" in one query (they used to be two)
    const cap = await t.q('SELECT EXISTS(SELECT 1 FROM docs WHERE coll = ? AND id = ?) AS have, (SELECT COUNT(*) FROM docs) AS c', coll, id).first();
    if (!cap.have && cap.c >= MAX_DOCS) return json({ error:'full' }, 507);
    if (!(await owns(t, id, key, true))) return json({ error:'forbidden' }, 403);
    await t.q('INSERT INTO docs (coll, id, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data, updated = excluded.updated',
      coll, id, JSON.stringify(data), Date.now()).run();
    return new Response(null, { status:204, headers:{ 'cache-control':'no-store' } });
  }
  return json({ error:'method_not_allowed' }, 405);
}
