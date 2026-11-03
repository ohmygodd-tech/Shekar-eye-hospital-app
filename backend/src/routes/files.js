// Short-lived signed links so the mobile app can open a report PDF or receipt in the
// system browser / share sheet without exposing the user's access token.
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db/index.js';
import { ah, notFound, unauthorized } from '../utils/errors.js';
import { STAFF } from '../middleware/auth.js';
import { receiptHtml } from './appointments.js';
import { audit } from '../services/audit.js';

export const signLink = (req, kind, id) => {
  const t = jwt.sign({ kind, id, sub: req.user.id }, config.jwtSecret, { expiresIn: '5m', audience: 'file' });
  return `${req.protocol}://${req.get('host')}/api/files?t=${encodeURIComponent(t)}`;
};

// Authenticated: issue links (mounted under requireAuth).
export const linkRouter = Router();
linkRouter.get('/records/:id', ah(async (req, res) => {
  const rec = await one(
    `SELECT r.id FROM records r JOIN patients p ON p.id = r.patient_id
      WHERE r.id = $1 AND r.deleted_at IS NULL AND r.file_key IS NOT NULL AND (p.user_id = $2 OR $3)`,
    [req.params.id, req.user.id, STAFF.includes(req.user.role)]);
  if (!rec) throw notFound('File not found');
  res.json({ url: signLink(req, 'record', rec.id) });
}));
linkRouter.get('/receipts/:id', ah(async (req, res) => {
  const p = await one(`SELECT id FROM payments WHERE id = $1 AND (user_id = $2 OR $3) AND status IN ('paid','refunded')`,
    [req.params.id, req.user.id, STAFF.includes(req.user.role)]);
  if (!p) throw notFound('Receipt not found');
  res.json({ url: signLink(req, 'receipt', p.id) });
}));

// Public: serve by signed token.
export const publicFiles = Router();
publicFiles.get('/', ah(async (req, res) => {
  let claims;
  try { claims = jwt.verify(String(req.query.t || ''), config.jwtSecret, { audience: 'file' }); } catch { throw unauthorized('Link expired. Please open it again from the app.'); }
  res.setHeader('Cache-Control', 'private, no-store');
  if (claims.kind === 'record') {
    const rec = await one('SELECT * FROM records WHERE id = $1 AND deleted_at IS NULL', [claims.id]);
    if (!rec?.file_key) throw notFound();
    await audit({ user: { id: claims.sub }, ip: req.ip }, 'record.download', 'record', rec.id);
    res.setHeader('Content-Type', rec.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(rec.file_name || 'report')}"`);
    return fs.createReadStream(path.join(config.uploadDir, path.basename(rec.file_key))).on('error', () => res.status(404).end()).pipe(res);
  }
  if (claims.kind === 'receipt') {
    const p = await one(
      `SELECT pay.*, a.date, to_char(a.start_time,'HH24:MI') AS time, a.token_no, d.name AS doctor, dep.name AS dept, pt.name AS patient, pt.mrn
         FROM payments pay JOIN appointments a ON a.id = pay.appointment_id JOIN doctors d ON d.id = a.doctor_id
         JOIN departments dep ON dep.id = d.department_id JOIN patients pt ON pt.id = a.patient_id WHERE pay.id = $1`, [claims.id]);
    if (!p) throw notFound();
    // Receipt page sets its own inline styles.
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    return res.type('html').send(receiptHtml(p));
  }
  throw notFound();
}));
