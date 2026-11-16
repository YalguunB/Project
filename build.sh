#!/bin/sh
# Builds two pages from the same source:
#   sh build.sh              -> moodtrip.html                (the claude.ai artifact; the platform supplies the backend)
#   sh build.sh cloudflare   -> frontend/public/index.html   (standalone site; backend/worker.js supplies the API)
cd "$(dirname "$0")"
PARTS="
  frontend/src/components/registry.js
  frontend/src/components/gl-canvas.js
  frontend/src/components/backdrop.js
  frontend/src/components/brand.js
  frontend/src/components/top-right.js
  frontend/src/components/tooltip.js
  frontend/src/components/sheet.js
  frontend/src/components/place-panel.js
  frontend/src/components/curtain.js
  frontend/src/components/loader.js
  frontend/src/components/toast.js
  frontend/src/components/live-region.js
  frontend/src/components/overlays.js
  frontend/src/components/mount.js
  frontend/src/core/model.js
  frontend/src/data/places/00-head.js
  frontend/src/data/places/hoian.js
  frontend/src/data/places/lisbon.js
  frontend/src/data/places/oaxaca.js
  frontend/src/data/places/kyoto.js
  frontend/src/data/places/reykjavik.js
  frontend/src/data/places/spots.js
  frontend/src/data/places/geo.js
  frontend/src/visuals/scenes.js
  frontend/src/core/backend.js
  frontend/src/visuals/gl.js
  frontend/src/visuals/fx.js
  frontend/src/core/constants.js
  frontend/src/core/registry.js
  frontend/src/i18n/mn.js
  frontend/src/core/i18n.js
  frontend/src/features/feel/state.js
  frontend/src/core/utils.js
  frontend/src/core/saved-trip.js
  frontend/src/core/profile.js
  frontend/src/core/chrome.js
  frontend/src/core/view-parts.js
  frontend/src/features/matches/crowd.js
  frontend/src/features/feel/rounds.js
  frontend/src/features/field/field.js
  frontend/src/features/matches/report.js
  frontend/src/features/reviews/list.js
  frontend/src/features/reviews/photo-form.js
  frontend/src/features/place/maps-google.js
  frontend/src/features/place/panel.js
  frontend/src/features/reviews/actions.js
  frontend/src/features/engage/nudge.js
  frontend/src/features/account/account.js
  frontend/src/features/plans/plans.js
  frontend/src/features/planner/views.js
  frontend/src/features/planner/route-map.js
  frontend/src/features/planner/stops.js
  frontend/src/features/budget/budget.js
  frontend/src/features/feel/game.js
  frontend/src/features/feel/battery.js
  frontend/src/core/flow.js
  frontend/src/features/feel/index.js
  frontend/src/features/budget/index.js
  frontend/src/features/matches/index.js
  frontend/src/features/planner/index.js
  frontend/src/features/field/index.js
  frontend/src/features/place/index.js
  frontend/src/features/reviews/index.js
  frontend/src/features/engage/index.js
  frontend/src/features/account/index.js
  frontend/src/features/plans/index.js
  frontend/src/core/events.js
  frontend/src/features/planner/drag.js
  frontend/src/core/backend-sync.js
  frontend/src/core/boot.js
"
CSS="frontend/src/styles/tokens-primitive.css frontend/src/styles/tokens-brand.css frontend/src/styles/tokens-semantic.css frontend/src/styles/component.css"
FONTS='<link rel="preconnect" href="https://cdnjs.cloudflare.com">
<link rel="preload" as="script" href="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js">
<link rel="preload" as="script" href="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=DM+Sans:wght@400;500;600&family=Manrope:wght@400..800&display=swap">'
LIBS='<script>setTimeout(function(){var l=document.getElementById("loader");if(l)l.hidden=true;},9000);</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>'

if [ "$1" = "cloudflare" ]; then
  OUT=frontend/public/index.html
  mkdir -p frontend/public backend
  {
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    echo '<title>MoodTrip</title>'
    echo '<meta name="description" content="MoodTrip plans your trip around how you feel.">'
    echo '<meta name="theme-color" content="#F2EBDD">'
    echo "$FONTS"
    echo '<style>'
    cat $CSS
    echo '</style></head><body>'
    cat frontend/src/body.html
    echo "$LIBS"
    echo '<script>window.MT_GOOGLE=true;window.MT_MAP=true;</script>'
    echo '<script>'
    cat frontend/src/core/runtime-cloudflare.js
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
    const SPOT = new Function(fs.readFileSync("frontend/src/data/places/spots.js", "utf8") + ";return SPOT")();
    const ids = [...new Set(Object.values(SPOT).flatMap(m => Object.values(m).map(v => v[1])))].sort();
    fs.writeFileSync("backend/spots.json", JSON.stringify(ids, null, 1) + "\n");
    console.log(ids.length + " Place IDs -> backend/spots.json");
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
    cat frontend/src/body.html
    echo "$LIBS"
    echo '<script>'
    echo '(() => { "use strict";'
    cat $PARTS
    echo '})();'
    echo '</script>'
  } > "$OUT"
fi
wc -c "$OUT"
