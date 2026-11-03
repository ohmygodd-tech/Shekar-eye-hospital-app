// Staff panel API: front desk (receptionist), doctors and administrators.
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query, tx } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { requireRole, STAFF } from '../middleware/auth.js';
import { ah, notFound, badRequest, conflict } from '../utils/errors.js';
import { apptSelect, apptFrom, createAppointment, notifyBooked } from '../services/appointments.js';
import { notify } from '../services/notify.js';
import { audit } from '../services/audit.js';
import { phoneSchema } from './auth.js';
import { doctorSelect } from './catalog.js';
import * as pay from '../services/payments.js';
import { nowIST } from '../utils/time.js';

const r = Router();
r.use(requireRole(...STAFF));
const adminOnly = requireRole('admin');
const desk = requireRole('admin', 'receptionist');
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

// ── Dashboard ────────────────────────────────────────────────────────────────
r.get('/dashboard', ah(async (req, res) => {
  const today = nowIST().date;
  const docFilter = req.user.role === 'doctor' ? 'AND a.doctor_id = $2' : '';
  const params = req.user.role === 'doctor' ? [today, req.user.doctorId] : [today];
  const stats = await one(
    `SELECT count(*) FILTER (WHERE a.status <> 'cancelled' AND NOT (a.status='pending_payment' AND a.hold_expires_at < now()))::int AS "todayTotal",
            count(*) FILTER (WHERE a.status = 'confirmed')::int AS waiting,
            count(*) FILTER (WHERE a.status = 'checked_in')::int AS "checkedIn",
            count(*) FILTER (WHERE a.status = 'completed')::int AS completed,
            count(*) FILTER (WHERE a.status = 'no_show')::int AS "noShow"
       FROM appointments a WHERE a.date = $1 ${docFilter}`, params);
  const revenue = await one(
    `SELECT COALESCE(sum(amount_paise) FILTER (WHERE (paid_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date), 0)::bigint AS "todayPaise",
            COALESCE(sum(amount_paise) FILTER (WHERE paid_at > now() - interval '30 days'), 0)::bigint AS "monthPaise"
       FROM payments WHERE status = 'paid'`, [today]);
  const newPatients = await one(`SELECT count(*)::int AS n FROM patients WHERE created_at > now() - interval '30 days'`);
  const trend = await many(
    `SELECT to_char(d, 'YYYY-MM-DD') AS date,
            (SELECT count(*)::int FROM appointments a WHERE a.date = d::date AND a.status NOT IN ('cancelled','pending_payment') ${docFilter}) AS count
       FROM generate_series($1::date - 13, $1::date, interval '1 day') d ORDER BY d`, params);
  const byDept = await many(
    `SELECT dep.name, count(a.id)::int AS count FROM departments dep
       LEFT JOIN doctors d ON d.department_id = dep.id
       LEFT JOIN appointments a ON a.doctor_id = d.id AND a.date > $1::date - 30 AND a.status NOT IN ('cancelled','pending_payment')
      GROUP BY dep.name, dep.sort_order ORDER BY dep.sort_order`, [today]);
  res.json({
    today, ...stats,
    revenueTodayPaise: Number(revenue.todayPaise), revenue30dPaise: Number(revenue.monthPaise),
    newPatients30d: newPatients.n, trend, byDepartment: byDept,
  });
}));

// ── Appointments ─────────────────────────────────────────────────────────────
r.get('/appointments', validate(z.object({
  date: z.string().regex(dateRe).optional(),
  doctorId: z.string().uuid().optional(),
  status: z.string().optional(),
  q: z.string().max(60).optional(),
}), 'query'), ah(async (req, res) => {
  const { date, doctorId, status, q } = req.validQuery;
  const doc = req.user.role === 'doctor' ? req.user.doctorId : doctorId;
  res.json(await many(
    `SELECT ${apptSelect}, u.phone ${apptFrom} JOIN users u ON u.id = p.user_id
      WHERE ($1::date IS NULL OR a.date = $1) AND ($2::uuid IS NULL OR a.doctor_id = $2)
        AND ($3::text IS NULL OR a.status::text = $3)
        AND ($4::text IS NULL OR p.name ILIKE '%'||$4||'%' OR p.mrn ILIKE '%'||$4||'%' OR u.phone LIKE '%'||$4||'%')
        AND NOT (a.status = 'pending_payment' AND a.hold_expires_at < now())
      ORDER BY a.date DESC, a.start_time LIMIT 500`,
    [date || null, doc || null, status || null, q || null]));
}));

const transitions = {
  checked_in: ['confirmed'],
  completed: ['checked_in', 'confirmed'],
  no_show: ['confirmed'],
  cancelled: ['confirmed', 'pending_payment', 'checked_in'],
  confirmed: ['checked_in', 'no_show'], // undo
};

r.patch('/appointments/:id', validate(z.object({
  status: z.enum(['confirmed', 'checked_in', 'completed', 'no_show', 'cancelled']).optional(),
  paymentStatus: z.enum(['paid']).optional(), // record cash/card payment at counter
  cancelReason: z.string().max(300).optional(),
})), ah(async (req, res) => {
  const a = await one(`SELECT a.*, p.user_id, d.name AS doctor_name FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN doctors d ON d.id = a.doctor_id WHERE a.id = $1`, [req.params.id]);
  if (!a) throw notFound('Appointment not found');
  if (req.user.role === 'doctor' && a.doctor_id !== req.user.doctorId) throw notFound('Appointment not found');
  const { status, paymentStatus, cancelReason } = req.body;
  if (status && !transitions[status].includes(a.status)) throw badRequest(`Cannot change from ${a.status} to ${status}`);
  await tx(async (c) => {
    if (status) {
      await c.query(`UPDATE appointments SET status = $2, cancel_reason = COALESCE($3, cancel_reason), updated_at = now() WHERE id = $1`,
        [a.id, status, status === 'cancelled' ? cancelReason || 'Cancelled by hospital' : null]);
    }
    if (paymentStatus === 'paid' && a.payment_status === 'pay_at_hospital') {
      await c.query(`UPDATE appointments SET payment_status = 'paid', updated_at = now() WHERE id = $1`, [a.id]);
      await c.query(
        `INSERT INTO payments (appointment_id, user_id, amount_paise, provider, status, paid_at, receipt_no)
         VALUES ($1,$2,$3,'cash','paid',now(), 'SEH-R-' || lpad(nextval('receipt_seq')::text, 6, '0'))`,
        [a.id, a.user_id, a.fee_paise]);
    }
  });
  if (status === 'cancelled') {
    const paid = await one(`SELECT * FROM payments WHERE appointment_id = $1 AND status = 'paid' AND provider <> 'cash'`, [a.id]);
    if (paid) {
      await pay.refund(paid.provider_payment_id, paid.amount_paise);
      await query(`UPDATE payments SET status = 'refunded' WHERE id = $1`, [paid.id]);
      await query(`UPDATE appointments SET payment_status = 'refunded' WHERE id = $1`, [a.id]);
    }
    await notify(a.user_id, 'Appointment cancelled by hospital',
      `Your appointment with ${a.doctor_name} on ${a.date} was cancelled. ${cancelReason || ''} ${paid ? 'Your payment will be refunded.' : ''} Please rebook or call us.`.trim());
  }
  if (status === 'completed') {
    await notify(a.user_id, 'Thank you for visiting', 'Your prescription and reports will appear in Records. Please follow your doctor\'s advice and follow-up date.');
  }
  await audit(req, 'appointment.update', 'appointment', a.id, req.body);
  res.json(await one(`SELECT ${apptSelect} ${apptFrom} WHERE a.id = $1`, [a.id]));
}));

// Front desk booking for walk-ins / phone calls.
r.post('/appointments', desk, validate(z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  date: z.string().regex(dateRe),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  visitType: z.enum(['new', 'follow_up', 'post_op', 'emergency']).default('new'),
  reason: z.string().max(500).optional(),
})), ah(async (req, res) => {
  const id = await tx(async (c) => (await createAppointment(c, { ...req.body, payMode: 'hospital', bookedBy: req.user.id })).id);
  const appt = await one(`SELECT ${apptSelect}, p.user_id ${apptFrom} WHERE a.id = $1`, [id]);
  await notifyBooked(appt.user_id, { id, doctorName: appt.doctor.name, date: appt.date, start: appt.startTime, token: appt.tokenNo });
  await audit(req, 'appointment.create_desk', 'appointment', id);
  delete appt.user_id;
  res.status(201).json(appt);
}));

// ── Patients ─────────────────────────────────────────────────────────────────
r.get('/patients', validate(z.object({ q: z.string().max(60).optional() }), 'query'), ah(async (req, res) => {
  const q = req.validQuery.q || null;
  res.json(await many(
    `SELECT p.id, p.mrn, p.name, p.relation, to_char(p.dob,'YYYY-MM-DD') AS dob, p.gender, u.phone, p.created_at AS "createdAt",
            (SELECT max(date) FROM appointments a WHERE a.patient_id = p.id AND a.status IN ('completed','checked_in')) AS "lastVisit"
       FROM patients p JOIN users u ON u.id = p.user_id
      WHERE p.deleted_at IS NULL AND ($1::text IS NULL OR p.name ILIKE '%'||$1||'%' OR p.mrn ILIKE '%'||$1||'%' OR u.phone LIKE '%'||$1||'%')
      ORDER BY p.created_at DESC LIMIT 200`, [q]));
}));

r.get('/patients/:id', ah(async (req, res) => {
  const p = await one(
    `SELECT p.id, p.mrn, p.name, p.relation, to_char(p.dob,'YYYY-MM-DD') AS dob, p.gender, p.blood_group AS "bloodGroup",
            p.allergies, p.medical_history AS "medicalHistory", p.wears_glasses AS "wearsGlasses", u.phone, u.name AS "accountName", p.created_at AS "createdAt"
       FROM patients p JOIN users u ON u.id = p.user_id WHERE p.id = $1`, [req.params.id]);
  if (!p) throw notFound('Patient not found');
  p.appointments = await many(`SELECT ${apptSelect} ${apptFrom} WHERE a.patient_id = $1 ORDER BY a.date DESC, a.start_time DESC LIMIT 50`, [p.id]);
  await audit(req, 'patient.view', 'patient', p.id);
  res.json(p);
}));

// Register a walk-in patient (creates the phone account if needed).
r.post('/patients', desk, validate(z.object({
  phone: phoneSchema,
  name: z.string().trim().min(2).max(80),
  relation: z.enum(['self', 'spouse', 'child', 'parent', 'sibling', 'other']).default('self'),
  dob: z.string().regex(dateRe).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  medicalHistory: z.string().max(1000).optional(),
})), ah(async (req, res) => {
  const b = req.body;
  const p = await tx(async (c) => {
    let u = (await c.query('SELECT id, role FROM users WHERE phone = $1', [b.phone])).rows[0];
    if (!u) u = (await c.query(`INSERT INTO users (phone, name) VALUES ($1, $2) RETURNING id, role`, [b.phone, b.relation === 'self' ? b.name : null])).rows[0];
    if (b.relation === 'self') {
      const self = (await c.query(`SELECT 1 FROM patients WHERE user_id = $1 AND relation = 'self' AND deleted_at IS NULL`, [u.id])).rowCount;
      if (self) throw conflict('A patient is already registered as "self" on this phone number. Choose a different relation.');
    }
    return (await c.query(
      `INSERT INTO patients (user_id, name, relation, dob, gender, medical_history) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, mrn, name`,
      [u.id, b.name, b.relation, b.dob || null, b.gender || null, b.medicalHistory || null])).rows[0];
  });
  await audit(req, 'patient.create', 'patient', p.id);
  res.status(201).json(p);
}));

// ── Doctors, schedules, leaves ───────────────────────────────────────────────
r.get('/doctors', ah(async (_req, res) => {
  const docs = await many(`SELECT ${doctorSelect}, u.phone FROM doctors d JOIN departments dep ON dep.id = d.department_id LEFT JOIN users u ON u.id = d.user_id ORDER BY dep.sort_order, d.name`);
  const sched = await many(`SELECT doctor_id, weekday, to_char(start_time,'HH24:MI') AS start, to_char(end_time,'HH24:MI') AS "end", slot_minutes AS "slotMinutes" FROM doctor_schedules ORDER BY weekday, start_time`);
  const leaves = await many(`SELECT doctor_id, date, reason FROM doctor_leaves WHERE date >= CURRENT_DATE ORDER BY date`);
  res.json(docs.map((d) => ({
    ...d,
    schedule: sched.filter((s) => s.doctor_id === d.id).map(({ doctor_id, ...s }) => s),
    leaves: leaves.filter((l) => l.doctor_id === d.id).map(({ doctor_id, ...l }) => l),
  })));
}));

const doctorBody = z.object({
  name: z.string().trim().min(2).max(80),
  departmentId: z.string().uuid(),
  qualification: z.string().max(200).optional(),
  experienceYears: z.number().int().min(0).max(70).optional(),
  languages: z.array(z.string().max(30)).max(10).optional(),
  bio: z.string().max(2000).optional(),
  photoUrl: z.string().url().optional().or(z.literal('')),
  feePaise: z.number().int().min(0).max(10000000),
  isActive: z.boolean().optional(),
  phone: phoneSchema.optional().or(z.literal('')), // doctor's login number
});

async function linkDoctorUser(c, phone, name) {
  if (!phone) return null;
  const u = (await c.query(
    `INSERT INTO users (phone, name, role) VALUES ($1,$2,'doctor')
     ON CONFLICT (phone) DO UPDATE SET role = CASE WHEN users.role = 'admin' THEN users.role ELSE 'doctor' END, name = COALESCE(users.name, EXCLUDED.name)
     RETURNING id`, [phone, name])).rows[0];
  return u.id;
}

r.post('/doctors', adminOnly, validate(doctorBody), ah(async (req, res) => {
  const b = req.body;
  const d = await tx(async (c) => {
    const userId = await linkDoctorUser(c, b.phone, b.name);
    return (await c.query(
      `INSERT INTO doctors (user_id, department_id, name, qualification, experience_years, languages, bio, photo_url, fee_paise, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [userId, b.departmentId, b.name, b.qualification || null, b.experienceYears ?? null, b.languages || [], b.bio || null, b.photoUrl || null, b.feePaise, b.isActive ?? true])).rows[0];
  });
  await audit(req, 'doctor.create', 'doctor', d.id);
  res.status(201).json(d);
}));

r.put('/doctors/:id', adminOnly, validate(doctorBody), ah(async (req, res) => {
  const b = req.body;
  const d = await tx(async (c) => {
    const userId = await linkDoctorUser(c, b.phone, b.name);
    return (await c.query(
      `UPDATE doctors SET department_id=$2, name=$3, qualification=$4, experience_years=$5, languages=$6, bio=$7, photo_url=$8,
              fee_paise=$9, is_active=$10, user_id = COALESCE($11, user_id) WHERE id = $1 RETURNING id`,
      [req.params.id, b.departmentId, b.name, b.qualification || null, b.experienceYears ?? null, b.languages || [], b.bio || null, b.photoUrl || null, b.feePaise, b.isActive ?? true, userId])).rows[0];
  });
  if (!d) throw notFound('Doctor not found');
  await audit(req, 'doctor.update', 'doctor', d.id);
  res.json(d);
}));

r.put('/doctors/:id/schedule', adminOnly, validate(z.object({
  schedule: z.array(z.object({
    weekday: z.number().int().min(0).max(6),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    slotMinutes: z.number().int().min(5).max(120).default(15),
  }).refine((s) => s.end > s.start, 'End time must be after start time')).max(28),
})), ah(async (req, res) => {
  await tx(async (c) => {
    await c.query('DELETE FROM doctor_schedules WHERE doctor_id = $1', [req.params.id]);
    for (const s of req.body.schedule) {
      await c.query('INSERT INTO doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes) VALUES ($1,$2,$3,$4,$5)',
        [req.params.id, s.weekday, s.start, s.end, s.slotMinutes]);
    }
  });
  await audit(req, 'doctor.schedule', 'doctor', req.params.id);
  res.json({ ok: true });
}));

r.post('/doctors/:id/leaves', desk, validate(z.object({ date: z.string().regex(dateRe), reason: z.string().max(200).optional() })), ah(async (req, res) => {
  await query('INSERT INTO doctor_leaves (doctor_id, date, reason) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.params.id, req.body.date, req.body.reason || null]);
  const affected = await one(`SELECT count(*)::int AS n FROM appointments WHERE doctor_id = $1 AND date = $2 AND status IN ('confirmed','pending_payment')`, [req.params.id, req.body.date]);
  await audit(req, 'doctor.leave', 'doctor', req.params.id, req.body);
  res.status(201).json({ ok: true, existingAppointments: affected.n });
}));

r.delete('/doctors/:id/leaves/:date', desk, ah(async (req, res) => {
  await query('DELETE FROM doctor_leaves WHERE doctor_id = $1 AND date = $2', [req.params.id, req.params.date]);
  res.json({ ok: true });
}));

// ── Departments ──────────────────────────────────────────────────────────────
const deptBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).max(40), name: z.string().min(2).max(80),
  description: z.string().max(1000).optional(), icon: z.string().max(40).optional(),
  sortOrder: z.number().int().optional(), isActive: z.boolean().optional(),
});
r.get('/departments', ah(async (_req, res) => {
  res.json(await many(`SELECT id, slug, name, description, icon, sort_order AS "sortOrder", is_active AS "isActive" FROM departments ORDER BY sort_order, name`));
}));
r.post('/departments', adminOnly, validate(deptBody), ah(async (req, res) => {
  const b = req.body;
  try {
    res.status(201).json(await one(`INSERT INTO departments (slug, name, description, icon, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [b.slug, b.name, b.description || null, b.icon || null, b.sortOrder ?? 0, b.isActive ?? true]));
  } catch (e) { if (e.code === '23505') throw conflict('A department with this slug exists'); throw e; }
}));
r.put('/departments/:id', adminOnly, validate(deptBody), ah(async (req, res) => {
  const b = req.body;
  const d = await one(`UPDATE departments SET slug=$2, name=$3, description=$4, icon=$5, sort_order=$6, is_active=$7 WHERE id=$1 RETURNING id`,
    [req.params.id, b.slug, b.name, b.description || null, b.icon || null, b.sortOrder ?? 0, b.isActive ?? true]);
  if (!d) throw notFound();
  res.json(d);
}));

// ── Payments ─────────────────────────────────────────────────────────────────
r.get('/payments', requireRole('admin', 'receptionist'), validate(z.object({ from: z.string().regex(dateRe).optional(), to: z.string().regex(dateRe).optional() }), 'query'), ah(async (req, res) => {
  const { from, to } = req.validQuery;
  res.json(await many(
    `SELECT pay.id, pay.amount_paise AS "amountPaise", pay.status, pay.provider, pay.receipt_no AS "receiptNo",
            pay.provider_payment_id AS "providerPaymentId", pay.paid_at AS "paidAt", pay.created_at AS "createdAt",
            p.name AS "patientName", p.mrn, d.name AS "doctorName", a.date AS "appointmentDate"
       FROM payments pay JOIN appointments a ON a.id = pay.appointment_id JOIN patients p ON p.id = a.patient_id JOIN doctors d ON d.id = a.doctor_id
      WHERE pay.status IN ('paid','refunded')
        AND ($1::date IS NULL OR (pay.paid_at AT TIME ZONE 'Asia/Kolkata')::date >= $1)
        AND ($2::date IS NULL OR (pay.paid_at AT TIME ZONE 'Asia/Kolkata')::date <= $2)
      ORDER BY pay.paid_at DESC NULLS LAST LIMIT 1000`, [from || null, to || null]));
}));

// ── Staff management & audit (admin) ────────────────────────────────────────
r.get('/staff', adminOnly, ah(async (_req, res) => {
  res.json(await many(`SELECT id, phone, name, role, is_active AS "isActive", created_at AS "createdAt" FROM users WHERE role <> 'patient' AND deleted_at IS NULL ORDER BY role, name`));
}));
r.post('/staff', adminOnly, validate(z.object({ phone: phoneSchema, name: z.string().min(2).max(80), role: z.enum(['admin', 'receptionist']) })), ah(async (req, res) => {
  const u = await one(
    `INSERT INTO users (phone, name, role) VALUES ($1,$2,$3)
     ON CONFLICT (phone) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, is_active = TRUE RETURNING id, phone, name, role`,
    [req.body.phone, req.body.name, req.body.role]);
  await audit(req, 'staff.upsert', 'user', u.id, { role: u.role });
  res.status(201).json(u);
}));
r.patch('/staff/:id', adminOnly, validate(z.object({ isActive: z.boolean() })), ah(async (req, res) => {
  if (req.params.id === req.user.id) throw badRequest('You cannot deactivate yourself');
  const u = await one(`UPDATE users SET is_active = $2 WHERE id = $1 AND role <> 'patient' RETURNING id`, [req.params.id, req.body.isActive]);
  if (!u) throw notFound();
  await audit(req, 'staff.active', 'user', u.id, req.body);
  res.json({ ok: true });
}));
r.get('/audit', adminOnly, ah(async (_req, res) => {
  res.json(await many(`SELECT l.id, l.action, l.entity, l.entity_id AS "entityId", l.meta, l.ip, l.created_at AS "createdAt", u.name AS "userName", u.role
                         FROM audit_logs l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT 300`));
}));

export default r;
