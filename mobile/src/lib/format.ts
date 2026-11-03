const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function parseDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function todayIST() {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
}

export function fmtDate(d: string, opts: { weekday?: boolean; year?: boolean } = {}) {
  const dt = parseDate(d);
  const base = `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
  const wd = opts.weekday ? `${DAYS[dt.getUTCDay()]}, ` : '';
  return `${wd}${base}${opts.year ? ` ${dt.getUTCFullYear()}` : ''}`;
}

export function relativeDay(d: string) {
  const t = todayIST();
  if (d === t) return 'Today';
  const tomorrow = new Date(parseDate(t).getTime() + 86400000).toISOString().slice(0, 10);
  if (d === tomorrow) return 'Tomorrow';
  return fmtDate(d, { weekday: true });
}

export const dayShort = (d: string) => DAYS[parseDate(d).getUTCDay()];
export const dayNum = (d: string) => parseDate(d).getUTCDate();
export const weekdayName = (n: number) => DAYS_LONG[n];

export function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export function age(dob: string | null) {
  if (!dob) return null;
  const b = parseDate(dob);
  const n = parseDate(todayIST());
  let a = n.getUTCFullYear() - b.getUTCFullYear();
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

export const initials = (name?: string | null) =>
  (name || '?').replace(/^Dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

export function signed(n?: number) {
  if (n === undefined || n === null) return '—';
  if (n === 0) return 'Plano';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`;
}
