# MoodTrip

MoodTrip is a travel-planning prototype that starts with how you feel. Three parts, no framework, no build step. It runs on your own computer with Node + SQLite, or on Cloudflare (Worker + D1) with the same API.

## Layout

```
frontend/            the website (HTML, CSS, vanilla JS). Served as is, nothing to build
  index.html           layout glue, 4 CSS links, and one app script: src/main.js
  vendor/              MapLibre (route map), served with a long cache
  src/main.js          the one app script: loads every other file, in dependency order
  src/styles/          4 CSS files: tokens-primitive, tokens-brand, tokens-semantic, component
  src/components/      page markup as components (registry, one file per part, mount.js renders them)
  src/core/            shared code: model, api-client, state, profile, chrome (render/go), events, i18n, boot
  src/features/        one folder per feature: feel, budget, matches, planner, field, place, reviews, engage, account, plans
  src/i18n/            Mongolian strings (mn.js)
  src/visuals/         3D scene (traveler.js: the floating explorer), motion, SVG scenery
  src/data/places/     destinations, venues, geo.js (approximate stop positions for the route map)
backend/             Node.js + Express: serves the frontend and the /api
  server.js            starts the Express server (Node + SQLite)
  worker.js            the same API as one Cloudflare Worker (D1), used only for Cloudflare
  scripts/             setup.mjs (one-command Cloudflare setup), make-spots.mjs (writes spots.json for the Worker)
  src/routes/          HTTP only: read the request, call a service, send the response
  src/services/        the rules: who may write, limits, validation, accounts, Google Places proxy
  src/repositories/    every SQL statement
db/                  schema.sql (the tables), seed/ (hand-written example data). moodtrip.sqlite is created on first start and is not committed
wrangler.jsonc       the one Cloudflare config (JSON with comments; Wrangler cannot read a .js) (also used by Cloudflare's Git builds, which run at the repo root)
package.json         root npm scripts for Cloudflare: dev, setup, deploy, logs, db:local, seed:local (wrangler)
.dev.vars.example    copy to .dev.vars for `npm run dev` (Google key, admin token)
```

Flow: browser -> `frontend/` (static files) and `/api/...` -> routes -> services -> repositories -> `db/`.

## Run locally

Needs Node.js 22.13 or newer (SQLite is built in, nothing native to compile).

```powershell
cd backend
npm install
npm start
```

Open `http://localhost:3000` and check `http://localhost:3000/api/health`. Optional: copy `backend/.env.example` to `backend/.env` and set `GOOGLE_PLACES_API_KEY` (Google ratings and photos) and `ADMIN_TOKEN` (delete any review). Example data: `sh db/seed/one-trip-traveler.sh` (a traveler who planned one Kyoto trip).

## Deploy to Cloudflare

The Express server cannot run on Cloudflare, so for Cloudflare the same API is `backend/worker.js` on a D1 database. Both implement the rules in the same way; **a change to an API rule must be made in both** (`backend/src/services/` and `backend/worker.js`). Everything runs from the repo root, Node 18+, a free Cloudflare account.

```powershell
npm install          # installs wrangler
npm run setup        # first time: signs in, creates the D1 database moodtrip-db and its tables, deploys, asks for the optional Google key and admin token
npm run deploy       # later deploys (or push to GitHub if Cloudflare's Git build is connected: it runs `npx wrangler deploy`)
```

- Before every `dev` and `deploy`, wrangler runs `backend/scripts/make-spots.mjs`, which writes `backend/spots.json` (not committed) from `frontend/src/data/places/spots.js`.
- Locally on Cloudflare's runtime: `copy .dev.vars.example .dev.vars`, `npm run db:local`, `npm run dev` (http://localhost:8787), optional `npm run seed:local`.
- Google key: enable billing and Places API (New), create a key restricted to that API, set a daily quota and a budget alert, then `npx wrangler secret put GOOGLE_PLACES_API_KEY`. Without a key the site works and each venue keeps an "Open on Google Maps" button. Google content is never stored or cached.
- Moderation: `npx wrangler secret put ADMIN_TOKEN` (16+ characters), then delete a review with `curl -X DELETE -H "Authorization: Bearer <token>" https://<site>/api/db/reviews/<traveler id>`.
- Branch previews have no database on purpose (see `wrangler.jsonc`), so a half-finished branch can never touch the live data.
- Check what is switched on at `<site>/api/health`.

## API

- `GET /api/health`: which parts are configured.
- `GET /api/db/<feelings|cards|reviews|comments|votes>[?since=<tag>]`: shared documents, readable by everyone.
- `GET /api/sync?<collection>=<tag>&...`: every shared collection that changed since its tag, in one request (the page polls this every few seconds).
- `GET|PUT|DELETE /api/db/<collection>/<id>`: one document. Only the browser that owns `<id>` can change it (it proves this with a secret; the server keeps only a hash).
- `GET|PUT|DELETE /api/db/<trip|profile|plans>/<id>`: private documents, readable and writable only by their owner.
- `POST /api/auth/signup|login|logout`, `GET /api/auth/me`: a username and a password linked to one traveler id (PBKDF2 hash, 30-day sessions stored as hashes). Signing up links the browser's anonymous traveler and everything it saved.
- `GET /api/place?id=`, `GET /api/photo?ref=&w=`: Google ratings, photos and reviews, only for the venues in `frontend/src/data/places/spots.js` (the key stays on the server).
- The Cloudflare Worker also adds a `Server-Timing` header (D1 round trips) to every response.
- Limits: 30 writes and 8 sign-ins per minute per visitor, 20 000 documents, size caps per collection, security headers (CSP) on every response. The server also stamps the author's username on reviews and comments; the browser cannot set it.

## How the site works

- **Segments and nudges:** `core/profile.js` keeps a private profile (visits, trips, whether the traveler went). `segmentOf` gives `new` (0 trips taken), `once` (1) or `seasoned` (2+). The home page shows one nudge at a time (`features/engage`): did you go, rate the places, or the next trip. "Not now" snoozes a trip for 7 days. Urgency text is always true: the traveler's own calendar, the month's real season score, and how many real cards others picked this week. No invented scarcity.
- **Language:** the page is written in English and translated on top (`core/i18n.js`, strings in `i18n/mn.js`) with an МН / EN button; the choice is kept in `localStorage`. To find untranslated text, open the page in Mongolian and run `MT_I18N.missing()` in the Console, then add the strings to `MN_STRINGS` exactly as shown on the page. Variables are `{0}`; Mongolian cases are `{0:gen}`, `{0:dat}`, `{0:acc}`. Place descriptions and Google content stay English.

## Rules

- **Features:** a feature folder does not call another feature's functions; shared code lives in `core/`. A feature's `index.js` registers its screens (`VIEWS`), actions (`ACT`) and after-render hooks (`AFTER`).
- **Scripts:** all scripts share one scope, so the order of the file list in `frontend/src/main.js` is the dependency order. A new file needs its line there.
- **CSS:** exactly 4 files. Tokens flow primitive -> brand -> semantic -> component. Components use semantic tokens only (no raw hex). Native nesting at most 3 levels. Media queries sit flat at the end of `component.css`. Reuse existing classes instead of writing new CSS for a similar design. Moods (`<html data-mood>`) swap only the `--brand-*` values; adding one is a new block in `tokens-brand.css`.
- **Backend:** routes know HTTP only, services know the rules only, repositories hold all SQL. A service returns `{ status, body, headers }`.

## Not done yet

- Scripts share one scope; ES modules would enforce the "features do not reach into each other" rule.
- px values are not tokenized; breakpoints are not consolidated; `src/visuals/gl.js` repeats the mood palette.
- No automated tests (the API was checked with a throwaway script).
