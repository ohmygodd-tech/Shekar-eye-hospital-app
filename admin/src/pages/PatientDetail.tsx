import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, openLink } from '../api';
import { useMe } from '../App';
import { Badge, Modal, PAY, STATUS, cap, fmtDate, fmtDateTime, fmtTime, useData } from '../util';
import { age } from './Patients';
import type { Appt, Rec } from '../types';

interface Detail {
  id: string; mrn: string; name: string; relation: string; dob: string | null; gender: string | null; bloodGroup: string | null;
  allergies: string | null; medicalHistory: string | null; wearsGlasses: boolean | null; phone: string; accountName: string | null; appointments: Appt[];
}

const TYPES: [string, string][] = [['eye_test', 'Eye test'], ['spectacle_rx', 'Glasses prescription'], ['prescription', 'Prescription (medicines)'], ['lab_report', 'Lab report'], ['scan', 'Scan (OCT / fundus / etc.)'], ['discharge_summary', 'Discharge summary'], ['other', 'Other document']];
const typeLabel = (t: string) => TYPES.find((x) => x[0] === t)?.[1] ?? t;

export default function PatientDetail() {
  const { id } = useParams();
  const me = useMe();
  const p = useData<Detail>(`/admin/patients/${id}`);
  const recs = useData<Rec[]>(`/records?patientId=${id}`);
  const [tab, setTab] = useState<'visits' | 'records'>('visits');
  const [upload, setUpload] = useState(false);
  const [view, setView] = useState<Rec | null>(null);

  if (!p.data) return <div className="empty">{p.error || 'Loading…'}</div>;
  const d = p.data;
  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted small"><Link to="/patients">Patients</Link> / {d.mrn}</div>
          <h1>{d.name}</h1>
          <p>{d.mrn} · {d.dob ? `${age(d.dob)} years` : 'Age not recorded'}{d.gender ? ` · ${cap(d.gender)}` : ''} · {d.phone}{d.relation !== 'self' ? ` (${cap(d.relation)} of ${d.accountName || 'account holder'})` : ''}</p>
        </div>
        <button className="btn" onClick={() => setUpload(true)}>+ Add record / report</button>
      </div>
      <div className="grid stats">
        <Info label="Medical history" value={d.medicalHistory || 'None recorded'} />
        <Info label="Allergies" value={d.allergies || 'None recorded'} warn={!!d.allergies} />
        <Info label="Glasses / lenses" value={d.wearsGlasses === null ? '—' : d.wearsGlasses ? 'Yes' : 'No'} />
        <Info label="Visits" value={String(d.appointments.filter((a) => a.status === 'completed').length)} />
      </div>
      <div className="tabs">
        <button className={tab === 'visits' ? 'on' : ''} onClick={() => setTab('visits')}>Appointments ({d.appointments.length})</button>
        <button className={tab === 'records' ? 'on' : ''} onClick={() => setTab('records')}>Records ({recs.data?.length ?? 0})</button>
      </div>
      {tab === 'visits' ? (
        <div className="card table-card">
          {d.appointments.length === 0 ? <div className="empty">No appointments yet.</div> : (
            <table>
              <thead><tr><th>Date</th><th>Doctor</th><th>Visit</th><th>Status</th><th>Payment</th><th>Reason</th></tr></thead>
              <tbody>{d.appointments.map((a) => (
                <tr key={a.id}><td>{fmtDate(a.date)} <span className="muted small">{fmtTime(a.startTime)}</span></td><td>{a.doctor.name}<div className="muted small">{a.doctor.department}</div></td>
                  <td>{cap(a.visitType)}</td><td><Badge v={STATUS[a.status]} /></td><td><Badge v={PAY[a.paymentStatus]} /></td><td className="small">{a.reason || '—'}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card table-card">
          {(recs.data ?? []).length === 0 ? <div className="empty">No records yet. Add eye test results, glasses prescriptions or reports — the patient is notified in the app.</div> : (
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Title</th><th>By</th><th style={{ textAlign: 'right' }}></th></tr></thead>
              <tbody>{recs.data!.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDateTime(r.createdAt)}</td><td>{typeLabel(r.type)}</td><td className="strong">{r.title}</td><td className="muted">{r.uploadedBy || '—'}</td>
                  <td><div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn sm outline" onClick={() => setView(r)}>View</button>
                    {r.hasFile && <button className="btn sm outline" onClick={() => openLink(`/links/records/${r.id}`)}>File</button>}
                    {me.user.role !== 'receptionist' && <button className="btn sm danger" onClick={async () => { if (confirm('Delete this record?')) { await api(`/records/${r.id}`, { method: 'DELETE' }); recs.reload(); } }}>Delete</button>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
      {upload && <UploadRecord patientId={d.id} appointments={d.appointments} onClose={() => setUpload(false)} onDone={() => { setUpload(false); setTab('records'); recs.reload(); }} />}
      {view && (
        <Modal title={view.title} onClose={() => setView(null)}>
          <div className="muted small" style={{ marginBottom: 12 }}>{typeLabel(view.type)} · {fmtDateTime(view.createdAt)}</div>
          {(view.data?.od || view.data?.os) && <RxTable od={view.data.od} os={view.data.os} />}
          {view.data?.pd && <p>PD: {view.data.pd} mm</p>}
          {view.data?.diagnosis && <p><b>Diagnosis:</b> {view.data.diagnosis}</p>}
          {view.data?.medicines?.length > 0 && <ul>{view.data.medicines.map((m: any, i: number) => <li key={i}>{m.name} {m.eye && `(${m.eye})`} — {[m.dose, m.frequency, m.duration].filter(Boolean).join(', ')}</li>)}</ul>}
          {view.data?.followUpDate && <p><b>Follow-up:</b> {fmtDate(view.data.followUpDate)}</p>}
          {view.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{view.notes}</p>}
        </Modal>
      )}
    </>
  );
}

function Info({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return <div className="card stat"><div className="label">{label}</div><div className="strong" style={{ marginTop: 6, color: warn ? 'var(--danger)' : undefined }}>{value}</div></div>;
}

const fmt = (n?: number) => (n === undefined || n === null ? '—' : n === 0 ? 'Plano' : `${n > 0 ? '+' : ''}${Number(n).toFixed(2)}`);
function RxTable({ od, os }: { od?: any; os?: any }) {
  return (
    <div className="rx"><table>
      <thead><tr><th>Eye</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th><th>VA</th><th>IOP</th></tr></thead>
      <tbody>{[['Right (OD)', od], ['Left (OS)', os]].map(([l, e]) => (
        <tr key={l}><td className="strong">{l}</td><td>{fmt(e?.sph)}</td><td>{e?.cyl !== undefined ? fmt(e.cyl) : '—'}</td><td>{e?.axis ?? '—'}</td><td>{e?.add !== undefined ? fmt(e.add) : '—'}</td><td>{e?.va ?? '—'}</td><td>{e?.iop ?? '—'}</td></tr>
      ))}</tbody>
    </table></div>
  );
}

type Eye = { sph: string; cyl: string; axis: string; add: string; va: string; iop: string };
const emptyEye: Eye = { sph: '', cyl: '', axis: '', add: '', va: '', iop: '' };

function UploadRecord({ patientId, appointments, onClose, onDone }: { patientId: string; appointments: Appt[]; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState('spectacle_rx');
  const [title, setTitle] = useState('Glasses prescription');
  const [appointmentId, setAppointmentId] = useState(appointments.find((a) => ['checked_in', 'completed'].includes(a.status))?.id ?? '');
  const [od, setOd] = useState<Eye>(emptyEye);
  const [os, setOs] = useState<Eye>(emptyEye);
  const [pd, setPd] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [meds, setMeds] = useState([{ name: '', eye: 'both', dose: '', frequency: '', duration: '' }]);
  const [followUp, setFollowUp] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const showRx = type === 'spectacle_rx' || type === 'eye_test';
  const showMeds = type === 'prescription';

  function eyeData(e: Eye) {
    const o: Record<string, number | string> = {};
    for (const k of ['sph', 'cyl', 'add', 'iop'] as const) if (e[k] !== '') o[k] = Number(e[k]);
    if (e.axis !== '') o.axis = parseInt(e.axis, 10);
    if (e.va) o.va = e.va;
    return Object.keys(o).length ? o : undefined;
  }

  async function save() {
    setError('');
    const data: Record<string, unknown> = {};
    if (showRx) { const a = eyeData(od), b = eyeData(os); if (a) data.od = a; if (b) data.os = b; if (pd) data.pd = Number(pd); }
    if (showMeds) { const m = meds.filter((x) => x.name.trim()); if (m.length) data.medicines = m; }
    if (diagnosis) data.diagnosis = diagnosis;
    if (followUp) data.followUpDate = followUp;
    const fd = new FormData();
    fd.append('patientId', patientId); fd.append('type', type); fd.append('title', title);
    if (appointmentId) fd.append('appointmentId', appointmentId);
    if (notes) fd.append('notes', notes);
    if (Object.keys(data).length) fd.append('data', JSON.stringify(data));
    if (file) fd.append('file', file);
    setBusy(true);
    try { await api('/records', { form: fd }); onDone(); } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const eyeRow = (label: string, e: Eye, set: (e: Eye) => void) => (
    <tr><td className="strong small">{label}</td>
      {(['sph', 'cyl', 'axis', 'add', 'va', 'iop'] as const).map((k) => (
        <td key={k}><input value={e[k]} onChange={(ev) => set({ ...e, [k]: ev.target.value })} placeholder={k === 'va' ? '6/6' : k === 'axis' ? '0–180' : k === 'iop' ? 'mmHg' : '±0.00'} /></td>
      ))}
    </tr>
  );

  return (
    <Modal title="Add record" onClose={onClose}
      footer={<><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn" onClick={save} disabled={busy || title.length < 2}>{busy ? 'Saving…' : 'Save & notify patient'}</button></>}>
      {error && <div className="alert error">{error}</div>}
      <div className="form-grid">
        <div className="field"><label>Type</label>
          <select value={type} onChange={(e) => { setType(e.target.value); setTitle(TYPES.find((t) => t[0] === e.target.value)![1]); }}>
            {TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>Linked visit</label>
          <select value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
            <option value="">— None —</option>
            {appointments.slice(0, 10).map((a) => <option key={a.id} value={a.id}>{fmtDate(a.date)} · {a.doctor.name}</option>)}
          </select>
        </div>
      </div>
      {showRx && (
        <>
          <label>Refraction / measurements</label>
          <div className="rx"><table>
            <thead><tr><th></th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th><th>VA</th><th>IOP</th></tr></thead>
            <tbody>{eyeRow('Right (OD)', od, setOd)}{eyeRow('Left (OS)', os, setOs)}</tbody>
          </table></div>
          <div className="form-grid"><div className="field"><label>PD (mm)</label><input value={pd} onChange={(e) => setPd(e.target.value)} placeholder="e.g. 62" /></div></div>
        </>
      )}
      {showMeds && (
        <div className="field">
          <label>Medicines</label>
          {meds.map((m, i) => (
            <div className="row" key={i} style={{ marginBottom: 6 }}>
              <input placeholder="Medicine / eye drop" value={m.name} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} style={{ flex: 2 }} />
              <select value={m.eye} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, eye: e.target.value } : x)))} style={{ width: 100 }}>
                <option value="both">Both</option><option value="right">Right</option><option value="left">Left</option>
              </select>
              <input placeholder="Dose" value={m.dose} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, dose: e.target.value } : x)))} />
              <input placeholder="Frequency" value={m.frequency} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, frequency: e.target.value } : x)))} />
              <input placeholder="Duration" value={m.duration} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))} />
            </div>
          ))}
          <button type="button" className="btn sm ghost" onClick={() => setMeds([...meds, { name: '', eye: 'both', dose: '', frequency: '', duration: '' }])}>+ Add medicine</button>
        </div>
      )}
      <div className="form-grid">
        <div className="field"><label>Diagnosis (optional)</label><input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div>
        <div className="field"><label>Follow-up date (optional)</label><input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></div>
      </div>
      <div className="field"><label>Notes / advice</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="field"><label>Attach file (PDF, JPG, PNG — max 15 MB)</label><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ paddingTop: 7 }} /></div>
    </Modal>
  );
}
