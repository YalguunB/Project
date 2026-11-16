/* backend/src/routes/places.js — HTTP for /api/place and /api/photo. */
import express from 'express';
import { send } from './documents.js';

const wrap = fn => (req, res, next) => fn(req, res).catch(next);

export function placesRoutes(svc) {
  const r = express.Router();
  r.get('/place', wrap(async (req, res) => send(res, await svc.place(String(req.query.id || '')))));
  r.get('/photo', wrap(async (req, res) => {
    const out = await svc.photo(String(req.query.ref || ''), req.query.w);
    if (out.redirect) return res.status(302).set({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' }).redirect(302, out.redirect);
    res.status(out.status).type('text/plain').send(out.status === 404 ? 'Not found' : out.status === 503 ? 'Not configured' : 'Photo unavailable');
  }));
  return r;
}
