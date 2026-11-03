import { Link } from 'react-router-dom';
import { useData, rupees, fmtTime, STATUS, Badge, todayIST } from '../util';
import { useMe } from '../App';
import type { Appt } from '../types';

interface Dash {
  today: string; todayTotal: number; waiting: number; checkedIn: number; completed: number; noShow: number;
  revenueTodayPaise: number; revenue30dPaise: number; newPatients30d: number;
  trend: { date: string; count: number }[]; byDepartment: { name: string; count: number }[];
}

export default function Dashboard() {
  const me = useMe();
  const d = useData<Dash>('/admin/dashboard');
  const queue = useData<Appt[]>(`/admin/appointments?date=${todayIST()}`);
  if (!d.data) return <div className="empty">{d.error || 'Loading…'}</div>;
  const s = d.data;
  const max = Math.max(1, ...s.trend.map((t) => t.count));
  const deptMax = Math.max(1, ...s.byDepartment.map((x) => x.count));
  const showMoney = me.user.role !== 'doctor';
  const live = (queue.data ?? []).filter((a) => ['confirmed', 'checked_in'].includes(a.status));

  return (
    <>
      <div className="page-head">
        <div><h1>Good day, {me.user.name?.split(' ')[0] || 'there'}</h1><p>Today's overview · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}</p></div>
        <Link className="btn" to="/appointments">Open today's queue</Link>
      </div>
      <div className="grid stats">
        <Stat label="Appointments today" value={s.todayTotal} />
        <Stat label="Waiting (not arrived)" value={s.waiting} />
        <Stat label="Checked in" value={s.checkedIn} />
        <Stat label="Completed" value={s.completed} hint={s.noShow ? `${s.noShow} no-show` : undefined} />
        {showMoney && <Stat label="Collected today" value={rupees(s.revenueTodayPaise)} hint={`${rupees(s.revenue30dPaise)} in 30 days`} />}
        <Stat label="New patients" value={s.newPatients30d} hint="last 30 days" />
      </div>
      <div className="grid two">
        <div className="card">
          <h2>Appointments — last 14 days</h2>
          <div className="bars">
            {s.trend.map((t) => <div key={t.date} className="bar" style={{ height: `${(t.count / max) * 100}%` }} data-tip={`${t.date}: ${t.count}`} />)}
          </div>
          <div className="bar-labels">{s.trend.map((t) => <span key={t.date}>{Number(t.date.slice(8))}</span>)}</div>
        </div>
        <div className="card">
          <h2>By speciality (30 days)</h2>
          {s.byDepartment.map((x) => (
            <div className="hbar" key={x.name}>
              <span style={{ width: 120 }} className="small">{x.name}</span>
              <div className="track"><div className="fill" style={{ width: `${(x.count / deptMax) * 100}%` }} /></div>
              <span className="small strong" style={{ width: 24, textAlign: 'right' }}>{x.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card table-card" style={{ marginTop: 16 }}>
        <div style={{ padding: '16px 18px 4px' }}><h2>Live queue</h2></div>
        {live.length === 0 ? <div className="empty">No patients waiting right now.</div> : (
          <table>
            <thead><tr><th>Token</th><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th></tr></thead>
            <tbody>
              {live.map((a) => (
                <tr key={a.id}>
                  <td className="strong">#{a.tokenNo ?? '—'}</td>
                  <td>{fmtTime(a.startTime)}</td>
                  <td><Link to={`/patients/${a.patient.id}`}>{a.patient.name}</Link> <span className="muted small">{a.patient.mrn}</span></td>
                  <td>{a.doctor.name}<div className="muted small">{a.doctor.department}</div></td>
                  <td><Badge v={STATUS[a.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="card stat"><div className="label">{label}</div><div className="value">{value}</div>{hint && <div className="hint">{hint}</div>}</div>;
}
