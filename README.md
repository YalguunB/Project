# MoodTrip

MoodTrip is a travel-planning prototype that starts with how you feel. The browser app is assembled from the files in `src/`; the Cloudflare version serves the built page and its API from `cloudflare/`.

## Project layout

- `src/` — app logic, visuals, styles, and destination data
- `build.sh` — assembles the source into the Cloudflare static page
- `cloudflare/` — Worker API, D1 schema, and deployable site

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
