#!/bin/sh
# Builds two pages from the same source:
#   sh build.sh              -> moodtrip.html                (the claude.ai artifact; the platform supplies the backend)
#   sh build.sh cloudflare   -> cloudflare/public/index.html (standalone site; cloudflare/src/worker.js supplies the backend)
cd "$(dirname "$0")"
PARTS="
  src/components/registry.js
  src/components/gl-canvas.js
  src/components/backdrop.js
  src/components/brand.js
  src/components/top-right.js
  src/components/tooltip.js
  src/components/sheet.js
  src/components/place-panel.js
  src/components/curtain.js
  src/components/loader.js
  src/components/toast.js
  src/components/live-region.js
  src/components/overlays.js
  src/components/mount.js
  src/core/model.js
  src/data/places/00-head.js
  src/data/places/hoian.js
  src/data/places/lisbon.js
  src/data/places/oaxaca.js
  src/data/places/kyoto.js
  src/data/places/reykjavik.js
  src/data/places/spots.js
  src/visuals/scenes.js
  src/core/backend.js
  src/visuals/gl.js
  src/visuals/fx.js
  src/core/constants.js
  src/core/registry.js
  src/features/feel/state.js
  src/core/utils.js
  src/core/saved-trip.js
  src/core/profile.js
  src/core/chrome.js
  src/core/view-parts.js
  src/features/matches/crowd.js
  src/features/feel/rounds.js
  src/features/field/field.js
  src/features/matches/report.js
  src/features/reviews/list.js
  src/features/reviews/photo-form.js
  src/features/place/maps-google.js
  src/features/place/panel.js
  src/features/reviews/actions.js
  src/features/engage/nudge.js
  src/features/planner/views.js
  src/features/planner/stops.js
  src/features/budget/budget.js
  src/features/feel/game.js
  src/features/feel/battery.js
  src/core/flow.js
  src/features/feel/index.js
  src/features/budget/index.js
  src/features/matches/index.js
  src/features/planner/index.js
  src/features/field/index.js
  src/features/place/index.js
  src/features/reviews/index.js
  src/features/engage/index.js
  src/core/events.js
  src/features/planner/drag.js
  src/core/backend-sync.js
  src/core/boot.js
"
CSS="src/styles/tokens-primitive.css src/styles/tokens-brand.css src/styles/tokens-semantic.css src/styles/component.css"
FONTS='<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=DM+Sans:wght@400;500;600&display=swap">'
LIBS='<script>setTimeout(function(){var l=document.getElementById("loader");if(l)l.hidden=true;},9000);</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>'

if [ "$1" = "cloudflare" ]; then
  OUT=cloudflare/public/index.html
  mkdir -p cloudflare/public cloudflare/src
  {
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    echo '<title>MoodTrip</title>'
    echo '<meta name="description" content="MoodTrip plans your trip around how you feel.">'
    echo '<meta name="theme-color" content="#F7F2EA">'
    echo "$FONTS"
    echo '<style>'
    cat $CSS
    echo '</style></head><body>'
    cat src/body.html
    echo "$LIBS"
    echo '<script>window.MT_GOOGLE=true;</script>'
    echo '<script>'
    cat src/core/runtime-cloudflare.js
    echo '</script>'
    echo '<script>'
    echo '(() => { "use strict";'
    cat $PARTS
    echo '})();'
    echo '</script></body></html>'
  } > "$OUT"
  # the server only answers for Place IDs that this page actually uses, so the API key cannot be used as an open proxy
  node -e '
    const fs = require("fs");
    const SPOT = new Function(fs.readFileSync("src/data/places/spots.js", "utf8") + ";return SPOT")();
    const ids = [...new Set(Object.values(SPOT).flatMap(m => Object.values(m).map(v => v[1])))].sort();
    fs.writeFileSync("cloudflare/src/spots.json", JSON.stringify(ids, null, 1) + "\n");
    console.log(ids.length + " Place IDs -> cloudflare/src/spots.json");
  '
else
  OUT=moodtrip.html
  {
    echo '<title>MoodTrip</title>'
    echo '<meta name="claude:viewport-fit-sides" content="cover">'
    echo "$FONTS"
    echo '<style>'
    cat $CSS
    echo '</style>'
    cat src/body.html
    echo "$LIBS"
    echo '<script>'
    echo '(() => { "use strict";'
    cat $PARTS
    echo '})();'
    echo '</script>'
  } > "$OUT"
fi
wc -c "$OUT"
