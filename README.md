# Shekar Eye Hospital — Patient App, Staff Portal & API

A complete digital front door for an eye hospital:

| Part | Tech | What it does |
|---|---|---|
| `mobile/` | React Native (Expo SDK 58, Expo Router, TypeScript) | Patient app for **Android (Google Play)** and **iPhone (App Store)** |
| `admin/` | React 19 + Vite + TypeScript | Staff web portal for front desk, doctors and administrators |
| `backend/` | Node.js 22 + Express + PostgreSQL | Secure REST API, payments, notifications, AI helpers |
| `deploy/` | Docker Compose + Caddy | One-command production deployment with automatic HTTPS |
| `docs/` | Markdown | Deployment, store submission, privacy policy, go-live checklist |

## Features

**Patient app**
- Mobile OTP login (no passwords), secure token storage, auto session refresh
- Onboarding with consent capture (DPDP), patient profile with eye-relevant history (diabetes, BP, glaucoma in family, glasses)
- **Family profiles**: book and view records for parents/children from one account; each gets a hospital patient ID (MRN)
- Browse 9 eye specialities → doctors (qualification, experience, languages, fee, OPD days)
- Live slot picker (14-day availability strip, morning/afternoon/evening slots), no double booking
- **Payments**: Razorpay (UPI, cards, net banking) or "Pay at hospital"; slot held during payment; receipts
- Appointment detail with token number, directions, call, **reschedule**, **cancel with automatic refund**
- **Medical records**: eye tests and **glasses prescriptions (SPH/CYL/AXIS/ADD/VA/IOP for each eye)**, medicines, diagnosis, follow-up date, PDF/image reports; share as PDF
- **AI eye symptom checker**: flags emergencies (chemical splash, sudden vision loss, retinal-detachment signs, injury, acute glaucoma, post-op problems) and suggests the right speciality
- **Help assistant** chatbot (FAQ + optional Claude AI answers), with safety-first emergency escalation
- Push notifications: booking confirmation, evening-before reminder (with dilation advice), report ready, cancellations
- In-app notifications centre, payment history, hospital info, privacy summary, **in-app account deletion** (store requirement)

**Staff portal** (role-based: admin / front desk / doctor)
- Dashboard: today's numbers, live queue, 14-day trend, speciality mix, collections
- Appointments: filter by date/doctor/status/search, check-in (+ collect payment at desk), complete, no-show, cancel with reason (auto-refund + patient notified), walk-in/phone booking, CSV export
- Patients: search, register walk-ins, full history, **add records with an eye-prescription grid**, medicines, uploads (PDF/JPG/PNG)
- Doctors: profiles, fees, OPD schedule editor (multiple sessions/day, slot length), leave management
- Departments, payments report with CSV export & receipts, staff access management, **audit log** of every login, record view and change
- Doctors see only their own patients' appointments

**Backend**
- PostgreSQL schema with constraints (DB-level unique index prevents double booking), advisory locks for concurrent booking
- OTP throttling, rate limits, helmet security headers, zod validation on every input, refresh-token rotation
- Signed 5-minute links for files and receipts (no tokens in URLs), audit logging, background jobs (hold expiry, reminders)
- Razorpay order + signature verification + webhook, refunds; mock gateway for testing
- 21 integration tests against a real PostgreSQL database

## Quick start (development)

Requirements: Node.js 22+, PostgreSQL 14+.

```bash
# 1. Backend
cd backend
npm install
createdb hospital                       # or set DATABASE_URL
npm run seed                            # creates tables, departments, SAMPLE doctors and staff
npm run dev                             # http://localhost:4000/api
npm test                                # needs a database called hospital_test

# 2. Staff portal
cd ../admin
npm install
npm run dev                             # http://localhost:5173 (proxies /api to :4000)

# 3. Patient app
cd ../mobile
npm install
EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:4000/api npx expo start
```

In development, OTPs are shown on screen (no SMS needed) and payments use a **test gateway**.

Demo logins (sample seed data):

| Role | Mobile |
|---|---|
| Administrator | 9000000001 |
| Front desk | 9000000002 |
| Doctor (Sample Doctor 2, Cataract) | 9000000012 |
| Patient | any other valid mobile number |

> ⚠️ The seeded doctors are **samples** ("Dr. Sample Doctor 1…9"). Replace them with Shekar Eye Hospital's real doctors, fees and timings from the staff portal before launch. Run `node src/db/seed.js --no-samples` on a fresh production database.

## Where to put the hospital's real details

- `backend/src/hospital.js` and `backend/.env` (`HOSPITAL_*`): name, phones, emergency number, address, Google Maps link, timings, insurance text
- `mobile/app.json`: app name, bundle IDs, icon & splash images in `mobile/assets/`
- `mobile/src/lib/theme.ts`: brand colours

Then follow **[docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md)**.

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): server, domain, HTTPS, backups, SMS, payments
- [docs/STORE_SUBMISSION.md](docs/STORE_SUBMISSION.md): building with EAS and publishing to Google Play & the App Store
- [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md): privacy policy template (needs legal review)
- [docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md): everything to finish before launch
- [docs/API.md](docs/API.md): API endpoint reference
