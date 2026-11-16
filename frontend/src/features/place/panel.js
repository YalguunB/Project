/* features/place/panel.js — Place: the side drawer / bottom sheet. */
function placeHTML(s, k, i){
  const d = S.dest, n = S.plan.days[k].stops.length, pid = pidOf(s), info = pid ? placeInfo(d.id, s.title) : null, cost = stopCost(s), spot = info ? spotOf(d.id, s.title) : null;
  const facts = [['When', `Day ${k + 1} · ${fmtHour(slotHour(i, n))}`], ['Cost', cost ? `${money(cost)}` : 'Free'], info && ['Usually', info.time], s.part && ['Best time', cap(PART_WORD[s.part])]].filter(Boolean);
  return `<div class="pl-top"><div><p class="label accent">${info ? esc(info.cat) : 'Your own stop'} · ${esc(d.name)}</p><h2 class="heading" id="plTitle">${esc(s.title)}</h2></div>
      <button type="button" class="icon-btn pl-close" data-act="closeplace" aria-label="Close place details" data-cursor="Close">×</button></div>
    <div class="pl-scroll">
      <dl class="pl-facts">${facts.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
      <p class="pl-about">${info ? esc(info.about) : 'You added this stop yourself, so there is no guide entry or traveler reviews for it. You can still move it or remove it in your plan.'}</p>
      ${info ? `<div class="pl-tip"><p class="label muted">Local tip</p><p>${esc(info.tip)}</p></div><p class="fine">A hand-written guide note for this prototype, not a live listing. Times and prices are typical, so check hours and tickets before you go.</p>
      ${spot ? spotHTML(spot) : genericMapHTML(s, d)}` : ''}
      ${pid ? `<section class="pl-rev" aria-labelledby="plRevH">
        <div class="pl-rev-head"><h3 class="title" id="plRevH">Traveler reviews</h3><span class="live ${BE.ready ? '' : 'off'}" id="plLive"><i aria-hidden="true"></i>${BE.ready ? 'Live' : 'Offline'}</span></div>
        <div id="plReviews">${reviewsHTML(pid, s.title)}</div>
        <div id="plForm">${reviewFormHTML(pid)}</div>
      </section>` : ''}
    </div>`;
}
function lockScroll(on){
  const root = document.documentElement;
  if (on){ root.style.setProperty('--sbw', Math.max(0, innerWidth - root.clientWidth) + 'px'); root.classList.add('pl-open'); }
  else { root.classList.remove('pl-open'); root.style.removeProperty('--sbw'); }
}
function openPlace(id, opener){
  const loc = locate(id); if (!loc || S.stage !== 'planner') return;
  const [k, i] = loc, s = S.plan.days[k].stops[i], pid = pidOf(s);
  closeSheet(true);
  placeId = id; placeOpener = opener || document.activeElement; revAll = false; resetPhoto();
  seenRev = BE.reviewsAt ? new Set(pid ? BE.reviewsFor(pid).list.map(revKey) : []) : null;
  $('#plBody').innerHTML = placeHTML(s, k, i);
  const wrap = $('#place'); wrap.hidden = false; lockScroll(true);
  const panel = $('.place'), narrow = innerWidth <= 760;
  if (FX.on && !FX.reduced){
    gsap.fromTo('.place-bd', { opacity:0 }, { opacity:1, duration:.3 });
    gsap.fromTo(panel, narrow ? { yPercent:12, opacity:0 } : { xPercent:8, opacity:0 }, { yPercent:0, xPercent:0, opacity:1, duration:.55, ease:'power4.out', clearProps:'transform,opacity' });
  }
  FX.bind(wrap);
  panel.focus({ preventScroll:true });
  const sp = pid ? spotOf(S.dest.id, s.title) : null; if (sp) loadGoogle(sp);
  clearInterval(agoTimer); agoTimer = setInterval(paintReviews, 20000);
  say(`${s.title}. Place details${pid ? ' and traveler reviews' : ''}.`);
}
function closePlace(quiet){
  const wrap = $('#place'); if (wrap.hidden) return;
  const id = placeId; wrap.hidden = true; placeId = null; resetPhoto(); clearInterval(agoTimer); lockScroll(false);
  const back = placeOpener && placeOpener.isConnected ? placeOpener : id ? $(`.stop-main[data-id="${id}"]`) : null;
  placeOpener = null;
  if (!quiet && back) back.focus({ preventScroll:true });
}
