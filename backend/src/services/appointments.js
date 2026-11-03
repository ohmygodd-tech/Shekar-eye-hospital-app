import { config } from '../config.js';
import { conflict, badRequest, notFound } from '../utils/errors.js';
import { findSlot } from './slots.js';
import { notify } from './notify.js';
import { istToDate } from '../utils/time.js';
import { hospital } from '../hospital.js';

export const apptSelect = `
  a.id, a.date, to_char(a.start_time,'HH24:MI') AS "startTime", to_char(a.end_time,'HH24:MI') AS "endTime",
  a.status, a.payment_status AS "paymentStatus", a.fee_paise AS "feePaise", a.visit_type AS "visitType",
  a.reason, a.token_no AS "tokenNo", a.hold_expires_at AS "holdExpiresAt", a.cancel_reason AS "cancelReason",
  a.created_at AS "createdAt",
  json_build_object('id', p.id, 'name', p.name, 'mrn', p.mrn, 'relation', p.relation) AS patient,
  json_build_object('id', d.id, 'name', d.name, 'qualification', d.qualification, 'photoUrl', d.photo_url,
                    'department', dep.name, 'departmentSlug', dep.slug) AS doctor`;
export const apptFrom = `
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN doctors d ON d.id = a.doctor_id
  JOIN departments dep ON dep.id = d.department_id`;

const lockSlotDay = (c, doctorId, date) =>
  c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${doctorId}:${date}`]);

/** Release expired payment holds on a slot so it can be rebooked. */
async function releaseExpiredHold(c, doctorId, date, start) {
  await c.query(
    `UPDATE appointments SET status = 'cancelled', cancel_reason = 'Payment not completed in time', updated_at = now()
      WHERE doctor_id = $1 AND date = $2 AND start_time = $3 AND status = 'pending_payment' AND hold_expires_at < now()`,
    [doctorId, date, start],
  );
}

export async function nextToken(c, doctorId, date) {
  const r = await c.query(
    `SELECT COALESCE(MAX(token_no), 0) + 1 AS n FROM appointments WHERE doctor_id = $1 AND date = $2`,
    [doctorId, date],
  );
  return r.rows[0].n;
}

/**
 * Create an appointment inside transaction c.
 * payMode 'online' → pending_payment with slot hold; 'hospital' → confirmed, pay at counter.
 */
export async function createAppointment(c, { patientId, doctorId, date, start, visitType, reason, payMode, bookedBy }) {
  const doctor = (await c.query('SELECT id, fee_paise, is_active FROM doctors WHERE id = $1', [doctorId])).rows[0];
  if (!doctor || !doctor.is_active) throw notFound('Doctor not found');

  await lockSlotDay(c, doctorId, date);
  await releaseExpiredHold(c, doctorId, date, start);
  const slot = await findSlot(doctorId, date, start);
  if (!slot) throw badRequest('This time is not in the doctor\'s schedule');
  if (!slot.available) throw conflict('Sorry, this slot was just booked. Please choose another time.');

  const dup = await c.query(
    `SELECT 1 FROM appointments WHERE patient_id = $1 AND doctor_id = $2 AND date = $3 AND status IN ('pending_payment','confirmed','checked_in')`,
    [patientId, doctorId, date],
  );
  if (dup.rowCount) throw conflict('This patient already has an appointment with this doctor on that day');

  const online = payMode === 'online' && doctor.fee_paise > 0;
  const token = online ? null : await nextToken(c, doctorId, date);
  try {
    const row = (await c.query(
      `INSERT INTO appointments (patient_id, doctor_id, booked_by, date, start_time, end_time, status, payment_status,
                                 fee_paise, visit_type, reason, token_no, hold_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, CASE WHEN $13::boolean THEN now() + ($14 || ' minutes')::interval END)
       RETURNING id`,
      [patientId, doctorId, bookedBy, date, start, slot.end, online ? 'pending_payment' : 'confirmed',
        doctor.fee_paise === 0 ? 'paid' : online ? 'unpaid' : 'pay_at_hospital',
        doctor.fee_paise, visitType, reason || null, token, online, String(config.payments.holdMinutes)],
    )).rows[0];
    return { id: row.id, online, feePaise: doctor.fee_paise };
  } catch (e) {
    if (e.code === '23505') throw conflict('Sorry, this slot was just booked. Please choose another time.');
    throw e;
  }
}

/** Mark a pending appointment as paid + confirmed and assign a token. */
export async function confirmPaid(c, appointmentId) {
  const a = (await c.query('SELECT * FROM appointments WHERE id = $1 FOR UPDATE', [appointmentId])).rows[0];
  if (!a) throw notFound();
  if (a.status === 'confirmed' && a.payment_status === 'paid') return a; // idempotent
  if (a.status === 'cancelled') {
    // Hold expired and slot may be gone: try to revive if still free.
    const clash = await c.query(
      `SELECT 1 FROM appointments WHERE doctor_id = $1 AND date = $2 AND start_time = $3 AND status <> 'cancelled' AND id <> $4`,
      [a.doctor_id, a.date, a.start_time, a.id],
    );
    if (clash.rowCount) return { ...a, needsRefund: true };
  }
  await lockSlotDay(c, a.doctor_id, a.date);
  const token = a.token_no || (await nextToken(c, a.doctor_id, a.date));
  const updated = (await c.query(
    `UPDATE appointments SET status = 'confirmed', payment_status = 'paid', token_no = $2, hold_expires_at = NULL,
            cancel_reason = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
    [a.id, token],
  )).rows[0];
  return updated;
}

export function canPatientChange(a) {
  if (!['pending_payment', 'confirmed'].includes(a.status)) return false;
  const start = istToDate(a.date, typeof a.start_time === 'string' ? a.start_time : a.startTime);
  return start.getTime() - Date.now() > config.booking.cancelCutoffHours * 3600 * 1000;
}

export async function notifyBooked(userId, appt) {
  await notify(userId, 'Appointment confirmed',
    `${appt.doctorName} on ${appt.date} at ${appt.start}. Token #${appt.token}. Please arrive 15 minutes early at ${hospital.name}.`,
    { type: 'appointment', id: appt.id });
}
