import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokens } from './api';
import type { Hospital, Patient, User } from './types';
import { registerForPush } from './push';

interface Session {
  ready: boolean;
  user: User | null;
  patients: Patient[];
  unread: number;
  hospital: Hospital | null;
  signIn: (accessToken: string, refreshToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<Session>(null as unknown as Session);
export const useSession = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [unread, setUnread] = useState(0);
  const [hospital, setHospital] = useState<Hospital | null>(null);

  const reload = useCallback(async () => {
    const me = await api<{ user: User; patients: Patient[]; unreadNotifications: number }>('/me');
    setUser(me.user);
    setPatients(me.patients);
    setUnread(me.unreadNotifications);
  }, []);

  const clear = useCallback(() => { setUser(null); setPatients([]); setUnread(0); }, []);

  useEffect(() => {
    tokens.setLogoutHandler(clear);
    (async () => {
      api<Hospital>('/hospital', { auth: false }).then(setHospital).catch(() => {});
      const t = await tokens.load();
      if (t.access) {
        try { await reload(); } catch { /* token invalid/offline — show login */ }
      }
      setReady(true);
    })();
  }, [reload, clear]);

  // Register for push once logged in.
  useEffect(() => {
    if (!user) return;
    registerForPush().then((token) => { if (token) api('/me', { method: 'PATCH', body: { pushToken: token } }).catch(() => {}); });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (access: string, refresh: string) => {
    await tokens.save(access, refresh);
    await reload();
  }, [reload]);

  const signOut = useCallback(async () => {
    const refreshToken = await tokens.refreshToken();
    await api('/auth/logout', { body: { refreshToken } }).catch(() => {});
    await tokens.clear();
    clear();
  }, [clear]);

  const value = useMemo(() => ({ ready, user, patients, unread, hospital, signIn, signOut, reload }),
    [ready, user, patients, unread, hospital, signIn, signOut, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
