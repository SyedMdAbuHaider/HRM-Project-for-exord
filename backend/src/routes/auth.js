import { Router } from 'express';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import { db } from '../db/pool.js';
import { createAccessToken, createRefreshToken, hashRefreshToken, verifyRefreshToken } from '../auth/tokens.js';

export const authRouter = Router();

const normalizeIdentifier = (value) => String(value || '').trim().toLowerCase();

async function getEmployee(identifier) {
  const { rows } = await db.query(
    `SELECT e.*, r.code AS role_code
     FROM employees e
     LEFT JOIN roles r ON r.id = e.role_id
     WHERE lower(e.email) = $1 OR lower(e.employee_code) = $1
     LIMIT 1`,
    [normalizeIdentifier(identifier)]
  );
  return rows[0] || null;
}

authRouter.post('/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identifier and password are required' });
  }

  const employee = await getEmployee(identifier);
  if (!employee || employee.status !== 'ACTIVE' || !employee.password_hash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await argon2.verify(employee.password_hash, password);
  if (!valid) {
    await db.query(
      `INSERT INTO audit_logs(actor_id, action, category, severity, details)
       VALUES ($1,'AUTH_LOGIN_FAILED','AUTH','WARN',$2)`,
      [employee.id, 'Invalid login attempt']
    );
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sessionId = crypto.randomUUID();
  const refreshToken = await createRefreshToken(employee.id, sessionId);
  const accessToken = await createAccessToken(employee);

  await db.query(
    `INSERT INTO auth_sessions
      (id, employee_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1,$2,$3,$4,$5,now()+interval '30 days')`,
    [
      sessionId,
      employee.id,
      hashRefreshToken(refreshToken),
      req.get('user-agent') || null,
      req.ip || null
    ]
  );

  await db.query(
    `INSERT INTO audit_logs(actor_id, action, category, severity)
     VALUES ($1,'AUTH_LOGIN','AUTH','INFO')`,
    [employee.id]
  );

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: employee.id,
      employeeCode: employee.employee_code,
      name: employee.full_name,
      email: employee.email,
      role: employee.role_code,
      departmentId: employee.department_id,
      unitId: employee.unit_id
    }
  });
});

authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required' });

  try {
    const payload = await verifyRefreshToken(refreshToken);
    const sessionId = String(payload.sid);
    const employeeId = String(payload.sub);

    const { rows } = await db.query(
      `SELECT e.*, r.code AS role_code
       FROM auth_sessions s
       JOIN employees e ON e.id = s.employee_id
       LEFT JOIN roles r ON r.id = e.role_id
       WHERE s.id = $1
         AND s.employee_id = $2
         AND s.refresh_token_hash = $3
         AND s.revoked_at IS NULL
         AND s.expires_at > now()`,
      [sessionId, employeeId, hashRefreshToken(refreshToken)]
    );

    const employee = rows[0];
    if (!employee || employee.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Refresh session is invalid' });
    }

    const accessToken = await createAccessToken(employee);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Refresh token is invalid or expired' });
  }
});

authRouter.post('/logout', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    try {
      const payload = await verifyRefreshToken(refreshToken);
      await db.query(
        'UPDATE auth_sessions SET revoked_at = now() WHERE id = $1',
        [String(payload.sid)]
      );
    } catch {}
  }
  res.json({ success: true });
});