"use strict";
/* components/sheet.js — Bottom sheet dialog. */
COMPONENTS['sheet'] = () => `<div id="sheet" class="sheet-wrap" hidden>
  <div class="sheet-bd" data-act="closesheet"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shTitle" tabindex="-1">
    <div id="shBody"></div>
  </div>
</div>`;
