import { Router } from 'express';
import argon2 from 'argon2';
import { db } from '../db/pool.js';
import { requireAuth } from '../auth/middleware.js';

export const meRouter = Router();

meRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.id, e.employee_code, e.full_name, e.email, e.phone,
              e.designation, e.status, e.joining_date, e.avatar_url,
              e.base_salary, e.device_id, e.gender, e.blood_group,
              e.phone_official, e.phone_personal, e.phone_alternative,
              e.father_name, e.mother_name, e.nid, e.present_address,
              e.permanent_address, e.date_of_birth, e.religion, e.marital_status,
              e.nationality, e.emergency_name, e.emergency_address,
              e.emergency_contact, e.emergency_relation, e.bank_name,
              e.bank_account_number, e.bank_branch, e.bank_routing_number,
              e.late_count, e.designation_track, e.must_change_password,
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
  } catch (error) {
    next(error);
  }
});

meRouter.post('/password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const { rows } = await db.query(
      'SELECT password_hash FROM employees WHERE id=$1',
      [req.auth.employeeId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found' });

    if (rows[0].password_hash) {
      const mustChange = (await db.query('SELECT must_change_password FROM employees WHERE id=$1',[req.auth.employeeId])).rows[0]?.must_change_password;
      if (mustChange === true) {
        // Initial-access credentials may be replaced without requiring the temporary password again.
      } else {
        if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
        if (!(await argon2.verify(rows[0].password_hash, currentPassword))) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }
      }
    }

    const passwordHash = await argon2.hash(newPassword);
    await db.query(
      `UPDATE employees
       SET password_hash=$1,must_change_password=false,updated_at=now()
       WHERE id=$2`,
      [passwordHash, req.auth.employeeId]
    );
    await db.query(
      `INSERT INTO audit_logs(actor_id,action,category,severity)
       VALUES($1,'AUTH_PASSWORD_CHANGED','AUTH','INFO')`,
      [req.auth.employeeId]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
