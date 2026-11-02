/* ============ PLACES: what each stop is like (hand-written; keyed by the stop's title) ============
   PLACE[destId][title] = [category, description, local tip, usual time]
   Times are typical, not promised. Prices come from the plan itself (the same figures as the planner). */
const PLACE = {};
const placeInfo = (destId, title) => { const p = PLACE[destId] && PLACE[destId][title]; return p ? { cat:p[0], about:p[1], tip:p[2], time:p[3] } : null; };
