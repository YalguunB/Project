"use strict";
/* features/field/field.js — Field: everyone's shared feeling cards. */
/* ---------- the field: everyone's shared feeling cards ---------- */
function cardDetail(c){
  const w = WIN.find(x => x.id === c.w), f = FEEL.find(x => x.id === c.f), s = SOUND.find(x => x.id === c.s), d = c.d ? destById(c.d) : null;
  const bag = c.bag.map(id => BAG.find(b => b.id === id).name.toLowerCase());
  return `<p class="label accent">${c.mine ? 'Your card' : 'A traveler'}</p><h2 class="heading">${esc(c.name)}</h2>
    <dl><dt>Window</dt><dd>${w.name}</dd><dt>Energy</dt><dd>${c.e}% · ${energyLevel(c.e).label.toLowerCase()}</dd><dt>Wants to feel</dt><dd>${f.label}</dd>
    <dt>Soundtrack</dt><dd>${s.name}</dd><dt>Bag</dt><dd>${bag.length ? capFirst(bag.join(', ')) : 'Nothing, very light'}</dd>${d ? `<dt>Eyeing</dt><dd>${esc(d.name)}</dd>` : ''}</dl>`;
}
function showDetail(c){
  const el = $('#fieldDetail'); if (!el) return;
  if (!c){ el.hidden = true; return; }
  el.innerHTML = cardDetail(c); el.hidden = false;
  if (FX.on && !FX.reduced) gsap.fromTo(el, { y:18, opacity:0 }, { y:0, opacity:1, duration:.5, ease:'power3.out' });
}
function paintField(){
  if (S.stage !== 'field') return;
  const cards = BE.cards(), mine = BE.myCard(), n = cards.length;
  $('#fieldLead').textContent = !BE.ready ? 'The shared field lives in the signed-in version of this page. The rest of MoodTrip works on its own.'
    : !n ? 'Nobody has added a feeling card yet. Add yours and it floats here as an anonymous orb that others can hover and read.'
    : `${n} ${plural(n, 'traveler is', 'travelers are')} floating right now. Hover an orb to see their mood, click one to read their card.`;
  const a = $('#fieldActions');
  if (!BE.ready) a.innerHTML = `<button class="btn btn-secondary" data-act="fieldback">Back to my trip</button>`;
  else if (!BE.canPost) a.innerHTML = `<p class="small muted">You can look around, but adding a card is switched off for your access level. Ask the owner for Contributor access.</p><button class="btn btn-secondary" data-act="fieldback">Back to my trip</button>`;
  else if (!S.cardSeen && !mine) a.innerHTML = `<p class="small muted">Play the feeling game first, so your card says something true about you.</p><div class="row"><button class="btn btn-primary" data-act="start">Play the game</button><button class="btn btn-ghost" data-act="fieldback">Back</button></div>`;
  else a.innerHTML = `<div class="row">${mine
      ? `<button class="btn btn-primary" data-act="addcard">Update my card</button><button class="btn btn-secondary" data-act="removecard">Remove my card</button>`
      : `<button class="btn btn-primary" data-act="addcard">Add my card to the field</button>`}<button class="btn btn-ghost" data-act="fieldback">Back</button></div>
    <p class="fine">Shares your window, energy, up to three bag items, soundtrack, feeling and the place you’re eyeing. No name, no email. Remove it any time.</p>`;
  $('#fieldList').innerHTML = cards.map(c => `<li>${esc(c.name)}${c.mine ? ' (you)' : ''}: ${WIN.find(w => w.id === c.w).name}, energy ${c.e}%</li>`).join('');
  FX.bind($('#fieldActions'));
  if (GL.ok) GL.setField(cards);
}
const tip = $('#tip');
function tipFor(c){ const f = FEEL.find(x => x.id === c.f), d = c.d ? destById(c.d) : null; return `<b>${esc(c.name)}${c.mine ? ' · you' : ''}</b>${c.e}% energy · wants to feel ${f.label.toLowerCase()}${d ? ` · eyeing ${esc(d.name)}` : ''}`; }
function moveTip(x, y){
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.transform = `translate(${Math.max(8, Math.min(x + 18, innerWidth - w - 8))}px,${Math.max(8, Math.min(y + 18, innerHeight - h - 8))}px)`;
}
if (GL.ok){
  GL.hoverCb = c => {
    if (!c){ tip.hidden = true; return; }
    tip.innerHTML = tipFor(c); tip.hidden = false; moveTip(lastX, lastY);
  };
  GL.pickCb = c => { showDetail(c); say(`${c.name}. ${c.e}% energy.`); };
}
let lastX = 0, lastY = 0;
addEventListener('pointermove', e => { lastX = e.clientX; lastY = e.clientY; if (!tip.hidden) moveTip(lastX, lastY); }, { passive:true });
