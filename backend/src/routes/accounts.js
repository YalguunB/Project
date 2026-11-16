/* backend/src/routes/accounts.js — HTTP for /api/auth/...: me, signup, login, logout. */
import express from 'express';
import { send } from './documents.js';

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

export function accountsRoutes(svc) {
  const r = express.Router();
  const authz = req => req.get('authorization') || '';
  r.get('/me', (req, res) => send(res, svc.me(authz(req))));
  r.post('/logout', (req, res) => send(res, svc.logout(authz(req))));
  r.post('/:what', express.text({ type: () => true, limit: '8kb' }), wrap(async (req, res) =>
    send(res, await svc.enter(req.params.what, typeof req.body === 'string' ? req.body : '', req.ip || 'local'))));
  r.all('/:what', (req, res) => send(res, { status: 405, body: { error: 'method_not_allowed' } }));
  return r;
}
