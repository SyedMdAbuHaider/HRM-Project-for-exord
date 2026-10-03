/**
 * Exord HRM — Transitional Local Attendance API
 *
 * This service is kept only during migration to the server-owned API.
 * Production secrets must be supplied through environment variables.
 */
import express from 'express';
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const app = express();
app.use(express.json({ limit: '1mb' }));

const allowedOrigins = (process.env.CORS_ORIGINS || 'https://admin.exord.net')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const API_KEY = process.env.ATTENDANCE_API_KEY;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}
if (!API_KEY) {
  throw new Error('ATTENDANCE_API_KEY is required');
}

const auth = (req, res, next) => {
  const supplied = req.headers['x-api-key'];
  if (typeof supplied !== 'string') return res.status(401).json({ error: 'Unauthorized' });

  const expected = Buffer.from(API_KEY);
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

app.post('/attendance', auth, async (req, res) => {
  const {
    user_id, type, status, timestamp, location, ip_address,
    is_late, late_minutes, reason, source
  } = req.body;

  if (!user_id || !type || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO attendance
        (user_id, type, status, timestamp, location, ip_address, is_late, late_minutes, reason, source, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       RETURNING id`,
      [
        user_id,
        type,
        status || 'SUCCESS',
        timestamp,
        location ? JSON.stringify(location) : null,
        ip_address || null,
        Boolean(is_late),
        Number(late_minutes || 0),
        reason || null,
        source || 'live'
      ]
    );
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('[AttendanceMirror] Insert error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/attendance/bulk', auth, async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || !records.length || records.length > 500) {
    return res.status(400).json({ error: 'records must contain 1-500 items' });
  }

  const results = [];
  for (const r of records) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO attendance
          (user_id, type, status, timestamp, location, ip_address, source, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,'offline_queue',NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          r.user_id,
          r.type,
          r.status || 'SUCCESS',
          r.timestamp,
          r.location ? JSON.stringify(r.location) : null,
          r.ip_address || null
        ]
      );
      results.push({ ok: true, id: rows[0]?.id });
    } catch (err) {
      results.push({ ok: false, error: 'Insert failed' });
    }
  }

  res.json({ success: true, results });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error' });
  }
});

const PORT = Number(process.env.ATTENDANCE_PORT || 3002);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[AttendanceMirror] Transitional API listening on 127.0.0.1:${PORT}`);
});
