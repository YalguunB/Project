/* backend/src/app.js — Builds the Express app: security headers, /api routes, then the frontend as static files. */
import express from 'express';
import { documentsRepo } from './repositories/documents.js';
import { accountsRepo } from './repositories/accounts.js';
import { makeAccess } from './services/security.js';
import { documentsService } from './services/documents.js';
import { accountsService } from './services/accounts.js';
import { placesService } from './services/places.js';
import { documentsRoutes, syncRoutes } from './routes/documents.js';
import { accountsRoutes } from './routes/accounts.js';
import { placesRoutes } from './routes/places.js';
import { loadAllowedPlaceIds } from './allowlist.js';

const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleusercontent.com https://tiles.openfreemap.org; connect-src 'self' https://tiles.openfreemap.org; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};

export function createApp({ config, db }) {
  const repo = documentsRepo(db), accounts = accountsRepo(db);
  const access = makeAccess({ repo, accounts });
  const docs = documentsService({ repo, access, adminToken: config.adminToken });
  const auth = accountsService({ accounts, access });
  const places = placesService({ allowed: loadAllowedPlaceIds(config.spotsFile), googleKey: config.googleKey, placesBase: config.placesBase });

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use((req, res, next) => { res.set(HEADERS); next(); });

  const api = express.Router();
  api.get('/health', (req, res) => res.set('cache-control', 'no-store').json({ ok: true, database: true, google: places.configured, moderation: !!config.adminToken }));
  api.use('/db', documentsRoutes(docs));
  api.use('/sync', syncRoutes(docs));
  api.use('/auth', accountsRoutes(auth));
  api.use('/', placesRoutes(places));
  api.use((req, res) => res.status(404).set('cache-control', 'no-store').json({ error: 'not_found' }));
  app.use('/api', api);

  app.use((req, res, next) => req.path === '/_headers' ? res.status(404).type('text/plain').send('Not found') : next());   // Cloudflare-only file
  app.use(express.static(config.frontendDir, {          // the website itself
    setHeaders: (res, file) => { if (/[\\/]vendor[\\/]/.test(file)) res.set('cache-control', 'public, max-age=31536000, immutable'); }
  }));
  app.use((req, res) => res.status(404).type('text/plain').send('Not found'));
  app.use((err, req, res, next) => {                   // eslint-disable-line no-unused-vars
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
    console.error(err);
    res.status(500).set('cache-control', 'no-store').json({ error: 'server_error' });
  });
  return app;
}
