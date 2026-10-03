CREATE TABLE IF NOT EXISTS login_attempts (
  identifier text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pay_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL,
  level integer NOT NULL,
  name text NOT NULL,
  min_salary numeric(14,2) NOT NULL DEFAULT 0,
  max_salary numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_code, level)
);

CREATE TABLE IF NOT EXISTS leave_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  leave_type text NOT NULL,
  min_service_years numeric(5,2) NOT NULL DEFAULT 0,
  max_service_years numeric(5,2) NOT NULL DEFAULT 999,
  days_allowed numeric(8,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gps_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  accuracy_meters numeric(10,2),
  recorded_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'android'
);

CREATE INDEX IF NOT EXISTS idx_gps_employee_time
  ON gps_logs(employee_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS schedule_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  change_type text NOT NULL CHECK (change_type IN ('PERMANENT','TEMPORARY')),
  requested_check_in time NOT NULL,
  requested_check_out time NOT NULL,
  start_date date,
  end_date date,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  advance_notice_hours numeric(8,2),
  policy_violation boolean NOT NULL DEFAULT false,
  manager_approved_by uuid REFERENCES employees(id),
  hr_approved_by uuid REFERENCES employees(id),
  rejected_by uuid REFERENCES employees(id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekend_work_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  work_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'PENDING',
  approved_by uuid REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS duty_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  duty_date date NOT NULL,
  check_in_time time,
  check_out_time time,
  shift_name text,
  status text NOT NULL DEFAULT 'SCHEDULED',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, duty_date)
);

CREATE TABLE IF NOT EXISTS department_delegates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unit_approvers (
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_code text NOT NULL,
  PRIMARY KEY(unit_id, employee_id, role_code)
);

CREATE TABLE IF NOT EXISTS department_approvers (
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_code text NOT NULL,
  PRIMARY KEY(department_id, employee_id, role_code)
);

CREATE TABLE IF NOT EXISTS role_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL,
  capability text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  UNIQUE(role_code, capability)
);

CREATE TABLE IF NOT EXISTS custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_by uuid REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_role_members (
  role_id uuid NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id, employee_id)
);

CREATE TABLE IF NOT EXISTS custom_role_permissions (
  role_id uuid NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  capability text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  PRIMARY KEY(role_id, capability)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  capability text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  PRIMARY KEY(employee_id, capability)
);

CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES employees(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  field_name text NOT NULL,
  old_value text,
  new_value text,
  reason text,
  status text NOT NULL DEFAULT 'PENDING',
  reviewed_by uuid REFERENCES employees(id),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);