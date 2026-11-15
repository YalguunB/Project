/* ============ CLOUDFLARE RUNTIME ============
   On claude.ai the platform supplies window.claude (shared database, who is viewing). On Cloudflare this file stands in for it,
   backed by this site's own API (cloudflare/src/worker.js): `db`, `user`, and `auth` (accounts). Traveler photo uploads are not
   offered here, so `assets` resolves to null and the page hides that control.

   Identity:
   - Anonymous: each browser makes a random public id and a random secret and keeps both in localStorage. The server remembers a
     hash of the secret the first time that id writes, so nobody else can overwrite or delete that traveler's documents.
   - Signed in: signing up links the browser's anonymous id to a username and password; signing in on any browser returns a
     session token for that id. Signing out forgets the token and starts a fresh anonymous traveler, so the next person on this
     computer cannot reach the account's documents.

   Shared collections are watched with one request for all of them (/api/sync), every few seconds while the tab is visible and
   straight away after this browser writes. */
(() => {
  if (window.claude && typeof window.claude.use === 'function') return;
  const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
  const load = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const keep = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let who = load('mt.who.v1');
  const freshWho = () => { who = { id:hex(16), key:hex(32) }; keep('mt.who.v1', who); };
  if (!who || !/^[0-9a-f]{32}$/.test(who.id) || !/^[0-9a-f]{64}$/.test(who.key)) freshWho();
  let sess = load('mt.session.v1');
  if (!sess || !/^[0-9a-f]{32}$/.test(sess.id) || !/^[0-9a-f]{64}$/.test(sess.token)) sess = null;
  const myId = () => sess ? sess.id : who.id;
  const headers = () => ({ 'content-type':'application/json', 'x-mt-key':who.key, ...(sess ? { authorization:'Bearer ' + sess.token } : {}) });

  const CODES = { 400:'invalid_argument', 401:'signed_out', 403:'revoked', 409:'conflict', 413:'too_large', 429:'rate_limited', 507:'quota_exceeded' };
  async function call(method, path, body){
    let res;
    try { res = await fetch('/api/' + path, { method, cache:'no-store', headers:headers(), body:body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { throw { code:'upstream_error' }; }
    if (res.status === 404 && method === 'GET') return null;
    if (!res.ok){ let j = null; try { j = await res.json(); } catch (e) {} throw { code:(j && j.error) || CODES[res.status] || 'upstream_error', status:res.status }; }
    return res.status === 204 ? null : res.json();
  }

  /* ---------- one poll for every watched collection ---------- */
  const watchers = new Map(), POLL = 7000;          // name -> { tag, subs:Set }
  let timer = 0, busy = false, again = false;
  async function poll(){
    clearTimeout(timer);
    if (busy){ again = true; return; }
    if (document.hidden || !watchers.size){ timer = setTimeout(poll, POLL); return; }
    busy = true;
    const q = [...watchers].map(([n, w]) => encodeURIComponent(n) + '=' + encodeURIComponent(w.tag)).join('&');
    try {
      const out = await call('GET', 'sync?' + q);
      Object.entries(out || {}).forEach(([n, r]) => {
        const w = watchers.get(n); if (!w || !r) return;
        w.tag = r.tag || '';
        if (!r.unchanged){ const snap = { docs:(r.docs || []).map(d => ({ id:d.id, exists:true, data:() => d.data })) }; w.subs.forEach(s => { try { s.ok(snap); } catch (e) {} }); }
      });
    } catch (e) { watchers.forEach(w => w.subs.forEach(s => { if (s.err) { try { s.err(e); } catch (x) {} } })); }
    busy = false;
    if (again){ again = false; poll(); return; }
    timer = setTimeout(poll, POLL + Math.random() * 1500);
  }
  let soon = 0;
  const pollSoon = () => { clearTimeout(soon); soon = setTimeout(poll, 30); };   // several watches registered at once -> one request
  function watch(name, ok, err){
    let w = watchers.get(name); if (!w){ w = { tag:'', subs:new Set() }; watchers.set(name, w); }
    const s = { ok, err }; w.subs.add(s); w.tag = ''; pollSoon();
    return () => { w.subs.delete(s); if (!w.subs.size) watchers.delete(name); };
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  const bump = name => { const w = watchers.get(name); if (w){ w.tag = ''; pollSoon(); } };
  const refetchAll = () => { watchers.forEach(w => { w.tag = ''; }); pollSoon(); };

  const SHARED = ['feelings', 'cards', 'reviews', 'comments', 'votes'], PRIVATE = ['trip', 'profile', 'plans'];
  function docRef(path){
    const s = String(path).split('/');
    let coll, id;
    if (s.length === 2 && SHARED.includes(s[0])){ coll = s[0]; id = s[1]; }
    else if (s.length === 4 && s[0] === 'data' && s[1] === 'users' && PRIVATE.includes(s[3])){ coll = s[3]; id = s[2]; }
    else throw { code:'invalid_argument' };
    const p = 'db/' + coll + '/' + encodeURIComponent(id);
    return {
      async get(){ const d = await call('GET', p); return { id, exists:!!d, data:() => d ? d.data : undefined }; },
      async set(data){ await call('PUT', p, data); bump(coll); },
      async delete(){ await call('DELETE', p); bump(coll); }
    };
  }
  const db = { collection:name => ({ onSnapshot:(ok, err) => watch(name, ok, err) }), doc:docRef };
  const user = { id:async () => myId(), me:async () => ({ id:myId(), name:sess ? sess.name : null }), can:async () => true, canEdit:() => false, isOwner:() => false };

  /* ---------- accounts ---------- */
  const idListeners = new Set();
  const changedId = () => { refetchAll(); idListeners.forEach(f => { try { f(); } catch (e) {} }); };
  const signIn = out => { sess = { id:out.id, name:out.name, token:out.token }; keep('mt.session.v1', sess); changedId(); return { id:sess.id, name:sess.name }; };
  const auth = {
    current:() => sess ? { id:sess.id, name:sess.name } : null,
    onChange:f => { idListeners.add(f); return () => idListeners.delete(f); },
    async login(username, password){ return signIn(await call('POST', 'auth/login', { username, password })); },
    async signup(username, password){
      try { return signIn(await call('POST', 'auth/signup', { username, password, id:who.id, key:who.key })); }
      catch (e) {
        if (e.code !== 'id_has_account') throw e;   // this browser's anonymous id already belongs to an account: start a fresh one
        freshWho(); return signIn(await call('POST', 'auth/signup', { username, password, id:who.id, key:who.key }));
      }
    },
    async logout(){
      try { if (sess) await call('POST', 'auth/logout'); } catch (e) {}
      sess = null; keep('mt.session.v1', null); freshWho(); changedId();
    },
    async check(){                                    // an expired or revoked session quietly signs the browser out
      if (!sess) return null;
      try { const me = await call('GET', 'auth/me'); if (me && me.name){ sess.name = me.name; keep('mt.session.v1', sess); } return auth.current(); }
      catch (e) { if (e.code === 'signed_out'){ sess = null; keep('mt.session.v1', null); freshWho(); changedId(); } return auth.current(); }
    }
  };
  window.claude = { use: async name => name === 'db' ? db : name === 'user' ? user : name === 'auth' ? auth : null };
})();
