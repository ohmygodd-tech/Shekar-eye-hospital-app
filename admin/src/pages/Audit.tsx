import { cap, fmtDateTime, useData } from '../util';

interface Log { id: number; action: string; entity: string | null; entityId: string | null; meta: unknown; ip: string | null; createdAt: string; userName: string | null; role: string | null }

export default function Audit() {
  const list = useData<Log[]>('/admin/audit');
  return (
    <>
      <div className="page-head"><div><h1>Audit log</h1><p>Latest 300 actions — logins, record views & downloads, bookings and changes</p></div></div>
      <div className="card table-card">
        <table>
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Item</th><th>IP</th></tr></thead>
          <tbody>{(list.data ?? []).map((l) => (
            <tr key={l.id}>
              <td className="small">{fmtDateTime(l.createdAt)}</td>
              <td>{l.userName || '—'}{l.role && <div className="muted small">{cap(l.role)}</div>}</td>
              <td><code>{l.action}</code></td>
              <td className="small muted">{l.entity}{l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ''}</td>
              <td className="small muted">{l.ip}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
