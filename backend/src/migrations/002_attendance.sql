CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  type text NOT NULL CHECK (type IN ('CHECK_IN','CHECK_OUT','BREAK_START','BREAK_END')),
  status text NOT NULL DEFAULT 'SUCCESS',
  occurred_at timestamptz NOT NULL,
  location jsonb,
  ip_address inet,
  device_id text,
  app_version text,
  source text NOT NULL DEFAULT 'live',
  is_late boolean NOT NULL DEFAULT false,
  late_minutes integer NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  reason text,
  client_event_id uuid,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, client_event_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_time
  ON attendance(employee_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS attendance_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  check_in_time time NOT NULL,
  grace_minutes integer NOT NULL DEFAULT 0,
  early_check_in_minutes integer NOT NULL DEFAULT 60,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'holiday',
  applicable_to text NOT NULL DEFAULT 'all',
  extra_pay_multiplier numeric(5,2) NOT NULL DEFAULT 1.5,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);