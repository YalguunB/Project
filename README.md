# MoodTrip

MoodTrip is a travel-planning prototype that starts with how you feel. It runs as one Cloudflare Worker: a static page and a
small API, with a D1 database.

## Project layout

```
frontend/             what runs in the browser
├─ src/               the source you edit (built into one page by build.sh)
│  ├─ styles/         4 CSS files only: tokens-primitive, tokens-brand, tokens-semantic, component
│  ├─ core/           shared code: model, backend client, state, chrome (render/go), events, i18n, boot
│  ├─ data/places/    destinations, venues, and geo.js (approximate stop positions for the route map)
│  ├─ i18n/           Mongolian strings (mn.js), see docs/i18n.md
│  ├─ visuals/        3D scene, motion, SVG scenery
│  ├─ features/       one folder per feature: feel, budget, matches, planner, field, place, reviews,
│  │                  engage, account, plans; each index.js registers its screens (VIEWS), actions (ACT), hooks (AFTER)
│  ├─ components/     page markup split into components (mount.js renders them)
│  └─ body.html       layout glue + component calls
└─ public/            what is served: index.html (built, do not edit by hand), _headers, vendor/ (MapLibre for the map)
backend/              the API
├─ worker.js          the Worker: /api/db, /api/sync, /api/auth, /api/place, /api/photo, /api/health
├─ spots.json         the venue ids the API accepts (written by build.sh)
├─ scripts/setup.mjs  one-command setup and deploy (npm run setup)
└─ README.md          deployment, Google key, accounts, moderation
db/
├─ schema.sql         the tables (the Worker also creates them on first use)
└─ seed/              hand-written example data: a traveler who took one trip
docs/                 css-architecture.md, i18n.md, engagement.md
wrangler.toml         the one Cloudflare config (also used by Cloudflare's Git builds)
package.json          npm scripts: build, dev, deploy, setup, db:local, seed:local, logs
build.sh              concatenates frontend/src into frontend/public/index.html
```

Rules: a feature folder does not call another feature's functions directly; shared code lives in `frontend/src/core/`.
CSS follows `docs/css-architecture.md`.

## Run locally

From the project root:

```sh
npm ci
npm run db:local      # create the tables in the local database
npm run dev           # http://localhost:8787
```

Optional: `npm run seed:local` adds an example traveler (see docs/engagement.md).

## After editing the frontend

```sh
npm run build         # = sh build.sh cloudflare (Git Bash, WSL, macOS or Linux)
```

This rewrites `frontend/public/index.html` and `backend/spots.json`. Commit them with your source changes.

## Deploy

`npm run setup` the first time, `npm run deploy` after that, or push to GitHub if Cloudflare's Git build is connected.
Details in [backend/README.md](backend/README.md).
