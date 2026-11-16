"use strict";
/* core/saved-trip.js — Saved trip: validated before it is trusted. */
/* ---------- saved trip: validated before it is trusted (it comes from storage or the shared database) ---------- */
function cleanTrip(v){
  if (!v || typeof v !== 'object') return null;
  const d = destById(v.destId); if (!d || !v.plan || !Array.isArray(v.plan.days)) return null;
  const str = (s, n) => String(s == null ? '' : s).slice(0, n);
  const days = v.plan.days.slice(0, 14).map(day => ({
    title:str(day && day.title, 60) || 'Open day',
    stops:(Array.isArray(day && day.stops) ? day.stops : []).slice(0, 12).map(s => ({
      id:str(s && s.id, 24) || 'c:' + Math.random().toString(36).slice(2, 8),
      part:PARTS.includes(s && s.part) ? s.part : null, title:str(s && s.title, 60),
      cost:clamp(Math.round(+(s && s.cost) || 0), 0, 9999), ...(s && s.custom ? { custom:true } : {})
    })).filter(s => s.title)
  }));
  if (!days.length) return null;
  const has = (list, id, dflt) => list.some(x => x.id === id) ? id : dflt;
  return {
    window:has(WIN, v.window, 'sea'), energy:clamp(Math.round(+v.energy) || 0, 0, 100), bag:(Array.isArray(v.bag) ? v.bag : []).filter(b => BAG.some(x => x.id === b)).slice(0, 3),
    sound:has(SOUND, v.sound, 'lofi'), feel:has(FEEL, v.feel, 'rested'), budget:clamp(Math.round(+v.budget) || 1800, 500, 5000),
    style:has(STYLE, v.style, 'comfy'), month:clamp(Math.round(+v.month) || 0, 0, 11), nights:clamp(Math.round(+v.nights) || 7, 3, 8),
    destId:d.id, plan:{ days }
  };
}
function loadSaved(){
  try { return cleanTrip(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); } catch (e) { return null; }
}
let saved = loadSaved();
/* put a saved trip back on screen: answers, budget and the plan itself */
function restoreTrip(t){
  const { destId, plan, ...rest } = t;
  Object.assign(S, rest, { dest:destById(destId), plan, adder:null, cardSeen:true, reached:3, planId:null });
  picked = true; [1, 2, 3, 4, 5].forEach(n => touched.add(n)); document.documentElement.style.setProperty('--energy', S.energy / 100);
}
const resumeBtn = () => saved ? `<button class="btn btn-secondary" data-act="resume">Continue your ${esc(destById(saved.destId).name)} plan</button>` : '';
