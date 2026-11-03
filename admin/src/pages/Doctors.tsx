import { useState } from 'react';
import { api } from '../api';
import { useMe } from '../App';
import { Modal, fmtDate, fmtTime, rupees, todayIST, useData } from '../util';
import type { Department, Doctor } from '../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Doctors() {
  const me = useMe();
  const admin = me.user.role === 'admin';
  const docs = useData<Doctor[]>('/admin/doctors');
  const depts = useData<Department[]>('/admin/departments');
  const [edit, setEdit] = useState<Doctor | 'new' | null>(null);
  const [sched, setSched] = useState<Doctor | null>(null);
  const [leave, setLeave] = useState<Doctor | null>(null);

  return (
    <>
      <div className="page-head">
        <div><h1>Doctors & schedules</h1><p>Profiles shown in the patient app, OPD timings and leave</p></div>
        {admin && <button className="btn" onClick={() => setEdit('new')}>+ Add doctor</button>}
      </div>
      <div className="card table-card">
        <table>
          <thead><tr><th>Doctor</th><th>Speciality</th><th>Fee</th><th>OPD schedule</th><th>Upcoming leave</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(docs.data ?? []).map((d) => (
              <tr key={d.id}>
                <td><div className="strong">{d.name}</div><div className="muted small">{d.qualification}{d.phone ? ` · login ${d.phone}` : ''}</div></td>
                <td>{d.department.name}</td>
                <td>{rupees(d.feePaise)}</td>
                <td className="small">{summarise(d.schedule) || <span className="muted">Not set</span>}</td>
                <td className="small">{d.leaves.length ? d.leaves.slice(0, 3).map((l) => fmtDate(l.date)).join(', ') : '—'}</td>
                <td>{d.isActive ? <span className="badge b-success">Active</span> : <span className="badge b-neutral">Hidden</span>}</td>
                <td><div className="row" style={{ justifyContent: 'flex-end' }}>
                  {admin && <button className="btn sm outline" onClick={() => setEdit(d)}>Edit</button>}
                  {admin && <button className="btn sm outline" onClick={() => setSched(d)}>Schedule</button>}
                  <button className="btn sm outline" onClick={() => setLeave(d)}>Leave</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <EditDoctor doctor={edit === 'new' ? null : edit} depts={depts.data ?? []} onClose={() => setEdit(null)} onDone={() => { setEdit(null); docs.reload(); }} />}
      {sched && <EditSchedule doctor={sched} onClose={() => setSched(null)} onDone={() => { setSched(null); docs.reload(); }} />}
      {leave && <Leave doctor={leave} onClose={() => { setLeave(null); docs.reload(); }} />}
    </>
  );
}

function summarise(s: Doctor['schedule']) {
  const byTime = new Map<string, number[]>();
  for (const x of s) { const k = `${fmtTime(x.start)}–${fmtTime(x.end)}`; byTime.set(k, [...(byTime.get(k) ?? []), x.weekday]); }
  return [...byTime].map(([t, days]) => `${days.map((d) => DAYS[d]).join(', ')}: ${t}`).join(' · ');
}

function EditDoctor({ doctor, depts, onClose, onDone }: { doctor: Doctor | null; depts: Department[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    name: doctor?.name ?? '', departmentId: doctor?.department.id ?? depts[0]?.id ?? '', qualification: doctor?.qualification ?? '',
    experienceYears: String(doctor?.experienceYears ?? ''), languages: doctor?.languages.join(', ') ?? 'English, Kannada',
    bio: doctor?.bio ?? '', photoUrl: doctor?.photoUrl ?? '', fee: String((doctor?.feePaise ?? 50000) / 100), isActive: doctor?.isActive ?? true,
    phone: doctor?.phone?.replace('+91', '') ?? '',
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setError('');
    const body = {
      name: f.name, departmentId: f.departmentId, qualification: f.qualification || undefined,
      experienceYears: f.experienceYears ? Number(f.experienceYears) : undefined,
      languages: f.languages.split(',').map((x) => x.trim()).filter(Boolean), bio: f.bio || undefined, photoUrl: f.photoUrl || '',
      feePaise: Math.round(Number(f.fee) * 100), isActive: f.isActive, phone: f.phone || '',
    };
    try { await api(doctor ? `/admin/doctors/${doctor.id}` : '/admin/doctors', { method: doctor ? 'PUT' : 'POST', body }); onDone(); } catch (e) { setError((e as Error).message); }
  }
  return (
    <Modal title={doctor ? `Edit ${doctor.name}` : 'Add doctor'} onClose={onClose}
      footer={<><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      {error && <div className="alert error">{error}</div>}
      <div className="form-grid">
        <div className="field"><label>Full name</label><input value={f.name} onChange={set('name')} placeholder="Dr. …" /></div>
        <div className="field"><label>Speciality</label><select value={f.departmentId} onChange={set('departmentId')}>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="field"><label>Qualifications</label><input value={f.qualification} onChange={set('qualification')} placeholder="MBBS, MS (Ophth)" /></div>
        <div className="field"><label>Experience (years)</label><input type="number" value={f.experienceYears} onChange={set('experienceYears')} /></div>
        <div className="field"><label>Consultation fee (₹)</label><input type="number" value={f.fee} onChange={set('fee')} /></div>
        <div className="field"><label>Login mobile (optional)</label><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="Doctor's 10-digit number" /></div>
      </div>
      <div className="field"><label>Languages (comma separated)</label><input value={f.languages} onChange={set('languages')} /></div>
      <div className="field"><label>Photo URL (optional)</label><input value={f.photoUrl} onChange={set('photoUrl')} placeholder="https://…" /></div>
      <div className="field"><label>Biography</label><textarea value={f.bio} onChange={set('bio')} /></div>
      <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} style={{ width: 16, height: 16 }} /> Visible in the patient app & bookable</label>
    </Modal>
  );
}

type Row = { weekday: number; start: string; end: string; slotMinutes: number };
function EditSchedule({ doctor, onClose, onDone }: { doctor: Doctor; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>(doctor.schedule.length ? doctor.schedule : [{ weekday: 1, start: '09:30', end: '13:00', slotMinutes: 15 }]);
  const [error, setError] = useState('');
  const upd = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: k === 'start' || k === 'end' ? v : Number(v) } : r)));
  async function save() {
    try { await api(`/admin/doctors/${doctor.id}/schedule`, { method: 'PUT', body: { schedule: rows } }); onDone(); } catch (e) { setError((e as Error).message); }
  }
  return (
    <Modal title={`OPD schedule — ${doctor.name}`} onClose={onClose}
      footer={<><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save schedule</button></>}>
      {error && <div className="alert error">{error}</div>}
      <p className="muted small" style={{ marginTop: 0 }}>Add one row per session (e.g. morning and evening). Changes apply to new bookings; existing appointments are not moved.</p>
      <table>
        <thead><tr><th>Day</th><th>From</th><th>To</th><th>Slot (min)</th><th></th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>
            <td><select value={r.weekday} onChange={(e) => upd(i, 'weekday', e.target.value)}>{DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}</select></td>
            <td><input type="time" value={r.start} onChange={(e) => upd(i, 'start', e.target.value)} /></td>
            <td><input type="time" value={r.end} onChange={(e) => upd(i, 'end', e.target.value)} /></td>
            <td><input type="number" value={r.slotMinutes} min={5} max={120} onChange={(e) => upd(i, 'slotMinutes', e.target.value)} /></td>
            <td><button className="btn sm danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button></td>
          </tr>
        ))}</tbody>
      </table>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn sm outline" onClick={() => setRows([...rows, { ...(rows[rows.length - 1] ?? { start: '09:30', end: '13:00', slotMinutes: 15 }), weekday: ((rows[rows.length - 1]?.weekday ?? 0) + 1) % 7 }])}>+ Add session</button>
        <button className="btn sm ghost" onClick={() => {
          const base = rows.filter((r) => r.weekday === 1);
          if (!base.length) return;
          setRows([...rows.filter((r) => r.weekday === 0), ...[1, 2, 3, 4, 5, 6].flatMap((d) => base.map((b) => ({ ...b, weekday: d })))]);
        }}>Copy Monday to Mon–Sat</button>
      </div>
    </Modal>
  );
}

function Leave({ doctor, onClose }: { doctor: Doctor; onClose: () => void }) {
  const [date, setDate] = useState(todayIST());
  const [reason, setReason] = useState('');
  const [leaves, setLeaves] = useState(doctor.leaves);
  const [msg, setMsg] = useState('');
  async function add() {
    const r = await api<{ existingAppointments: number }>(`/admin/doctors/${doctor.id}/leaves`, { body: { date, reason: reason || undefined } });
    setLeaves([...leaves, { date, reason }].sort((a, b) => a.date.localeCompare(b.date)));
    setMsg(r.existingAppointments ? `⚠ ${r.existingAppointments} appointment(s) already booked on ${fmtDate(date)} — please cancel or reschedule them from Appointments.` : 'Leave added. No new bookings will be accepted for that day.');
  }
  async function remove(d: string) {
    await api(`/admin/doctors/${doctor.id}/leaves/${d}`, { method: 'DELETE' });
    setLeaves(leaves.filter((l) => l.date !== d));
  }
  return (
    <Modal title={`Leave — ${doctor.name}`} onClose={onClose}>
      {msg && <div className={`alert ${msg.startsWith('⚠') ? 'warn' : 'ok'}`}>{msg}</div>}
      <div className="row" style={{ marginBottom: 16 }}>
        <input type="date" value={date} min={todayIST()} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} />
        <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn" onClick={add}>Add leave</button>
      </div>
      {leaves.length === 0 ? <div className="muted">No upcoming leave.</div> : leaves.map((l) => (
        <div key={l.date} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span><b>{fmtDate(l.date)}</b> <span className="muted">{l.reason}</span></span>
          <button className="btn sm danger" onClick={() => remove(l.date)}>Remove</button>
        </div>
      ))}
    </Modal>
  );
}
