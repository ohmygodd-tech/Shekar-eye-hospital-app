// Patient-side appointments and payments.
import { Router } from 'express';
import { z } from 'zod';
import { many, one, tx } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { ah, notFound, badRequest, forbidden } from '../utils/errors.js';
import {
  apptSelect, apptFrom, createAppointment, confirmPaid, canPatientChange, notifyBooked,
} from '../services/appointments.js';
import * as pay from '../services/payments.js';
import { notify } from '../services/notify.js';
import { audit } from '../services/audit.js';
import { config } from '../config.js';
import { hospital } from '../hospital.js';
import { rupees } from '../utils/time.js';

const r = Router();
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^\d{2}:\d{2}$/;

async function ownPatient(userId, patientId) {
  const p = await one('SELECT id FROM patients WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [patientId, userId]);
  if (!p) throw forbidden('This patient is not on your account');
}

async function ownAppointment(userId, id) {
  const a = await one(`SELECT ${apptSelect}, a.doctor_id, p.user_id ${apptFrom} WHERE a.id = $1`, [id]);
  if (!a || a.user_id !== userId) throw notFound('Appointment not found');
  return a;
}

async function startPayment(c, userId, appointmentId, amountPaise) {
  const receipt = `appt_${appointmentId.slice(0, 8)}`;
  const orderId = await pay.createOrder(amountPaise, receipt, { appointmentId });
  await c.query(
    `INSERT INTO payments (appointment_id, user_id, amount_paise, provider, provider_order_id) VALUES ($1,$2,$3,$4,$5)`,
    [appointmentId, userId, amountPaise, pay.provider(), orderId],
  );
  return { orderId, amountPaise, currency: 'INR', provider: pay.provider(), keyId: pay.publicKey(), name: hospital.name };
}

r.get('/', validate(z.object({ scope: z.enum(['upcoming', 'past', 'all']).default('upcoming') }), 'query'), ah(async (req, res) => {
  const { scope } = req.validQuery;
  const where = scope === 'upcoming'
    ? `AND a.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date AND a.status IN ('pending_payment','confirmed','checked_in')
       AND NOT (a.status = 'pending_payment' AND a.hold_expires_at < now())`
    : scope === 'past' ? `AND (a.date < (now() AT TIME ZONE 'Asia/Kolkata')::date OR a.status IN ('completed','cancelled','no_show'))` : '';
  res.json(await many(
    `SELECT ${apptSelect} ${apptFrom} WHERE p.user_id = $1 ${where}
      ORDER BY a.date ${scope === 'upcoming' ? 'ASC' : 'DESC'}, a.start_time ${scope === 'upcoming' ? 'ASC' : 'DESC'} LIMIT 200`,
    [req.user.id]));
}));

r.get('/:id', ah(async (req, res) => {
  const a = await ownAppointment(req.user.id, req.params.id);
  a.canChange = canPatientChange(a);
  delete a.user_id; delete a.doctor_id;
  res.json(a);
}));

r.post('/', validate(z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  date: z.string().regex(dateRe),
  start: z.string().regex(timeRe),
  visitType: z.enum(['new', 'follow_up', 'post_op']).default('new'),
  reason: z.string().max(500).optional(),
  payMode: z.enum(['online', 'hospital']).default('online'),
})), ah(async (req, res) => {
  await ownPatient(req.user.id, req.body.patientId);
  const result = await tx(async (c) => {
    const payMode = pay.provider() === 'none' ? 'hospital' : req.body.payMode;
    const created = await createAppointment(c, { ...req.body, payMode, bookedBy: req.user.id });
    const payment = created.online ? await startPayment(c, req.user.id, created.id, created.feePaise) : null;
    return { ...created, payment };
  });
  const appt = await one(`SELECT ${apptSelect} ${apptFrom} WHERE a.id = $1`, [result.id]);
  if (!result.online) {
    await notifyBooked(req.user.id, { id: appt.id, doctorName: appt.doctor.name, date: appt.date, start: appt.startTime, token: appt.tokenNo });
  }
  await audit(req, 'appointment.create', 'appointment', appt.id, { payMode: req.body.payMode });
  res.status(201).json({ appointment: appt, payment: result.payment });
}));

// Retry payment for a pending appointment (e.g. user closed the checkout).
r.post('/:id/pay', ah(async (req, res) => {
  const a = await ownAppointment(req.user.id, req.params.id);
  if (a.status !== 'pending_payment') throw badRequest('This appointment does not need payment');
  if (pay.provider() === 'none') throw badRequest('Online payment is not available. Please pay at the hospital.');
  if (new Date(a.holdExpiresAt) < new Date()) throw badRequest('The slot hold has expired. Please book again.');
  const payment = await tx((c) => startPayment(c, req.user.id, a.id, a.feePaise));
  res.json({ payment });
}));

r.post('/payments/verify', validate(z.object({
  orderId: z.string().min(5),
  paymentId: z.string().min(5),
  signature: z.string().min(10),
})), ah(async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  if (!pay.verifyPaymentSignature(orderId, paymentId, signature)) throw badRequest('Payment verification failed');
  const out = await tx(async (c) => {
    const p = (await c.query('SELECT * FROM payments WHERE provider_order_id = $1 AND user_id = $2 FOR UPDATE', [orderId, req.user.id])).rows[0];
    if (!p) throw notFound('Payment not found');
    if (p.status !== 'paid') {
      await c.query(
        `UPDATE payments SET status = 'paid', provider_payment_id = $2, paid_at = now(),
           receipt_no = 'SEH-R-' || lpad(nextval('receipt_seq')::text, 6, '0') WHERE id = $1`, [p.id, paymentId]);
    }
    const a = await confirmPaid(c, p.appointment_id);
    return { appointmentId: p.appointment_id, needsRefund: a.needsRefund, paymentId, amount: p.amount_paise };
  });
  if (out.needsRefund) {
    await pay.refund(paymentId, out.amount);
    await one(`UPDATE payments SET status = 'refunded' WHERE provider_order_id = $1 RETURNING id`, [orderId]);
    await notify(req.user.id, 'Payment refunded', 'Your slot hold expired and the slot was taken. The amount will be refunded in 5–7 working days.');
    throw badRequest('Your slot hold expired and the slot was taken. Your payment will be refunded. Please book another slot.');
  }
  const appt = await one(`SELECT ${apptSelect} ${apptFrom} WHERE a.id = $1`, [out.appointmentId]);
  await notifyBooked(req.user.id, { id: appt.id, doctorName: appt.doctor.name, date: appt.date, start: appt.startTime, token: appt.tokenNo });
  await audit(req, 'payment.verify', 'appointment', appt.id);
  res.json({ appointment: appt });
}));

// Development/demo only: completes a mock payment so the full flow can be tested without Razorpay.
r.post('/payments/mock-complete', validate(z.object({ orderId: z.string() })), ah(async (req, res) => {
  if (config.payments.provider !== 'mock' || config.isProd) throw forbidden('Not available');
  const paymentId = `mock_pay_${Date.now()}`;
  res.json({ orderId: req.body.orderId, paymentId, signature: pay.signPayment(req.body.orderId, paymentId) });
}));

r.post('/:id/cancel', validate(z.object({ reason: z.string().max(300).optional() })), ah(async (req, res) => {
  const a = await ownAppointment(req.user.id, req.params.id);
  if (!canPatientChange(a)) throw badRequest(`Appointments can be cancelled up to ${config.booking.cancelCutoffHours} hours before the time slot. Please call the hospital.`);
  const refund = await tx(async (c) => {
    await c.query(`UPDATE appointments SET status = 'cancelled', cancel_reason = $2, updated_at = now(),
                     payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END WHERE id = $1`,
    [a.id, req.body.reason || 'Cancelled by patient']);
    const p = (await c.query(`SELECT * FROM payments WHERE appointment_id = $1 AND status = 'paid' FOR UPDATE`, [a.id])).rows[0];
    if (p) await c.query(`UPDATE payments SET status = 'refunded' WHERE id = $1`, [p.id]);
    return p;
  });
  if (refund) await pay.refund(refund.provider_payment_id, refund.amount_paise);
  await notify(req.user.id, 'Appointment cancelled',
    `Your appointment with ${a.doctor.name} on ${a.date} has been cancelled.${refund ? ` ${rupees(refund.amount_paise)} will be refunded in 5–7 working days.` : ''}`);
  await audit(req, 'appointment.cancel', 'appointment', a.id);
  res.json({ ok: true, refunded: !!refund });
}));

r.post('/:id/reschedule', validate(z.object({ date: z.string().regex(dateRe), start: z.string().regex(timeRe) })), ah(async (req, res) => {
  const a = await ownAppointment(req.user.id, req.params.id);
  if (!canPatientChange(a) || a.status !== 'confirmed') throw badRequest('This appointment can no longer be rescheduled online. Please call the hospital.');
  // Move = create new confirmed appointment carrying payment, cancel old one.
  const newId = await tx(async (c) => {
    await c.query(`UPDATE appointments SET status = 'cancelled', cancel_reason = 'Rescheduled', updated_at = now() WHERE id = $1`, [a.id]);
    const created = await createAppointment(c, {
      patientId: a.patient.id, doctorId: a.doctor_id, date: req.body.date, start: req.body.start,
      visitType: a.visitType, reason: a.reason, payMode: 'hospital', bookedBy: req.user.id,
    });
    await c.query(`UPDATE appointments SET payment_status = $2 WHERE id = $1`, [created.id, a.paymentStatus]);
    await c.query(`UPDATE payments SET appointment_id = $2 WHERE appointment_id = $1 AND status = 'paid'`, [a.id, created.id]);
    return created.id;
  });
  const appt = await one(`SELECT ${apptSelect} ${apptFrom} WHERE a.id = $1`, [newId]);
  await notify(req.user.id, 'Appointment rescheduled', `New time: ${appt.date} at ${appt.startTime} with ${appt.doctor.name}. Token #${appt.tokenNo}.`, { type: 'appointment', id: appt.id });
  await audit(req, 'appointment.reschedule', 'appointment', appt.id, { from: a.id });
  res.json({ appointment: appt });
}));

export const paymentsRouter = Router();

paymentsRouter.get('/', ah(async (req, res) => {
  res.json(await many(
    `SELECT pay.id, pay.amount_paise AS "amountPaise", pay.status, pay.receipt_no AS "receiptNo", pay.paid_at AS "paidAt",
            pay.provider, pay.created_at AS "createdAt", a.id AS "appointmentId", a.date, d.name AS "doctorName", p.name AS "patientName"
       FROM payments pay JOIN appointments a ON a.id = pay.appointment_id
       JOIN doctors d ON d.id = a.doctor_id JOIN patients p ON p.id = a.patient_id
      WHERE pay.user_id = $1 AND pay.status IN ('paid','refunded') ORDER BY pay.created_at DESC`, [req.user.id]));
}));

/** Printable HTML receipt (the app opens/shares it as PDF). */
paymentsRouter.get('/:id/receipt', ah(async (req, res) => {
  const p = await one(
    `SELECT pay.*, a.date, to_char(a.start_time,'HH24:MI') AS time, a.token_no, d.name AS doctor, dep.name AS dept, pt.name AS patient, pt.mrn
       FROM payments pay JOIN appointments a ON a.id = pay.appointment_id JOIN doctors d ON d.id = a.doctor_id
       JOIN departments dep ON dep.id = d.department_id JOIN patients pt ON pt.id = a.patient_id
      WHERE pay.id = $1 AND (pay.user_id = $2 OR $3) AND pay.status IN ('paid','refunded')`,
    [req.params.id, req.user.id, req.user.role !== 'patient']);
  if (!p) throw notFound('Receipt not found');
  res.type('html').send(receiptHtml(p));
}));

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export function receiptHtml(p) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Receipt ${esc(p.receipt_no)}</title><style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1d2939;max-width:640px;margin:24px auto;padding:0 16px}
.h{border-bottom:3px solid ${hospital.brand.primary};padding-bottom:12px;margin-bottom:16px}
.h h1{margin:0;color:${hospital.brand.primary};font-size:22px}.muted{color:#667085;font-size:13px}
table{width:100%;border-collapse:collapse;margin-top:12px}td{padding:8px 0;border-bottom:1px solid #eaecf0}td:last-child{text-align:right;font-weight:600}
.total td{font-size:18px;border-bottom:none}.tag{display:inline-block;padding:2px 8px;border-radius:12px;background:${p.status === 'paid' ? '#dcfae6' : '#fef0c7'};font-size:12px}
</style></head><body><div class="h"><h1>${esc(hospital.name)}</h1><div class="muted">${esc(hospital.address)} · ${esc(hospital.phone)}${hospital.gstin ? ` · GSTIN ${esc(hospital.gstin)}` : ''}</div></div>
<h2 style="margin:0 0 4px">Payment receipt <span class="tag">${p.status === 'paid' ? 'PAID' : 'REFUNDED'}</span></h2>
<div class="muted">Receipt no. ${esc(p.receipt_no)} · ${new Date(p.paid_at || p.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
<table><tr><td>Patient</td><td>${esc(p.patient)} (${esc(p.mrn)})</td></tr>
<tr><td>Doctor</td><td>${esc(p.doctor)} · ${esc(p.dept)}</td></tr>
<tr><td>Appointment</td><td>${esc(p.date)} at ${esc(p.time)}${p.token_no ? ` · Token #${p.token_no}` : ''}</td></tr>
<tr><td>Description</td><td>Consultation fee</td></tr>
<tr><td>Payment ID</td><td>${esc(p.provider_payment_id || p.provider)}</td></tr>
<tr class="total"><td>Total</td><td>${rupees(p.amount_paise)}</td></tr></table>
<p class="muted">This is a computer-generated receipt.</p></body></html>`;
}

export default r;
