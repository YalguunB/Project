
const BE = (() => {
  const FEEL_IDS = FEEL.map(f => f.id), WIN_IDS = WIN.map(w => w.id), SOUND_IDS = SOUND.map(s => s.id), BAG_IDS = BAG.map(b => b.id), DEST_IDS = DEST.map(d => d.id);
  const st = { db:null, assets:null, auth:null, account:null, uid:null, ready:false, canWrite:true, feelings:new Map(), cards:new Map(), reviews:new Map(), rIndex:new Map(), reviewsAt:0,
              comments:new Map(), cIndex:new Map(), votes:new Map(), vIndex:new Map(), plans:null, subs:[], chain:Promise.resolve(), busy:false };
  const NAME_RE = /^[a-z0-9_.-]{3,24}$/i;
  const TARGET_RE = /^[0-9a-f]{32}~[a-z]+:\d{1,2}:\d{1,2}$/;
  const MAX_COMMENTS = 20, MAX_PLANS = 30;
  const idSubs = new Set();
  const PLACE_IDS = new Set(DEST.flatMap(d => d.days.flatMap((day, t) => day[1].map((_, i) => `${d.id}:${t}:${i}`))));
  const MAX_REVIEWS = 60;
  const PH_RE = /^[0-9a-f]{32}$/;     // a photo is an asset id and nothing else: the page builds the address itself
  const listeners = new Set();
  const emit = () => listeners.forEach(f => { try { f(); } catch (e) {} });
  const clampN = (v, a, b, d) => { v = Math.round(+v); return isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };

  function cleanReports(data){
    const out = {}, r = data && typeof data === 'object' ? data.reports : null;
    if (!r || typeof r !== 'object') return out;
    DEST_IDS.forEach(id => { const x = r[id]; if (x && FEEL_IDS.includes(x.feel)) out[id] = { feel:x.feel, score:clampN(x.score, 1, 5, 3) }; });
    return out;
  }
  function cleanCard(data, uid){
    if (!data || typeof data !== 'object' || !WIN_IDS.includes(data.w) || !FEEL_IDS.includes(data.f)) return null;
    const e = clampN(data.e, 0, 100, 35);
    const w = WIN.find(x => x.id === data.w), f = FEEL.find(x => x.id === data.f), lvl = energyLevel(e);
    return { id:'u' + uid, uid, w:data.w, f:data.f, e, s:SOUND_IDS.includes(data.s) ? data.s : 'lofi', d:DEST_IDS.includes(data.d) ? data.d : null,
             bag:Array.isArray(data.bag) ? data.bag.filter(b => BAG_IDS.includes(b)).slice(0, 3) : [], mood:w.mood,
             at:Math.min(Math.max(0, +data.at || 0), Date.now() + 60000),
             name:`${lvl.pace}-${w.noun} ${f.role}`, mine:uid === st.uid };
  }
  /* Reviews are free text from other people: strip control and direction-override characters, collapse spaces, cap the length.
     Only known place ids, known feeling / window ids and a 1-5 rating survive. The page shows the text with textContent-safe escaping. */
  const cleanText = (v, n = 240) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  function cleanReviews(data, uid){
    const out = new Map(), items = data && typeof data === 'object' ? data.items : null;
    if (!items || typeof items !== 'object') return out;
    Object.keys(items).slice(0, 300).forEach(pid => {
      const x = items[pid]; if (!PLACE_IDS.has(pid) || !x || typeof x !== 'object') return;
      const r = Math.round(+x.r); if (!(r >= 1 && r <= 5)) return;
      const w = WIN.find(k => k.id === x.w) || WIN[0], f = FEEL.find(k => k.id === x.f) || null, e = clampN(x.e, 0, 100, 35), lvl = energyLevel(e);
      out.set(pid, { pid, uid, r, t:cleanText(x.t), f:f ? f.id : null, w:w.id, e, ph:typeof x.ph === 'string' && PH_RE.test(x.ph) ? x.ph : null, tc:clampN(x.tc, 0, 99, 0), named:x.named === true, u:x.named === true ? nameOf(x.u, uid) : null, at:Math.min(Math.max(0, +x.at || 0), Date.now() + 60000),
                     name:`${lvl.pace}-${w.noun} ${f ? f.role : 'traveler'}`, mine:uid === st.uid });
    });
    return out;
  }
  const packReview = it => ({ r:it.r, t:it.t, f:it.f, w:it.w, e:it.e, at:it.at, ...(it.named ? { named:true } : {}), ...(it.tc ? { tc:it.tc } : {}), ...(it.ph ? { ph:it.ph } : {}) });
  function reindexReviews(){
    st.rIndex = new Map();
    st.reviews.forEach(m => m.forEach(it => { if (!st.rIndex.has(it.pid)) st.rIndex.set(it.pid, []); st.rIndex.get(it.pid).push(it); }));
    st.rIndex.forEach(list => list.sort((a, b) => (b.at - a.at) || (a.uid < b.uid ? -1 : 1)));
  }
  const nameOf = (u, uid) => typeof u === 'string' && NAME_RE.test(u) ? u : uid === st.uid && st.account ? st.account.name : null;
  /* comments on reviews: each traveler's document holds their comments, keyed by the review (<author id>~<place id>) */
  function cleanComments(data, uid){
    const out = new Map(), items = data && typeof data === 'object' ? data.items : null;
    if (!items || typeof items !== 'object') return out;
    Object.keys(items).slice(0, 200).forEach(tg => {
      const list = items[tg]; if (!TARGET_RE.test(tg) || !Array.isArray(list)) return;
      const ok = list.slice(0, MAX_COMMENTS).map(c => c && typeof c === 'object' ? { target:tg, uid, t:cleanText(c.t, 400), at:Math.min(Math.max(0, +c.at || 0), Date.now() + 60000),
        named:c.named === true, u:c.named === true ? nameOf(c.u, uid) : null, mine:uid === st.uid } : null).filter(c => c && c.t);
      if (ok.length) out.set(tg, ok);
    });
    return out;
  }
  function reindexComments(){
    st.cIndex = new Map();
    st.comments.forEach(m => m.forEach((list, tg) => { if (!st.cIndex.has(tg)) st.cIndex.set(tg, []); st.cIndex.get(tg).push(...list); }));
    st.cIndex.forEach(list => list.sort((a, b) => a.at - b.at));
  }
  /* "was this review helpful?": +1 or -1 per traveler per review */
  function cleanVotes(data){
    const out = new Map(), items = data && typeof data === 'object' ? data.items : null;
    if (!items || typeof items !== 'object') return out;
    Object.keys(items).slice(0, 1000).forEach(tg => { const v = items[tg]; if (TARGET_RE.test(tg) && (v === 1 || v === -1)) out.set(tg, v); });
    return out;
  }
  function reindexVotes(){
    st.vIndex = new Map();
    st.votes.forEach((m, voter) => m.forEach((v, tg) => {
      if (tg.split('~')[0] === voter) return;           // nobody votes on their own review
      const o = st.vIndex.get(tg) || { up:0, down:0 }; if (v > 0) o.up++; else o.down++; st.vIndex.set(tg, o);
    }));
  }
  function recompute(){
    DEST.forEach(d => { CROWD[d.id] = { n:0, total:0, byFeel:{}, count:{} }; });
    st.feelings.forEach(rep => Object.entries(rep).forEach(([did, r]) => {
      const o = CROWD[did]; o.n++; o.total += r.score; o.byFeel[r.feel] = (o.byFeel[r.feel] || 0) + r.score; o.count[r.feel] = (o.count[r.feel] || 0) + 1;
    }));
  }
  const queue = fn => { st.chain = st.chain.then(fn, fn); return st.chain; };
  function explain(e){
    const c = e && e.code;
    if (c === 'invalid_argument') return 'This link is view-only for you, so posting is switched off. Ask the owner for Contributor access.';
    if (c === 'quota_exceeded') return 'The shared database is full, so nothing more can be added right now.';
    if (c === 'resource_exhausted') return 'Too many requests at once. Give it a moment and try again.';
    if (c === 'limit') return `You have reviewed the maximum of ${MAX_REVIEWS} places. Remove an older review first.`;
    if (c === 'revoked') return 'Your access changed while the page was open. Reload to continue.';
    if (c === 'too_large') return 'That photo is too large to upload.';
    if (c === 'unsupported_type' || c === 'invalid_request') return 'That file could not be used as a photo. Try a JPEG or PNG.';
    if (c === 'quota_or_state') return 'The shared storage is full, so the photo could not be added. You can post the review without it.';
    if (c === 'rate_limited') return 'Too many requests at once. Give it a moment and try again.';
    if (c === 'wrong_login') return 'That username and password do not match.';
    if (c === 'name_taken') return 'That username is taken. Try another one.';
    if (c === 'bad_username') return 'Use 3 to 24 letters, numbers, dots, dashes or underscores.';
    if (c === 'bad_password') return 'Use a password of at least 8 characters.';
    if (c === 'signed_out') return 'You were signed out. Sign in again to continue.';
    if (c === 'no_account') return 'Sign in to keep plans in your account.';
    if (c === 'plans_full') return `You have ${MAX_PLANS} saved plans. Delete one first.`;
    if (c === 'comments_full') return `You can leave up to ${MAX_COMMENTS} comments on one review.`;
    if (c === 'not_granted' || c === 'capability_disabled' || c === 'capability_removed') return 'Photos are not available for your access level. You can post the review without one.';
    if (c === 'store_unavailable' || c === 'upstream_error' || c === 'upstream_auth') return 'The photo could not be uploaded just now. Try again, or post the review without it.';
    return 'Could not reach the shared database. Try again in a moment.';
  }

  async function init(){
    const claude = window.claude;
    if (!claude || typeof claude.use !== 'function') return false;
    try {
      const [db, user, assets, auth] = await Promise.all([claude.use('db'), claude.use('user'), Promise.resolve(claude.use('assets')).catch(() => null), Promise.resolve(claude.use('auth')).catch(() => null)]);
      if (!db) return false;
      st.db = db; st.assets = assets && typeof assets.upload === 'function' ? assets : null;
      if (auth && typeof auth.login === 'function'){
        st.auth = auth; st.account = auth.current();
        auth.onChange(async () => {                      // signed in or out: a different traveler id from now on
          st.uid = await user.id(); st.account = auth.current(); st.plans = null;
          [st.feelings, st.cards, st.reviews, st.comments, st.votes].forEach(m => m.clear());
          reindexReviews(); reindexComments(); reindexVotes(); recompute();
          idSubs.forEach(f => { try { f(); } catch (e) {} }); emit();
        });
        auth.check().then(a => { st.account = a; emit(); });
      }
      st.uid = user && user.id ? await user.id() : null;
      if (user && user.can){ const w = await user.can('data.write'); st.canWrite = w !== false; }
      st.ready = true;
      const fail = () => {};
      st.subs.push(db.collection('feelings').onSnapshot(snap => {
        st.feelings = new Map(); snap.docs.forEach(d => { if (d.exists) st.feelings.set(d.id, cleanReports(d.data())); });
        recompute(); emit();
      }, fail));
      st.subs.push(db.collection('cards').onSnapshot(snap => {
        st.cards = new Map(); snap.docs.forEach(d => { const c = d.exists ? cleanCard(d.data(), d.id) : null; if (c) st.cards.set(d.id, c); });
        emit();
      }, fail));
      st.subs.push(db.collection('reviews').onSnapshot(snap => {
        st.reviews = new Map(); snap.docs.forEach(d => { if (!d.exists) return; const m = cleanReviews(d.data(), d.id); if (m.size) st.reviews.set(d.id, m); });
        reindexReviews(); st.reviewsAt = Date.now(); emit();
      }, fail));
      st.subs.push(db.collection('comments').onSnapshot(snap => {
        st.comments = new Map(); snap.docs.forEach(d => { if (!d.exists) return; const m = cleanComments(d.data(), d.id); if (m.size) st.comments.set(d.id, m); });
        reindexComments(); emit();
      }, fail));
      st.subs.push(db.collection('votes').onSnapshot(snap => {
        st.votes = new Map(); snap.docs.forEach(d => { if (!d.exists) return; const m = cleanVotes(d.data()); if (m.size) st.votes.set(d.id, m); });
        reindexVotes(); emit();
      }, fail));
      emit();
      return true;
    } catch (e) { return false; }
  }

  const api = {
    init, on:f => { listeners.add(f); return () => listeners.delete(f); },
    get ready(){ return st.ready; }, get uid(){ return st.uid; },
    get canPost(){ return st.ready && !!st.uid && st.canWrite; },
    get canPhoto(){ return !!st.assets && st.ready && !!st.uid && st.canWrite; },
    explain,
    cards(){ return [...st.cards.values()].sort((a, b) => (b.mine - a.mine) || (a.uid < b.uid ? -1 : 1)); },
    myCard(){ return st.uid ? st.cards.get(st.uid) || null : null; },
    myReport(destId){ const r = st.uid && st.feelings.get(st.uid); return r && r[destId] || null; },
    get reviewsAt(){ return st.reviewsAt; },
    reviewsFor(pid){
      const list = st.rIndex.get(pid) || [], dist = [0, 0, 0, 0, 0]; let sum = 0;
      list.forEach(x => { dist[x.r - 1]++; sum += x.r; });
      return { n:list.length, avg:list.length ? sum / list.length : 0, dist, list };
    },
    myReview(pid){ const m = st.uid && st.reviews.get(st.uid); return m && m.get(pid) || null; },
    myReviewCount(){ const m = st.uid && st.reviews.get(st.uid); return m ? m.size : 0; },
    reviewCount(){ let n = 0; st.reviews.forEach(m => { n += m.size; }); return n; },
    reportCount(){ let n = 0; st.feelings.forEach(r => { n += Object.keys(r).length; }); return n; },

    submitReport(destId, feel, score){
      return queue(async () => {
        const mine = { ...(st.feelings.get(st.uid) || {}) };
        mine[destId] = { feel, score:clampN(score, 1, 5, 3), at:Date.now() };
        await st.db.doc('feelings/' + st.uid).set({ v:1, reports:mine });
        st.feelings.set(st.uid, cleanReports({ reports:mine })); recompute(); emit();
      });
    },
    submitReview(pid, { r, t, f, ph, tc, named }){
      return queue(async () => {
        if (!PLACE_IDS.has(pid)) throw { code:'invalid' };
        const mine = st.reviews.get(st.uid) || new Map();
        if (!mine.has(pid) && mine.size >= MAX_REVIEWS) throw { code:'limit' };
        const items = {}; mine.forEach((it, k) => { items[k] = packReview(it); });
        items[pid] = { r:clampN(r, 1, 5, 3), t:cleanText(t), f:FEEL_IDS.includes(f) ? f : null, w:S.window, e:S.energy, at:Date.now(), ...(tc > 0 ? { tc:clampN(tc, 0, 99, 0) } : {}), ...(named && st.account ? { named:true } : {}), ...(typeof ph === 'string' && PH_RE.test(ph) ? { ph } : {}) };
        await st.db.doc('reviews/' + st.uid).set({ v:1, items });
        st.reviews.set(st.uid, cleanReviews({ items }, st.uid)); reindexReviews(); st.reviewsAt = Date.now(); emit();
      });
    },
    /* several star ratings at once (the "how was your trip?" sheet): one write instead of one per place */
    submitRatings(list, tc){
      return queue(async () => {
        const mine = st.reviews.get(st.uid) || new Map();
        const items = {}; mine.forEach((it, k) => { items[k] = packReview(it); });
        list.forEach(({ pid, r }) => {
          if (!PLACE_IDS.has(pid)) return;
          const old = items[pid];
          items[pid] = { ...(old || {}), r:clampN(r, 1, 5, 3), t:old ? old.t : '', f:old ? old.f : null, w:old ? old.w : S.window, e:old ? old.e : S.energy, at:Date.now(), ...(tc > 0 ? { tc:clampN(tc, 0, 99, 0) } : {}) };
        });
        if (Object.keys(items).length > MAX_REVIEWS) throw { code:'limit' };
        await st.db.doc('reviews/' + st.uid).set({ v:1, items });
        st.reviews.set(st.uid, cleanReviews({ items }, st.uid)); reindexReviews(); st.reviewsAt = Date.now(); emit();
      });
    },
    removeReview(pid){
      return queue(async () => {
        const mine = st.reviews.get(st.uid); if (!mine || !mine.has(pid)) return;
        const items = {}; mine.forEach((it, k) => { if (k !== pid) items[k] = packReview(it); });
        if (Object.keys(items).length) await st.db.doc('reviews/' + st.uid).set({ v:1, items });
        else await st.db.doc('reviews/' + st.uid).delete();
        if (Object.keys(items).length) st.reviews.set(st.uid, cleanReviews({ items }, st.uid)); else st.reviews.delete(st.uid);
        reindexReviews(); st.reviewsAt = Date.now(); emit();
      });
    },
    /* photos: stored as assets, the review keeps only the id. Uploads are not part of the review write, so a failed write cleans up after itself. */
    async uploadPhoto(blob){
      if (!st.assets) throw { code:'capability_disabled' };
      const res = await st.assets.upload(blob);
      if (!res || typeof res.id !== 'string' || !PH_RE.test(res.id)) throw { code:'upstream_error' };
      return res.id;
    },
    async dropPhoto(id){ try { if (st.assets && PH_RE.test(id)) await st.assets.delete(id); } catch (e) {} },
    publishCard(destId){
      return queue(async () => {
        await st.db.doc('cards/' + st.uid).set({ v:1, w:S.window, e:S.energy, f:S.feel, s:S.sound, d:destId || null, bag:S.bag.slice(0, 3), at:Date.now() });
      });
    },
    removeCard(){ return queue(async () => { await st.db.doc('cards/' + st.uid).delete(); st.cards.delete(st.uid); emit(); }); },

    async loadTrip(){
      if (!st.ready || !st.uid) return null;
      try { const d = await st.db.doc('data/users/' + st.uid + '/trip').get(); return d.exists ? d.data() : null; } catch (e) { return null; }
    },
    saveTrip(trip){
      if (!st.ready || !st.uid) return Promise.reject({ code:'unavailable' });
      return queue(() => st.db.doc('data/users/' + st.uid + '/trip').set(trip));
    },
    /* ---------- accounts ---------- */
    get canAccount(){ return !!st.auth; },
    get account(){ return st.account; },
    onIdentity:f => { idSubs.add(f); return () => idSubs.delete(f); },
    async login(u, p){ if (!st.auth) throw { code:'capability_disabled' }; await st.auth.login(u, p); },
    async signup(u, p){ if (!st.auth) throw { code:'capability_disabled' }; await st.auth.signup(u, p); },
    async logout(){ if (st.auth) await st.auth.logout(); },

    /* ---------- comments and helpful votes on reviews; a review is <author id>~<place id> ---------- */
    reviewKey:x => x.uid + '~' + x.pid,
    commentsFor:tg => st.cIndex.get(tg) || [],
    votesFor(tg){ const o = st.vIndex.get(tg) || { up:0, down:0 }, m = st.uid && st.votes.get(st.uid); return { up:o.up, down:o.down, mine:m && m.get(tg) || 0 }; },
    addComment(tg, text, named){
      return queue(async () => {
        if (!TARGET_RE.test(tg)) throw { code:'invalid' };
        const t = cleanText(text, 400); if (!t) throw { code:'invalid' };
        const mine = st.comments.get(st.uid) || new Map(), items = {};
        mine.forEach((list, k) => { items[k] = list.map(c => ({ t:c.t, at:c.at, ...(c.named ? { named:true } : {}) })); });
        const list = items[tg] || [];
        if (list.length >= MAX_COMMENTS) throw { code:'comments_full' };
        items[tg] = [...list, { t, at:Date.now(), ...(named && st.account ? { named:true } : {}) }];
        await st.db.doc('comments/' + st.uid).set({ v:1, items });
        st.comments.set(st.uid, cleanComments({ items }, st.uid)); reindexComments(); emit();
      });
    },
    removeComment(tg, at){
      return queue(async () => {
        const mine = st.comments.get(st.uid); if (!mine || !mine.has(tg)) return;
        const items = {}; mine.forEach((list, k) => { const keep = list.filter(c => !(k === tg && c.at === at)); if (keep.length) items[k] = keep.map(c => ({ t:c.t, at:c.at, ...(c.named ? { named:true } : {}) })); });
        if (Object.keys(items).length) await st.db.doc('comments/' + st.uid).set({ v:1, items }); else await st.db.doc('comments/' + st.uid).delete();
        st.comments.set(st.uid, cleanComments({ items }, st.uid)); reindexComments(); emit();
      });
    },
    vote(tg, v){                                         // the same vote again takes it back
      return queue(async () => {
        if (!TARGET_RE.test(tg) || tg.split('~')[0] === st.uid) return;
        const mine = new Map(st.votes.get(st.uid) || []);
        if (mine.get(tg) === v) mine.delete(tg); else mine.set(tg, v > 0 ? 1 : -1);
        const items = Object.fromEntries(mine);
        if (mine.size) await st.db.doc('votes/' + st.uid).set({ v:1, items }); else await st.db.doc('votes/' + st.uid).delete();
        st.votes.set(st.uid, mine); reindexVotes(); emit();
      });
    },

    /* ---------- saved plans on the account: { id, name, at, trip } ---------- */
    async loadPlans(){
      if (!st.ready || !st.uid || !st.account) return [];
      if (st.plans) return st.plans;
      try {
        const d = await st.db.doc('data/users/' + st.uid + '/plans').get(), items = d.exists && d.data() && d.data().items || {};
        st.plans = Object.entries(items).filter(([id, p]) => /^[a-z0-9]{6,16}$/.test(id) && p && typeof p === 'object' && p.trip)
          .map(([id, p]) => ({ id, name:cleanText(p.name, 60) || 'My trip', at:+p.at || 0, trip:p.trip })).sort((a, b) => b.at - a.at);
      } catch (e) { st.plans = []; }
      return st.plans;
    },
    savePlan({ id, name, trip }){
      return queue(async () => {
        if (!st.account) throw { code:'no_account' };
        const list = (await api.loadPlans()).slice(), pid = id && list.some(p => p.id === id) ? id : Math.random().toString(36).slice(2, 12).padEnd(10, '0');
        if (!list.some(p => p.id === pid) && list.length >= MAX_PLANS) throw { code:'plans_full' };
        const old = list.find(p => p.id === pid), next = { id:pid, name:cleanText(name, 60) || (old && old.name) || 'My trip', at:Date.now(), trip };
        const all = [next, ...list.filter(p => p.id !== pid)];
        await st.db.doc('data/users/' + st.uid + '/plans').set({ v:1, items:Object.fromEntries(all.map(p => [p.id, { name:p.name, at:p.at, trip:p.trip }])) });
        st.plans = all; emit(); return pid;
      });
    },
    renamePlan(id, name){ const p = (st.plans || []).find(x => x.id === id); return p ? api.savePlan({ id, name, trip:p.trip }) : Promise.resolve(); },
    removePlan(id){
      return queue(async () => {
        const all = (await api.loadPlans()).filter(p => p.id !== id);
        await st.db.doc('data/users/' + st.uid + '/plans').set({ v:1, items:Object.fromEntries(all.map(p => [p.id, { name:p.name, at:p.at, trip:p.trip }])) });
        st.plans = all; emit();
      });
    },

    /* the traveler's private profile: visits and the trips they planned or took (see core/profile.js) */
    async loadProfile(){
      if (!st.ready || !st.uid) return null;
      try { const d = await st.db.doc('data/users/' + st.uid + '/profile').get(); return d.exists ? d.data() : null; } catch (e) { return null; }
    },
    saveProfile(p){
      if (!st.ready || !st.uid) return Promise.reject({ code:'unavailable' });
      return queue(() => st.db.doc('data/users/' + st.uid + '/profile').set(p));
    }
  };
  return api;
})();
