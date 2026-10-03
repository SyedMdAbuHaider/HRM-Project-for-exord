CREATE TABLE IF NOT EXISTS stored_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES employees(id),
  scope text NOT NULL,
  original_name text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  checksum_sha256 text,
  conversation_id uuid REFERENCES conversations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_stored_files_owner ON stored_files(owner_id);
CREATE INDEX IF NOT EXISTS idx_stored_files_conversation ON stored_files(conversation_id);