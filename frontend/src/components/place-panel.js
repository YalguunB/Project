"use strict";
/* components/place-panel.js — Place details side panel. */
COMPONENTS['place-panel'] = () => `<div id="place" class="place-wrap" hidden>
  <div class="place-bd" data-act="closeplace"></div>
  <aside class="place" role="dialog" aria-modal="true" aria-labelledby="plTitle" tabindex="-1">
    <div id="plBody"></div>
  </aside>
</div>`;
