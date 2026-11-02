CREATE TABLE IF NOT EXISTS dr_users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  couple_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dr_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES dr_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dr_sessions_user_idx ON dr_sessions(user_id);

CREATE TABLE IF NOT EXISTS dr_password_resets (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES dr_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dr_weddings (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL UNIQUE REFERENCES dr_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  couple_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  gifts jsonb NOT NULL DEFAULT '[]'::jsonb,
  guest_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  financials jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dr_guest_families (
  id uuid PRIMARY KEY,
  wedding_id uuid NOT NULL REFERENCES dr_weddings(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  invite_token_hash text UNIQUE,
  invite_expires_at timestamptz,
  rsvp_token_hash text UNIQUE,
  rsvp_expires_at timestamptz,
  rsvp_submitted_at timestamptz,
  verification_attempts integer NOT NULL DEFAULT 0,
  verification_locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dr_guest_families_wedding_idx ON dr_guest_families(wedding_id, created_at);

CREATE TABLE IF NOT EXISTS dr_guests (
  id uuid PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES dr_guest_families(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_child boolean NOT NULL DEFAULT false,
  age integer NOT NULL DEFAULT 0 CHECK (age >= 0),
  confirmed boolean,
  qr_token_hash text UNIQUE,
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dr_guests_family_idx ON dr_guests(family_id, created_at);

CREATE TABLE IF NOT EXISTS dr_gift_reminders (
  id uuid PRIMARY KEY,
  wedding_id uuid NOT NULL REFERENCES dr_weddings(id) ON DELETE CASCADE,
  reservation_id text NOT NULL,
  scheduled_for date NOT NULL,
  event_date date NOT NULL,
  days_before integer NOT NULL CHECK (days_before IN (15, 30)),
  guest_name text NOT NULL,
  whatsapp text NOT NULL,
  gift_title text NOT NULL,
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, days_before)
);
CREATE INDEX IF NOT EXISTS dr_gift_reminders_due_idx
  ON dr_gift_reminders(scheduled_for) WHERE sent_at IS NULL;
