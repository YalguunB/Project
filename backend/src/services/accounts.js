/* backend/src/services/accounts.js — Accounts: a username and a password linked to one traveler id. No email and no password reset in this prototype.
   Signing up links the browser's anonymous traveler (and everything it saved) to the new account; signing in elsewhere gets a session token for that same
   id. Passwords are hashed with PBKDF2 and a random salt; session tokens are stored as hashes. Returns { status, body }; knows nothing about HTTP. */
import { pbkdf2 as pbkdf2Cb, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { ID_RE, KEY_RE, sha256, same, LOGINS_PER_MINUTE } from './security.js';

const pbkdf2 = promisify(pbkdf2Cb);
const NAME_RE = /^[a-z0-9_.-]{3,24}$/i;
const SESSION_DAYS = 30, PBKDF2_ROUNDS = 100000;
const err = (status, error, headers) => ({ status, body: { error }, headers });
const hashPassword = async (password, salt) => (await pbkdf2(password, salt, PBKDF2_ROUNDS, 32, 'sha256')).toString('hex');

export function accountsService({ accounts, access }) {
  function newSession(id, name) {
    const token = randomBytes(32).toString('hex');
    if (Math.random() < 0.02) accounts.sweepSessions();
    accounts.addSession(sha256('session:' + token), id, name, Date.now() + SESSION_DAYS * 864e5);
    return token;
  }

  return {
    me(authorization) {                               // GET /api/auth/me
      const s = access.session(authorization);
      return s ? { status: 200, body: s } : err(401, 'signed_out');
    },

    logout(authorization) {                           // POST /api/auth/logout
      const h = authorization || '';
      if (/^Bearer [0-9a-f]{64}$/.test(h)) accounts.removeSession(sha256('session:' + h.slice(7)));
      return { status: 204 };
    },

    async enter(what, text, ip) {                     // POST /api/auth/signup | /api/auth/login
      if (what !== 'signup' && what !== 'login') return err(404, 'not_found');
      let body; try { body = JSON.parse(text); } catch (e) { return err(400, 'bad_json'); }
      if (!body || typeof body !== 'object') return err(400, 'bad_json');
      const display = typeof body.username === 'string' ? body.username.trim() : '', password = typeof body.password === 'string' ? body.password : '';
      if (!NAME_RE.test(display)) return err(400, 'bad_username');
      if (password.length < 8 || password.length > 200) return err(400, 'bad_password');
      if (access.tooMany(ip, 'auth', LOGINS_PER_MINUTE)) return err(429, 'rate_limited', { 'retry-after': '60' });
      const name = display.toLowerCase();

      if (what === 'login') {
        const acc = accounts.account(name);
        const hash = await hashPassword(password, acc ? acc.salt : 'no-such-account');   // same work either way, so timing does not reveal names
        if (!acc || !same(hash, acc.hash)) return err(401, 'wrong_login');
        return { status: 200, body: { id: acc.id, name: acc.display, token: newSession(acc.id, acc.display) } };
      }

      // signup: the browser proves it owns its current traveler id with its secret, and that id gets the account
      const id = typeof body.id === 'string' ? body.id : '', key = typeof body.key === 'string' ? body.key : '';
      if (!ID_RE.test(id) || !KEY_RE.test(key)) return err(400, 'bad_id');
      if (!access.owns(id, key, true, null)) return err(403, 'forbidden');
      const salt = randomBytes(16).toString('hex'), hash = await hashPassword(password, salt);
      if (!accounts.create(name, display, id, salt, hash)) return err(409, accounts.nameTaken(name) ? 'name_taken' : 'id_has_account');
      return { status: 200, body: { id, name: display, token: newSession(id, display) } };
    }
  };
}
