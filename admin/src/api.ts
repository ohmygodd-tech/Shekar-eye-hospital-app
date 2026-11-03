const BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';
const KEY = 'seh.staff';

type Stored = { accessToken: string; refreshToken: string };
let session: Stored | null = JSON.parse(sessionStorage.getItem(KEY) || 'null');
let onLogout: (() => void) | null = null;

export const auth = {
  get: () => session,
  set(s: Stored | null) { session = s; if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY); },
  onLogout(fn: () => void) { onLogout = fn; },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function refresh() {
  if (!session) return false;
  const r = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }) });
  if (!r.ok) return false;
  const d = await r.json();
  auth.set({ accessToken: d.accessToken, refreshToken: d.refreshToken });
  return true;
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method: init.method || (init.body !== undefined || init.form ? 'POST' : 'GET'),
    headers,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
  if (res.status === 401 && retry && session) {
    if (await refresh()) return api<T>(path, init, false);
    auth.set(null);
    onLogout?.();
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error?.message || 'Request failed');
  return data as T;
}

/** Open a signed file/receipt link in a new tab. */
export async function openLink(path: string) {
  const w = window.open('', '_blank');
  try {
    const { url } = await api<{ url: string }>(path);
    if (w) w.location.href = url; else window.open(url, '_blank');
  } catch (e) {
    w?.close();
    alert((e as Error).message);
  }
}
