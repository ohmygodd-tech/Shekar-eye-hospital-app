import { useState } from 'react';
import { api } from '../api';
import { useMe } from '../App';
import { cap, fmtDate, useData } from '../util';

interface StaffUser { id: string; phone: string; name: string | null; role: string; isActive: boolean; createdAt: string }

export default function Staff() {
  const me = useMe();
  const list = useData<StaffUser[]>('/admin/staff');
  const [f, setF] = useState({ phone: '', name: '', role: 'receptionist' });
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);

  async function add() {
    try {
      await api('/admin/staff', { body: f });
      setMsg({ t: 'ok', m: `${f.name} can now log in to the staff portal with ${f.phone}.` });
      setF({ phone: '', name: '', role: 'receptionist' });
      list.reload();
    } catch (e) { setMsg({ t: 'error', m: (e as Error).message }); }
  }
  async function toggle(u: StaffUser) {
    try { await api(`/admin/staff/${u.id}`, { method: 'PATCH', body: { isActive: !u.isActive } }); list.reload(); } catch (e) { setMsg({ t: 'error', m: (e as Error).message }); }
  }

  return (
    <>
      <div className="page-head"><div><h1>Staff access</h1><p>Who can log in to this portal. Doctors get access from Doctors → Edit → Login mobile.</p></div></div>
      {msg && <div className={`alert ${msg.t}`}>{msg.m}</div>}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Add staff member</h2>
        <div className="row wrap">
          <input placeholder="Mobile (10 digits)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} style={{ width: 180 }} />
          <input placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={{ width: 220 }} />
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} style={{ width: 180 }}>
            <option value="receptionist">Front desk</option><option value="admin">Administrator</option>
          </select>
          <button className="btn" onClick={add} disabled={f.phone.length !== 10 || f.name.length < 2}>Grant access</button>
        </div>
      </div>
      <div className="card table-card">
        <table>
          <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>Added</th><th>Status</th><th></th></tr></thead>
          <tbody>{(list.data ?? []).map((u) => (
            <tr key={u.id}>
              <td className="strong">{u.name || '—'}</td><td>{u.phone}</td><td>{u.role === 'receptionist' ? 'Front desk' : cap(u.role)}</td><td className="muted">{fmtDate(u.createdAt)}</td>
              <td>{u.isActive ? <span className="badge b-success">Active</span> : <span className="badge b-neutral">Disabled</span>}</td>
              <td>{u.id !== me.user.id && <button className={`btn sm ${u.isActive ? 'danger' : 'outline'}`} onClick={() => toggle(u)}>{u.isActive ? 'Disable' : 'Enable'}</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
