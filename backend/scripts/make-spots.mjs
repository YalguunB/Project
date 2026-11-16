/* backend/scripts/make-spots.mjs — Writes backend/spots.json: the Google Place IDs the site uses, read from the frontend's own data file.
   The Cloudflare Worker (backend/worker.js) imports that list, so its Google key can only ask about these places.
   wrangler.jsonc runs this before every `wrangler dev` / `wrangler deploy`; nothing to do by hand. (The Express server reads spots.js itself.) */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const SPOT = vm.runInNewContext(readFileSync(root + 'frontend/src/data/places/spots.js', 'utf8') + '\n;SPOT');
const ids = [...new Set(Object.values(SPOT).flatMap(venues => Object.values(venues).map(v => v[1])))].sort();
writeFileSync(root + 'backend/spots.json', JSON.stringify(ids, null, 1) + '\n');
console.log(ids.length + ' Place IDs -> backend/spots.json');
