import { useState } from 'react';
import { api } from '../api';
import { Modal, useData } from '../util';
import type { Department } from '../types';

export default function Departments() {
  const list = useData<Department[]>('/admin/departments');
  const [edit, setEdit] = useState<Department | 'new' | null>(null);
  return (
    <>
      <div className="page-head">
        <div><h1>Departments</h1><p>Specialities shown in the app's booking flow</p></div>
        <button className="btn" onClick={() => setEdit('new')}>+ Add department</button>
      </div>
      <div className="card table-card">
        <table>
          <thead><tr><th>Order</th><th>Name</th><th>Description</th><th>Status</th><th></th></tr></thead>
          <tbody>{(list.data ?? []).map((d) => (
            <tr key={d.id}>
              <td>{d.sortOrder}</td><td className="strong">{d.name}<div className="muted small">{d.slug}</div></td>
              <td className="small" style={{ maxWidth: 420 }}>{d.description}</td>
              <td>{d.isActive ? <span className="badge b-success">Active</span> : <span className="badge b-neutral">Hidden</span>}</td>
              <td><button className="btn sm outline" onClick={() => setEdit(d)}>Edit</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {edit && <Edit d={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); list.reload(); }} />}
    </>
  );
}

function Edit({ d, onClose, onDone }: { d: Department | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: d?.name ?? '', slug: d?.slug ?? '', description: d?.description ?? '', icon: d?.icon ?? 'eye', sortOrder: String(d?.sortOrder ?? 10), isActive: d?.isActive ?? true });
  const [error, setError] = useState('');
  async function save() {
    try {
      await api(d ? `/admin/departments/${d.id}` : '/admin/departments', { method: d ? 'PUT' : 'POST', body: { ...f, sortOrder: Number(f.sortOrder) } });
      onDone();
    } catch (e) { setError((e as Error).message); }
  }
  return (
    <Modal title={d ? `Edit ${d.name}` : 'Add department'} onClose={onClose}
      footer={<><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      {error && <div className="alert error">{error}</div>}
      <div className="form-grid">
        <div className="field"><label>Name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: d ? f.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} /></div>
        <div className="field"><label>Slug (URL id)</label><input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></div>
        <div className="field"><label>Display order</label><input type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></div>
      </div>
      <div className="field"><label>Description</label><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} style={{ width: 16, height: 16 }} /> Show in app</label>
    </Modal>
  );
}
