# MoodTrip

MoodTrip is a travel-planning prototype that starts with how you feel. The browser app is assembled from the files in `src/`; the Cloudflare version serves the built page and its API from `cloudflare/`.

## Project layout

```
src/
├─ styles/            4 CSS files only: tokens-primitive, tokens-brand, tokens-semantic, component
├─ core/              shared code: model, backend, state, chrome (render/go), events, boot
├─ data/places/       destination and venue data
├─ i18n/              Mongolian strings (mn.js); the switch itself is core/i18n.js, see docs/i18n.md
├─ visuals/           3D scene, motion, SVG scenery
├─ features/          one folder per feature (feel, budget, matches, planner, field, place, reviews)
│  ├─ engage/          start-screen nudge per segment (new / once / seasoned), "rate your trip" sheet
│  ├─ account/         sign in / create account sheet, account menu
│  ├─ plans/           My plans: saved plans on the account, review their places
│  └─ <feature>/index.js   registers the feature's screens (VIEWS), actions (ACT) and hooks (AFTER)
├─ components/        page markup split into components (registry, one file per part, overlays.js aggregates, mount.js renders)
└─ body.html          layout glue + component calls (<div data-component="x"></div>)
build.sh              concatenates src/ (file order is listed in build.sh) into cloudflare/public/index.html
cloudflare/           Worker API, D1 schema, and deployable site
docs/                 css-architecture.md, i18n.md (language switch), engagement.md (segments, nudges, review asks, why requests were slow)
```

Rules: a feature folder does not call another feature's functions directly; shared code lives in `core/`. CSS follows `docs/css-architecture.md`. After editing anything in `src/`, run `sh build.sh cloudflare`.

## Run locally

From `cloudflare/`, install dependencies and initialize the local database:

```powershell
npm ci
npm run db:local
npm run dev
```

Then open `http://localhost:8787`. Live Google Places details are optional; see [Cloudflare setup and deployment](cloudflare/README.md).

## Rebuild the Cloudflare page

From the project root, run `sh build.sh cloudflare` using Git Bash, WSL, macOS, or Linux. This updates `cloudflare/public/index.html` and the allowlist at `cloudflare/src/spots.json`.
