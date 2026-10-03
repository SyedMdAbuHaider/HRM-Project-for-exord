CREATE TABLE IF NOT EXISTS migration_id_map (
  source_table text NOT NULL,
  source_id text NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_table, source_id),
  UNIQUE (source_table, target_id)
);

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS unit_type text,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS snmp_config jsonb;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES units(id),
  ADD COLUMN IF NOT EXISTS unit_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_name text;

ALTER TABLE stored_files
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE salary_records
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_migration_id_map_source ON migration_id_map(source_table, source_id);

CREATE TABLE IF NOT EXISTS legacy_import_rows (
  source_table text NOT NULL,
  source_id text NOT NULL,
  payload jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_table, source_id)
);
