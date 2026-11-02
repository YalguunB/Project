/* ============ CLOUDFLARE RUNTIME ============
   On claude.ai the platform supplies window.claude (shared database, who is viewing). On Cloudflare this file stands in for it,
   backed by this site's own /api/db routes (cloudflare/src/worker.js). Only the parts backend.js uses exist: `db` and `user`.
   Traveler photo uploads are not offered here, so `assets` resolves to null and the page hides that control.

   Identity: each browser makes a random public id and a random secret and keeps both in localStorage. The server remembers a hash
   of the secret the first time that id writes, so nobody else can overwrite or delete that traveler's documents. Clearing site
   data starts a new, anonymous traveler. */
(() => {
  if (window.claude && typeof window.claude.use === 'function') return;
  const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
  let who = null;
  try { who = JSON.parse(localStorage.getItem('mt.who.v1') || 'null'); } catch (e) {}
  if (!who || !/^[0-9a-f]{32}$/.test(who.id) || !/^[0-9a-f]{64}$/.test(who.key)){
    who = { id:hex(16), key:hex(32) };
    try { localStorage.setItem('mt.who.v1', JSON.stringify(who)); } catch (e) {}
  }
  const CODES = { 400:'invalid_argument', 403:'revoked', 413:'too_large', 429:'rate_limited', 507:'quota_exceeded' };
  async function call(method, path, body){
    let res;
    try {
      res = await fetch('/api/db/' + path, { method, cache:'no-store', headers:{ 'content-type':'application/json', 'x-mt-key':who.key }, body:body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { throw { code:'upstream_error' }; }
    if (res.status === 404 && method === 'GET') return null;
    if (!res.ok) throw { code:CODES[res.status] || 'upstream_error' };
    return res.status === 204 ? null : res.json();
  }

  /* A collection is watched by polling: a cheap "has anything changed?" check every few seconds while the tab is visible,
     and straight away after this browser writes. */
  const watchers = new Set(), POLL = 7000;
  function watch(name, onSnap, onErr){
    const w = { name, tag:'', stop:false, timer:0, busy:false };
    async function tick(){
      if (w.stop || w.busy) return;
      clearTimeout(w.timer); w.busy = true;
      try {
        const out = await call('GET', name + (w.tag ? '?since=' + encodeURIComponent(w.tag) : ''));
        if (out && !w.stop && !out.unchanged){
          w.tag = out.tag || '';
          onSnap({ docs:(out.docs || []).map(d => ({ id:d.id, exists:true, data:() => d.data })) });
        } else if (out && out.tag) w.tag = out.tag;
      } catch (e) { if (onErr) { try { onErr(e); } catch (x) {} } }
      w.busy = false;
      if (!w.stop) w.timer = setTimeout(tick, POLL + Math.random() * 1500);
    }
    w.tick = () => { if (!document.hidden) tick(); };
    watchers.add(w); tick();
    return () => { w.stop = true; clearTimeout(w.timer); watchers.delete(w); };
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) watchers.forEach(w => w.tick()); });
  const bump = name => watchers.forEach(w => { if (w.name === name){ w.tag = ''; w.tick(); } });

  function docRef(path){
    const s = String(path).split('/');
    let coll, id;
    if (s.length === 2 && (s[0] === 'feelings' || s[0] === 'cards' || s[0] === 'reviews')){ coll = s[0]; id = s[1]; }
    else if (s.length === 4 && s[0] === 'data' && s[1] === 'users' && s[3] === 'trip'){ coll = 'trip'; id = s[2]; }
    else throw { code:'invalid_argument' };
    const p = coll + '/' + encodeURIComponent(id);
    return {
      async get(){ const d = await call('GET', p); return { id, exists:!!d, data:() => d ? d.data : undefined }; },
      async set(data){ await call('PUT', p, data); bump(coll); },
      async delete(){ await call('DELETE', p); bump(coll); }
    };
  }
  const db = { collection:name => ({ onSnapshot:(ok, err) => watch(name, ok, err) }), doc:docRef };
  const user = { id:async () => who.id, me:async () => ({ id:who.id }), can:async () => true, canEdit:() => false, isOwner:() => false };
  window.claude = { use: async name => name === 'db' ? db : name === 'user' ? user : null };
})();
