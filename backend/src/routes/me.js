import { Router } from 'express';
import { db } from '../db/pool.js';
import { requireAuth } from '../auth/middleware.js';

export const meRouter = Router();

meRouter.get('/', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT e.id, e.employee_code, e.full_name, e.email, e.phone,
            e.designation, e.status, e.joining_date,
            r.code AS role,
            d.id AS department_id, d.name AS department,
            u.id AS unit_id, u.name AS unit
     FROM employees e
     LEFT JOIN roles r ON r.id = e.role_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN units u ON u.id = e.unit_id
     WHERE e.id = $1`,
    [req.auth.employeeId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Employee not found' });
  res.json({ user: rows[0] });
});