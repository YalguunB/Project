/* core/view-parts.js — Shared view pieces used by several screens. */
/* ---------- shared view pieces ---------- */
const CHECK = '<svg class="ck" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 8.4l3 3 6-6.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const packedText = () => touched.has(3) ? ['Nothing packed yet · pick up to three', '1 of 3 packed', '2 of 3 packed · room for one more', '3 of 3 packed · you travel light'][S.bag.length] : 'A suggested bag · change it or keep it';
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const dflt = n => touched.has(n) ? '' : ' <span class="muted">· default</span>';
const bagNames = () => S.bag.map(id => BAG.find(b => b.id === id).name.toLowerCase());
/* a small flat Earth, drawn for MoodTrip (the separator in the moving banner) */
const EARTH_ICON = `<svg class="earth" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <circle class="eg-sea" cx="32" cy="32" r="28"/>
  <path class="eg-land" d="M15 17c3-3 8-4 12-2 2 1 2 4 0 5-3 1-4 3-2 5 2 3 5 4 4 8-1 3-4 4-4 8 0 3-2 6-4 8-2-3-3-6-3-9 0-4-4-5-6-9-2-5-1-10 3-14z"/>
  <path class="eg-sand" d="M20 22c2 0 3 2 2 3s-3 1-3-1 0-2 1-2z"/>
  <path class="eg-land" d="M36 9c5-1 11 1 15 5 2 2 1 4-1 5-3 1-5 0-7 2-1 2 1 4 3 5 3 2 4 5 2 8-2 4-5 6-6 10-1 3-3 5-5 6-1-4 0-7-2-10-2-4-6-5-6-9s4-5 4-8c0-3-3-5-1-8 1-3 2-5 4-6z"/>
  <path class="eg-sand" d="M41 30c3 0 5 2 4 5-1 2-3 4-5 3s-2-4-1-6 1-2 2-2z"/>
  <path class="eg-land" d="M45 46c2-1 5-1 6 1s-1 4-4 4-3-3-2-5z"/>
  <path class="eg-grid" d="M32 4a28 28 0 0 1 0 56M32 4a12 28 0 0 0 0 56M32 4a12 28 0 0 1 0 56M4.6 27h54.8M6.5 42h51"/>
  <path class="eg-shine" d="M14 18a24 24 0 0 1 14-10"/>
  <circle class="eg-ring" cx="32" cy="32" r="28"/>
</svg>`;
const marq = FEEL.map(f => `<span>${f.label}</span><span class="sep">${EARTH_ICON}</span>`).join('');

/* star words for every rating control */
const STAR_WORDS = ['Poor', 'Fair', 'Good', 'Great', 'Superb'];
/* "post as": a signed-in traveler chooses between their username and staying anonymous. The server checks it either way. */
function postAsHTML(name, named){
  if (!BE.account) return '';
  return `<fieldset class="post-as"><legend class="label muted">Post as</legend><div class="chips" role="radiogroup">
    <label class="opt chip" data-cursor=""><input type="radio" name="${name}" value="named" ${named ? 'checked' : ''}><span class="face" translate="no">@${esc(BE.account.name)}</span></label>
    <label class="opt chip" data-cursor=""><input type="radio" name="${name}" value="anon" ${named ? '' : 'checked'}><span class="face">Anonymous</span></label></div></fieldset>`;
}
const postAsNamed = (form, name) => !!BE.account && !!form.elements[name] && form.elements[name].value === 'named';
