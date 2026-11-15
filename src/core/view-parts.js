/* core/view-parts.js — Shared view pieces used by several screens. */
/* ---------- shared view pieces ---------- */
const CHECK = '<svg class="ck" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 8.4l3 3 6-6.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const packedText = () => touched.has(3) ? ['Nothing packed yet · pick up to three', '1 of 3 packed', '2 of 3 packed · room for one more', '3 of 3 packed · you travel light'][S.bag.length] : 'A suggested bag · change it or keep it';
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const dflt = n => touched.has(n) ? '' : ' <span class="muted">· default</span>';
const bagNames = () => S.bag.map(id => BAG.find(b => b.id === id).name.toLowerCase());
const marq = FEEL.map(f => `<span>${f.label}</span><span class="sep">✺</span>`).join('');
