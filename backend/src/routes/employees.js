import { Router } from 'express';
import argon2 from 'argon2';
import { db, withTransaction } from '../db/pool.js';
import { requireAuth } from '../auth/middleware.js';
import { requireCapability } from '../auth/authorization.js';

export const employeesRouter = Router();

const EMPLOYEE_FIELDS = [
  'full_name','email','phone','designation','status','joining_date','weekend_days',
  'avatar_url','base_salary','device_id','father_name','mother_name','nid',
  'present_address','permanent_address','doc_deadline','must_change_password',
  'gender','blood_group','dress_size','date_of_birth','phone_official',
  'phone_personal','phone_alternative','religion','marital_status','nationality',
  'emergency_name','emergency_address','emergency_contact','emergency_relation',
  'bank_name','bank_account_number','bank_branch','bank_routing_number',
  'festival_leave_1_choice','festival_leave_2_choice','festival_worked_period',
  'living_children','late_count','designation_track'
];

const employeeSelect = `SELECT e.id,e.employee_code,e.full_name,e.email,e.phone,e.designation,e.status,
  e.joining_date,e.weekend_days,e.avatar_url,e.base_salary,e.device_id,e.father_name,e.mother_name,
  e.nid,e.present_address,e.permanent_address,e.doc_deadline,e.must_change_password,e.gender,
  e.blood_group,e.dress_size,e.date_of_birth,e.phone_official,e.phone_personal,e.phone_alternative,
  e.religion,e.marital_status,e.nationality,e.emergency_name,e.emergency_address,e.emergency_contact,
  e.emergency_relation,e.bank_name,e.bank_account_number,e.bank_branch,e.bank_routing_number,
  e.festival_leave_1_choice,e.festival_leave_2_choice,e.festival_worked_period,e.living_children,
  e.late_count,e.designation_track,e.department_id,e.unit_id,r.code AS role_code,
  d.name AS department_name,u.name AS unit_name
  FROM employees e
  LEFT JOIN roles r ON r.id=e.role_id
  LEFT JOIN departments d ON d.id=e.department_id
  LEFT JOIN units u ON u.id=e.unit_id`;

employeesRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(`${employeeSelect} WHERE e.id=$1`, [req.auth.employeeId]);
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found' });
    res.json({ employee: rows[0] });
  } catch (error) { next(error); }
});

employeesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const limit=Math.min(Math.max(Number(req.query.limit||100),1),500);
    const offset=Math.max(Number(req.query.offset||0),0);
    const q=String(req.query.q||'').trim();
    const {rows}=await db.query(
      `${employeeSelect}
       WHERE ($3='' OR e.full_name ILIKE '%'||$3||'%' OR e.employee_code ILIKE '%'||$3||'%' OR e.email ILIKE '%'||$3||'%')
       ORDER BY e.full_name LIMIT $1 OFFSET $2`,
      [limit,offset,q]
    );
    res.json({employees:rows,limit,offset});
  } catch(error){next(error);}
});

employeesRouter.post('/', requireAuth, requireCapability('hrm.employees.manage'), async (req,res,next)=>{
  try {
    const b=req.body||{};
    if(!b.fullName && !b.full_name) return res.status(400).json({error:'fullName is required'});
    const fullName=b.fullName||b.full_name;
    const roleCode=String(b.role||b.roleCode||'EMPLOYEE').toUpperCase();
    const passwordHash=b.password ? await argon2.hash(String(b.password)) : null;
    const out=await withTransaction(async(client)=>{
      const role=await client.query('SELECT id FROM roles WHERE code=$1',[roleCode]);
      if(!role.rows[0]) { const e=new Error('Invalid role'); e.status=400; throw e; }
      const result=await client.query(
        `INSERT INTO employees(employee_code,full_name,email,phone,password_hash,role_id,department_id,unit_id,designation,status,joining_date,weekend_days,base_salary)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [b.employeeCode||b.employee_code||null,fullName,b.email||null,b.phone||null,passwordHash,
         role.rows[0].id,b.departmentId||b.department_id||null,b.unitId||b.unit_id||null,
         b.designation||null,b.status||'ACTIVE',b.joiningDate||b.joining_date||null,
         b.weekendDays||b.weekend_days||['Friday','Saturday'],Number(b.baseSalary||b.base_salary||0)]
      );
      await client.query(
        `INSERT INTO audit_logs(actor_id,action,category,severity,metadata)
         VALUES($1,'EMPLOYEE_CREATED','HRM','INFO',$2)`,
        [req.auth.employeeId,JSON.stringify({employeeId:result.rows[0].id})]
      );
      return result.rows[0].id;
    });
    const {rows}=await db.query(`${employeeSelect} WHERE e.id=$1`,[out]);
    res.status(201).json({employee:rows[0]});
  } catch(error){next(error);}
});

employeesRouter.patch('/:id', requireAuth, requireCapability('hrm.employees.manage'), async (req,res,next)=>{
  try {
    const b=req.body||{};
    const sets=[],values=[];
    for(const field of EMPLOYEE_FIELDS){
      const camel=field.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
      if(Object.prototype.hasOwnProperty.call(b,field) || Object.prototype.hasOwnProperty.call(b,camel)){
        sets.push(`e.${field}=$${values.length+1}`);
        values.push(b[field]!==undefined?b[field]:b[camel]);
      }
    }
    if(Object.prototype.hasOwnProperty.call(b,'departmentId')){sets.push(`e.department_id=$${values.length+1}`);values.push(b.departmentId);}
    if(Object.prototype.hasOwnProperty.call(b,'unitId')){sets.push(`e.unit_id=$${values.length+1}`);values.push(b.unitId);}
    if(Object.prototype.hasOwnProperty.call(b,'role') || Object.prototype.hasOwnProperty.call(b,'roleCode')){
      const code=String(b.role||b.roleCode).toUpperCase();
      const role=await db.query('SELECT id FROM roles WHERE code=$1',[code]);
      if(!role.rows[0]) return res.status(400).json({error:'Invalid role'});
      sets.push(`e.role_id=$${values.length+1}`);values.push(role.rows[0].id);
    }
    if(!sets.length) return res.status(400).json({error:'No supported fields supplied'});
    sets.push('e.updated_at=now()');
    values.push(req.params.id);
    const result=await db.query(`UPDATE employees e SET ${sets.join(',')} WHERE e.id=$${values.length} RETURNING e.id`,values);
    if(!result.rows[0]) return res.status(404).json({error:'Employee not found'});
    await db.query(`INSERT INTO audit_logs(actor_id,action,category,severity,metadata) VALUES($1,'EMPLOYEE_UPDATED','HRM','INFO',$2)`,[req.auth.employeeId,JSON.stringify({employeeId:req.params.id})]);
    const {rows}=await db.query(`${employeeSelect} WHERE e.id=$1`,[req.params.id]);
    res.json({employee:rows[0]});
  } catch(error){next(error);}
});

employeesRouter.delete('/:id', requireAuth, requireCapability('hrm.employees.manage'), async (req,res,next)=>{
  try {
    if(req.params.id===req.auth.employeeId) return res.status(400).json({error:'You cannot deactivate your own account'});
    const {rowCount}=await db.query(`UPDATE employees SET status='INACTIVE',updated_at=now() WHERE id=$1`,[req.params.id]);
    if(!rowCount) return res.status(404).json({error:'Employee not found'});
    await db.query(`UPDATE auth_sessions SET revoked_at=now() WHERE employee_id=$1 AND revoked_at IS NULL`,[req.params.id]);
    await db.query(`INSERT INTO audit_logs(actor_id,action,category,severity,metadata) VALUES($1,'EMPLOYEE_DEACTIVATED','HRM','WARN',$2)`,[req.auth.employeeId,JSON.stringify({employeeId:req.params.id})]);
    res.json({success:true});
  } catch(error){next(error);}
});
