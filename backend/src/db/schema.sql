-- Shekar Eye Hospital — PostgreSQL schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('patient','doctor','receptionist','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE appt_status AS ENUM ('pending_payment','confirmed','checked_in','completed','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE pay_status AS ENUM ('unpaid','paid','refunded','pay_at_hospital');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE record_type AS ENUM ('eye_test','spectacle_rx','prescription','lab_report','scan','discharge_summary','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT NOT NULL UNIQUE,            -- E.164, e.g. +919876543210
  name          TEXT,
  email         TEXT,
  role          user_role NOT NULL DEFAULT 'patient',
  push_token    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  consent_at    TIMESTAMPTZ,                     -- DPDP consent to process health data
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_phone_idx ON otp_codes(phone, created_at DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS mrn_seq START 1001;

-- A patient profile. One user (account holder) can manage several (self + family).
CREATE TABLE IF NOT EXISTS patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mrn             TEXT NOT NULL UNIQUE DEFAULT ('SEH-' || lpad(nextval('mrn_seq')::text, 6, '0')),
  name            TEXT NOT NULL,
  relation        TEXT NOT NULL DEFAULT 'self',  -- self, spouse, child, parent, other
  dob             DATE,
  gender          TEXT CHECK (gender IN ('male','female','other')),
  blood_group     TEXT,
  allergies       TEXT,
  medical_history TEXT,                          -- e.g. diabetes, hypertension (relevant to retina/glaucoma)
  wears_glasses   BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS patients_user_idx ON patients(user_id);

CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS doctors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  department_id    UUID NOT NULL REFERENCES departments(id),
  name             TEXT NOT NULL,
  qualification    TEXT,
  experience_years INT,
  languages        TEXT[] NOT NULL DEFAULT '{}',
  bio              TEXT,
  photo_url        TEXT,
  fee_paise        INT NOT NULL CHECK (fee_paise >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctor_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  weekday      INT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  slot_minutes INT NOT NULL DEFAULT 15 CHECK (slot_minutes BETWEEN 5 AND 120),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS doctor_leaves (
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date      DATE NOT NULL,
  reason    TEXT,
  PRIMARY KEY (doctor_id, date)
);

CREATE TABLE IF NOT EXISTS appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID NOT NULL REFERENCES patients(id),
  doctor_id        UUID NOT NULL REFERENCES doctors(id),
  booked_by        UUID NOT NULL REFERENCES users(id),
  date             DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  status           appt_status NOT NULL DEFAULT 'pending_payment',
  payment_status   pay_status NOT NULL DEFAULT 'unpaid',
  fee_paise        INT NOT NULL,
  visit_type       TEXT NOT NULL DEFAULT 'new' CHECK (visit_type IN ('new','follow_up','post_op','emergency')),
  reason           TEXT,
  token_no         INT,
  hold_expires_at  TIMESTAMPTZ,             -- slot hold while payment is pending
  cancel_reason    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Guarantees no double booking of an active slot.
CREATE UNIQUE INDEX IF NOT EXISTS appt_slot_unique
  ON appointments(doctor_id, date, start_time)
  WHERE status NOT IN ('cancelled');
CREATE INDEX IF NOT EXISTS appt_patient_idx ON appointments(patient_id, date DESC);
CREATE INDEX IF NOT EXISTS appt_date_idx ON appointments(date, doctor_id);

CREATE SEQUENCE IF NOT EXISTS receipt_seq START 1;

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id      UUID NOT NULL REFERENCES appointments(id),
  user_id             UUID NOT NULL REFERENCES users(id),
  amount_paise        INT NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'INR',
  provider            TEXT NOT NULL,          -- razorpay | mock | cash
  provider_order_id   TEXT UNIQUE,
  provider_payment_id TEXT,
  status              TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed','refunded')),
  receipt_no          TEXT UNIQUE,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  type           record_type NOT NULL,
  title          TEXT NOT NULL,
  notes          TEXT,
  data           JSONB,        -- structured eye data, e.g. {"od":{"sph":-1.25,...},"os":{...},"va":{...}}
  file_key       TEXT,
  file_name      TEXT,
  mime_type      TEXT,
  uploaded_by    UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS records_patient_idx ON records(patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  meta       JSONB,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
