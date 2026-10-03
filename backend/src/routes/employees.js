import { Router } from 'express';
import { db } from '../db/pool.js';
import { requireAuth } from '../auth/middleware.js';

export const employeesRouter = Router();

employeesRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*, r.code AS role_code, d.name AS department_name, u.name AS unit_name
       FROM employees e
       LEFT JOIN roles r ON r.id=e.role_id
       LEFT JOIN departments d ON d.id=e.department_id
       LEFT JOIN units u ON u.id=e.unit_id
       WHERE e.id=$1`,
      [req.auth.employeeId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found' });
    delete rows[0].password_hash;
    res.json({ employee: rows[0] });
  } catch (error) { next(error); }
});