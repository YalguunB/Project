/* components/top-right.js — Meta line, the language switch and the Field button. */
COMPONENTS['top-right'] = () => `    <div class="top-r">
      <p class="meta" id="meta"></p>
      <button class="fieldbtn acctbtn" id="acctBtn" type="button" data-act="account" hidden></button>
      <button class="fieldbtn langbtn" id="langBtn" type="button" data-act="lang" translate="no" lang="mn" aria-label="Монгол хэл рүү шилжих">МН</button>
      <button class="fieldbtn" id="fieldBtn" type="button" data-act="field"><span class="fb-dot" aria-hidden="true"></span><span>Field</span><b id="fieldCount" hidden></b></button>
    </div>`;
