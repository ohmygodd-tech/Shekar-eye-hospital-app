// The logged-in account holder: profile, family members (patients), notifications, account deletion.
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query, tx } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { ah, notFound, badRequest } from '../utils/errors.js';
import { publicUser } from './auth.js';
import { audit } from '../services/audit.js';

const r = Router();

const patientCols = `id, mrn, name, relation, to_char(dob,'YYYY-MM-DD') AS dob, gender, blood_group AS "bloodGroup",
  allergies, medical_history AS "medicalHistory", wears_glasses AS "wearsGlasses"`;

r.get('/', ah(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const patients = await many(`SELECT ${patientCols} FROM patients WHERE user_id = $1 AND deleted_at IS NULL ORDER BY (relation = 'self') DESC, created_at`, [req.user.id]);
  const unread = await one('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.json({ user: publicUser(u), patients, unreadNotifications: unread.n, doctorId: req.user.doctorId || null });
}));

r.patch('/', validate(z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  pushToken: z.string().max(300).nullable().optional(),
  consent: z.literal(true).optional(),
})), ah(async (req, res) => {
  const { name, email, pushToken, consent } = req.body;
  const u = await one(
    `UPDATE users SET name = COALESCE($2, name), email = COALESCE($3, email),
       push_token = CASE WHEN $4::boolean THEN $5 ELSE push_token END,
       consent_at = CASE WHEN $6::boolean AND consent_at IS NULL THEN now() ELSE consent_at END
     WHERE id = $1 RETURNING *`,
    [req.user.id, name ?? null, email === '' ? null : email ?? null, pushToken !== undefined, pushToken ?? null, !!consent],
  );
  res.json({ user: publicUser(u) });
}));

const patientSchema = z.object({
  name: z.string().trim().min(2).max(80),
  relation: z.enum(['self', 'spouse', 'child', 'parent', 'sibling', 'other']).default('self'),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((d) => d <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future').optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  bloodGroup: z.string().max(5).optional().nullable(),
  allergies: z.string().max(500).optional().nullable(),
  medicalHistory: z.string().max(1000).optional().nullable(),
  wearsGlasses: z.boolean().optional().nullable(),
});

r.post('/patients', validate(patientSchema), ah(async (req, res) => {
  const p = req.body;
  const count = await one('SELECT count(*)::int AS n FROM patients WHERE user_id = $1 AND deleted_at IS NULL', [req.user.id]);
  if (count.n >= 8) throw badRequest('You can add up to 8 family members');
  if (p.relation === 'self') {
    const self = await one(`SELECT 1 FROM patients WHERE user_id = $1 AND relation = 'self' AND deleted_at IS NULL`, [req.user.id]);
    if (self) throw badRequest('Your own profile already exists');
  }
  const row = await tx(async (c) => {
    const created = (await c.query(
      `INSERT INTO patients (user_id, name, relation, dob, gender, blood_group, allergies, medical_history, wears_glasses)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${patientCols}`,
      [req.user.id, p.name, p.relation, p.dob || null, p.gender || null, p.bloodGroup || null, p.allergies || null, p.medicalHistory || null, p.wearsGlasses ?? null],
    )).rows[0];
    if (p.relation === 'self') await c.query('UPDATE users SET name = COALESCE(name, $2) WHERE id = $1', [req.user.id, p.name]);
    return created;
  });
  res.status(201).json(row);
}));

r.patch('/patients/:id', validate(patientSchema.partial()), ah(async (req, res) => {
  const p = req.body;
  const row = await one(
    `UPDATE patients SET name = COALESCE($3, name), dob = COALESCE($4, dob), gender = COALESCE($5, gender),
       blood_group = COALESCE($6, blood_group), allergies = COALESCE($7, allergies),
       medical_history = COALESCE($8, medical_history), wears_glasses = COALESCE($9, wears_glasses)
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING ${patientCols}`,
    [req.params.id, req.user.id, p.name ?? null, p.dob ?? null, p.gender ?? null, p.bloodGroup ?? null, p.allergies ?? null, p.medicalHistory ?? null, p.wearsGlasses ?? null],
  );
  if (!row) throw notFound('Patient not found');
  res.json(row);
}));

r.delete('/patients/:id', ah(async (req, res) => {
  const row = await one(
    `UPDATE patients SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND relation <> 'self' AND deleted_at IS NULL RETURNING id`,
    [req.params.id, req.user.id],
  );
  if (!row) throw notFound('Family member not found');
  res.json({ ok: true });
}));

r.get('/notifications', ah(async (req, res) => {
  res.json(await many(
    `SELECT id, title, body, data, read_at AS "readAt", created_at AS "createdAt" FROM notifications
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`, [req.user.id]));
}));

r.post('/notifications/read', ah(async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.json({ ok: true });
}));

// Required by Apple App Store & Google Play: in-app account deletion.
// Personal identifiers are removed; medical records are retained as required by law (anonymised link).
r.delete('/', ah(async (req, res) => {
  await tx(async (c) => {
    await c.query(
      `UPDATE appointments SET status = 'cancelled', cancel_reason = 'Account deleted', updated_at = now()
        WHERE booked_by = $1 AND status IN ('pending_payment','confirmed') AND date >= CURRENT_DATE`, [req.user.id]);
    await c.query(`UPDATE users SET deleted_at = now(), is_active = FALSE, name = NULL, email = NULL, push_token = NULL,
                     phone = 'deleted:' || id::text WHERE id = $1`, [req.user.id]);
    await c.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1', [req.user.id]);
  });
  await audit(req, 'account.delete', 'user', req.user.id);
  res.json({ ok: true });
}));

export default r;
