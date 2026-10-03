import { Router } from 'express';
import { db, withTransaction } from '../db/pool.js';
import { requireAuth } from '../auth/middleware.js';

export const hrmRouter = Router();

const canManage = (req) => ['DEVELOPER','ADMIN','CO_ADMIN','HR','MANAGER'].includes(req.auth?.role);
const canApproveAll = (req) => ['DEVELOPER','ADMIN'].includes(req.auth?.role);
const nextLeaveStage = (applicantRole, status) => {
  const flow = {
    EMPLOYEE: { PENDING: ['MANAGER','MANAGER_APPROVED'], MANAGER_APPROVED: ['HR','HR_APPROVED'], HR_APPROVED: ['ADMIN','APPROVED'] },
    MANAGER: { PENDING: ['HR','HR_APPROVED'], HR_APPROVED: ['CO_ADMIN','CO_ADMIN_APPROVED'], CO_ADMIN_APPROVED: ['ADMIN','APPROVED'] },
    HR: { PENDING: ['CO_ADMIN','CO_ADMIN_APPROVED'], CO_ADMIN_APPROVED: ['ADMIN','APPROVED'] },
    CO_ADMIN: { PENDING: ['ADMIN','APPROVED'] }
  };
  return flow[applicantRole]?.[status] || null;
};

hrmRouter.get('/units', requireAuth, async (_req,res,next)=>{
  try { const {rows}=await db.query('SELECT * FROM units ORDER BY name'); res.json({units:rows}); } catch(e){next(e);}
});
hrmRouter.get('/departments', requireAuth, async (_req,res,next)=>{
  try { const {rows}=await db.query('SELECT d.*,u.name AS unit_name FROM departments d LEFT JOIN units u ON u.id=d.unit_id ORDER BY d.name'); res.json({departments:rows}); } catch(e){next(e);}
});
hrmRouter.get('/employees', requireAuth, async (req,res,next)=>{
  try {
    const limit=Math.min(Number(req.query.limit||100),500);
    const offset=Math.max(Number(req.query.offset||0),0);
    const {rows}=await db.query(`SELECT e.id,e.employee_code,e.full_name,e.email,e.phone,e.designation,e.status,e.joining_date,e.weekend_days,
      e.avatar_url,e.base_salary,e.device_id,e.department_id,e.unit_id,e.must_change_password,e.gender,e.blood_group,
      e.phone_official,e.phone_personal,e.phone_alternative,e.late_count,e.designation_track,
      r.code AS role_code,d.name AS department_name,u.name AS unit_name
      FROM employees e LEFT JOIN roles r ON r.id=e.role_id LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN units u ON u.id=e.unit_id
      ORDER BY e.full_name LIMIT $1 OFFSET $2`,[limit,offset]);
    res.json({employees:rows,limit,offset});
  } catch(e){next(e);}
});
hrmRouter.get('/leaves', requireAuth, async (req,res,next)=>{
  try {
    const all=canManage(req);
    const {rows}=await db.query(`SELECT l.*,e.full_name AS user_name,e.employee_code,d.name AS department_name
      FROM leave_requests l JOIN employees e ON e.id=l.employee_id LEFT JOIN departments d ON d.id=e.department_id
      WHERE ($1 OR l.employee_id=$2) ORDER BY l.created_at DESC LIMIT 500`,[all,req.auth.employeeId]);
    res.json({leaves:rows});
  } catch(e){next(e);}
});
hrmRouter.post('/leaves', requireAuth, async (req,res,next)=>{
  try {
    const b=req.body||{};
    if(!b.leaveType||!b.startDate||!b.endDate) return res.status(400).json({error:'leaveType, startDate and endDate are required'});
    const roleRow=await db.query('SELECT r.code AS role FROM employees e JOIN roles r ON r.id=e.role_id WHERE e.id=$1',[req.auth.employeeId]);
    const applicantRole=roleRow.rows[0]?.role || 'EMPLOYEE';
    const first=nextLeaveStage(applicantRole,'PENDING') || ['MANAGER','MANAGER_APPROVED'];
    const {rows}=await db.query(`INSERT INTO leave_requests(employee_id,leave_type,start_date,end_date,reason,status,current_approver_role)
      VALUES($1,$2,$3,$4,$5,'PENDING',$6) RETURNING *`,
      [req.auth.employeeId,b.leaveType,b.startDate,b.endDate,b.reason||null,first[0]]);
    res.status(201).json({leave:rows[0]});
  } catch(e){next(e);}
});
hrmRouter.patch('/leaves/:id', requireAuth, async (req,res,next)=>{
  try {
    if(!canManage(req)) return res.status(403).json({error:'Permission denied'});
    const {status,rejectionReason}=req.body||{};
    if(!status) return res.status(400).json({error:'status is required'});
    const out=await withTransaction(async(client)=>{
      const q=await client.query(`SELECT l.*,r.code AS applicant_role
        FROM leave_requests l JOIN employees e ON e.id=l.employee_id
        JOIN roles r ON r.id=e.role_id WHERE l.id=$1 FOR UPDATE`,[req.params.id]);
      const leave=q.rows[0];
      if(!leave) { const err=new Error('Leave not found'); err.status=404; throw err; }
      if(!['REJECTED','APPROVED'].includes(status) && !nextLeaveStage(leave.applicant_role,leave.status)) {
        const err=new Error('Invalid leave status transition'); err.status=409; throw err;
      }
      if(status==='REJECTED'){
        if(!canApproveAll(req) && leave.current_approver_role!==req.auth.role){
          const err=new Error('This leave is not awaiting your approval role'); err.status=403; throw err;
        }
      } else if(status==='APPROVED'){
        if(!canApproveAll(req) || leave.current_approver_role!=='ADMIN'){
          const err=new Error('Only Admin or Developer can finalize this leave'); err.status=403; throw err;
        }
      } else {
        const stage=nextLeaveStage(leave.applicant_role,leave.status);
        if(!stage || stage[1]!==status || (!canApproveAll(req) && stage[0]!==req.auth.role)){
          const err=new Error('This leave is not awaiting your approval role'); err.status=403; throw err;
        }
      }
      const stage=nextLeaveStage(leave.applicant_role,leave.status);
      const nextRole=status==='REJECTED'||status==='APPROVED' ? null : (stage?.[0] || null);
      await client.query(`UPDATE leave_requests
        SET status=$1,rejection_reason=$2,current_approver_role=$3,updated_at=now()
        WHERE id=$4`,[status,status==='REJECTED'?rejectionReason||null:null,nextRole,req.params.id]);
      await client.query('INSERT INTO approval_actions(request_type,request_id,actor_id,action,note) VALUES($1,$2,$3,$4,$5)',
        ['LEAVE',req.params.id,req.auth.employeeId,status,rejectionReason||null]);
      return (await client.query('SELECT * FROM leave_requests WHERE id=$1',[req.params.id])).rows[0];
    });
    res.json({leave:out});
  } catch(e){next(e);}
});
hrmRouter.get('/salaries', requireAuth, async (req,res,next)=>{
  try {
    const {rows}=await db.query(`SELECT sr.*,sp.period,sp.status AS period_status,e.full_name,e.employee_code
      FROM salary_records sr JOIN salary_periods sp ON sp.id=sr.period_id JOIN employees e ON e.id=sr.employee_id
      WHERE ($1 OR sr.employee_id=$2) ORDER BY sp.period DESC,e.full_name`,[canManage(req),req.auth.employeeId]);
    res.json({salaries:rows});
  } catch(e){next(e);}
});
hrmRouter.get('/notifications', requireAuth, async (req,res,next)=>{
  try { const {rows}=await db.query('SELECT * FROM notifications WHERE recipient_id=$1 ORDER BY created_at DESC LIMIT 200',[req.auth.employeeId]); res.json({notifications:rows}); } catch(e){next(e);}
});
hrmRouter.post('/notifications/:id/read', requireAuth, async(req,res,next)=>{
  try { const {rowCount}=await db.query('UPDATE notifications SET read_at=now() WHERE id=$1 AND recipient_id=$2',[req.params.id,req.auth.employeeId]); res.json({success:rowCount===1}); } catch(e){next(e);}
});
