#!/bin/sh
# Builds two pages from the same source:
#   sh build.sh              -> moodtrip.html                (the claude.ai artifact; the platform supplies the backend)
#   sh build.sh cloudflare   -> cloudflare/public/index.html (standalone site; cloudflare/src/worker.js supplies the backend)
cd "$(dirname "$0")"
PARTS="src/model.js src/places/00-head.js src/places/hoian.js src/places/lisbon.js src/places/oaxaca.js src/places/kyoto.js src/places/reykjavik.js src/places/spots.js src/scenes.js src/backend.js src/gl.js src/fx.js src/app.js"
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
    echo '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>'
    echo '<style>'
    cat src/style.css
    echo '</style></head><body>'
    cat src/body.html
    echo "$LIBS"
    echo '<script>window.MT_GOOGLE=true;</script>'
    echo '<script>'
    cat src/cf-runtime.js
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
    const SPOT = new Function(fs.readFileSync("src/places/spots.js", "utf8") + ";return SPOT")();
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
    cat src/style.css
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
