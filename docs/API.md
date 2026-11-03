# API reference

Base URL: `https://api.<domain>/api`. JSON in/out. Authenticated routes need `Authorization: Bearer <accessToken>`.
Errors: `{ "error": { "code": "...", "message": "human readable" } }`.

## Public
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness + DB check |
| GET | `/hospital` | Hospital profile, booking rules, payment mode |
| GET | `/departments` | Specialities with doctor counts |
| GET | `/doctors?department=&q=` | Doctor list |
| GET | `/doctors/:id` | Doctor + weekly schedule |
| GET | `/doctors/:id/availability` | Next 14 days: total/free slots |
| GET | `/doctors/:id/slots?date=YYYY-MM-DD` | Slots for a day |
| POST | `/ai/triage` | `{symptoms, age?, durationDays?, diabetic?}` → urgency, advice, department |
| POST | `/ai/chat` | `{message, history?}` → assistant reply + suggested action |
| GET | `/files?t=` | Signed file/receipt download (5-min token) |
| POST | `/payments/webhook` | Razorpay webhook (signature verified) |

## Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/otp/request` | `{phone}` → sends OTP (`devOtp` returned in development) |
| POST | `/auth/otp/verify` | `{phone, code, app: 'patient'\|'staff'}` → tokens, user, `needsProfile` |
| POST | `/auth/refresh` | `{refreshToken}` → new token pair (rotation) |
| POST | `/auth/logout` | `{refreshToken}` |

## Account (`/me`)
| Method | Path | Description |
|---|---|---|
| GET | `/me` | User, patient profiles, unread count |
| PATCH | `/me` | `{name?, email?, pushToken?, consent?}` |
| DELETE | `/me` | Delete account |
| POST/PATCH/DELETE | `/me/patients[/:id]` | Manage self/family profiles |
| GET | `/me/notifications` · POST `/me/notifications/read` | Notification centre |

## Appointments & payments (patient)
| Method | Path | Description |
|---|---|---|
| GET | `/appointments?scope=upcoming|past|all` | List |
| GET | `/appointments/:id` | Detail incl. `canChange` |
| POST | `/appointments` | `{patientId, doctorId, date, start, visitType, reason?, payMode: online\|hospital}` → appointment + payment order |
| POST | `/appointments/:id/pay` | New payment order for a pending booking |
| POST | `/appointments/payments/verify` | `{orderId, paymentId, signature}` → confirms |
| POST | `/appointments/:id/cancel` · `/reschedule` | Cancel (auto refund) / move |
| GET | `/payments` · `/links/receipts/:id` | History · signed receipt link |

## Records
| Method | Path | Description |
|---|---|---|
| GET | `/records?patientId=&type=` | Patient: own family's; staff: by patient |
| GET | `/records/:id` · `/links/records/:id` | Detail · signed file link |
| POST | `/records` (staff, multipart) | `patientId, type, title, notes?, data? (JSON), appointmentId?, file?` |
| DELETE | `/records/:id` (admin/doctor) | Soft delete |

## Staff (`/admin`, roles: admin, receptionist, doctor)
`GET /dashboard` · `GET/POST /appointments` · `PATCH /appointments/:id` (status, paymentStatus) · `GET/POST /patients` · `GET /patients/:id` · `GET/POST /doctors` · `PUT /doctors/:id` · `PUT /doctors/:id/schedule` · `POST/DELETE /doctors/:id/leaves` · `GET/POST/PUT /departments` · `GET /payments` · `GET/POST/PATCH /staff` · `GET /audit`
