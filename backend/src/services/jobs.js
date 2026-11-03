// Background jobs: expire unpaid slot holds and send appointment reminders.
// (Single-instance timer. For multiple servers, run this in one worker or use a cron.)
import { many, query } from '../db/index.js';
import { notify } from './notify.js';
import { hospital } from '../hospital.js';

export async function expireHolds() {
  await query(
    `UPDATE appointments SET status = 'cancelled', cancel_reason = 'Payment not completed in time', updated_at = now()
      WHERE status = 'pending_payment' AND hold_expires_at < now() - interval '2 minutes'`);
}

/** Reminder the evening before (sent once — tracked via notifications.data). */
export async function sendReminders() {
  const rows = await many(
    `SELECT a.id, a.date, to_char(a.start_time,'HH24:MI') AS start, a.token_no, p.user_id, p.name AS patient, d.name AS doctor
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN doctors d ON d.id = a.doctor_id
      WHERE a.status = 'confirmed' AND a.date = ((now() AT TIME ZONE 'Asia/Kolkata')::date + 1)
        AND (now() AT TIME ZONE 'Asia/Kolkata')::time >= '17:00'
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.data->>'reminderFor' = a.id::text)`);
  for (const r of rows) {
    await notify(r.user_id, 'Appointment tomorrow',
      `${r.patient} has an appointment with ${r.doctor} tomorrow at ${r.start} (Token #${r.token_no}). If your eyes may be dilated, please bring sunglasses and avoid driving. — ${hospital.shortName}`,
      { type: 'appointment', id: r.id, reminderFor: r.id });
  }
}

export function startJobs() {
  const run = async () => {
    try { await expireHolds(); await sendReminders(); } catch (e) { console.error('job error', e.message); }
  };
  run();
  setInterval(run, 5 * 60 * 1000).unref();
}
