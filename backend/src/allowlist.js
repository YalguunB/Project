/* backend/src/allowlist.js — The Google Place IDs this site uses, read from the frontend's own data file (one source of truth). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadAllowedPlaceIds(spotsFile) {
  const SPOT = vm.runInNewContext(readFileSync(spotsFile, 'utf8') + '\n;SPOT');
  return new Set(Object.values(SPOT).flatMap(venues => Object.values(venues).map(v => v[1])));
}
