import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export const db = new Pool({
  connectionString: config.databaseUrl,
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
});

export async function withTransaction(fn) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}