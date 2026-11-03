import Constants from 'expo-constants';
import * as SecureStoreNative from 'expo-secure-store';
import { Platform } from 'react-native';

// Secure storage on phones; localStorage fallback for the web build (patient portal / testing).
const SecureStore = Platform.OS === 'web' ? {
  getItemAsync: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
  setItemAsync: async (k: string, v: string) => { globalThis.localStorage?.setItem(k, v); },
  deleteItemAsync: async (k: string) => { globalThis.localStorage?.removeItem(k); },
} : SecureStoreNative;

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string) || 'http://localhost:4000/api';

const ACCESS = 'seh.access';
const REFRESH = 'seh.refresh';

let accessToken: string | null = null;
let onLoggedOut: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export const tokens = {
  async load() {
    accessToken = await SecureStore.getItemAsync(ACCESS);
    return { access: accessToken, refresh: await SecureStore.getItemAsync(REFRESH) };
  },
  async save(access: string, refresh: string) {
    accessToken = access;
    await SecureStore.setItemAsync(ACCESS, access);
    await SecureStore.setItemAsync(REFRESH, refresh);
  },
  async clear() {
    accessToken = null;
    await SecureStore.deleteItemAsync(ACCESS);
    await SecureStore.deleteItemAsync(REFRESH);
  },
  refreshToken: () => SecureStore.getItemAsync(REFRESH),
  setLogoutHandler(fn: () => void) { onLoggedOut = fn; },
};

async function refresh(): Promise<boolean> {
  const rt = await SecureStore.getItemAsync(REFRESH);
  if (!rt) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    await tokens.save(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

type Opts = { method?: string; body?: unknown; auth?: boolean };

export async function api<T = any>(path: string, opts: Opts = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken && opts.auth !== false) headers.Authorization = `Bearer ${accessToken}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No internet connection. Please check your network and try again.', 'network');
  }
  if (res.status === 401 && !retried && opts.auth !== false && accessToken) {
    refreshing ??= refresh().finally(() => { refreshing = null; });
    if (await refreshing) return api<T>(path, opts, true);
    await tokens.clear();
    onLoggedOut?.();
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error?.message || 'Something went wrong. Please try again.', data?.error?.code);
  return data as T;
}

function safeJson(t: string) {
  try { return JSON.parse(t); } catch { return { error: { message: t.slice(0, 200) } }; }
}
