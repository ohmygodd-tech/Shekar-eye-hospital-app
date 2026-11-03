import { many, one } from '../db/index.js';
import { config } from '../config.js';
import { nowIST, toMinutes, fromMinutes, weekday, addDays } from '../utils/time.js';

/**
 * Available slots for a doctor on a date (IST).
 * A slot is taken if an active appointment exists, except pending-payment holds that have expired.
 */
export async function getSlots(doctorId, date) {
  const today = nowIST();
  if (date < today.date || date > addDays(today.date, config.booking.maxDaysAhead)) return [];

  const leave = await one('SELECT 1 FROM doctor_leaves WHERE doctor_id = $1 AND date = $2', [doctorId, date]);
  if (leave) return [];

  const schedules = await many(
    'SELECT start_time, end_time, slot_minutes FROM doctor_schedules WHERE doctor_id = $1 AND weekday = $2 ORDER BY start_time',
    [doctorId, weekday(date)],
  );
  const taken = new Set(
    (await many(
      `SELECT to_char(start_time, 'HH24:MI') AS t FROM appointments
        WHERE doctor_id = $1 AND date = $2 AND status <> 'cancelled'
          AND NOT (status = 'pending_payment' AND hold_expires_at < now())`,
      [doctorId, date],
    )).map((r) => r.t),
  );

  const slots = [];
  for (const s of schedules) {
    const end = toMinutes(s.end_time);
    for (let m = toMinutes(s.start_time); m + s.slot_minutes <= end; m += s.slot_minutes) {
      const start = fromMinutes(m);
      const isPast = date === today.date && m <= today.minutes + 15; // need 15 min notice
      slots.push({ start, end: fromMinutes(m + s.slot_minutes), available: !taken.has(start) && !isPast });
    }
  }
  return slots;
}

/** Find the slot definition (to validate a booking request). */
export async function findSlot(doctorId, date, start) {
  const slots = await getSlots(doctorId, date);
  return slots.find((s) => s.start === start) || null;
}
