import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useMe } from '../App';
import { Badge, Modal, PAY, STATUS, cap, fmtDate, fmtTime, rupees, todayIST, useData, downloadCsv } from '../util';
import type { Appt, Doctor, PatientRow } from '../types';

export default function Appointments() {
  const me = useMe();
  const desk = me.user.role !== 'doctor';
  const [date, setDate] = useState(todayIST());
  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [booking, setBooking] = useState(false);
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; m: string } | null>(null);
  const params = new URLSearchParams({ ...(date && { date }), ...(doctorId && { doctorId }), ...(status && { status }), ...(q.length >= 2 && { q }) });
  const list = useData<Appt[]>(`/admin/appointments?${params}`);
  const doctors = useData<Doctor[]>(desk ? '/admin/doctors' : null);

  async function update(a: Appt, body: Record<string, string>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    try {
      await api(`/admin/appointments/${a.id}`, { method: 'PATCH', body });
      setMsg({ t: 'ok', m: `Updated ${a.patient.name}` });
      list.reload();
    } catch (e) { setMsg({ t: 'error', m: (e as Error).message }); }
  }

  const rows = list.data ?? [];
  return (
    <>
      <div className="page-head">
        <div><h1>Appointments</h1><p>{rows.length} {date ? `on ${fmtDate(date)}` : 'found'}</p></div>
        <div className="row">
          <button className="btn outline" onClick={() => downloadCsv(`appointments-${date || 'all'}.csv`, [
            ['Token', 'Date', 'Time', 'Patient', 'MRN', 'Phone', 'Doctor', 'Department', 'Status', 'Payment', 'Fee', 'Reason'],
            ...rows.map((a) => [a.tokenNo, a.date, a.startTime, a.patient.name, a.patient.mrn, a.phone, a.doctor.name, a.doctor.department, a.status, a.paymentStatus, a.feePaise / 100, a.reason]),
          ])}>Export CSV</button>
          {desk && <button className="btn" onClick={() => setBooking(true)}>+ New booking</button>}
        </div>
      </div>
      {msg && <div className={`alert ${msg.t}`} onClick={() => setMsg(null)}>{msg.m}</div>}
      <div className="filters">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        {desk && (
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} aria-label="Doctor">
            <option value="">All doctors</option>
            {doctors.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
        </select>
        <input placeholder="Search name, MRN or phone" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
        {date && <button className="btn ghost" onClick={() => setDate('')}>Show all dates</button>}
      </div>
      <div className="card table-card">
        {list.error ? <div className="alert error">{list.error}</div> : rows.length === 0 ? <div className="empty">{list.loading ? 'Loading…' : 'No appointments match these filters.'}</div> : (
          <table>
            <thead><tr><th>Token</th><th>When</th><th>Patient</th><th>Doctor</th><th>Visit</th><th>Status</th><th>Payment</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="strong">{a.tokenNo ? `#${a.tokenNo}` : '—'}</td>
                  <td>{fmtTime(a.startTime)}{!date && <div className="muted small">{fmtDate(a.date)}</div>}</td>
                  <td>
                    <Link to={`/patients/${a.patient.id}`} className="strong">{a.patient.name}</Link>
                    <div className="muted small">{a.patient.mrn}{a.phone ? ` · ${a.phone}` : ''}</div>
                    {a.reason && <div className="small" style={{ maxWidth: 260 }}>“{a.reason}”</div>}
                  </td>
                  <td>{a.doctor.name}<div className="muted small">{a.doctor.department}</div></td>
                  <td className="small">{cap(a.visitType === 'post_op' ? 'post-op' : a.visitType)}</td>
                  <td><Badge v={STATUS[a.status]} /></td>
                  <td><Badge v={PAY[a.paymentStatus]} /><div className="muted small">{rupees(a.feePaise)}</div></td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 }}>
                      {a.status === 'confirmed' && desk && (
                        <button className="btn sm" onClick={() => update(a, a.paymentStatus === 'pay_at_hospital' ? { status: 'checked_in', paymentStatus: 'paid' } : { status: 'checked_in' },
                          a.paymentStatus === 'pay_at_hospital' ? `Check in ${a.patient.name} and record ${rupees(a.feePaise)} collected at desk?` : undefined)}>
                          Check in{a.paymentStatus === 'pay_at_hospital' ? ' + collect' : ''}
                        </button>
                      )}
                      {['checked_in', 'confirmed'].includes(a.status) && (me.user.role === 'doctor' || a.status === 'checked_in') && (
                        <button className="btn sm outline" onClick={() => update(a, { status: 'completed' })}>Complete</button>
                      )}
                      {a.status === 'confirmed' && desk && <button className="btn sm outline" onClick={() => update(a, { status: 'no_show' }, 'Mark as no-show?')}>No-show</button>}
                      {['confirmed', 'pending_payment', 'checked_in'].includes(a.status) && desk && (
                        <button className="btn sm danger" onClick={() => {
                          const reason = prompt('Reason for cancellation (sent to the patient):', 'Doctor unavailable');
                          if (reason !== null) update(a, { status: 'cancelled', cancelReason: reason });
                        }}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {booking && <NewBooking doctors={doctors.data ?? []} onClose={() => setBooking(false)} onDone={(m) => { setBooking(false); setMsg({ t: 'ok', m }); list.reload(); }} />}
    </>
  );
}

function NewBooking({ doctors, onClose, onDone }: { doctors: Doctor[]; onClose: () => void; onDone: (m: string) => void }) {
  const [q, setQ] = useState('');
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayIST());
  const [slots, setSlots] = useState<{ start: string; available: boolean }[]>([]);
  const [start, setStart] = useState('');
  const [visitType, setVisitType] = useState('new');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.length < 2) { setPatients([]); return; }
    const t = setTimeout(() => api<PatientRow[]>(`/admin/patients?q=${encodeURIComponent(q)}`).then(setPatients).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setStart('');
    if (!doctorId || !date) { setSlots([]); return; }
    api<{ slots: { start: string; available: boolean }[] }>(`/doctors/${doctorId}/slots?date=${date}`).then((r) => setSlots(r.slots)).catch((e) => setError(e.message));
  }, [doctorId, date]);

  async function book() {
    setBusy(true); setError('');
    try {
      const a = await api<Appt>('/admin/appointments', { body: { patientId: patient!.id, doctorId, date, start, visitType, reason: reason || undefined } });
      onDone(`Booked ${a.patient.name} with ${a.doctor.name} at ${fmtTime(a.startTime)} — token #${a.tokenNo}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <Modal title="New booking (walk-in / phone)" onClose={onClose}
      footer={<><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn" disabled={!patient || !doctorId || !start || busy} onClick={book}>{busy ? 'Booking…' : 'Confirm booking'}</button></>}>
      {error && <div className="alert error">{error}</div>}
      <div className="field">
        <label>Patient</label>
        {patient ? (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span><b>{patient.name}</b> <span className="muted">{patient.mrn} · {patient.phone}</span></span>
            <button className="btn sm outline" onClick={() => setPatient(null)}>Change</button>
          </div>
        ) : (
          <>
            <input placeholder="Search by name, MRN or phone" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            {patients.length > 0 && (
              <div className="card" style={{ padding: 4, marginTop: 6, maxHeight: 180, overflow: 'auto' }}>
                {patients.map((p) => (
                  <div key={p.id} style={{ padding: '7px 10px', cursor: 'pointer', borderRadius: 6 }} onClick={() => setPatient(p)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f2f6f8')} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                    <b>{p.name}</b> <span className="muted small">{p.mrn} · {p.phone}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="muted small" style={{ marginTop: 6 }}>New patient? Register them first under <Link to="/patients" onClick={onClose}>Patients</Link>.</div>
          </>
        )}
      </div>
      <div className="form-grid">
        <div className="field"><label>Doctor</label>
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Select doctor</option>
            {doctors.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.name} — {d.department.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Date</label><input type="date" value={date} min={todayIST()} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      {doctorId && (
        <div className="field">
          <label>Time slot</label>
          {slots.length === 0 ? <div className="muted small">Doctor is not available on this date.</div> : (
            <div className="row wrap" style={{ gap: 6 }}>
              {slots.map((s) => (
                <button key={s.start} type="button" disabled={!s.available} className={`btn sm ${start === s.start ? '' : 'outline'}`} onClick={() => setStart(s.start)}
                  style={!s.available ? { textDecoration: 'line-through' } : undefined}>{fmtTime(s.start)}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="form-grid">
        <div className="field"><label>Visit type</label>
          <select value={visitType} onChange={(e) => setVisitType(e.target.value)}>
            <option value="new">New</option><option value="follow_up">Follow-up</option><option value="post_op">Post-op</option><option value="emergency">Emergency</option>
          </select>
        </div>
        <div className="field"><label>Reason (optional)</label><input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      </div>
      <div className="muted small">Payment will be collected at the desk on check-in.</div>
    </Modal>
  );
}
