"use strict";
/* core/feeling-colors.js — The page's colors follow how the traveler feels (color psychology).

   The game asks two feeling questions: how you feel RIGHT NOW (battery round) and how you want to come home feeling (last round).
   1. If you feel low, stressed, worn out, lonely or restless right now, the page takes the color linked with lifting that state.
   2. Otherwise it takes the color of the feeling you want.
      ("Sad" is stored as 'low'.)
   3. Before either is answered, the window you picked sets the colors (as before). A traveler can always go back to those.

   What the rules rest on (general findings in color psychology, summarized by Verywell Mind, Mental Health America and others):
   - warm colors (red, orange, yellow) are linked with energy and happiness; cool ones (blue, green, purple) with calm;
   - cool tones can also deepen sadness, so a low mood gets warmth rather than blue;
   - yellow: optimism and cheer (too much can tire the eyes, so it stays soft here); orange: red's energy with yellow's cheer;
     blue: calm and lower stress; green: restful, nature, eases anxiety; pink: warmth and care; lavender: imagination.
   The effects are small, short and differ by person and culture, and the page says so. */

/* how you feel right now: the battery round asks this */
const NOW = [
  { id:'low',      label:'Sad' },
  { id:'stressed', label:'Stressed' },
  { id:'tired',    label:'Worn out' },
  { id:'lonely',   label:'Lonely' },
  { id:'restless', label:'Restless' },
  { id:'okay',     label:'Okay' },
  { id:'good',     label:'Happy' }
];
/* a state worth lifting -> the palette chosen to counter it */
const LIFT = {
  low:      { mood:'sun',    color:'warm yellow', why:'Warm yellows are linked with optimism and cheer, while cool colors can deepen a low mood.' },
  tired:    { mood:'ember',  color:'warm orange', why:'Orange mixes the energy of red with the cheer of yellow, so it is used to give a tired day a lift.' },
  stressed: { mood:'calm',   color:'soft blue',   why:'Blue is the color most often linked with calm and lower stress.' },
  restless: { mood:'forest', color:'quiet green', why:'Green is restful and linked with nature; it is used to ease restlessness and anxiety.' },
  lonely:   { mood:'rose',   color:'warm rose',   why:'Warm pinks are linked with warmth, care and closeness.' }
};
/* the feeling you want to come home with -> its palette */
const WANT = {
  rested:   { mood:'calm',   color:'soft blue',   why:'Blue is linked with calm and rest.' },
  inspired: { mood:'plum',   color:'lavender',    why:'Purples are linked with imagination and creativity.' },
  free:     { mood:'tide',   color:'sea green',   why:'Open blue-greens are linked with space, air and freshness.' },
  close:    { mood:'rose',   color:'warm rose',   why:'Warm pinks are linked with warmth and closeness.' },
  alive:    { mood:'ember',  color:'clay orange', why:'Warm oranges and reds are linked with energy and excitement.' },
  lighter:  { mood:'sun',    color:'warm yellow', why:'Yellow is linked with lightness, optimism and cheer.' },
  curious:  { mood:'forest', color:'olive green', why:'Green is linked with growth and an easy, open mind.' },
  proud:    { mood:'plum',   color:'deep lavender', why:'Deep purples are linked with dignity and confidence.' }
};
const FEEL_COLOR_SOURCE = 'https://www.verywellmind.com/color-psychology-2795824';

/* which palette, and why. S.colors === 'window' keeps the window's own colors */
function feelingPalette(){
  const w = WIN.find(x => x.id === S.window);
  if (S.colors === 'window') return { mood:w.mood, kind:'window' };
  const lift = S.now && LIFT[S.now];
  if (lift) return { ...lift, kind:'lift', now:NOW.find(n => n.id === S.now) };
  if (typeof touched !== 'undefined' && touched.has(5) && WANT[S.feel]) return { ...WANT[S.feel], kind:'want', feel:FEEL.find(f => f.id === S.feel) };
  return { mood:w.mood, kind:'window' };
}
/* is the page trying to cheer someone up? (the traveler then encourages them) */
const isLifting = () => S.colors !== 'window' && !!(S.now && LIFT[S.now]);

/* the "why these colors" note on the feeling card */
function colorsWhyHTML(){
  const p = feelingPalette();
  if (p.kind === 'window' && S.colors !== 'window') return '';
  const head = p.kind === 'lift' ? `You feel ${p.now.label.toLowerCase()} right now, so the page turned ${p.color}.`
    : p.kind === 'want' ? `You want to come home feeling ${p.feel.label.toLowerCase()}, so the page turned ${p.color}.`
    : 'You are seeing the colors of the window you picked.';
  return `<div class="why-colors" data-fade>
    <span class="wc-swatch" aria-hidden="true"></span>
    <div><p class="label muted">Your colors</p><p class="small"><span>${esc(head)}</span> ${p.why ? `<span>${esc(p.why)}</span>` : ''}</p>
      <p class="fine">Color effects are small and differ from person to person. <a href="${FEEL_COLOR_SOURCE}" target="_blank" rel="noopener">About color psychology</a></p></div>
    <button type="button" class="btn btn-ghost btn-sm" data-act="colormode">${S.colors === 'window' ? 'Use colors for my feeling' : 'Keep my window’s colors'}</button>
  </div>`;
}
