import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './pool.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(root, '..', 'migrations');

await db.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const files = (await fs.readdir(dir))
  .filter(name => name.endsWith('.sql'))
  .sort();

for (const file of files) {
  const version = file.replace(/\.sql$/, '');
  const exists = await db.query(
    'SELECT 1 FROM schema_migrations WHERE version = $1',
    [version]
  );
  if (exists.rowCount) continue;

  const sql = await fs.readFile(path.join(dir, file), 'utf8');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations(version) VALUES ($1)',
      [version]
    );
    await client.query('COMMIT');
    console.log(`[migration] applied ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[migration] failed ${file}`);
    throw error;
  } finally {
    client.release();
  }
}

await db.end();