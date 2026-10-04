import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { recordAttendance } from '../services/attendance.js';

export const attendanceRouter = Router();

attendanceRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const record = await recordAttendance({
      employeeId: req.auth.employeeId,
      type: req.body?.type,
      timestamp: req.body?.timestamp,
      location: req.body?.location,
      ipAddress: req.ip,
      deviceId: req.body?.deviceId,
      appVersion: req.body?.appVersion,
      clientEventId: req.body?.clientEventId,
      reason: req.body?.reason
    });
    res.status(201).json({ record });
  } catch (error) {
    next(error);
  }
});

attendanceRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const { rows } = await import('../db/pool.js').then(({ db }) => db.query(
      `SELECT * FROM attendance
       WHERE employee_id = $1
       ORDER BY occurred_at DESC
       LIMIT $2`,
      [req.auth.employeeId, limit]
    ));
    res.json({ records: rows });
  } catch (error) {
    next(error);
  }
});