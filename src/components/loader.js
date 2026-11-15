/* components/loader.js — Loading screen. */
COMPONENTS['loader'] = () => `<div id="loader" role="status" aria-label="Loading MoodTrip">
  <div class="lp"></div>
  <div class="ld-in">
    <p class="ld-line ld-brand">MoodTrip</p>
    <p class="ld-line ld-sub">Reading the room</p>
    <p class="ld-line ld-num"><span id="ldNum">0</span><i>%</i></p>
  </div>
</div>`;
