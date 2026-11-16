/* backend/src/services/security.js — Who may change what: owner secrets and sessions (both stored only as hashes), the admin token, and rate limits. */
import { createHash, timingSafeEqual } from 'node:crypto';

export const ID_RE = /^[0-9a-f]{32}$/, KEY_RE = /^[0-9a-f]{64}$/;
export const WRITES_PER_MINUTE = 30, LOGINS_PER_MINUTE = 8;   // per visitor address

export const sha256 = s => createHash('sha256').update(s).digest('hex');
export const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export function isAdmin(authorization, adminToken) {
  const h = authorization || '';
  return !!adminToken && adminToken.length >= 16 && h.startsWith('Bearer ') && same(h.slice(7), adminToken);
}

export function makeAccess({ repo, accounts }) {
  return {
    /* A signed-in browser sends "authorization: Bearer <token>". Returns { id, name } or null. */
    session(authorization) {
      const h = authorization || '';
      if (!/^Bearer [0-9a-f]{64}$/.test(h)) return null;
      const row = accounts.session(sha256('session:' + h.slice(7)));
      return row && row.expires > Date.now() ? { id: row.id, name: row.name } : null;
    },
    /* An id belongs to whoever first wrote with it (their browser's secret), and to a signed-in session of the account linked to it. */
    owns(id, key, claim, sess) {
      if (sess && sess.id === id) return true;
      if (!KEY_RE.test(key)) return false;
      const hash = sha256('moodtrip:' + key);
      if (claim) repo.claim(id, hash);
      const have = repo.ownerHash(id);
      return !!have && same(have, hash);
    },
    tooMany(ip, kind = 'ip', limit = WRITES_PER_MINUTE) {
      const bucket = Math.floor(Date.now() / 60000), k = sha256(kind + ':' + ip).slice(0, 24);
      const n = repo.hit(k, bucket);
      if (Math.random() < 0.02) repo.sweep(bucket - 5);
      return n > limit;
    }
  };
}
