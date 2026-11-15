/* core/utils.js — Small utilities: toast, screen-reader announcements, plural. */
/* ---------- small utilities ---------- */
let toastTimer;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3600); }
const say = msg => { $('#live').textContent = ''; setTimeout(() => { $('#live').textContent = msg; }, 30); };
const plural = (n, a, b) => n === 1 ? a : b;
