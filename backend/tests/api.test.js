import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { seed } from '../src/db/seed.js';
import { triage } from '../src/services/triage.js';
import { nowIST, addDays, weekday } from '../src/utils/time.js';

const app = createApp();
const api = () => request(app);

async function login(phone, appKind = 'patient') {
  const r1 = await api().post('/api/auth/otp/request').send({ phone });
  expect(r1.status).toBe(200);
  const r2 = await api().post('/api/auth/otp/verify').send({ phone, code: r1.body.devOtp, app: appKind });
  return r2;
}

/** A future Mon–Fri date (doctors have morning + afternoon sessions). */
function nextWorkday(offset = 2) {
  let d = addDays(nowIST().date, offset);
  while ([0, 6].includes(weekday(d))) d = addDays(d, 1);
  return d;
}

let patientTok, patient2Tok, adminTok, deskTok, doctorTok, selfPatient, doctor, date;

beforeAll(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await seed();
  const p = await login('+919876543210');
  patientTok = p.body.accessToken;
  expect(p.body.needsProfile).toBe(true);
  patient2Tok = (await login('9123456780')).body.accessToken;
  adminTok = (await login('+919000000001', 'staff')).body.accessToken;
  deskTok = (await login('+919000000002', 'staff')).body.accessToken;
  doctorTok = (await login('+919000000012', 'staff')).body.accessToken;
  doctor = (await api().get('/api/doctors?department=cataract')).body[0];
  date = nextWorkday();
});
afterAll(() => pool.end());

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('auth', () => {
  it('rejects invalid phone numbers', async () => {
    const r = await api().post('/api/auth/otp/request').send({ phone: '12345' });
    expect(r.status).toBe(400);
  });
  it('rejects wrong OTP and throttles resend', async () => {
    await api().post('/api/auth/otp/request').send({ phone: '9988776655' });
    const again = await api().post('/api/auth/otp/request').send({ phone: '9988776655' });
    expect(again.status).toBe(429);
    const bad = await api().post('/api/auth/otp/verify').send({ phone: '9988776655', code: '000000' });
    expect(bad.status).toBe(400);
  });
  it('blocks patients from the staff app', async () => {
    const r1 = await api().post('/api/auth/otp/request').send({ phone: '9811111111' });
    const r = await api().post('/api/auth/otp/verify').send({ phone: '9811111111', code: r1.body.devOtp, app: 'staff' });
    expect(r.status).toBe(403);
  });
  it('rotates refresh tokens', async () => {
    const l = await login('9822222222');
    const r = await api().post('/api/auth/refresh').send({ refreshToken: l.body.refreshToken });
    expect(r.status).toBe(200);
    expect(r.body.accessToken).toBeTruthy();
    const reuse = await api().post('/api/auth/refresh').send({ refreshToken: l.body.refreshToken });
    expect(reuse.status).toBe(401);
  });
  it('requires auth for private routes', async () => {
    expect((await api().get('/api/me')).status).toBe(401);
  });
});

describe('profile & family', () => {
  it('creates self and family profiles with MRN', async () => {
    const r = await api().post('/api/me/patients').set(auth(patientTok)).send({ name: 'Ravi Kumar', relation: 'self', dob: '1960-04-12', gender: 'male', medicalHistory: 'Diabetes' });
    expect(r.status).toBe(201);
    expect(r.body.mrn).toMatch(/^SEH-\d{6}$/);
    selfPatient = r.body;
    const kid = await api().post('/api/me/patients').set(auth(patientTok)).send({ name: 'Anu', relation: 'child', dob: '2016-01-01' });
    expect(kid.status).toBe(201);
    const dup = await api().post('/api/me/patients').set(auth(patientTok)).send({ name: 'X', relation: 'self' });
    expect(dup.status).toBe(400);
    const me = await api().get('/api/me').set(auth(patientTok));
    expect(me.body.patients).toHaveLength(2);
    expect(me.body.patients[0].relation).toBe('self');
  });
});

describe('booking', () => {
  let apptId;
  it('lists slots and books with pay-at-hospital', async () => {
    const s = await api().get(`/api/doctors/${doctor.id}/slots?date=${date}`);
    expect(s.body.slots.length).toBeGreaterThan(10);
    const r = await api().post('/api/appointments').set(auth(patientTok)).send({
      patientId: selfPatient.id, doctorId: doctor.id, date, start: '10:00', payMode: 'hospital', reason: 'Blurry vision',
    });
    expect(r.status).toBe(201);
    expect(r.body.appointment.status).toBe('confirmed');
    expect(r.body.appointment.tokenNo).toBe(1);
    apptId = r.body.appointment.id;
    const s2 = await api().get(`/api/doctors/${doctor.id}/slots?date=${date}`);
    expect(s2.body.slots.find((x) => x.start === '10:00').available).toBe(false);
  });

  it('prevents double booking the same slot (even concurrently)', async () => {
    const p2 = (await api().post('/api/me/patients').set(auth(patient2Tok)).send({ name: 'Meena', relation: 'self' })).body;
    const taken = await api().post('/api/appointments').set(auth(patient2Tok)).send({ patientId: p2.id, doctorId: doctor.id, date, start: '10:00', payMode: 'hospital' });
    expect(taken.status).toBe(409);
    const [a, b] = await Promise.all([
      api().post('/api/appointments').set(auth(patient2Tok)).send({ patientId: p2.id, doctorId: doctor.id, date, start: '11:00', payMode: 'hospital' }),
      api().post('/api/appointments').set(auth(patientTok)).send({ patientId: selfPatient.id, doctorId: doctor.id, date: date, start: '11:00', payMode: 'hospital' }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('rejects booking for someone else\'s patient', async () => {
    const r = await api().post('/api/appointments').set(auth(patient2Tok)).send({ patientId: selfPatient.id, doctorId: doctor.id, date, start: '12:00', payMode: 'hospital' });
    expect(r.status).toBe(403);
  });

  it('online payment: hold → verify signature → confirmed with token and receipt', async () => {
    const kid = (await api().get('/api/me').set(auth(patientTok))).body.patients.find((p) => p.relation === 'child');
    const r = await api().post('/api/appointments').set(auth(patientTok)).send({ patientId: kid.id, doctorId: doctor.id, date, start: '15:00', payMode: 'online' });
    expect(r.status).toBe(201);
    expect(r.body.appointment.status).toBe('pending_payment');
    expect(r.body.payment.amountPaise).toBe(doctor.feePaise);
    const bad = await api().post('/api/appointments/payments/verify').set(auth(patientTok)).send({ orderId: r.body.payment.orderId, paymentId: 'pay_fake123', signature: 'x'.repeat(64) });
    expect(bad.status).toBe(400);
    const mock = await api().post('/api/appointments/payments/mock-complete').set(auth(patientTok)).send({ orderId: r.body.payment.orderId });
    const ok = await api().post('/api/appointments/payments/verify').set(auth(patientTok)).send(mock.body);
    expect(ok.status).toBe(200);
    expect(ok.body.appointment.status).toBe('confirmed');
    expect(ok.body.appointment.paymentStatus).toBe('paid');
    const pays = await api().get('/api/payments').set(auth(patientTok));
    expect(pays.body[0].receiptNo).toMatch(/^SEH-R-/);
    const receipt = await api().get(`/api/payments/${pays.body[0].id}/receipt`).set(auth(patientTok));
    expect(receipt.text).toContain('Shekar Eye Hospital');
    const other = await api().get(`/api/payments/${pays.body[0].id}/receipt`).set(auth(patient2Tok));
    expect(other.status).toBe(404);
  });

  it('reschedules and cancels', async () => {
    const r = await api().post(`/api/appointments/${apptId}/reschedule`).set(auth(patientTok)).send({ date, start: '16:00' });
    expect(r.status).toBe(200);
    expect(r.body.appointment.startTime).toBe('16:00');
    const c = await api().post(`/api/appointments/${r.body.appointment.id}/cancel`).set(auth(patientTok)).send({});
    expect(c.status).toBe(200);
    const up = await api().get('/api/appointments?scope=upcoming').set(auth(patientTok));
    expect(up.body.find((a) => a.id === r.body.appointment.id)).toBeUndefined();
  });

  it('expired holds free the slot', async () => {
    const r = await api().post('/api/appointments').set(auth(patientTok)).send({ patientId: selfPatient.id, doctorId: doctor.id, date, start: '17:00', payMode: 'online' });
    await pool.query(`UPDATE appointments SET hold_expires_at = now() - interval '1 minute' WHERE id = $1`, [r.body.appointment.id]);
    const p2 = (await api().post('/api/me/patients').set(auth(patient2Tok)).send({ name: 'Raju', relation: 'spouse' })).body;
    const b = await api().post('/api/appointments').set(auth(patient2Tok)).send({ patientId: p2.id, doctorId: doctor.id, date, start: '17:00', payMode: 'hospital' });
    expect(b.status).toBe(201);
  });
});

describe('staff panel', () => {
  it('blocks patients from admin APIs', async () => {
    expect((await api().get('/api/admin/dashboard').set(auth(patientTok))).status).toBe(403);
  });
  it('dashboard and appointment workflow', async () => {
    const d = await api().get('/api/admin/dashboard').set(auth(deskTok));
    expect(d.status).toBe(200);
    expect(d.body.trend).toHaveLength(14);
    const list = await api().get(`/api/admin/appointments?date=${date}`).set(auth(deskTok));
    const appt = list.body.find((a) => a.status === 'confirmed' && a.paymentStatus === 'pay_at_hospital');
    expect(appt).toBeTruthy();
    const paid = await api().patch(`/api/admin/appointments/${appt.id}`).set(auth(deskTok)).send({ status: 'checked_in', paymentStatus: 'paid' });
    expect(paid.body.status).toBe('checked_in');
    expect(paid.body.paymentStatus).toBe('paid');
    const bad = await api().patch(`/api/admin/appointments/${appt.id}`).set(auth(deskTok)).send({ status: 'no_show' });
    expect(bad.status).toBe(400);
  });
  it('doctor sees only own appointments', async () => {
    const list = await api().get(`/api/admin/appointments?date=${date}`).set(auth(doctorTok));
    expect(list.status).toBe(200);
    expect(list.body.every((a) => a.doctor.id === doctor.id)).toBe(true);
  });
  it('receptionist cannot manage doctors; admin can', async () => {
    const dep = (await api().get('/api/departments')).body[0];
    const body = { name: 'Dr. New', departmentId: dep.id, feePaise: 40000 };
    expect((await api().post('/api/admin/doctors').set(auth(deskTok)).send(body)).status).toBe(403);
    const r = await api().post('/api/admin/doctors').set(auth(adminTok)).send(body);
    expect(r.status).toBe(201);
    const s = await api().put(`/api/admin/doctors/${r.body.id}/schedule`).set(auth(adminTok)).send({ schedule: [{ weekday: weekday(date), start: '10:00', end: '11:00', slotMinutes: 20 }] });
    expect(s.status).toBe(200);
    const slots = await api().get(`/api/doctors/${r.body.id}/slots?date=${date}`);
    expect(slots.body.slots.map((x) => x.start)).toEqual(['10:00', '10:20', '10:40']);
    await api().post(`/api/admin/doctors/${r.body.id}/leaves`).set(auth(deskTok)).send({ date });
    expect((await api().get(`/api/doctors/${r.body.id}/slots?date=${date}`)).body.slots).toHaveLength(0);
  });
  it('registers walk-in patient and uploads a glasses prescription the patient can see', async () => {
    const wp = await api().post('/api/admin/patients').set(auth(deskTok)).send({ phone: '9876543210', name: 'Lakshmi', relation: 'parent' });
    expect(wp.status).toBe(201);
    const rec = await api().post('/api/records').set(auth(doctorTok))
      .field('patientId', selfPatient.id).field('type', 'spectacle_rx').field('title', 'Spectacle prescription')
      .field('data', JSON.stringify({ od: { sph: -1.25, cyl: -0.5, axis: 90, va: '6/6' }, os: { sph: -1.0, va: '6/6' }, pd: 62 }))
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'rx.pdf', contentType: 'application/pdf' });
    expect(rec.status).toBe(201);
    const mine = await api().get('/api/records').set(auth(patientTok));
    expect(mine.body[0].data.od.sph).toBe(-1.25);
    const file = await api().get(`/api/records/${rec.body.id}/file`).set(auth(patientTok));
    expect(file.status).toBe(200);
    const link = await api().get(`/api/links/records/${rec.body.id}`).set(auth(patientTok));
    const signed = await api().get(new URL(link.body.url).pathname + new URL(link.body.url).search);
    expect(signed.status).toBe(200);
    expect(signed.headers['content-type']).toContain('application/pdf');
    expect((await api().get('/api/files?t=bogus')).status).toBe(401);
    expect((await api().get(`/api/links/records/${rec.body.id}`).set(auth(patient2Tok))).status).toBe(404);
    expect((await api().get(`/api/records/${rec.body.id}`).set(auth(patient2Tok))).status).toBe(404);
    expect((await api().post('/api/records').set(auth(patientTok)).field('patientId', selfPatient.id)).status).toBe(403);
    const notes = await api().get('/api/me/notifications').set(auth(patientTok));
    expect(notes.body.some((n) => n.title === 'New report available')).toBe(true);
  });
});

describe('AI helpers', () => {
  it('escalates eye emergencies', () => {
    expect(triage({ symptoms: 'Chemical splash in my eye from bleach' }).urgency).toBe('emergency');
    expect(triage({ symptoms: 'I see a curtain coming over my vision with flashes' }).urgency).toBe('emergency');
    expect(triage({ symptoms: 'sudden loss of vision in left eye' }).urgency).toBe('emergency');
  });
  it('routes to the right department', () => {
    expect(triage({ symptoms: 'cloudy blurry vision and glare at night driving', age: 68 }).department).toBe('cataract');
    expect(triage({ symptoms: 'itchy red watering eyes' }).department).toBe('cornea');
    expect(triage({ symptoms: 'want to remove my glasses, interested in lasik' }).department).toBe('refractive');
    expect(triage({ symptoms: 'blurry vision', diabetic: true }).department).toBe('retina');
    expect(triage({ symptoms: 'eyes turning inward', age: 5 }).department).toBe('pediatric');
  });
  it('chat answers FAQs and triages symptoms', async () => {
    const t = await api().post('/api/ai/chat').send({ message: 'What are your timings?' });
    expect(t.body.source).toBe('faq');
    const s = await api().post('/api/ai/chat').send({ message: 'got hit in the eye by a cricket ball' });
    expect(s.body.triage.urgency).toBe('emergency');
    const tr = await api().post('/api/ai/triage').send({ symptoms: 'floaters and diabetic', diabetic: true });
    expect(tr.body.departmentInfo.slug).toBe('retina');
  });
});

describe('account deletion (store requirement)', () => {
  it('deletes the account and blocks further access', async () => {
    const l = await login('9833333333');
    const del = await api().delete('/api/me').set(auth(l.body.accessToken));
    expect(del.status).toBe(200);
    expect((await api().get('/api/me').set(auth(l.body.accessToken))).status).toBe(401);
  });
});
