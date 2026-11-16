/* backend/src/config.js — Settings: paths of the three parts and the optional secrets from backend/.env. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');     // the project folder

function loadEnv(file) {                                                            // tiny .env reader (no dependency)
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv(resolve(ROOT, 'backend/.env'));

export const config = {
  port: Number(process.env.PORT) || 3000,
  frontendDir: resolve(ROOT, 'frontend'),
  spotsFile: resolve(ROOT, 'frontend/src/data/places/spots.js'),                    // the venues the frontend uses: the only places the API key may ask Google about
  schemaFile: resolve(ROOT, 'db/schema.sql'),
  dbFile: process.env.DB_FILE ? resolve(process.env.DB_FILE) : resolve(ROOT, 'db/moodtrip.sqlite'),
  placesBase: (process.env.PLACES_BASE || 'https://places.googleapis.com/v1').replace(/\/+$/, ''),
  googleKey: process.env.GOOGLE_PLACES_API_KEY || '',
  adminToken: process.env.ADMIN_TOKEN || '',
  trustProxy: process.env.TRUST_PROXY === '1'                                       // set to 1 behind a reverse proxy so rate limits see the visitor address
};
