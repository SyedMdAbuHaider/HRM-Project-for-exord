import { db } from '../db/pool.js';

export async function getEffectivePermissions(employeeId) {
  const { rows } = await db.query(`
    WITH role_grants AS (
      SELECT rc.capability, rc.granted FROM employees e
      JOIN roles r ON r.id=e.role_id
      JOIN role_capabilities rc ON rc.role_code=r.code WHERE e.id=$1
    ), custom_grants AS (
      SELECT crp.capability, crp.granted FROM custom_role_members crm
      JOIN custom_role_permissions crp ON crp.role_id=crm.role_id WHERE crm.employee_id=$1
    ), user_grants AS (
      SELECT capability, granted FROM user_permissions WHERE employee_id=$1
    )
    SELECT capability, granted, 1 AS priority FROM role_grants
    UNION ALL SELECT capability, granted, 2 FROM custom_grants
    UNION ALL SELECT capability, granted, 3 FROM user_grants
  `, [employeeId]);
  const effective=new Map();
  for (const row of rows.sort((a,b)=>Number(a.priority)-Number(b.priority))) effective.set(row.capability,row.granted);
  return [...effective.entries()].filter(([,granted])=>granted).map(([capability])=>capability);
}

export async function hasCapability(employeeId, capability) {
  const permissions=await getEffectivePermissions(employeeId);
  return permissions.includes('*') || permissions.includes(capability);
}

export function requireCapability(capability) {
  return async (req,res,next)=>{
    try {
      if(!req.auth?.employeeId) return res.status(401).json({error:'Authentication required'});
      if(!(await hasCapability(req.auth.employeeId,capability))) return res.status(403).json({error:'Permission denied',capability});
      next();
    } catch(error){ next(error); }
  };
}

export async function authorizationContext(employeeId) {
  return { permissions: await getEffectivePermissions(employeeId) };
}
