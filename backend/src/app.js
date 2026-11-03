import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { ApiError } from './utils/errors.js';
import { pool, query } from './db/index.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import catalogRoutes from './routes/catalog.js';
import appointmentRoutes, { paymentsRouter } from './routes/appointments.js';
import recordRoutes from './routes/records.js';
import adminRoutes from './routes/admin.js';
import { linkRouter, publicFiles } from './routes/files.js';
import { verifyWebhook } from './services/payments.js';
import { tx } from './db/index.js';
import { confirmPaid } from './services/appointments.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

  // Razorpay webhook needs the raw body for signature verification (backup to client-side verify).
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!verifyWebhook(req.body, req.headers['x-razorpay-signature'])) return res.status(400).json({ error: 'bad signature' });
    try {
      const evt = JSON.parse(req.body.toString());
      if (evt.event === 'payment.captured' || evt.event === 'order.paid') {
        const p = evt.payload.payment.entity;
        await tx(async (c) => {
          const row = (await c.query(`SELECT * FROM payments WHERE provider_order_id = $1 FOR UPDATE`, [p.order_id])).rows[0];
          if (!row) return;
          if (row.status !== 'paid') {
            await c.query(`UPDATE payments SET status='paid', provider_payment_id=$2, paid_at=now(),
                             receipt_no = COALESCE(receipt_no, 'SEH-R-' || lpad(nextval('receipt_seq')::text, 6, '0')) WHERE id=$1`, [row.id, p.id]);
          }
          await confirmPaid(c, row.appointment_id);
        });
      }
      res.json({ ok: true });
    } catch (e) {
      console.error('webhook error', e);
      res.status(500).json({ error: 'webhook failed' });
    }
  });

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: config.isTest ? 100000 : 300, standardHeaders: true, legacyHeaders: false }));

  app.get('/api/health', async (_req, res) => {
    try { await query('SELECT 1'); res.json({ ok: true, db: 'up' }); } catch { res.status(503).json({ ok: false, db: 'down' }); }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api/me', requireAuth, meRoutes);
  app.use('/api/appointments', requireAuth, appointmentRoutes);
  app.use('/api/payments', requireAuth, paymentsRouter);
  app.use('/api/records', requireAuth, recordRoutes);
  app.use('/api/admin', requireAuth, adminRoutes);
  app.use('/api/links', requireAuth, linkRouter);
  app.use('/api/files', publicFiles);

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Endpoint not found' } }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err?.code === 'LIMIT_FILE_SIZE') err = new ApiError(400, `File too large (max ${config.maxUploadMb} MB)`, 'file_too_large');
    if (err?.type === 'entity.parse.failed') err = new ApiError(400, 'Invalid JSON body', 'bad_json');
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    console.error(err);
    res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong. Please try again.' } });
  });

  return app;
}

export { pool };
