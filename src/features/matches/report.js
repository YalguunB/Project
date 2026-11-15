/* features/matches/report.js — Matches: report sheet, how did a place feel? */
/* ---------- report sheet: how did a place feel? ---------- */
let sheetFor = null, sheetOpener = null;
const STRENGTH = ['A hint', 'Mild', 'Clearly', 'Strong', 'Deeply'];
function openReport(destId){
  const d = destById(destId); if (!d) return;
  sheetFor = destId; sheetOpener = document.activeElement;
  const mine = BE.myReport(destId), can = BE.canPost, feel = mine ? mine.feel : S.feel, score = mine ? mine.score : 3;
  $('#shBody').innerHTML = `
    <div><p class="label accent">Traveler note · anonymous</p><h2 class="heading" id="shTitle">How did ${esc(d.name)} make you feel?</h2>
    <p class="small muted" style="margin-top:8px">One note per place. Only the feeling and how strongly you felt it are shared, nothing else. You can change it later.</p></div>
    ${can ? `<form id="reportForm" class="rform" novalidate>
      <fieldset><legend class="label muted">The feeling</legend><div class="chips" role="radiogroup">${FEEL.map(f => `<label class="opt chip" data-cursor=""><input type="radio" name="rfeel" value="${f.id}" ${f.id === feel ? 'checked' : ''}><span class="face">${f.label}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend class="label muted">How strongly</legend><div class="strength" role="radiogroup">${STRENGTH.map((t, i) => `<label class="opt" data-cursor=""><input type="radio" name="rscore" value="${i + 1}" ${i + 1 === score ? 'checked' : ''}><span class="face">${i + 1}<small>${t}</small></span></label>`).join('')}</div></fieldset>
      <p class="notice" id="rerr" hidden></p>
      <div class="sheet-foot"><button type="button" class="btn btn-ghost" data-act="closesheet">Cancel</button><button class="btn btn-primary" type="submit" id="rsub">${mine ? 'Update my note' : 'Send my note'}</button></div>
    </form>` : `<p class="notice">${BE.ready ? 'Adding notes is switched off for your access level. Ask the owner for Contributor access.' : 'Notes need the shared version of this page.'}</p>
      <div class="sheet-foot"><button type="button" class="btn btn-secondary" data-act="closesheet">Close</button></div>`}`;
  const wrap = $('#sheet'); wrap.hidden = false;
  if (FX.on && !FX.reduced){ gsap.fromTo('.sheet-bd', { opacity:0 }, { opacity:1, duration:.3 }); gsap.fromTo('.sheet', { y:50, opacity:0, scale:.97 }, { y:0, opacity:1, scale:1, duration:.55, ease:'power4.out' }); }
  FX.bind(wrap);
  $('.sheet').focus();
}
function closeSheet(quiet){
  const wrap = $('#sheet'); if (wrap.hidden) return;
  wrap.hidden = true; sheetFor = null;
  if (!quiet && sheetOpener && sheetOpener.isConnected) sheetOpener.focus({ preventScroll:true });
  sheetOpener = null;
}
async function submitReport(form){
  const feel = form.elements.rfeel.value, score = +form.elements.rscore.value, btn = $('#rsub'), err = $('#rerr');
  if (!feel || !score){ err.textContent = 'Pick a feeling and how strongly you felt it.'; err.hidden = false; return; }
  btn.disabled = true; err.hidden = true;
  try {
    await BE.submitReport(sheetFor, feel, score);
    const d = destById(sheetFor), n = CROWD[sheetFor] ? CROWD[sheetFor].n : 1;
    closeSheet(); toast(`Thanks. Your note on ${d.name} is in, with ${n} ${plural(n, 'traveler', 'travelers')} so far.`);
  } catch (e) { err.textContent = BE.explain(e); err.hidden = false; btn.disabled = false; }
}
