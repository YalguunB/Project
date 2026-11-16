/* backend/src/services/documents.js — Rules for the documents: shared ones everybody reads (feelings, cards, reviews, comments, votes)
   and private ones only their owner reads (trip, profile, plans). Returns { status, body, headers }; knows nothing about HTTP. */
import { ID_RE, KEY_RE, sha256, same, isAdmin } from './security.js';

const SHARED = new Set(['feelings', 'cards', 'reviews', 'comments', 'votes']);
const PRIVATE = new Set(['trip', 'profile', 'plans']);
const MAX_BYTES = { feelings: 2048, cards: 1024, reviews: 40000, comments: 60000, votes: 60000, trip: 40000, profile: 12000, plans: 400000 };
const MAX_DOCS = 20000;                               // total documents kept; new ones are refused beyond this
const TARGET_RE = /^[0-9a-f]{32}~[a-z]+:\d{1,2}:\d{1,2}$/;   // a review: <author id>~<place id>
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const err = (status, error, headers) => ({ status, body: { error }, headers });
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

export function documentsService({ repo, access, adminToken }) {
  const known = coll => SHARED.has(coll) || PRIVATE.has(coll);

  /* the tag of a collection is "<count>:<newest update>"; a reader that sends the tag it has gets "unchanged" back */
  function changed(pairs) {
    const out = {};
    for (const [coll, since] of pairs) {
      const s = repo.stat(coll), tag = `${s.c}:${s.m}`;
      if (since === tag) { out[coll] = { tag, unchanged: true }; continue; }
      const docs = [];
      for (const r of repo.list(coll)) { try { docs.push({ id: r.id, data: JSON.parse(r.data) }); } catch (e) {} }
      out[coll] = { tag, docs };
    }
    return out;
  }

  return {
    methodNotAllowed: coll => known(coll) ? err(405, 'method_not_allowed') : err(404, 'not_found'),

    list(coll, since) {                               // GET /api/db/<collection>
      if (!known(coll)) return err(404, 'not_found');
      if (PRIVATE.has(coll)) return err(405, 'method_not_allowed');
      return { status: 200, body: changed([[coll, since || '']])[coll] };
    },

    sync(search) {                                    // GET /api/sync?feelings=<tag>&cards=<tag>... every shared collection that changed
      const pairs = [...new URLSearchParams(search || '').entries()].filter(([c]) => SHARED.has(c)).slice(0, SHARED.size);
      if (!pairs.length) return err(400, 'nothing_asked');
      return { status: 200, body: changed(pairs) };
    },

    read(coll, id, key, authorization) {              // GET /api/db/<collection>/<id>
      if (!known(coll)) return err(404, 'not_found');
      if (!ID_RE.test(id)) return err(400, 'bad_id');
      if (PRIVATE.has(coll)) {
        const sess = access.session(authorization);
        if (!(sess && sess.id === id)) {
          if (!KEY_RE.test(key)) return err(404, 'not_found');
          const have = repo.ownerHash(id);
          if (!have || !same(have, sha256('moodtrip:' + key))) return err(404, 'not_found');
        }
      }
      const row = repo.get(coll, id);
      if (!row) return err(404, 'not_found');
      try { return { status: 200, body: { id, data: JSON.parse(row.data) } }; } catch (e) { return err(404, 'not_found'); }
    },

    remove(coll, id, key, authorization) {            // DELETE /api/db/<collection>/<id>
      if (!known(coll)) return err(404, 'not_found');
      if (!ID_RE.test(id)) return err(400, 'bad_id');
      if (!isAdmin(authorization, adminToken) && !access.owns(id, key, false, access.session(authorization))) return err(403, 'forbidden');
      repo.remove(coll, id);
      return { status: 204 };
    },

    write(coll, id, key, authorization, text, ip) {   // PUT /api/db/<collection>/<id>
      if (!known(coll)) return err(404, 'not_found');
      if (!ID_RE.test(id)) return err(400, 'bad_id');
      if (text.length > MAX_BYTES[coll]) return err(413, 'too_large');   // cheap checks first
      let data; try { data = JSON.parse(text); } catch (e) { return err(400, 'bad_json'); }
      if (!valid(coll, data)) return err(400, 'invalid');
      const sess = access.session(authorization);
      if (!(sess && sess.id === id) && !KEY_RE.test(key)) return err(403, 'forbidden');
      if (access.tooMany(ip)) return err(429, 'rate_limited', { 'retry-after': '60' });
      if (!repo.has(coll, id) && repo.total() >= MAX_DOCS) return err(507, 'full');
      if (!access.owns(id, key, true, sess)) return err(403, 'forbidden');
      stampNames(coll, data, sess && sess.id === id ? sess : null);
      repo.save(coll, id, JSON.stringify(data));
      return { status: 204 };
    }
  };
}
