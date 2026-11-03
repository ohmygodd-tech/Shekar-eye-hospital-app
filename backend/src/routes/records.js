// Medical records: patients read their own; staff can read all and upload.
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { many, one } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { requireRole, STAFF } from '../middleware/auth.js';
import { ah, notFound, badRequest } from '../utils/errors.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notify.js';

const r = Router();
fs.mkdirSync(config.uploadDir, { recursive: true });

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 6)}`),
  }),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(badRequest('Only PDF, JPG, PNG or WEBP files are allowed'))),
});

const recordSelect = `r.id, r.type, r.title, r.notes, r.data, r.file_name AS "fileName", r.mime_type AS "mimeType",
  (r.file_key IS NOT NULL) AS "hasFile", r.created_at AS "createdAt", r.appointment_id AS "appointmentId",
  json_build_object('id', p.id, 'name', p.name, 'mrn', p.mrn) AS patient, u.name AS "uploadedBy"`;

/** Can this user see records of this patient? */
async function canAccess(user, patientId) {
  if (STAFF.includes(user.role)) return true;
  return !!(await one('SELECT 1 FROM patients WHERE id = $1 AND user_id = $2', [patientId, user.id]));
}

r.get('/', validate(z.object({ patientId: z.string().uuid().optional(), type: z.string().optional() }), 'query'), ah(async (req, res) => {
  const { patientId, type } = req.validQuery;
  const staff = STAFF.includes(req.user.role);
  if (staff && !patientId) throw badRequest('patientId is required');
  res.json(await many(
    `SELECT ${recordSelect} FROM records r JOIN patients p ON p.id = r.patient_id LEFT JOIN users u ON u.id = r.uploaded_by
      WHERE r.deleted_at IS NULL AND ($1::uuid IS NULL OR r.patient_id = $1)
        AND ($2::boolean OR p.user_id = $3) AND ($4::text IS NULL OR r.type::text = $4)
      ORDER BY r.created_at DESC LIMIT 300`,
    [patientId || null, staff, req.user.id, type || null]));
}));

r.get('/:id', ah(async (req, res) => {
  const rec = await one(`SELECT ${recordSelect}, r.patient_id FROM records r JOIN patients p ON p.id = r.patient_id LEFT JOIN users u ON u.id = r.uploaded_by WHERE r.id = $1 AND r.deleted_at IS NULL`, [req.params.id]);
  if (!rec || !(await canAccess(req.user, rec.patient_id))) throw notFound('Record not found');
  delete rec.patient_id;
  res.json(rec);
}));

r.get('/:id/file', ah(async (req, res) => {
  const rec = await one('SELECT * FROM records WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!rec?.file_key || !(await canAccess(req.user, rec.patient_id))) throw notFound('File not found');
  await audit(req, 'record.download', 'record', rec.id);
  res.setHeader('Content-Type', rec.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(rec.file_name || 'report')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(path.join(config.uploadDir, path.basename(rec.file_key))).on('error', () => res.status(404).end()).pipe(res);
}));

// ── Staff upload ──────────────────────────────────────────────────────────────
const eyeSide = z.object({
  sph: z.number().min(-30).max(30).optional(), cyl: z.number().min(-15).max(15).optional(),
  axis: z.number().int().min(0).max(180).optional(), add: z.number().min(0).max(4).optional(),
  va: z.string().max(12).optional(), iop: z.number().min(0).max(80).optional(),
}).partial();
const dataSchema = z.object({
  od: eyeSide.optional(), os: eyeSide.optional(),  // OD = right eye, OS = left eye
  pd: z.number().min(40).max(80).optional(),
  medicines: z.array(z.object({
    name: z.string().max(120), eye: z.enum(['right', 'left', 'both']).optional(),
    dose: z.string().max(60).optional(), frequency: z.string().max(60).optional(), duration: z.string().max(60).optional(),
  })).max(30).optional(),
  diagnosis: z.string().max(500).optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).partial();

r.post('/', requireRole(...STAFF), upload.single('file'), ah(async (req, res) => {
  let data = null;
  try { data = req.body.data ? JSON.parse(req.body.data) : null; } catch { throw badRequest('data must be valid JSON'); }
  const parsed = z.object({
    patientId: z.string().uuid(),
    appointmentId: z.string().uuid().optional().or(z.literal('')),
    type: z.enum(['eye_test', 'spectacle_rx', 'prescription', 'lab_report', 'scan', 'discharge_summary', 'other']),
    title: z.string().trim().min(2).max(120),
    notes: z.string().max(4000).optional(),
    data: dataSchema.nullable(),
  }).safeParse({ ...req.body, data });
  if (!parsed.success) {
    if (req.file) fs.unlink(req.file.path, () => {});
    throw badRequest(parsed.error.issues[0].message);
  }
  const b = parsed.data;
  if (!req.file && !b.data && !b.notes) throw badRequest('Attach a file or enter the record details');
  const patient = await one('SELECT id, user_id, name FROM patients WHERE id = $1', [b.patientId]);
  if (!patient) throw notFound('Patient not found');
  const rec = await one(
    `INSERT INTO records (patient_id, appointment_id, type, title, notes, data, file_key, file_name, mime_type, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [b.patientId, b.appointmentId || null, b.type, b.title, b.notes || null, b.data, req.file?.filename || null,
      req.file?.originalname || null, req.file?.mimetype || null, req.user.id]);
  await notify(patient.user_id, 'New report available', `${b.title} for ${patient.name} is now in your Records.`, { type: 'record', id: rec.id });
  await audit(req, 'record.create', 'record', rec.id, { patientId: b.patientId, type: b.type });
  res.status(201).json({ id: rec.id });
}));

r.delete('/:id', requireRole('admin', 'doctor'), ah(async (req, res) => {
  const rec = await one('UPDATE records SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id', [req.params.id]);
  if (!rec) throw notFound();
  await audit(req, 'record.delete', 'record', rec.id);
  res.json({ ok: true });
}));

export default r;
