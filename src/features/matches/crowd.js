/* features/matches/crowd.js — Matches: what other travelers said about a place. */
/* ---------- crowd: what other travelers said about a place ---------- */
function crowdHTML(r){
  const c = r.crowd, mine = BE.myReport(r.d.id);
  const body = c
    ? `<p class="small"><b>${c.n} ${plural(c.n, 'traveler', 'travelers')}</b> told us how ${esc(r.d.name)} felt.</p>
       <div class="tags">${c.top.map(([f, n]) => `<span class="tag">${esc((FEEL.find(x => x.id === f) || { label:f }).label)} · ${n}</span>`).join('')}</div>
       ${r.base !== undefined ? `<p class="fine">Feeling score: ${r.base} from your answers, ${r.feel} with their notes blended in.</p>` : ''}`
    : `<p class="small muted">${BE.ready ? `No traveler notes for ${esc(r.d.name)} yet.` : 'Traveler notes show up in the shared version of this page.'}</p>`;
  const btn = BE.ready ? `<button class="crowd-link" type="button" data-act="report" data-id="${r.d.id}">${mine ? 'Edit my note' : 'Been here? Share how it felt'}</button>` : '';
  return `<div class="crowd" data-crowd="${r.d.id}">${body}${btn}</div>`;
}
