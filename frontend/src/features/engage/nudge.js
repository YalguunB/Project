/* features/engage/nudge.js — Engage: one nudge on the start screen, shaped by who is visiting, and a quick "rate your trip" sheet.

   Every line here is true for this traveler: their own trip dates, the month's real season score, and counts of real cards in the
   shared field. Nothing is invented ("only 2 left!") because nothing is sold here; a made-up deadline would cost trust the first
   time someone noticed. Urgency comes from the traveler's own calendar instead. */
const WEEK_MS = 7 * DAY_MS;
const tripKey = t => `${t.dest}|${t.month}|${t.year}`;
const tripOf = el => { const [dest, m, y] = String(el.dataset.trip || '').split('|'); return profile && profile.trips.find(t => t.dest === dest && t.month === +m && t.year === +y) || null; };
const pickedThisWeek = destId => BE.cards().filter(c => c.d === destId && !c.mine && c.at > Date.now() - WEEK_MS).length;
const notYet = p => { const been = new Set(tripsTaken(p).map(t => t.dest)); return DEST.filter(d => !been.has(d.id)); };
const listNames = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1];
function whenText(t){
  const ms = tripStart(t) - Date.now();
  if (ms <= 0) return 'this month';
  const days = Math.round(ms / DAY_MS); if (days < 14) return `in ${days} ${plural(days, 'day', 'days')}`;
  const w = Math.round(ms / WEEK_MS); if (w < 9) return `in ${w} weeks`;
  const m = Math.round(ms / (30.4 * DAY_MS)); return `in ${m} months`;
}

function nudgeHTML(){
  const p = profile; if (!p) return '';
  const seg = segmentOf(p), n = tripsTaken(p).length, ask = nextAsk(p);
  const label = seg === 'seasoned' ? `Seasoned traveler · ${n} trips` : seg === 'once' || p.visits > 1 ? 'Welcome back' : 'Your next trip';
  let title, body, btns = '';

  if (ask && ask.kind === 'went'){
    const d = destById(ask.trip.dest), k = tripKey(ask.trip);
    title = `Did you make it to ${d.name} in ${MONTH_FULL[ask.trip.month]}?`;
    body = 'Tell us and we will ask how the places on your plan were. It helps the next traveler going there.';
    btns = `<button class="btn btn-primary btn-sm" data-act="went" data-v="1" data-trip="${k}">Yes, I went</button><button class="btn btn-ghost btn-sm" data-act="went" data-v="0" data-trip="${k}">No, not this time</button>`;
  }
  else if (ask && ask.kind === 'review'){
    const d = destById(ask.trip.dest), k = ask.left.length;
    title = seg === 'seasoned' ? `Your take on ${d.name} carries weight` : `How was ${d.name}?`;
    body = `${k} ${plural(k, 'place', 'places')} from your plan ${k === 1 ? 'is' : 'are'} waiting for a rating. Stars only, a few taps.`
      + (n >= 2 ? ` Your reviews carry a “${n} trips” badge, so readers know they come from experience.` : ' The next traveler heading there will see them.');
    btns = `<button class="btn btn-primary btn-sm" data-act="ratetrip" data-trip="${tripKey(ask.trip)}">Rate my ${esc(d.name)} stops</button><button class="btn btn-ghost btn-sm" data-act="snoozetrip" data-trip="${tripKey(ask.trip)}">Not now</button>`;
  }
  else if (ask && ask.kind === 'upcoming'){
    const t = ask.trip, d = destById(t.dest), crowd = pickedThisWeek(d.id), busy = mlevel(d.months[t.month]) === 2;
    title = `${d.name} ${whenText(t)}`;
    body = [busy ? `${MONTH_FULL[t.month]} is one of the best and busiest months there, so stays tend to fill early.` : '',
            crowd >= 2 ? `${crowd} other travelers picked ${d.name} in the field this week.` : '',
            seg === 'new' ? 'First trip planned with us? Your plan, budget and best-time notes are saved, so come back to them anytime.' : ''].filter(Boolean).join(' ')
      || `Your ${t.nights}-night plan is saved.`;
    btns = saved && saved.destId === t.dest ? `<button class="btn btn-primary btn-sm" data-act="resume">Open my ${esc(d.name)} plan</button>` : '';
  }
  else if (seg !== 'new'){
    const fresh = notYet(p).map(d => d.name);
    title = seg === 'seasoned' ? 'Somewhere new this time?' : 'Ready for trip number two?';
    body = (fresh.length ? `You have not been to ${listNames(fresh.slice(0, 3))} yet.` : 'You have been to every place here. Go back with a different mood?')
      + (seg === 'seasoned' ? ' You know how it works, so skip the game and go straight to your budget.' : '');
    btns = seg === 'seasoned' ? '<button class="btn btn-primary btn-sm" data-act="skip">Skip to budget</button>' : '';
  }
  else if (p.visits > 1){
    title = 'Good to see you again';
    body = 'The feeling game takes about a minute, and nothing gets booked here, so plan freely.';
  }
  else return '';                                       // a first visit: the page itself is the welcome
  return `<aside class="nudge nudge-${seg}" data-seg="${seg}"><p class="label accent">${esc(label)}</p><p class="title">${esc(title)}</p><p class="small muted">${esc(body)}</p>${btns ? `<div class="row">${btns}</div>` : ''}</aside>`;
}
function paintEngage(){
  const slot = $('#engageSlot'); if (!slot) return;
  const h = nudgeHTML(); if (slot.dataset.h === h) return;
  slot.dataset.h = h; slot.innerHTML = h; FX.bind(slot);
}

/* ---------- "how was your trip?": star every unreviewed place from the plan in one sheet, saved in one write ---------- */
let rateTrip = null;
function openRateSheet(trip){
  const d = destById(trip.dest); if (!d) return;
  const titles = new Map(catalog(d).map(c => [c.id, c.title])), left = trip.pids.filter(pid => !BE.myReview(pid) && titles.has(pid));
  if (!left.length){ toast(`You have rated every place from ${d.name}. Thank you.`); return; }
  rateTrip = trip; sheetFor = null; sheetOpener = document.activeElement;
  $('#shBody').innerHTML = `
    <div><p class="label accent">Your ${esc(d.name)} trip · ${MONTH_FULL[trip.month]}</p><h2 class="heading" id="shTitle">How were these places?</h2>
    <p class="small muted" style="margin-top:8px">Rate the ones you remember and leave the rest. You can add words later from any place in your plan.</p></div>
    ${BE.canPost ? `<form id="rateForm" class="rform" novalidate>
      ${left.map((pid, i) => `<fieldset><legend class="label muted">${esc(titles.get(pid))}</legend><div class="strength rate-pick" role="radiogroup">${STAR_WORDS.map((w, s) => `<label class="opt" data-cursor=""><input type="radio" name="tr${i}" value="${s + 1}" data-pid="${pid}"><span class="face"><span class="sr">${s + 1} ${plural(s + 1, 'star', 'stars')}, </span><span class="pnr" aria-hidden="true">${s + 1}<i class="rstar"></i></span><small>${w}</small></span></label>`).join('')}</div></fieldset>`).join('')}
      <p class="notice" id="trerr" hidden></p>
      <div class="sheet-foot"><button type="button" class="btn btn-ghost" data-act="closesheet">Later</button><button class="btn btn-primary" type="submit" id="trsub">Post ratings</button></div>
    </form>` : `<p class="notice">Ratings need the shared version of this page.</p><div class="sheet-foot"><button type="button" class="btn btn-secondary" data-act="closesheet">Close</button></div>`}`;
  const wrap = $('#sheet'); wrap.hidden = false;
  if (FX.on && !FX.reduced){ gsap.fromTo('.sheet-bd', { opacity:0 }, { opacity:1, duration:.3 }); gsap.fromTo('.sheet', { y:50, opacity:0, scale:.97 }, { y:0, opacity:1, scale:1, duration:.55, ease:'power4.out' }); }
  FX.bind(wrap); $('.sheet').focus();
}
async function submitRatings(form){
  const err = $('#trerr'), btn = $('#trsub');
  const list = $$('input[type="radio"]:checked', form).map(i => ({ pid:i.dataset.pid, r:+i.value }));
  if (!list.length){ err.textContent = 'Tap a star rating on at least one place.'; err.hidden = false; return; }
  btn.disabled = true; err.hidden = true;
  try {
    await BE.submitRatings(list, tripsTaken(profile).length);
    const d = rateTrip && destById(rateTrip.dest);
    closeSheet(); paintEngage();
    toast(`Thanks. ${list.length} ${plural(list.length, 'rating is', 'ratings are')} live${d ? ` for the next traveler to ${d.name}` : ''}.`);
  } catch (e) { err.textContent = BE.explain(e); err.hidden = false; btn.disabled = false; }
}
