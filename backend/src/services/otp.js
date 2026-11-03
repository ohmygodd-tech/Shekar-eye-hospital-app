import crypto from 'node:crypto';
import { config } from '../config.js';
import { one, query } from '../db/index.js';
import { badRequest, ApiError } from '../utils/errors.js';

const hash = (phone, code) => crypto.createHmac('sha256', config.jwtSecret).update(`${phone}:${code}`).digest('hex');

async function sendSms(phone, code) {
  if (config.otp.smsProvider === 'msg91') {
    // MSG91 OTP API (DLT-registered template required in India).
    const res = await fetch('https://control.msg91.com/api/v5/otp?' + new URLSearchParams({
      template_id: config.otp.msg91TemplateId,
      mobile: phone.replace('+', ''),
      otp: code,
    }), { method: 'POST', headers: { authkey: config.otp.msg91AuthKey } });
    if (!res.ok) throw new ApiError(502, 'Could not send OTP SMS, please try again', 'sms_failed');
    return;
  }
  if (!config.isTest) console.log(`[OTP] ${phone}: ${code}`);
}

export async function requestOtp(phone) {
  // Throttle: max 1 OTP per 30s and 5 per hour per number.
  const recent = await one(
    `SELECT count(*)::int AS hour,
            count(*) FILTER (WHERE created_at > now() - interval '30 seconds')::int AS burst
       FROM otp_codes WHERE phone = $1 AND created_at > now() - interval '1 hour'`,
    [phone],
  );
  if (recent.burst > 0) throw new ApiError(429, 'Please wait 30 seconds before requesting another OTP', 'otp_throttled');
  if (recent.hour >= 5) throw new ApiError(429, 'Too many OTP requests. Try again in an hour.', 'otp_throttled');

  const isReviewer = config.otp.reviewerPhone && phone === config.otp.reviewerPhone && config.otp.reviewerOtp;
  const code = isReviewer ? config.otp.reviewerOtp : String(crypto.randomInt(100000, 1000000));
  await query(
    `INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [phone, hash(phone, code), String(config.otp.ttlMinutes)],
  );
  if (!isReviewer) await sendSms(phone, code);
  return config.otp.exposeInResponse ? code : undefined;
}

export async function verifyOtp(phone, code) {
  const row = await one(
    `SELECT * FROM otp_codes WHERE phone = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [phone],
  );
  if (!row || new Date(row.expires_at) < new Date()) throw badRequest('OTP expired. Please request a new one.');
  if (row.attempts >= config.otp.maxAttempts) throw badRequest('Too many wrong attempts. Please request a new OTP.');
  const ok = crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hash(phone, code)));
  if (!ok) {
    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    throw badRequest('Incorrect OTP');
  }
  await query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [row.id]);
}
