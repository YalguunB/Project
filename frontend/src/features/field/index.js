/* features/field/index.js — Field: entry points. */
VIEWS.field = () => `<section class="field-view" aria-labelledby="h1">
    <div class="field-top">
      <p class="label accent" data-fade>Live · anonymous</p>
      <h1 class="display-l" id="h1" tabindex="-1" data-split>Everyone’s feeling, floating.</h1>
      <p class="body-l muted" id="fieldLead" data-fade></p>
    </div>
    <div class="field-bot" data-fade>
      <div class="field-actions" id="fieldActions"></div>
      <div class="detail" id="fieldDetail" hidden aria-live="polite"></div>
    </div>
    <ul class="sr" id="fieldList" aria-label="Feeling cards in the field"></ul>
  </section>`;
AFTER.field = () => { paintField(); };
ACT.field = () => { if (S.stage === 'field') ACT.fieldback(); else go('field'); };
ACT.fieldback = () => go(prevStage && prevStage !== 'field' ? prevStage : 'intro');
ACT.addcard = async el => {
    if (el) el.disabled = true;
    try { await BE.publishCard(S.dest ? S.dest.id : null); toast('Your card is floating in the field.'); }
    catch (e) { toast(BE.explain(e)); }
    paintField();
  };
ACT.removecard = async el => {
    if (el) el.disabled = true;
    try { await BE.removeCard(); showDetail(null); toast('Your card was removed from the field.'); }
    catch (e) { toast(BE.explain(e)); }
    paintField();
  };
