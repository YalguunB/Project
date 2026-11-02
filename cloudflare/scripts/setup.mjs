#!/usr/bin/env node
/* One-command setup and deploy for MoodTrip on Cloudflare.   Run it with:  npm run setup
   It is safe to run again: it reuses the database it made, and re-deploys the site.

   1. signs in to Cloudflare (a browser window opens the first time)
   2. creates the D1 database "moodtrip-db" and writes its id into wrangler.toml
   3. creates the tables from schema.sql
   4. deploys the site and its API
   5. optionally stores your Google Places API key and a moderation token as secrets */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, env, platform, exit, version } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOML = join(ROOT, 'wrangler.toml');
const DB_NAME = 'moodtrip-db';
const BIN = env.WRANGLER_BIN || (platform === 'win32' ? 'npx.cmd' : 'npx');
const PRE = env.WRANGLER_BIN ? [] : ['wrangler'];

const say = m => console.log(m);
const step = (n, m) => say(`\n[${n}/5] ${m}`);
const die = m => { console.error(`\n${m}\n`); exit(1); };

/* Runs wrangler. capture:true returns its output instead of printing it, and keeps it from asking questions. */
function wr(args, { capture = false, input, allowFail = false } = {}) {
  const r = spawnSync(BIN, [...PRE, ...args], {
    cwd: ROOT, encoding: 'utf8', shell: platform === 'win32', input,
    stdio: capture ? ['pipe', 'pipe', 'pipe'] : [input === undefined ? 'inherit' : 'pipe', 'pipe', 'inherit']
  });
  const out = (r.stdout || '') + (capture ? (r.stderr || '') : '');
  if (!capture && r.stdout) process.stdout.write(r.stdout);
  if (r.error) die(`Could not run wrangler (${r.error.message}). Run "npm install" first, then try again.`);
  if (r.status !== 0 && !allowFail) die(`wrangler ${args.join(' ')} failed${capture ? ':\n' + out : '.'}`);
  return { ok: r.status === 0, out };
}

async function ask(q) {
  if (!stdin.isTTY) return '';
  const rl = createInterface({ input: stdin, output: stdout });
  try { return (await rl.question(q)).trim(); } finally { rl.close(); }
}

if (Number(version.slice(1).split('.')[0]) < 18) die(`Node 18 or newer is needed (this is ${version}).`);

/* 1 ---------------------------------------------------------------- sign in */
step(1, 'Checking your Cloudflare sign-in');
if (!env.CLOUDFLARE_API_TOKEN) {
  const who = wr(['whoami'], { capture: true, allowFail: true });
  if (!who.ok || /not authenticated/i.test(who.out)) {
    say('A browser window will open so you can sign in to Cloudflare.');
    wr(['login']);
  } else say('Signed in.');
}

/* 2 ---------------------------------------------------------------- database */
step(2, `Setting up the database "${DB_NAME}"`);
const findDb = () => {
  const r = wr(['d1', 'list', '--json'], { capture: true });
  const start = r.out.indexOf('[');
  let list = [];
  try { list = JSON.parse(r.out.slice(start)); } catch (e) { die('Could not read the list of databases:\n' + r.out); }
  return list.find(d => d.name === DB_NAME) || null;
};
let db = findDb();
if (!db) {
  wr(['d1', 'create', DB_NAME], { capture: true });
  db = findDb();
  if (!db) die('The database was created but could not be found afterwards. Check the Cloudflare dashboard under Storage & Databases > D1.');
  say('Created.');
} else say('Already exists, reusing it.');
const id = db.uuid || db.database_id || db.id;
if (!/^[0-9a-f-]{36}$/i.test(String(id))) die(`Unexpected database id: ${id}`);
const toml = readFileSync(TOML, 'utf8');
if (!/^database_id\s*=\s*"[^"]*"/m.test(toml)) die('wrangler.toml has no database_id line to update.');
writeFileSync(TOML, toml.replace(/^database_id\s*=\s*"[^"]*"/m, `database_id = "${id}"`));

/* 3 ---------------------------------------------------------------- tables */
step(3, 'Creating the tables');
wr(['d1', 'execute', DB_NAME, '--remote', '--file', 'schema.sql', '--yes']);

/* 4 ---------------------------------------------------------------- deploy */
step(4, 'Deploying the site');
const dep = wr(['deploy']);
const url = (dep.out.match(/https:\/\/[^\s]+\.workers\.dev/) || [])[0];

/* 5 ---------------------------------------------------------------- secrets */
step(5, 'Optional: Google reviews and photos, and moderation');
let key = env.GOOGLE_PLACES_API_KEY || '';
if (!key) key = await ask('Paste a Google Places API key to show Google ratings, photos and reviews (press Enter to skip): ');
if (key) { wr(['secret', 'put', 'GOOGLE_PLACES_API_KEY'], { input: key + '\n' }); say('Saved. Google details will appear on the venue pages.'); }
else say('Skipped. The site works without it; each venue still opens its exact place on Google Maps.');
const mod = env.MOODTRIP_MODERATION === '1' ? 'y' : await ask('Create a moderation token so you can delete a traveler review? (y/N): ');
if (/^y/i.test(mod)) {
  const token = randomBytes(24).toString('hex');
  wr(['secret', 'put', 'ADMIN_TOKEN'], { input: token + '\n' });
  say(`\nYour moderation token (save it somewhere safe, it is not shown again):\n  ${token}`);
  say('To remove a review:  curl -X DELETE -H "Authorization: Bearer <token>" <site>/api/db/reviews/<traveler id>');
}

say(`\nDone. ${url ? `Your site: ${url}` : 'Find your site under Workers & Pages in the Cloudflare dashboard.'}`);
say('Check what is switched on at  <your site>/api/health');
