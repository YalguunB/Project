"use strict";
/* core/constants.js — Shared helpers, stage names, and the 3D-orb anchors. */
/* ============ APP: views, events, wiring (GL scene, motion layer, shared backend) ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const stageEl = $('#stage');
const GROUP = { intro:-1, game:0, card:0, budget:1, matches:2, planner:3, field:-1, plans:-1 };
const STAGE_NAMES = ['Feel', 'Budget', 'Matches', 'Plan'];
const STAGE_LABEL = { intro:'MoodTrip', game:'The game', card:'Your feeling', budget:'Budget & timing', matches:'Your matches', planner:'Your plan', field:'The field', plans:'My plans' };
const SAVE_KEY = 'moodtrip:saved:v1';
const GRIP = '<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="1.7"/><circle cx="10" cy="4" r="1.7"/><circle cx="4" cy="10" r="1.7"/><circle cx="10" cy="10" r="1.7"/><circle cx="4" cy="16" r="1.7"/><circle cx="10" cy="16" r="1.7"/></svg>';
/* where the 3D orb sits on each screen: [desktop, phone] = [x, y, size] as fractions of the viewport.
   r1..r5 are the five rounds of the one-page game: the orb moves to the round that is in view. */
const ANCHOR = {                       // where the traveler floats on each screen: [x, y, size] for desktop, then phone
  intro:   [[.8, .66, .8],   [.74, .2, .62]],
  r1:      [[.93, .84, .3],  [.9, .9, .26]],
  r2:      [[.5, .52, .6],   [.5, .46, .6]],
  r3:      [[.93, .84, .3],  [.9, .9, .26]],
  r4:      [[.93, .84, .3],  [.9, .9, .26]],
  r5:      [[.93, .84, .3],  [.9, .9, .26]],
  card:    [[.9, .24, .36],  [.5, .2, .55]],
  budget:  [[.93, .22, .4],  [.84, .15, .38]],
  matches: [[.95, .2, .3],   [.86, .15, .34]],
  planner: [[.95, .2, .28],  [.86, .15, .32]],
  plans:   [[.95, .2, .3],   [.86, .15, .32]]
};
const BAG_STAGES = new Set(['card']); // the game shows the bag from round 3 on (see bagOn)
let picked = false; // has the traveler chosen a window yet (round 1 shifts the whole mood)
let prevStage = 'intro';
