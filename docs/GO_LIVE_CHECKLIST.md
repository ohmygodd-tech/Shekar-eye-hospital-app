# Go-live checklist — Shekar Eye Hospital

## A. Information to collect from the hospital
- [ ] Legal entity name, registered address, GSTIN (if applicable)
- [ ] Reception phone, **24×7 eye emergency number**, WhatsApp, email, website
- [ ] Full address and Google Maps link; OPD timings (weekday/Sunday/holidays)
- [ ] Logo (vector or 1024×1024 PNG) and brand colours
- [ ] Each doctor: name, qualifications, experience, languages, speciality, consultation fee, OPD days/times, slot length, mobile number for staff login, and a photo if wanted (with the doctor's consent)
- [ ] Front desk and admin staff names and mobile numbers
- [ ] Insurance/TPA wording, cancellation and refund policy, follow-up fee rules
- [ ] Records retention period, confirmed with the hospital's legal adviser
- [ ] Grievance officer (data protection contact)

## B. Accounts to open (in the hospital's name)
- [ ] D-U-N-S number (start first, can take weeks)
- [ ] Google Play Console, **Organization** account
- [ ] Apple Developer Program, **Organization**
- [ ] Expo account (organisation)
- [ ] Razorpay business account (KYC), live keys and webhook
- [ ] MSG91 (or other) SMS, with DLT entity, sender ID and OTP template registration
- [ ] Server/cloud account (India region) and domain DNS access

## C. Configuration
- [ ] `backend/src/hospital.js` or `HOSPITAL_*` env vars filled in (no `+91-00000-00000` placeholders left)
- [ ] `mobile/app.json`: bundle IDs, EAS projectId, icons and splash replaced
- [ ] `mobile/eas.json`: production `EXPO_PUBLIC_API_URL`
- [ ] Privacy policy reviewed by a lawyer, published at a public URL, URL set in `mobile/src/app/privacy.tsx`
- [ ] Account-deletion request web page (Google Play requires a URL)
- [ ] Production DB seeded with `--no-samples`; sample doctors **not** present
- [ ] Real doctors, schedules and fees entered; test booking for each doctor
- [ ] `REVIEWER_PHONE`/`REVIEWER_OTP` set; demo data created for the reviewer account

## D. Testing before submission
- [ ] Install the preview build on 2+ Android phones and 1+ iPhone
- [ ] Full flow: sign up → add family member → book → pay with a real ₹1 test doctor fee → receive push → reschedule → cancel → refund arrives
- [ ] Front desk: walk-in registration → booking → check-in + collect → doctor completes → glasses Rx uploaded → patient sees it and gets a notification
- [ ] Doctor login sees only their own patients
- [ ] Symptom checker: try "chemical in eye", "curtain over vision", "itchy eyes", "child squint"
- [ ] Slow or no internet shows friendly errors
- [ ] Backups running; a restore tested on a spare server

## E. Store submission
See [STORE_SUBMISSION.md](STORE_SUBMISSION.md). Plan for **1–3 weeks** for first approval. Health apps get extra review attention, and a rejection or two asking for clarifications is normal.

## F. After launch
- [ ] Put a QR code at the reception desk and in OPD waiting areas: "Book your next visit on our app"
- [ ] Monitor `/api/health` (UptimeRobot or similar, free)
- [ ] Review the audit log monthly; remove staff who leave
- [ ] Keep Expo SDK and dependencies updated about twice a year (stores require recent target SDKs)
