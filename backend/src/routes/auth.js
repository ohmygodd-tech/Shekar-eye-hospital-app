import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { one, query, tx } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, signAccessToken } from '../middleware/auth.js';
import { requestOtp, verifyOtp } from '../services/otp.js';
import { ah, unauthorized, forbidden } from '../utils/errors.js';
import { audit } from '../services/audit.js';

const r = Router();

export const phoneSchema = z.string().trim()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .transform((s) => (/^\d{10}$/.test(s) ? `+91${s}` : s.startsWith('91') && s.length === 12 ? `+${s}` : s))
  .refine((s) => /^\+91[6-9]\d{9}$/.test(s), 'Enter a valid 10-digit Indian mobile number');

const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.isTest ? 1000 : 20, standardHeaders: true, legacyHeaders: false });

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

async function issueTokens(client, user) {
  const refresh = crypto.randomBytes(48).toString('base64url');
  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [user.id, hashToken(refresh), String(config.refreshTokenDays)],
  );
  return { accessToken: signAccessToken(user), refreshToken: refresh };
}

r.post('/otp/request', otpLimiter, validate(z.object({ phone: phoneSchema })), ah(async (req, res) => {
  const devOtp = await requestOtp(req.body.phone);
  res.json({ ok: true, phone: req.body.phone, expiresInSeconds: config.otp.ttlMinutes * 60, ...(devOtp ? { devOtp } : {}) });
}));

r.post('/otp/verify', otpLimiter, validate(z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  app: z.enum(['patient', 'staff']).default('patient'),
})), ah(async (req, res) => {
  const { phone, code, app } = req.body;
  await verifyOtp(phone, code);

  const result = await tx(async (c) => {
    let user = (await c.query('SELECT * FROM users WHERE phone = $1 AND deleted_at IS NULL', [phone])).rows[0];
    let isNew = false;
    if (!user) {
      if (app === 'staff') throw forbidden('This number is not registered as hospital staff');
      user = (await c.query(`INSERT INTO users (phone) VALUES ($1) RETURNING *`, [phone])).rows[0];
      isNew = true;
    }
    if (!user.is_active) throw forbidden('Account disabled. Please contact the hospital.');
    if (app === 'staff' && user.role === 'patient') throw forbidden('This number is not registered as hospital staff');
    const tokens = await issueTokens(c, user);
    const hasProfile = (await c.query('SELECT 1 FROM patients WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1', [user.id])).rowCount > 0;
    return { ...tokens, isNew, needsProfile: user.role === 'patient' && !hasProfile, user: publicUser(user) };
  });
  await audit({ user: result.user, ip: req.ip }, 'auth.login', 'user', result.user.id, { app });
  res.json(result);
}));

r.post('/refresh', validate(z.object({ refreshToken: z.string().min(20) })), ah(async (req, res) => {
  const result = await tx(async (c) => {
    const row = (await c.query(
      `SELECT rt.id AS rt_id, u.* FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now() AND u.is_active AND u.deleted_at IS NULL
        FOR UPDATE OF rt`,
      [hashToken(req.body.refreshToken)],
    )).rows[0];
    if (!row) throw unauthorized('Session expired, please log in again');
    // Rotate: old refresh token can't be reused.
    await c.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.rt_id]);
    return { ...(await issueTokens(c, row)), user: publicUser(row) };
  });
  res.json(result);
}));

r.post('/logout', requireAuth, ah(async (req, res) => {
  if (req.body?.refreshToken) {
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND user_id = $2', [hashToken(req.body.refreshToken), req.user.id]);
  }
  await query('UPDATE users SET push_token = NULL WHERE id = $1', [req.user.id]);
  res.json({ ok: true });
}));

export function publicUser(u) {
  return { id: u.id, phone: u.phone, name: u.name, email: u.email, role: u.role, consentAt: u.consent_at };
}

export default r;
