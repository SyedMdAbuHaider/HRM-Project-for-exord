/**
 * Exord HRM — Local Attendance Mirror API
 * Runs on port 3002 — receives dual-write from the frontend
 * Stores attendance in local PostgreSQL as backup to Supabase
 */
import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const app = express();
app.use(express.json());

// ── CORS — allow only from your own domain ──────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://admin.exord.net');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── PostgreSQL connection ───────────────────────────────────
const pool = new Pool({
  host:     'localhost',
  port:     5432,
  database: 'exord_hrm',
  user:     'exord_hrm',
  password: 'Exord_HRM@2024',
});

// ── Simple API key auth ─────────────────────────────────────
const API_KEY = 'exord-local-mirror-k9x2m7p4';
const auth = (req, res, next) => {
  if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// ── POST /attendance — save a single record ─────────────────
app.post('/attendance', auth, async (req, res) => {
  const { user_id, type, status, timestamp, location, ip_address, is_late, late_minutes, reason, source } = req.body;
  if (!user_id || !type || !timestamp) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO attendance (user_id, type, status, timestamp, location, ip_address, is_late, late_minutes, reason, source, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       RETURNING id`,
      [user_id, type, status || 'SUCCESS', timestamp,
       location ? JSON.stringify(location) : null,
       ip_address || null, is_late || false,
       late_minutes || 0, reason || null, source || 'live']
    );
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('[AttendanceMirror] Insert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /attendance/bulk — sync offline queue ──────────────
app.post('/attendance/bulk', auth, async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || !records.length) return res.status(400).json({ error: 'No records' });
  const results = [];
  for (const r of records) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO attendance (user_id, type, status, timestamp, location, ip_address, source, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,'offline_queue',NOW())
         ON CONFLICT DO NOTHING RETURNING id`,
        [r.user_id, r.type, r.status || 'SUCCESS', r.timestamp,
         r.location ? JSON.stringify(r.location) : null, r.ip_address || null]
      );
      results.push({ ok: true, id: rows[0]?.id });
    } catch (err) {
      results.push({ ok: false, error: err.message });
    }
  }
  res.json({ success: true, results });
});

// ── GET /attendance/health ──────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) as total FROM attendance');
    res.json({ status: 'ok', total_records: rows[0].total });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.listen(3002, '127.0.0.1', () => {
  console.log('[AttendanceMirror] Local API running on 127.0.0.1:3002');
});
// Temp debug middleware - remove after diagnosis
