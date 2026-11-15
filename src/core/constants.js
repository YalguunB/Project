/* core/constants.js — Shared helpers, stage names, and the 3D-orb anchors. */
/* ============ APP: views, events, wiring (GL scene, motion layer, shared backend) ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const stageEl = $('#stage');
const GROUP = { intro:-1, game:0, card:0, budget:1, matches:2, planner:3, field:-1 };
const STAGE_NAMES = ['Feel', 'Budget', 'Matches', 'Plan'];
const STAGE_LABEL = { intro:'MoodTrip', game:'The game', card:'Your feeling', budget:'Budget & timing', matches:'Your matches', planner:'Your plan', field:'The field' };
const SAVE_KEY = 'moodtrip:saved:v1';
const GRIP = '<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="1.7"/><circle cx="10" cy="4" r="1.7"/><circle cx="4" cy="10" r="1.7"/><circle cx="10" cy="10" r="1.7"/><circle cx="4" cy="16" r="1.7"/><circle cx="10" cy="16" r="1.7"/></svg>';
/* where the 3D orb sits on each screen: [desktop, phone] = [x, y, size] as fractions of the viewport.
   r1..r5 are the five rounds of the one-page game: the orb moves to the round that is in view. */
const ANCHOR = {
  intro:   [[.73, .52, .86], [.5, .26, .98]],
  r1:      [[.5, .66, .62],  [.5, .56, .7]],
  r2:      [[.5, .52, .6],   [.5, .46, .6]],
  r3:      [[.5, .60, .58],  [.5, .50, .72]],
  r4:      [[.5, .62, .58],  [.5, .52, .72]],
  r5:      [[.5, .56, .74],  [.5, .48, .8]],
  card:    [[.22, .52, .52], [.5, .2, .55]],
  budget:  [[.93, .20, .42], [.82, .12, .42]],
  matches: [[.98, .07, .34], [.85, .09, .4]],
  planner: [[.97, .05, .3],  [.86, .08, .36]]
};
const BAG_STAGES = new Set(['card']); // the game shows the bag from round 3 on (see bagOn)
let picked = false; // has the traveler chosen a window yet (round 1 shifts the whole mood)
let prevStage = 'intro';
