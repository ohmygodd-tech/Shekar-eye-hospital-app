# Deployment guide

The backend and staff portal run on a single Linux server (or any container platform). The mobile app talks to the backend over HTTPS.

## 1. What you need

| Item | Notes |
|---|---|
| A server | 2 vCPU / 4 GB RAM is plenty to start (AWS Lightsail/EC2 Mumbai, DigitalOcean Bangalore, Azure/GCP India). Keep health data in an Indian region. |
| Two sub-domains | e.g. `api.shekareyehospital.in` (API) and `staff.shekareyehospital.in` (staff portal), both pointing (A record) to the server |
| Docker + Docker Compose | `curl -fsSL https://get.docker.com \| sh` |
| SMS provider | MSG91 (or similar) with a **DLT-registered** OTP template (TRAI requirement in India) |
| Razorpay account | KYC-verified business account; live Key ID/Secret and a webhook secret |

## 2. Install

```bash
git clone <your repo> /opt/shekar && cd /opt/shekar
cd admin && npm ci && npm run build && cd ..          # builds the staff portal into admin/dist
cd deploy
cp ../backend/.env.example .env
nano .env    # fill everything in; also add:
#   DB_PASSWORD=<long random>
#   API_DOMAIN=api.shekareyehospital.in
#   STAFF_DOMAIN=staff.shekareyehospital.in
#   CORS_ORIGINS=https://staff.shekareyehospital.in
docker compose up -d --build
docker compose exec api node src/db/seed.js --no-samples   # tables + departments + first admin (SEED_ADMIN_PHONE)
```

Caddy gets HTTPS certificates automatically. Check `https://api.<domain>/api/health` → `{"ok":true,"db":"up"}`.

Log in to `https://staff.<domain>` with the `SEED_ADMIN_PHONE` number, then:
1. **Doctors → Add doctor** for each real doctor (fee, qualifications, login mobile), then **Schedule**.
2. **Staff access** → add front-desk users.
3. **Departments**: adjust descriptions/order if needed.

## 3. Payments (Razorpay)

1. Razorpay Dashboard → Settings → API Keys → generate **live** keys → put in `.env`.
2. Settings → Webhooks → add `https://api.<domain>/api/payments/webhook`, events `payment.captured` and `order.paid`, set a secret → `RAZORPAY_WEBHOOK_SECRET`.
3. `docker compose up -d` to restart. The app automatically switches from the test gateway to Razorpay.

Medical consultations are real-world services, so card/UPI payments through Razorpay are allowed on both stores (Apple in-app purchase is **not** required for this).

## 4. SMS OTP (MSG91)

1. Register sender ID and an OTP template on the DLT portal (via MSG91), e.g. `Your Shekar Eye Hospital login OTP is ##OTP##. Valid for 5 minutes. Do not share it.`
2. Put `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` and `SMS_PROVIDER=msg91` in `.env`.
3. With `NODE_ENV=production` OTPs are never shown in API responses.

## 5. Push notifications

Uses Expo Push (FCM on Android, APNs on iOS) — configured automatically by EAS when you build (see STORE_SUBMISSION.md). No server keys are needed in `.env`.

## 6. Backups (do not skip)

```bash
chmod +x deploy/backup.sh
crontab -e   →   30 2 * * * /opt/shekar/deploy/backup.sh >> /var/log/shekar-backup.log 2>&1
```
Copy `deploy/backups/` off the server daily (S3/Drive). **Test a restore** once:
`docker compose exec -T db pg_restore -U hospital -d hospital --clean < backups/db-YYYY-MM-DD.dump`

## 7. Updating

```bash
git pull
cd admin && npm ci && npm run build && cd ../deploy
docker compose up -d --build api web
```
Database changes are applied automatically at API start (`schema.sql` is idempotent).

## 8. Security checklist

- Strong `JWT_SECRET` (`openssl rand -hex 32`) and `DB_PASSWORD`; never commit `.env`
- Server firewall: only ports 22, 80, 443 open; SSH with keys only
- Keep `CORS_ORIGINS` limited to the staff portal domain
- Review **Audit log** periodically; disable staff accounts when people leave
- Enable automatic OS security updates
- Uploaded reports live in the `uploads` Docker volume — include it in backups (the script does)
