import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { api, auth } from './api';
import type { Me } from './types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Doctors from './pages/Doctors';
import Payments from './pages/Payments';
import Staff from './pages/Staff';
import Departments from './pages/Departments';
import Audit from './pages/Audit';

const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx)!;

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const loadMe = async () => {
    try { setMe(await api<Me>('/me')); } catch { setMe(null); }
    setReady(true);
  };
  useEffect(() => {
    auth.onLogout(() => setMe(null));
    if (auth.get()) loadMe(); else setReady(true);
  }, []);

  if (!ready) return null;
  if (!me || me.user.role === 'patient') return <Login onDone={loadMe} />;

  const role = me.user.role;
  const desk = role === 'admin' || role === 'receptionist';
  const logout = async () => {
    await api('/auth/logout', { body: { refreshToken: auth.get()?.refreshToken } }).catch(() => {});
    auth.set(null);
    setMe(null);
  };

  return (
    <MeCtx.Provider value={me}>
      <BrowserRouter>
        <div className="layout">
          <aside className="sidebar">
            <div className="brand">
              <div className="logo"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="#fff" /><circle cx="12" cy="12" r="3.2" fill="#0B6E99" /></svg></div>
              <div>Shekar Eye Hospital<div style={{ fontSize: 11, fontWeight: 500, color: '#7fa3b5' }}>Staff portal</div></div>
            </div>
            <nav className="nav">
              <NavLink to="/" end>📊 Dashboard</NavLink>
              <NavLink to="/appointments">📅 Appointments</NavLink>
              <NavLink to="/patients">🧑‍⚕️ Patients</NavLink>
              {desk && <NavLink to="/payments">💳 Payments</NavLink>}
              {role === 'admin' && (
                <>
                  <div className="sep">Administration</div>
                  <NavLink to="/doctors">👨‍⚕️ Doctors & schedules</NavLink>
                  <NavLink to="/departments">🏥 Departments</NavLink>
                  <NavLink to="/staff">🔑 Staff access</NavLink>
                  <NavLink to="/audit">📜 Audit log</NavLink>
                </>
              )}
              {role === 'receptionist' && <NavLink to="/doctors">👨‍⚕️ Doctors & leave</NavLink>}
            </nav>
            <div className="me">
              <div className="strong">{me.user.name || me.user.phone}</div>
              <small>{role}</small>
              <button className="btn ghost sm" style={{ color: '#cfe3ec', padding: 0, marginTop: 6 }} onClick={logout}>Log out</button>
            </div>
          </aside>
          <main className="main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/patients/:id" element={<PatientDetail />} />
              {desk && <Route path="/payments" element={<Payments />} />}
              {desk && <Route path="/doctors" element={<Doctors />} />}
              {role === 'admin' && <Route path="/departments" element={<Departments />} />}
              {role === 'admin' && <Route path="/staff" element={<Staff />} />}
              {role === 'admin' && <Route path="/audit" element={<Audit />} />}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </MeCtx.Provider>
  );
}
