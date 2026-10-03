-- Baseline capabilities for the migrated application.
-- Source-specific grants can override these through role_capabilities,
-- custom_role_permissions, and user_permissions.
INSERT INTO role_capabilities(role_code,capability,granted) VALUES
  ('DEVELOPER','*',true),
  ('ADMIN','hrm.employees.read',true),
  ('ADMIN','hrm.employees.manage',true),
  ('ADMIN','hrm.leaves.manage',true),
  ('ADMIN','hrm.salaries.read',true),
  ('ADMIN','hrm.notifications.manage',true),
  ('ADMIN','hrm.settings.manage',true),
  ('CO_ADMIN','hrm.employees.read',true),
  ('CO_ADMIN','hrm.employees.manage',true),
  ('CO_ADMIN','hrm.leaves.manage',true),
  ('CO_ADMIN','hrm.salaries.read',true),
  ('HR','hrm.employees.read',true),
  ('HR','hrm.employees.manage',true),
  ('HR','hrm.leaves.manage',true),
  ('HR','hrm.salaries.read',true),
  ('MANAGER','hrm.employees.read',true),
  ('MANAGER','hrm.leaves.manage',true),
  ('MANAGER','hrm.salaries.read',true)
ON CONFLICT(role_code,capability) DO UPDATE SET granted=EXCLUDED.granted;

CREATE INDEX IF NOT EXISTS idx_role_capabilities_role ON role_capabilities(role_code);
CREATE INDEX IF NOT EXISTS idx_user_permissions_employee ON user_permissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_custom_role_members_employee ON custom_role_members(employee_id);
