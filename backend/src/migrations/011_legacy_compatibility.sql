ALTER TABLE holidays ADD COLUMN IF NOT EXISTS assigned_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS unit_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE weekend_work_permissions ADD COLUMN IF NOT EXISTS user_name text, ADD COLUMN IF NOT EXISTS department text, ADD COLUMN IF NOT EXISTS reviewed_by_name text, ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE duty_roster ADD COLUMN IF NOT EXISTS user_name text, ADD COLUMN IF NOT EXISTS department text, ADD COLUMN IF NOT EXISTS shift_label text, ADD COLUMN IF NOT EXISTS note text, ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE department_delegates ADD COLUMN IF NOT EXISTS department text, ADD COLUMN IF NOT EXISTS normal_role text, ADD COLUMN IF NOT EXISTS delegate_user_id uuid, ADD COLUMN IF NOT EXISTS delegate_user_name text, ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES employees(id);
CREATE INDEX IF NOT EXISTS idx_weekend_work_date ON weekend_work_permissions(work_date);
CREATE INDEX IF NOT EXISTS idx_duty_roster_date ON duty_roster(duty_date);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS duty_schedule jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '{}'::jsonb;
