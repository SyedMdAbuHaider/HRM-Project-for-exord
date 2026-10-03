# Supabase export/import migration

The production application remains Supabase-backed until the cutover. This importer is for a **staging copy/export only**.

## Export directory

Put one JSON or JSONL file per legacy table in a directory, for example:

```
supabase-export/
  users.json
  units.json
  departments.json
  attendance.json
  leaves.json
  salaries.json
  ...
```

Each JSON file may be either an array or an object containing `data` or `rows`.

## Run

```bash
npm run migrate
npm run migrate:supabase -- --input=/absolute/path/to/supabase-export --dry-run
npm run migrate:supabase -- --input=/absolute/path/to/supabase-export
```

The import uses the target database configured by `DATABASE_URL`.

### Safety

- Run against a new/staging PostgreSQL database first.
- The importer preserves UUID source IDs when possible.
- Non-UUID source IDs are mapped through `migration_id_map`.
- Unmapped source rows are retained verbatim in `legacy_import_rows`; they are not silently discarded.
- Password hashes are preserved when recognizable. Plaintext legacy passwords, if present in the export, are immediately converted to Argon2 before insertion.
- Do not export or commit the resulting JSON files to Git.
- Keep the existing Supabase application online until parity checks pass.

The migration script does not delete or modify the Supabase source.
