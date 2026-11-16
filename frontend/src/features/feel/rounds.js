"use strict";
/* features/feel/rounds.js — Feel: one section per round. */
/* ---------- the game: one section per round ---------- */
const ROUND_BODY = {
  1: () => `<div class="arches" role="radiogroup" aria-label="Window view">
    ${WIN.map(w => `<label class="opt arch"><input type="radio" name="window" value="${w.id}" ${touched.has(1) && S.window === w.id ? 'checked' : ''}><span class="face"><span class="pic" data-liquid>${scene(w.id)}</span><span class="txt"><span class="nm"><i></i>${w.name}</span><span class="small muted">${w.sub}</span></span></span></label>`).join('')}
    </div>`,
  2: () => { const L = energyLevel();
    return `<div class="energy-read ${touched.has(2) ? '' : 'unset'}"><div class="num" id="enNum">${S.energy}%</div><p class="title" id="enWord">${energyWord(S.energy)}</p><p class="small muted" id="enHint">Plans about ${L.per} stops a day</p></div>
      <div class="battery" id="battery" role="slider" tabindex="0" aria-label="Energy level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${S.energy}" aria-valuetext="${S.energy} percent, ${energyWord(S.energy)}" style="--p:${S.energy / 100}"><div class="charge"></div><div class="knob" aria-hidden="true"><b></b><b></b></div></div>
      <div class="scale" aria-hidden="true"><span>Drained</span><span>Steady</span><span>Buzzing</span></div>
      <p class="rule">Low energy gives 2 stops a day · high energy gives 4</p>
      <div class="now-feel"><p class="title">And right now, you feel…</p>
        <div class="chips" role="radiogroup" aria-label="How you feel right now">${NOW.map(n => `<label class="opt chip"><input type="radio" name="now" value="${n.id}" ${S.now === n.id ? 'checked' : ''}><span class="face">${n.label}</span></label>`).join('')}</div>
        <p class="small muted">The colors around you follow this: a low day gets warm, cheerful colors, a stressed one calm blues.</p></div>`; },
  3: () => `<div class="tiles" role="group" aria-label="Bag items, pick up to three">
    ${BAG.map(b => `<label class="opt tile"><input type="checkbox" name="bag" value="${b.id}" ${S.bag.includes(b.id) ? 'checked' : ''}><span class="face"><span class="gl">${icon(b.id)}</span><span class="nm">${b.name}</span><span class="ht">${b.hint}</span></span></label>`).join('')}
    </div><p class="rule packed" id="packed" aria-live="polite">${packedText()}</p>`,
  4: () => `<div class="sounds" role="radiogroup" aria-label="Soundtrack">
    ${SOUND.map(s => `<label class="opt sound"><input type="radio" name="sound" value="${s.id}" ${touched.has(4) && S.sound === s.id ? 'checked' : ''}><span class="face"><span class="wave" aria-hidden="true">${s.bars.map((h, i) => `<i style="--h:${h};--i:${i}"></i>`).join('')}</span><span class="nm">${s.name}</span><span class="ht">${s.hint}</span></span></label>`).join('')}
    </div>`,
  5: () => `<div class="sentence"><p class="display-l">I want to come home feeling</p><p class="fill"><span class="pill-word ${touched.has(5) ? '' : 'empty'}" id="pillWord" aria-live="polite">${touched.has(5) ? FEEL.find(f => f.id === S.feel).label.toLowerCase() : '…'}</span><span class="dot">.</span></p></div>
    <div class="chips" id="feelChips" role="radiogroup" aria-label="Feeling">
    ${FEEL.map(f => `<label class="opt chip" data-cursor=""><input type="radio" name="feel" value="${f.id}" ${touched.has(5) && S.feel === f.id ? 'checked' : ''}><span class="face">${f.label}</span></label>`).join('')}
    </div>`
};
const roundSection = r => `<section class="gr" id="gr${r.n}" data-n="${r.n}" aria-labelledby="gt${r.n}"><div class="gr-in" data-rise>
  <header class="gr-head"><p class="label muted gr-lbl">Round ${r.n} of 5<span class="tag gr-ok" hidden>Answered</span></p><h2 class="display-m" id="gt${r.n}" tabindex="-1">${r.title}</h2><p class="body-l muted">${r.sub}</p></header>
  <div class="gr-body">${ROUND_BODY[r.n]()}</div>
  ${r.n < 5 ? `<button class="btn btn-ghost btn-sm gr-next" type="button" data-act="gnext" data-n="${r.n}">Skip this round</button>` : ''}
</div></section>`;
