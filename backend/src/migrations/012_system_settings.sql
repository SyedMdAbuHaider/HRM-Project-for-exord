CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES employees(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO system_settings(key,value,description) VALUES
('allowed_ip_subnets','[]'::jsonb,'Allowed corporate IP subnets'),
('allowed_origins','[]'::jsonb,'Allowed frontend CORS origins'),
('smtp_config','{}'::jsonb,'SMTP configuration'),
('provident_fund_rate','5'::jsonb,'Provident fund percentage')
ON CONFLICT(key) DO NOTHING;
