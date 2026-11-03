// Public, no-login endpoints: hospital info, departments, doctors, slots, AI helpers.
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { many, one } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { ah, notFound } from '../utils/errors.js';
import { hospital } from '../hospital.js';
import { getSlots } from '../services/slots.js';
import { triage } from '../services/triage.js';
import { answer } from '../services/assistant.js';
import { config } from '../config.js';
import { nowIST, addDays } from '../utils/time.js';

const r = Router();

r.get('/hospital', (_req, res) => res.json({
  ...hospital,
  booking: { maxDaysAhead: config.booking.maxDaysAhead, cancelCutoffHours: config.booking.cancelCutoffHours, holdMinutes: config.payments.holdMinutes },
  paymentProvider: config.payments.provider,
  paymentKey: config.payments.provider === 'razorpay' ? config.payments.razorpayKeyId : null,
}));

r.get('/departments', ah(async (_req, res) => {
  res.json(await many(
    `SELECT d.id, d.slug, d.name, d.description, d.icon,
            (SELECT count(*)::int FROM doctors x WHERE x.department_id = d.id AND x.is_active) AS "doctorCount"
       FROM departments d WHERE d.is_active ORDER BY d.sort_order, d.name`));
}));

export const doctorSelect = `
  d.id, d.name, d.qualification, d.experience_years AS "experienceYears", d.languages, d.bio,
  d.photo_url AS "photoUrl", d.fee_paise AS "feePaise", d.is_active AS "isActive",
  json_build_object('id', dep.id, 'slug', dep.slug, 'name', dep.name) AS department`;

r.get('/doctors', validate(z.object({
  department: z.string().optional(),
  q: z.string().max(60).optional(),
}), 'query'), ah(async (req, res) => {
  const { department, q } = req.validQuery;
  res.json(await many(
    `SELECT ${doctorSelect} FROM doctors d JOIN departments dep ON dep.id = d.department_id
      WHERE d.is_active AND ($1::text IS NULL OR dep.slug = $1 OR dep.id::text = $1)
        AND ($2::text IS NULL OR d.name ILIKE '%' || $2 || '%' OR dep.name ILIKE '%' || $2 || '%')
      ORDER BY dep.sort_order, d.experience_years DESC NULLS LAST, d.name`,
    [department || null, q || null]));
}));

r.get('/doctors/:id', ah(async (req, res) => {
  const doc = await one(`SELECT ${doctorSelect} FROM doctors d JOIN departments dep ON dep.id = d.department_id WHERE d.id = $1 AND d.is_active`, [req.params.id]);
  if (!doc) throw notFound('Doctor not found');
  doc.schedule = await many(
    `SELECT weekday, to_char(start_time,'HH24:MI') AS start, to_char(end_time,'HH24:MI') AS "end", slot_minutes AS "slotMinutes"
       FROM doctor_schedules WHERE doctor_id = $1 ORDER BY weekday, start_time`, [doc.id]);
  res.json(doc);
}));

r.get('/doctors/:id/slots', validate(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }), 'query'), ah(async (req, res) => {
  res.json({ date: req.validQuery.date, slots: await getSlots(req.params.id, req.validQuery.date) });
}));

/** Next 14 days with number of free slots (for a date strip in the app). */
r.get('/doctors/:id/availability', ah(async (req, res) => {
  const today = nowIST().date;
  const days = [];
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    const slots = await getSlots(req.params.id, date);
    days.push({ date, total: slots.length, free: slots.filter((s) => s.available).length });
  }
  res.json(days);
}));

const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: config.isTest ? 1000 : 20, standardHeaders: true, legacyHeaders: false });

r.post('/ai/triage', aiLimiter, validate(z.object({
  symptoms: z.string().trim().min(3).max(1000),
  age: z.number().int().min(0).max(120).optional(),
  durationDays: z.number().int().min(0).max(3650).optional(),
  diabetic: z.boolean().optional(),
})), ah(async (req, res) => {
  const result = triage(req.body);
  const dep = await one('SELECT id, slug, name FROM departments WHERE slug = $1', [result.department]);
  res.json({ ...result, departmentInfo: dep, emergencyPhone: hospital.emergencyPhone });
}));

r.post('/ai/chat', aiLimiter, validate(z.object({
  message: z.string().trim().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(20).optional(),
})), ah(async (req, res) => {
  res.json(await answer(req.body.message, req.body.history));
}));

export default r;
