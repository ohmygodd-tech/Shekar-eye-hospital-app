// All scheduling is in hospital local time (Asia/Kolkata, UTC+5:30, no DST).
const IST_OFFSET_MIN = 330;

/** Current date/time in IST as { date: 'YYYY-MM-DD', minutes: minutes since midnight }. */
export function nowIST(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60000);
  return {
    date: ist.toISOString().slice(0, 10),
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

export const toMinutes = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};
export const fromMinutes = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const weekday = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();

/** Absolute JS Date for an IST date + 'HH:MM'. */
export function istToDate(dateStr, time) {
  return new Date(new Date(`${dateStr}T${time.slice(0, 5)}:00Z`).getTime() - IST_OFFSET_MIN * 60000);
}

export const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
