"use strict";
/* core/profile.js — The traveler's profile: visits and trips, which segment they are in, and what to ask them next.

   Stored in two places, like the saved trip: this browser (localStorage) and, when the shared database is there, the traveler's
   private document data/users/<id>/profile (/api/db/profile/<id>, readable only with the traveler's secret).

   Shape (also the shape to write by hand, see docs/engagement.md and db/seed/):
   {
     v: 1,
     first: 1730000000000,          // first visit, ms since 1970
     last:  1731600000000,          // latest visit
     visits: 4,                     // a new visit = back after SESSION_GAP or more
     trips: [{
       dest: 'kyoto', month: 3, year: 2026, nights: 5,   // month is 0-11 (3 = April)
       saved: 1730500000000,        // when the plan was saved
       went: true,                  // true = went, false = did not go, null = not asked yet
       pids: ['kyoto:0:1', ...],    // the guide places in that plan, so we can ask for reviews of exactly those
       snooze: 0                    // "not now": no asks about this trip until this time
     }]
   }

   Segments (segmentOf): 'new' = no trip taken yet (first-timer), 'once' = exactly one, 'seasoned' = two or more. */
const PROFILE_KEY = 'moodtrip:profile:v1';
const SESSION_GAP = 30 * 60 * 1000;
const DAY_MS = 864e5;
let profile = null;
const profileSubs = new Set();
const onProfile = f => { profileSubs.add(f); return () => profileSubs.delete(f); };
const profileChanged = () => profileSubs.forEach(f => { try { f(); } catch (e) {} });

function cleanProfile(v){
  if (!v || typeof v !== 'object') return null;
  const now = Date.now(), n = (x, a, b, d) => { x = Math.round(+x); return isFinite(x) ? Math.max(a, Math.min(b, x)) : d; };
  const trips = (Array.isArray(v.trips) ? v.trips : []).slice(-30).map(t => {
    const d = t && destById(t.dest); if (!d) return null;
    const ids = new Set(catalog(d).map(c => c.id));
    return { dest:d.id, month:n(t.month, 0, 11, 0), year:n(t.year, 2020, 2100, new Date().getFullYear()), nights:n(t.nights, 1, 30, 7),
             saved:n(t.saved, 0, now + 6e4, now), went:t.went === true ? true : t.went === false ? false : null,
             pids:[...new Set((Array.isArray(t.pids) ? t.pids : []).filter(p => ids.has(p)))].slice(0, 60), snooze:n(t.snooze, 0, now + 365 * DAY_MS, 0) };
  }).filter(Boolean);
  return { v:1, first:n(v.first, 0, now + 6e4, now), last:n(v.last, 0, now + 6e4, now), visits:n(v.visits, 0, 1e6, 0), trips };
}
const freshProfile = () => ({ v:1, first:Date.now(), last:0, visits:0, trips:[] });

/* ---------- reading the profile ---------- */
const tripStart = t => new Date(t.year, t.month, 1).getTime();
const tripOver = t => Date.now() >= new Date(t.year, t.month + 1, 1).getTime() + t.nights * DAY_MS;   // we know the month, not the day
const tripsTaken = p => p ? p.trips.filter(t => t.went === true) : [];
function segmentOf(p){
  const n = tripsTaken(p).length;
  return n === 0 ? 'new' : n === 1 ? 'once' : 'seasoned';
}
/* the one thing worth asking right now, most useful first */
function nextAsk(p){
  if (!p) return null;
  const now = Date.now(), recent = p.trips.slice().reverse().filter(t => t.snooze <= now);
  const unsure = recent.find(t => t.went === null && tripOver(t));
  if (unsure) return { kind:'went', trip:unsure };
  if (BE.reviewsAt){                                    // only once the reviews are loaded, or every place would look unreviewed
    for (const t of recent) if (t.went){ const left = t.pids.filter(pid => !BE.myReview(pid)); if (left.length) return { kind:'review', trip:t, left }; }
  }
  const soon = p.trips.filter(t => t.went === null && !tripOver(t)).sort((a, b) => tripStart(a) - tripStart(b))[0];
  if (soon) return { kind:'upcoming', trip:soon };
  return null;
}
const sameTrip = (a, b) => a.dest === b.dest && a.month === b.month && a.year === b.year;

/* ---------- writing the profile ---------- */
function persistProfile(){
  if (!profile) return Promise.resolve();
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) {}
  profileChanged();
  return BE.ready && BE.uid ? BE.saveProfile(profile).catch(() => {}) : Promise.resolve();
}
/* called once the shared database has answered (or not): picks the newer copy and counts the visit */
async function loadProfile(){
  let local = null; try { local = cleanProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null')); } catch (e) {}
  const remote = cleanProfile(await BE.loadProfile());
  profile = remote && (!local || remote.last >= local.last) ? remote : local || freshProfile();
  const now = Date.now();
  if (now - profile.last >= SESSION_GAP){ profile.visits++; profile.last = now; await persistProfile(); }
  else { profile.last = now; profileChanged(); }
}
/* the guide places in a plan, by title (the same rule pidOf uses in the planner) */
function planPids(d, plan){
  const byTitle = new Map(catalog(d).map(c => [c.title, c.id]));
  return [...new Set(plan.days.flatMap(day => day.stops.filter(s => !s.custom).map(s => byTitle.get(s.title))).filter(Boolean))];
}
/* a saved plan becomes a trip: the same place, month and year updates the one already there */
function recordTrip(trip){
  const d = destById(trip.destId); if (!d) return Promise.resolve();
  if (!profile) profile = freshProfile();
  const now = new Date(), year = trip.month >= now.getMonth() ? now.getFullYear() : now.getFullYear() + 1;
  const t = { dest:d.id, month:trip.month, year, nights:trip.nights, saved:Date.now(), went:null, pids:planPids(d, trip.plan), snooze:0 };
  const i = profile.trips.findIndex(x => sameTrip(x, t) && x.went === null);
  if (i >= 0) profile.trips[i] = t; else profile.trips = [...profile.trips, t].slice(-30);
  return persistProfile();
}
function markWent(trip, went){
  const t = profile && profile.trips.find(x => sameTrip(x, trip)); if (!t) return Promise.resolve();
  t.went = !!went; return persistProfile();
}
function snoozeTrip(trip, days = 7){
  const t = profile && profile.trips.find(x => sameTrip(x, trip)); if (!t) return Promise.resolve();
  t.snooze = Date.now() + days * DAY_MS; return persistProfile();
}
