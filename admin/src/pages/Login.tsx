import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, auth } from '../api';

export default function Login({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (step === 'phone') {
        const r = await api<{ devOtp?: string }>('/auth/otp/request', { body: { phone } });
        setDevOtp(r.devOtp || '');
        setStep('otp');
      } else {
        const r = await api<{ accessToken: string; refreshToken: string }>('/auth/otp/verify', { body: { phone, code, app: 'staff' } });
        auth.set({ accessToken: r.accessToken, refreshToken: r.refreshToken });
        onDone();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login" onSubmit={submit}>
        <div className="row" style={{ marginBottom: 22 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#0B6E99', display: 'grid', placeItems: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="#fff" /><circle cx="12" cy="12" r="3.2" fill="#0B6E99" /></svg>
          </div>
          <div><h1 style={{ fontSize: 18 }}>Shekar Eye Hospital</h1><div className="muted small">Staff portal — doctors, front desk & admin</div></div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {step === 'phone' ? (
          <div className="field">
            <label htmlFor="phone">Registered mobile number</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" inputMode="numeric" autoFocus />
          </div>
        ) : (
          <>
            {devOtp && <div className="alert warn">Development mode — OTP: <b>{devOtp}</b></div>}
            <div className="field">
              <label htmlFor="otp">OTP sent to +91 {phone}</label>
              <input id="otp" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" inputMode="numeric" autoFocus autoComplete="one-time-code" />
            </div>
          </>
        )}
        <button className="btn" style={{ width: '100%', height: 42 }} disabled={busy || (step === 'phone' ? phone.length !== 10 : code.length !== 6)}>
          {busy ? 'Please wait…' : step === 'phone' ? 'Send OTP' : 'Log in'}
        </button>
        {step === 'otp' && <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => { setStep('phone'); setCode(''); }}>Change number</button>}
        <p className="muted small" style={{ marginTop: 18, marginBottom: 0 }}>Access is restricted to authorised hospital staff. All activity is logged.</p>
      </form>
    </div>
  );
}
