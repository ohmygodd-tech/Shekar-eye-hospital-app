import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useMe } from '../App';
import { Modal, cap, fmtDate, useData } from '../util';
import type { PatientRow } from '../types';

export default function Patients() {
  const me = useMe();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const list = useData<PatientRow[]>(`/admin/patients${q.length >= 2 ? `?q=${encodeURIComponent(q)}` : ''}`);
  const nav = useNavigate();
  return (
    <>
      <div className="page-head">
        <div><h1>Patients</h1><p>Search by name, patient ID (MRN) or mobile number</p></div>
        {me.user.role !== 'doctor' && <button className="btn" onClick={() => setAdding(true)}>+ Register patient</button>}
      </div>
      <div className="filters"><input placeholder="Search patients…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 320 }} autoFocus /></div>
      <div className="card table-card">
        {(list.data ?? []).length === 0 ? <div className="empty">{list.loading ? 'Loading…' : 'No patients found.'}</div> : (
          <table>
            <thead><tr><th>Patient ID</th><th>Name</th><th>Age / Gender</th><th>Mobile (account)</th><th>Relation</th><th>Last visit</th><th>Registered</th></tr></thead>
            <tbody>
              {list.data!.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/patients/${p.id}`)}>
                  <td className="strong">{p.mrn}</td>
                  <td><Link to={`/patients/${p.id}`}>{p.name}</Link></td>
                  <td>{p.dob ? `${age(p.dob)} y` : '—'}{p.gender ? ` · ${cap(p.gender)}` : ''}</td>
                  <td>{p.phone}</td>
                  <td>{cap(p.relation)}</td>
                  <td>{p.lastVisit ? fmtDate(p.lastVisit) : '—'}</td>
                  <td className="muted">{fmtDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {adding && <Register onClose={() => setAdding(false)} onDone={(id) => nav(`/patients/${id}`)} />}
    </>
  );
}

export function age(dob: string) {
  const b = new Date(dob), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
}

function Register({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [f, setF] = useState({ phone: '', name: '', relation: 'self', dob: '', gender: '', medicalHistory: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true); setError('');
    try {
      const p = await api<{ id: string }>('/admin/patients', { body: { ...f, dob: f.dob || undefined, gender: f.gender || undefined, medicalHistory: f.medicalHistory || undefined } });
      onDone(p.id);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title="Register patient" onClose={onClose}
      footer={<><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn" onClick={save} disabled={busy || f.phone.length < 10 || f.name.length < 2}>{busy ? 'Saving…' : 'Register'}</button></>}>
      {error && <div className="alert error">{error}</div>}
      <p className="muted small" style={{ marginTop: 0 }}>The patient (or the family member who manages their account) can log in to the mobile app with this number to see appointments and reports.</p>
      <div className="form-grid">
        <div className="field"><label>Mobile number</label><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10 digits" /></div>
        <div className="field"><label>Full name</label><input value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>Relation to number owner</label>
          <select value={f.relation} onChange={set('relation')}>{['self', 'spouse', 'child', 'parent', 'sibling', 'other'].map((r) => <option key={r} value={r}>{cap(r)}</option>)}</select>
        </div>
        <div className="field"><label>Date of birth</label><input type="date" value={f.dob} onChange={set('dob')} /></div>
        <div className="field"><label>Gender</label>
          <select value={f.gender} onChange={set('gender')}><option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select>
        </div>
      </div>
      <div className="field"><label>Medical history</label><input value={f.medicalHistory} onChange={set('medicalHistory')} placeholder="e.g. Diabetes, High BP" /></div>
    </Modal>
  );
}
