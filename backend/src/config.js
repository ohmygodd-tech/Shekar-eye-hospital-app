import 'dotenv/config';

const env = process.env;
const isProd = env.NODE_ENV === 'production';

function required(name, fallback) {
  const v = env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing required env var ${name}`);
  return v;
}

export const config = {
  env: env.NODE_ENV || 'development',
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT || 4000),
  databaseUrl: required('DATABASE_URL', isProd ? undefined : 'postgres://postgres:postgres@localhost:5432/hospital'),
  jwtSecret: required('JWT_SECRET', isProd ? undefined : 'dev-only-change-me-please-32-characters'),
  accessTokenTtl: env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: Number(env.REFRESH_TOKEN_DAYS || 30),
  corsOrigins: (env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()),
  uploadDir: env.UPLOAD_DIR || 'uploads',
  maxUploadMb: Number(env.MAX_UPLOAD_MB || 15),

  otp: {
    ttlMinutes: 5,
    maxAttempts: 5,
    // In development the OTP is returned in the API response so you can log in without SMS.
    exposeInResponse: !isProd && env.OTP_EXPOSE !== 'false',
    smsProvider: env.SMS_PROVIDER || 'console', // console | msg91
    msg91AuthKey: env.MSG91_AUTH_KEY,
    msg91TemplateId: env.MSG91_TEMPLATE_ID,
    // Fixed OTP for app-store reviewers' demo account (Apple/Google require a working login).
    reviewerPhone: env.REVIEWER_PHONE,
    reviewerOtp: env.REVIEWER_OTP,
  },

  payments: {
    // 'none' in production without keys: online payment is disabled (never fake payments in production).
    provider: env.RAZORPAY_KEY_ID ? 'razorpay' : isProd ? 'none' : 'mock',
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    razorpayKeySecret: env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    holdMinutes: Number(env.SLOT_HOLD_MINUTES || 10),
  },

  booking: {
    maxDaysAhead: Number(env.BOOKING_MAX_DAYS_AHEAD || 30),
    cancelCutoffHours: Number(env.CANCEL_CUTOFF_HOURS || 2),
    timezone: 'Asia/Kolkata',
  },

  ai: {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    model: env.AI_MODEL || 'claude-haiku-5-5',
  },
};
