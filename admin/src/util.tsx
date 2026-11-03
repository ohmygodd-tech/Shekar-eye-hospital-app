import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';

export const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
export function fmtDate(d: string) {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
export function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

export const STATUS: Record<string, [string, string]> = {
  pending_payment: ['Payment pending', 'warning'], confirmed: ['Confirmed', 'info'], checked_in: ['Checked in', 'success'],
  completed: ['Completed', 'neutral'], cancelled: ['Cancelled', 'danger'], no_show: ['No-show', 'danger'],
};
export const PAY: Record<string, [string, string]> = {
  unpaid: ['Unpaid', 'warning'], paid: ['Paid', 'success'], refunded: ['Refunded', 'neutral'], pay_at_hospital: ['Collect at desk', 'warning'],
};
export const Badge = ({ v }: { v: [string, string] }) => <span className={`badge b-${v[1]}`}>{v[0]}</span>;

export function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try { setData(await api<T>(path)); setError(''); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head"><h2 style={{ margin: 0 }}>{title}</h2><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
}
