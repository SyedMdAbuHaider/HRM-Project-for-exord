CREATE TABLE IF NOT EXISTS salary_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'DRAFT',
  finalized_at timestamptz,
  finalized_by uuid REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES salary_periods(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  base_salary numeric(14,2) NOT NULL DEFAULT 0,
  bonus numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_salary numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_id, employee_id)
);

CREATE TABLE IF NOT EXISTS salary_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_record_id uuid NOT NULL REFERENCES salary_records(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  reason text NOT NULL,
  created_by uuid REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  type text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  reason text,
  status text NOT NULL DEFAULT 'PENDING',
  total_months integer,
  paid_months integer NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  start_month text,
  reviewed_by uuid REFERENCES employees(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);