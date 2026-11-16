"use strict";
/* features/engage/index.js — Engage: entry points. The nudge lives in #engageSlot on the start screen. */
AFTER.intro = paintEngage;
onProfile(() => { if (S.stage === 'intro') paintEngage(); });
BE.on(() => { if (S.stage === 'intro') paintEngage(); });
ACT.went = async el => {
  const t = tripOf(el); if (!t) return;
  const yes = el.dataset.v === '1';
  await markWent(t, yes);
  if (yes) openRateSheet(t); else toast('Got it. Plans change. Your saved plan is still here when you want it.');
};
ACT.ratetrip = el => { const t = tripOf(el); if (t) openRateSheet(t); };
ACT.snoozetrip = async el => { const t = tripOf(el); if (!t) return; await snoozeTrip(t, 7); toast('No problem. We will ask again next week.'); };
