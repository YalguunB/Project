/* MoodTrip on Cloudflare: one Worker for everything dynamic. Static files (public/) are served by Cloudflare itself.

   GET  /api/place?id=<Place ID>             Google rating, photos and reviews for one of the venues this site uses
   GET  /api/photo?ref=<photo name>&w=<px>   redirects to one Google photo (so the API key never reaches the browser)
   GET  /api/db/<collection>[?since=<tag>]   shared documents (feelings, cards, reviews), readable by everyone
   GET|PUT|DELETE /api/db/<collection>/<id>  one document, writable only by the browser that owns <id>
   GET|PUT|DELETE /api/db/trip/<id>          a private saved trip, readable and writable only by its owner
   GET|PUT|DELETE /api/db/profile/<id>       a private profile (visits, trips taken), readable and writable only by its owner
   GET  /api/sync?<collection>=<tag>&...     every shared collection that changed since its tag, in one request
   POST /api/auth/signup|login|logout, GET /api/auth/me   accounts: a username and password linked to a traveler id
   GET  /api/health                          which parts are configured

   Bindings: DB (D1), secret GOOGLE_PLACES_API_KEY (optional), secret ADMIN_TOKEN (optional, for moderation), var PLACES_BASE. */
import SPOTS from './spots.json';

const ALLOWED = new Set(SPOTS);                      // the API key only ever asks Google about these places
const SHARED = new Set(['feelings', 'cards', 'reviews', 'comments', 'votes']);
const PRIVATE = new Set(['trip', 'profile', 'plans']); // only the owner can read these
const ID_RE = /^[0-9a-f]{32}$/, KEY_RE = /^[0-9a-f]{64}$/;
const MAX_BYTES = { feelings:2048, cards:1024, reviews:40000, comments:60000, votes:60000, trip:40000, profile:12000, plans:400000 };
const NAME_RE = /^[a-z0-9_.-]{3,24}$/i;
const SESSION_DAYS = 30, PBKDF2_ROUNDS = 100000, LOGINS_PER_MINUTE = 8;
const TARGET_RE = /^[0-9a-f]{32}~[a-z]+:\d{1,2}:\d{1,2}$/;  // a review: <author id>~<place id>
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
      if (path === '/api/sync') return timed(await sync(request, env, url, t), t);
      if (path.startsWith('/api/auth/')) return timed(await auth(request, env, url, t), t);
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
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
const same = (a, b) => { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const ipKey = async (request, kind) => (await sha256(kind + ':' + (request.headers.get('cf-connecting-ip') || 'local'))).slice(0, 24);

function isAdmin(request, env) {
  const t = env.ADMIN_TOKEN, h = request.headers.get('authorization') || '';
  return !!t && t.length >= 16 && h.startsWith('Bearer ') && same(h.slice(7), t);
}
/* A signed-in browser sends "authorization: Bearer <token>". Returns { id, name } or null. One query. */
async function session(t, request) {
  const h = request.headers.get('authorization') || '';
  if (!/^Bearer [0-9a-f]{64}$/.test(h)) return null;
  const row = await t.q('SELECT id, name, expires FROM sessions WHERE hash = ?', await sha256('session:' + h.slice(7))).first();
  return row && row.expires > Date.now() ? { id:row.id, name:row.name } : null;
}
/* An id belongs to whoever first wrote with it (their browser's secret), and to a signed-in session of the account linked to it.
   Reading: one query. Claiming (on a write): the insert and the read-back go together in one batch, so one round trip. */
async function owns(t, id, key, claim, sess) {
  if (sess && sess.id === id) return true;
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
/* One statement counts the request and returns the new count. */
async function tooMany(t, request, kind = 'ip', limit = WRITES_PER_MINUTE) {
  const bucket = Math.floor(Date.now() / 60000);
  const k = await ipKey(request, kind);
  const row = await t.q('INSERT INTO hits (k, bucket, n) VALUES (?, ?, 1) ON CONFLICT(k, bucket) DO UPDATE SET n = n + 1 RETURNING n', k, bucket).first();
  if (Math.random() < 0.02) await t.q('DELETE FROM hits WHERE bucket < ?', bucket - 5).run();
  return !!row && row.n > limit;
}
const cleanText = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
function valid(coll, d) {
  if (!isObj(d) || d.v !== 1) return false;
  if (coll === 'feelings') return isObj(d.reports) && Object.keys(d.reports).length <= 12;
  if (coll === 'cards') return typeof d.w === 'string' && typeof d.f === 'string';
  if (coll === 'reviews') return isObj(d.items) && Object.keys(d.items).length <= 300 && Object.values(d.items).every(isObj);
  if (coll === 'comments') return isObj(d.items) && Object.keys(d.items).length <= 200
    && Object.entries(d.items).every(([k, list]) => TARGET_RE.test(k) && Array.isArray(list) && list.length <= 20 && list.every(isObj));
  if (coll === 'votes') return isObj(d.items) && Object.keys(d.items).length <= 1000
    && Object.entries(d.items).every(([k, v]) => TARGET_RE.test(k) && (v === 1 || v === -1));
  if (coll === 'profile') return Array.isArray(d.trips) && d.trips.length <= 30 && d.trips.every(isObj);
  if (coll === 'plans') return isObj(d.items) && Object.keys(d.items).length <= 30 && Object.values(d.items).every(p => isObj(p) && isObj(p.trip));
  return coll === 'trip';
}
/* A review or comment may carry the author's username, but only the server writes it: a signed-in author who asked for their
   name (named: true) gets it, everybody else is anonymous, whatever the browser sent. */
function stampNames(coll, d, sess) {
  const stamp = x => { const named = x.named === true && !!sess; delete x.u; delete x.named; if (named) { x.named = true; x.u = sess.name; } };
  if (coll === 'reviews') Object.values(d.items).forEach(stamp);
  if (coll === 'comments') Object.values(d.items).forEach(list => list.forEach(c => { c.t = cleanText(c.t, 400); stamp(c); }));
}

async function store(request, env, url, t) {
  if (!env.DB) return json({ error:'no_database' }, 503);
  const [coll, id] = url.pathname.split('/').filter(Boolean).slice(2);
  const priv = PRIVATE.has(coll);
  if (!SHARED.has(coll) && !priv) return json({ error:'not_found' }, 404);
  const key = request.headers.get('x-mt-key') || '', method = request.method;

  if (!id) {                                                   // list a shared collection (the page uses /api/sync instead)
    if (method !== 'GET' || priv) return json({ error:'method_not_allowed' }, 405);
    const out = await changed(t, [[coll, url.searchParams.get('since') || '']]);
    return json(out[coll]);
  }

  if (!ID_RE.test(id)) return json({ error:'bad_id' }, 400);

  if (method === 'GET') {
    let row;
    if (priv) {                                                // owner check and read in one round trip
      const sess = await session(t, request);
      if (sess && sess.id === id) row = await t.q('SELECT data FROM docs WHERE coll = ? AND id = ?', coll, id).first();
      else {
        if (!KEY_RE.test(key)) return json({ error:'not_found' }, 404);
        const hash = await sha256('moodtrip:' + key);
        const out = await t.batch([t.q('SELECT hash FROM owners WHERE id = ?', id), t.q('SELECT data FROM docs WHERE coll = ? AND id = ?', coll, id)]);
        const o = out[0].results[0];
        if (!o || !same(o.hash, hash)) return json({ error:'not_found' }, 404);
        row = out[1].results[0];
      }
    } else row = await t.q('SELECT data FROM docs WHERE coll = ? AND id = ?', coll, id).first();
    if (!row) return json({ error:'not_found' }, 404);
    try { return json({ id, data:JSON.parse(row.data) }); } catch (e) { return json({ error:'not_found' }, 404); }
  }

  if (method === 'DELETE') {
    const sess = await session(t, request);
    if (!isAdmin(request, env) && !(await owns(t, id, key, false, sess))) return json({ error:'forbidden' }, 403);
    await t.q('DELETE FROM docs WHERE coll = ? AND id = ?', coll, id).run();
    return new Response(null, { status:204, headers:{ 'cache-control':'no-store' } });
  }

  if (method === 'PUT') {
    const text = await request.text();                         // cheap checks first: a bad request costs no database trip
    if (text.length > MAX_BYTES[coll]) return json({ error:'too_large' }, 413);
    let data; try { data = JSON.parse(text); } catch (e) { return json({ error:'bad_json' }, 400); }
    if (!valid(coll, data)) return json({ error:'invalid' }, 400);
    const sess = await session(t, request);
    if (!(sess && sess.id === id) && !KEY_RE.test(key)) return json({ error:'forbidden' }, 403);
    if (await tooMany(t, request)) return json({ error:'rate_limited' }, 429, { 'retry-after':'60' });
    // "is this document new?" and "how many documents are there?" in one query
    const cap = await t.q('SELECT EXISTS(SELECT 1 FROM docs WHERE coll = ? AND id = ?) AS have, (SELECT COUNT(*) FROM docs) AS c', coll, id).first();
    if (!cap.have && cap.c >= MAX_DOCS) return json({ error:'full' }, 507);
    if (!(await owns(t, id, key, true, sess))) return json({ error:'forbidden' }, 403);
    stampNames(coll, data, sess && sess.id === id ? sess : null);
    await t.q('INSERT INTO docs (coll, id, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data, updated = excluded.updated',
      coll, id, JSON.stringify(data), Date.now()).run();
    return new Response(null, { status:204, headers:{ 'cache-control':'no-store' } });
  }
  return json({ error:'method_not_allowed' }, 405);
}

/* ---------------------------------------------------------------- sync: every shared collection in one request ----------------------------------------------------------------
   The page used to poll each collection on its own (five requests every few seconds). Now it sends the tag it has for each one,
   the counts for all of them come back in one batch, and only the collections that changed are read, in a second batch. */
async function changed(t, pairs) {
  const stats = await t.batch(pairs.map(([c]) => t.q('SELECT COUNT(*) AS c, COALESCE(MAX(updated), 0) AS m FROM docs WHERE coll = ?', c)));
  const out = {}, read = [];
  pairs.forEach(([c, since], i) => {
    const s = stats[i].results[0], tag = `${s.c}:${s.m}`;
    if (since === tag) out[c] = { tag, unchanged:true }; else { out[c] = { tag, docs:[] }; read.push(c); }
  });
  if (read.length) {
    const rows = await t.batch(read.map(c => t.q('SELECT id, data FROM docs WHERE coll = ? ORDER BY updated DESC LIMIT 500', c)));
    read.forEach((c, i) => { for (const r of rows[i].results) { try { out[c].docs.push({ id:r.id, data:JSON.parse(r.data) }); } catch (e) {} } });
  }
  return out;
}
async function sync(request, env, url, t) {
  if (!env.DB) return json({ error:'no_database' }, 503);
  if (request.method !== 'GET') return json({ error:'method_not_allowed' }, 405);
  const pairs = [...url.searchParams.entries()].filter(([c]) => SHARED.has(c)).slice(0, SHARED.size);
  if (!pairs.length) return json({ error:'nothing_asked' }, 400);
  return json(await changed(t, pairs));
}

/* ---------------------------------------------------------------- accounts ----------------------------------------------------------------
   No email and no password reset in this prototype: a username and a password, linked to one traveler id. Signing up links the
   browser's current anonymous traveler (and so everything it already saved) to the new account; signing in elsewhere gets a
   session token for that same traveler id. Passwords are hashed with PBKDF2 and a random salt; sessions are stored as hashes. */
async function pbkdf2(password, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:enc.encode(salt), iterations:PBKDF2_ROUNDS }, k, 256));
}
async function newSession(t, id, name) {
  const token = randHex(32);
  await t.q('INSERT INTO sessions (hash, id, name, expires) VALUES (?, ?, ?, ?)', await sha256('session:' + token), id, name, Date.now() + SESSION_DAYS * 864e5).run();
  return token;
}
async function auth(request, env, url, t) {
  if (!env.DB) return json({ error:'no_database' }, 503);
  const what = url.pathname.slice('/api/auth/'.length);
  if (what === 'me') {
    if (request.method !== 'GET') return json({ error:'method_not_allowed' }, 405);
    const s = await session(t, request);
    return s ? json(s) : json({ error:'signed_out' }, 401);
  }
  if (request.method !== 'POST') return json({ error:'method_not_allowed' }, 405);
  if (what === 'logout') {
    const h = request.headers.get('authorization') || '';
    if (/^Bearer [0-9a-f]{64}$/.test(h)) await t.q('DELETE FROM sessions WHERE hash = ?', await sha256('session:' + h.slice(7))).run();
    return new Response(null, { status:204, headers:{ 'cache-control':'no-store' } });
  }
  if (what !== 'signup' && what !== 'login') return json({ error:'not_found' }, 404);
  let body; try { body = JSON.parse(await request.text()); } catch (e) { return json({ error:'bad_json' }, 400); }
  const display = typeof body.username === 'string' ? body.username.trim() : '', password = typeof body.password === 'string' ? body.password : '';
  if (!NAME_RE.test(display)) return json({ error:'bad_username' }, 400);
  if (password.length < 8 || password.length > 200) return json({ error:'bad_password' }, 400);
  if (await tooMany(t, request, 'auth', LOGINS_PER_MINUTE)) return json({ error:'rate_limited' }, 429, { 'retry-after':'60' });
  const name = display.toLowerCase();

  if (what === 'login') {
    const acc = await t.q('SELECT display, id, salt, hash FROM accounts WHERE name = ?', name).first();
    const hash = await pbkdf2(password, acc ? acc.salt : 'no-such-account');  // same work either way, so timing does not reveal names
    if (!acc || !same(hash, acc.hash)) return json({ error:'wrong_login' }, 401);
    return json({ id:acc.id, name:acc.display, token:await newSession(t, acc.id, acc.display) });
  }

  // signup: the browser proves it owns its current traveler id with its secret, and that id gets the account
  const id = typeof body.id === 'string' ? body.id : '', key = typeof body.key === 'string' ? body.key : '';
  if (!ID_RE.test(id) || !KEY_RE.test(key)) return json({ error:'bad_id' }, 400);
  if (!(await owns(t, id, key, true, null))) return json({ error:'forbidden' }, 403);
  const salt = randHex(16), hash = await pbkdf2(password, salt);
  const res = await t.q('INSERT OR IGNORE INTO accounts (name, display, id, salt, hash, created) SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE id = ?)',
    name, display, id, salt, hash, Date.now(), id).run();
  if (!res.meta || !res.meta.changes) {
    const taken = await t.q('SELECT 1 AS x FROM accounts WHERE name = ?', name).first();
    return json({ error:taken ? 'name_taken' : 'id_has_account' }, 409);
  }
  return json({ id, name:display, token:await newSession(t, id, display) });
}
