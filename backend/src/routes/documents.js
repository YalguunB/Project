/* backend/src/routes/documents.js — HTTP for /api/db/... and /api/sync: reads the request, calls the service, writes the response. */
import express from 'express';

export const send = (res, r) => {
  res.status(r.status).set('cache-control', 'no-store');
  if (r.headers) res.set(r.headers);
  if (r.body === undefined) res.end(); else res.json(r.body);
};

export function documentsRoutes(svc) {
  const r = express.Router();
  const key = req => req.get('x-mt-key') || '';
  const authz = req => req.get('authorization') || '';
  r.get('/:coll', (req, res) => send(res, svc.list(req.params.coll, req.query.since)));
  r.get('/:coll/:id', (req, res) => send(res, svc.read(req.params.coll, req.params.id, key(req), authz(req))));
  r.delete('/:coll/:id', (req, res) => send(res, svc.remove(req.params.coll, req.params.id, key(req), authz(req))));
  r.put('/:coll/:id', express.text({ type: () => true, limit: '512kb' }), (req, res) =>
    send(res, svc.write(req.params.coll, req.params.id, key(req), authz(req), typeof req.body === 'string' ? req.body : '', req.ip || 'local')));
  r.all('/:coll', (req, res) => send(res, svc.methodNotAllowed(req.params.coll)));
  r.all('/:coll/:id', (req, res) => send(res, svc.methodNotAllowed(req.params.coll)));
  return r;
}

export function syncRoutes(svc) {
  const r = express.Router();
  r.get('/', (req, res) => send(res, svc.sync(req.originalUrl.split('?')[1] || '')));
  r.all('/', (req, res) => send(res, { status: 405, body: { error: 'method_not_allowed' } }));
  return r;
}
