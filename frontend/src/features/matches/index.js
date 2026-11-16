/* features/matches/index.js — Matches: entry points. */
VIEWS.matches = () => { const R = rank().slice(0, 3);
    const lvlWord = ['off season', 'a good month', 'a best month'];
    return `<section aria-labelledby="h1">
    <header class="head"><p class="label accent" data-fade>Step 3 of 4</p><h1 class="display-l" id="h1" tabindex="-1" data-split>Three places that feel like you.</h1>
      <p class="body-l muted" data-fade>Matched on your feeling, ${MONTH_FULL[S.month]}, and a ${money(S.budget)} budget.</p>
      <div class="formula" aria-label="How the match is weighed" data-fade><span class="tag">50% feeling</span><span class="tag">25% month</span><span class="tag">25% budget</span></div></header>
    <div class="cards">
    ${R.map((r, i) => { const over = r.cost.total > S.budget, diff = Math.abs(S.budget - r.cost.total), br = bestRange(r.d);
      const score = (name, v) => `<div class="score"><span>${name}</span><div class="bar"><i style="width:${v}%"></i></div><span class="tnum">${v}</span></div>`;
      return `<article class="dcard ${i === 0 ? 'first' : ''}" data-pop data-tilt><div class="pic" data-liquid>${scene(r.d.scene)}<span class="badge ${i === 0 ? 'first' : ''}">#${i + 1}${i === 0 ? ' · Best match' : ''}</span></div>
      <div class="dbody"><div class="dhead"><div><h2 class="heading">${r.d.name}</h2><p class="small muted">${r.d.country} · ${r.d.blurb}</p></div><div class="pct"><b>${r.match}%</b><span class="caption muted">match</span></div></div>
      <div class="scores">${score('Feeling', r.feel)}${score('Month', r.month)}${score('Budget', r.budget)}</div>
      <p class="small muted">${MONTH_FULL[S.month]} is ${lvlWord[mlevel(r.month)]} here${br ? ` · best ${br}` : ''}.</p>
      ${crowdHTML(r)}
      <div class="cost-line"><span class="small muted">Est. cost · ${S.nights} nights</span><span class="title tnum">${money(r.cost.total)}</span></div>
      <p class="status ${over ? 'warn' : 'ok'}">${over ? `${money(diff)} over budget` : `${money(diff)} under budget`}</p>
      <button class="btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}" data-act="plan" data-id="${r.d.id}" data-cursor="Plan">Plan this trip</button></div></article>`; }).join('')}
    </div>
    <div class="foot split" data-fade><button class="btn btn-ghost" data-act="back">Change budget or timing</button><p class="fine">Prototype data: prices and best months are illustrative. Costs exclude flights. Traveler notes come from other visitors.</p></div></section>`; };
ACT.report = el => openReport(el.dataset.id);
ACT.closesheet = () => closeSheet();
