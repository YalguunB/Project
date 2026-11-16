"use strict";
/* core/utils.js — Small utilities: toast, screen-reader announcements, plural. */
/* ---------- small utilities ---------- */
let toastTimer;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3600); }
const say = msg => { $('#live').textContent = ''; setTimeout(() => { $('#live').textContent = msg; }, 30); };
const plural = (n, a, b) => n === 1 ? a : b;

/* how long ago, for reviews, comments and saved plans */
function ago(ms){
  if (!ms) return '';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); if (s < 45) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); return d < 30 ? `${d} ${plural(d, 'day', 'days')} ago` : new Date(ms).toLocaleDateString('en-US', { month:'short', year:'numeric' });
}
