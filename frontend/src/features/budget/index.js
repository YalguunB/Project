"use strict";
/* features/budget/index.js — Budget: entry points. */
VIEWS.budget = () => `<section aria-labelledby="h1">
    <header class="head"><p class="label accent" data-fade>Step 2 of 4</p><h1 class="display-l" id="h1" tabindex="-1" data-split>Budget and timing.</h1><p class="body-l muted" data-fade>Set what you’d spend and when you can go. Everything is per person, and flights are not included.</p></header>
    <div class="two">
      <div class="controls" data-fade>
        <div class="field">
          <div class="field-top"><label class="label muted" for="budget">Budget</label><span class="small muted">per person · flights not included</span></div>
          <div class="big-money" id="budgetVal">${money(S.budget)}</div>
          <input type="range" id="budget" min="500" max="5000" step="50" value="${S.budget}" aria-label="Total budget in US dollars">
          <div class="range-scale" aria-hidden="true"><span>$500</span><span>$5,000</span></div>
        </div>
        <div class="field"><p class="label muted" id="styleLbl">Travel style</p>
          <div class="styles" role="radiogroup" aria-labelledby="styleLbl">
          ${STYLE.map(s => `<label class="opt style"><input type="radio" name="style" value="${s.id}" ${S.style === s.id ? 'checked' : ''}><span class="face"><span class="nm">${s.name}</span><span class="ds">${s.desc}</span><span class="pd" id="sc-${s.id}"></span></span></label>`).join('')}
          </div></div>
        <div class="field"><p class="label muted" id="monthLbl">When</p>
          <div class="months" role="radiogroup" aria-labelledby="monthLbl">
          ${MONTHS.map((m, i) => `<label class="opt chip" data-cursor=""><input type="radio" name="month" value="${i}" ${S.month === i ? 'checked' : ''} aria-label="${MONTH_FULL[i]}"><span class="face">${m}</span></label>`).join('')}
          </div></div>
        <div class="field"><p class="label muted" id="lenLbl">Trip length</p>
          <div class="stepper" role="group" aria-labelledby="lenLbl"><button type="button" data-act="nights" data-d="-1" aria-label="One fewer night">−</button><output id="nightsOut" aria-live="polite"></output><button type="button" data-act="nights" data-d="1" aria-label="One more night">+</button></div></div>
      </div>
      <aside class="summary" aria-label="Your trip so far" data-pop>
        <p class="label muted">Your trip so far</p>
        <dl class="sum-rows">
          <div><dt>Feeling</dt><dd>${archetype().name}</dd></div>
          <div><dt>Energy</dt><dd>${S.energy}% · ${energyLevel().per} stops a day</dd></div>
          <div><dt>Budget</dt><dd id="sumBudget"></dd></div>
          <div><dt>Style</dt><dd id="sumStyle"></dd></div>
          <div><dt>When</dt><dd id="sumWhen"></dd></div>
        </dl>
        <div class="perday"><span class="small muted">About</span><b><span id="perDay"></span> a day</b><span class="small muted">before flights</span></div>
        <p class="status small" id="fit"></p>
        <button class="btn btn-primary" data-act="next">See my matches</button>
        <button class="btn btn-ghost btn-sm" data-act="back">Back to my feeling card</button>
      </aside>
    </div></section>`;
AFTER.budget = paintBudget;
ACT.nights = el => { S.nights = clamp(S.nights + (+el.dataset.d), 3, 8); paintBudget(); };
