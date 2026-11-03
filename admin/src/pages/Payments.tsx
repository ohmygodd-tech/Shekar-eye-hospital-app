import { useState } from 'react';
import { openLink } from '../api';
import { downloadCsv, fmtDate, fmtDateTime, rupees, todayIST, useData } from '../util';

interface Pay {
  id: string; amountPaise: number; status: 'paid' | 'refunded'; provider: string; receiptNo: string; providerPaymentId: string | null;
  paidAt: string; patientName: string; mrn: string; doctorName: string; appointmentDate: string;
}

export default function Payments() {
  const [from, setFrom] = useState(todayIST().slice(0, 8) + '01');
  const [to, setTo] = useState(todayIST());
  const list = useData<Pay[]>(`/admin/payments?from=${from}&to=${to}`);
  const rows = list.data ?? [];
  const paid = rows.filter((r) => r.status === 'paid');
  const sum = (xs: Pay[]) => xs.reduce((a, b) => a + b.amountPaise, 0);
  const online = paid.filter((p) => p.provider !== 'cash');
  return (
    <>
      <div className="page-head">
        <div><h1>Payments</h1><p>Online (Razorpay) and counter collections</p></div>
        <button className="btn outline" onClick={() => downloadCsv(`payments-${from}-to-${to}.csv`, [
          ['Receipt', 'Paid at', 'Patient', 'MRN', 'Doctor', 'Appointment', 'Mode', 'Amount', 'Status', 'Gateway ID'],
          ...rows.map((r) => [r.receiptNo, r.paidAt, r.patientName, r.mrn, r.doctorName, r.appointmentDate, r.provider, r.amountPaise / 100, r.status, r.providerPaymentId]),
        ])}>Export CSV</button>
      </div>
      <div className="filters">
        <label className="row" style={{ margin: 0 }}>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="row" style={{ margin: 0 }}>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="grid stats">
        <div className="card stat"><div className="label">Total collected</div><div className="value">{rupees(sum(paid))}</div><div className="hint">{paid.length} payments</div></div>
        <div className="card stat"><div className="label">Online</div><div className="value">{rupees(sum(online))}</div></div>
        <div className="card stat"><div className="label">At counter</div><div className="value">{rupees(sum(paid) - sum(online))}</div></div>
        <div className="card stat"><div className="label">Refunded</div><div className="value">{rupees(sum(rows.filter((r) => r.status === 'refunded')))}</div></div>
      </div>
      <div className="card table-card">
        {rows.length === 0 ? <div className="empty">{list.loading ? 'Loading…' : 'No payments in this period.'}</div> : (
          <table>
            <thead><tr><th>Receipt</th><th>Paid at</th><th>Patient</th><th>Doctor</th><th>Mode</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td className="strong">{r.receiptNo}</td><td>{r.paidAt ? fmtDateTime(r.paidAt) : '—'}</td>
                <td>{r.patientName}<div className="muted small">{r.mrn}</div></td>
                <td>{r.doctorName}<div className="muted small">Visit {fmtDate(r.appointmentDate)}</div></td>
                <td>{r.provider === 'cash' ? 'Counter' : r.provider === 'razorpay' ? 'Online' : 'Test'}</td>
                <td className="strong">{rupees(r.amountPaise)}</td>
                <td><span className={`badge ${r.status === 'paid' ? 'b-success' : 'b-neutral'}`}>{r.status === 'paid' ? 'Paid' : 'Refunded'}</span></td>
                <td><button className="btn sm outline" onClick={() => openLink(`/links/receipts/${r.id}`)}>Receipt</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
