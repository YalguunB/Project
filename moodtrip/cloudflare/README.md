# MoodTrip on Cloudflare

MoodTrip plans a trip around how you feel. This folder is the whole site as one Cloudflare Worker:

- the page (`public/index.html`), served by Cloudflare as a static file
- a small API (`src/worker.js`) that
  - shows **live Google ratings, photos and reviews** for 34 named venues, using your own Google key kept on the server
  - stores **traveler reviews, feeling cards and saved trips** in a Cloudflare D1 database, so everyone sees each other's reviews
- no accounts: each browser gets a random anonymous traveler id

## Deploy (about 5 minutes)

You need a free [Cloudflare account](https://dash.cloudflare.com/sign-up) and Node 18 or newer.

```sh
npm install
npm run setup
```

`npm run setup` opens a browser window to sign in the first time, then:

1. creates the D1 database `moodtrip-db` and writes its id into `wrangler.toml`
2. creates the tables from `schema.sql`
3. deploys the site and the API
4. asks (you can press Enter to skip) for a Google Places API key and for a moderation token

It prints your address, something like `https://moodtrip.<your-name>.workers.dev`. Running it again is safe: it reuses the database and re-deploys.

Without a Google key the site works fully. Each venue still has an **Open on Google Maps** button that opens that exact place. The live rating, photos and reviews appear once a key is added.

To check what is switched on, open `<your site>/api/health`.

## Google reviews and photos

1. In the [Google Cloud console](https://console.cloud.google.com/) create or pick a project and **enable billing** (Google requires it for this API).
2. Enable **Places API (New)**.
3. Create an API key under *APIs & Services > Credentials*, then **restrict it to Places API (New)** only. A key used from a server cannot be limited by website address, so the API restriction matters.
4. Set a **daily quota** on Places API (New) and a **budget alert**. Place Details requests that include reviews and photos are billed at a higher rate than basic ones, and each venue panel someone opens is one request. Check Google's current pricing and free allowance before you share the link widely.
5. Give the key to the site, either during `npm run setup`, or later:

   ```sh
   npx wrangler secret put GOOGLE_PLACES_API_KEY
   ```

How the key is protected: it lives only on the server (a Worker secret) and never reaches the browser. The API only answers for the 34 venue ids in `src/spots.json`, so the key cannot be used to look up anything else.

Google's terms are followed in the page: Google content is not stored or cached (the Worker sends `Cache-Control: no-store` and keeps nothing), every review and photo shows its author with a link, a "Google Maps" mark is shown, translated reviews offer the original, and there is a link to see everything on Google Maps. If you change the page, keep those.

## Moderation

Anyone can post a review, so you may need to remove one. Create a token once:

```sh
npx wrangler secret put ADMIN_TOKEN     # paste a long random string (16 characters or more)
```

Then delete a review by the traveler's id (every id is listed at `<your site>/api/db/reviews`):

```sh
curl -X DELETE -H "Authorization: Bearer <your token>" https://<your site>/api/db/reviews/<traveler id>
```

Or open the database in the dashboard (*Storage & Databases > D1 > moodtrip-db*).

## Run it on your own computer

```sh
cp .dev.vars.example .dev.vars    # put a Google key in it if you want live Google data
npm run db:local
npm run dev                       # http://localhost:8787
```

## Change the page and rebuild

`public/index.html` is built from the source files one folder up. In the full source folder:

```sh
sh build.sh cloudflare            # macOS, Linux, or Windows with WSL
```

The 34 venues are listed in `src/places/spots.js`. After editing it, rebuild: the build also rewrites `cloudflare/src/spots.json`, which is the list the API accepts. Then run `npm run deploy`.

## Deploy from Git instead

Run `npm run setup` once (it fills in `database_id` in `wrangler.toml`), commit this folder to GitHub or GitLab, then in the dashboard choose *Workers & Pages > Create > Import a repository*, set the root directory to this folder, and keep the default deploy command (`npx wrangler deploy`). Add the secrets under *Settings > Variables and Secrets*.

## What is stored

| What | Where | Who can change it |
| --- | --- | --- |
| Feeling answers, feeling card, traveler reviews | D1 tables `docs` and `owners` (`hits` counts writes for the rate limit) | only the browser that made them |
| Saved trip | D1, private | only that browser |
| Google ratings, photos, reviews | nowhere, fetched live | n/a |

A traveler id and a secret are made in the browser the first time it writes, and kept in that browser's local storage. The server keeps only a hash of the secret. Clearing site data makes a new anonymous traveler; the old reviews stay but can no longer be edited, only removed by you.

## Limits and notes

- Traveler photo uploads are not available on this build (the claude.ai version has them). Reviews are text plus stars.
- Posting is limited to 30 writes a minute per visitor address, and the database stops accepting new documents at 20,000.
- The page uses inline scripts and styles, so the Content Security Policy in `public/_headers` allows them. Everything else is limited to this site, cdnjs, Google Fonts and Google's image host.
- "Quiet dinner in a garden house" has no named venue on purpose, because a free search for it returns ads and unrelated places.
- Place ids can occasionally change on Google's side. If a venue stops loading, look it up again and replace its id in `src/places/spots.js`.
