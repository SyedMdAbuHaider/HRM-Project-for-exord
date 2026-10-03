import { Router } from 'express';
import { db } from '../db/pool.js';
import { requireAuth } from '../auth/middleware.js';

export const dataRouter = Router();

const TABLES = new Set([
  'login_attempts','notifications','units','departments','users','attendance',
  'custom_role_members','custom_roles','leaves','loan_requests','salaries',
  'activity_logs','pay_scales','gps_logs','user_permissions','role_feature_grants',
  'custom_role_permissions','role_capabilities','leave_policies','system_settings',
  'holidays','duty_roster','department_delegates','unit_approvers','dept_approvers',
  'weekend_work_permissions','profile_change_requests','schedule_change_requests',
  'conversations','conversation_members','messages','message_reads','stored_files'
]);

const ADMIN_ROLES = new Set(['DEVELOPER','ADMIN','CO_ADMIN','HR','MANAGER']);
const tableMap = (name) => ({
  users:'employees',
  leaves:'leave_requests',
  salaries:'salary_records',
  activity_logs:'audit_logs',
  role_feature_grants:'role_capabilities',
  dept_approvers:'department_approvers'
}[name] || name);

const qi = (s) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) throw Object.assign(new Error('Invalid identifier'), {status:400});
  return '"' + s + '"';
};

const deny = (req, table, write) => {
  if (!TABLES.has(table)) throw Object.assign(new Error('Unsupported table'), {status:400});
  if (write && !ADMIN_ROLES.has(req.auth.role)) throw Object.assign(new Error('Permission denied'), {status:403});
};

const selectUsers = (fields) => {
  if (fields === '*' || !fields) {
    return 'e.*,r.code AS role,r.code AS role_code,d.name AS department,u.name AS unit_name,e.password_hash AS password,e.employee_code AS employee_id';
  }
  const m = {
    id:'e.id',employee_code:'e.employee_code',email:'e.email',full_name:'e.full_name',
    name:'e.full_name',phone:'e.phone',password:'e.password_hash',role:'r.code',
    role_code:'r.code',department:'d.name',department_id:'e.department_id',unit_id:'e.unit_id',
    unit_name:'u.name',designation:'e.designation',status:'e.status',joining_date:'e.joining_date',
    weekend_days:'e.weekend_days',avatar_url:'e.avatar_url',avatar:'e.avatar_url',
    join_date:'e.joining_date',unit_location_lat:'u.latitude',unit_location_lng:'u.longitude',
    duty_schedule:'e.duty_schedule',documents:'e.documents',native_role:'r.code',
    base_salary:'e.base_salary',device_id:'e.device_id',father_name:'e.father_name',
    mother_name:'e.mother_name',nid:'e.nid',present_address:'e.present_address',
    permanent_address:'e.permanent_address',doc_deadline:'e.doc_deadline',
    must_change_password:'e.must_change_password',gender:'e.gender',blood_group:'e.blood_group',
    dress_size:'e.dress_size',date_of_birth:'e.date_of_birth',phone_official:'e.phone_official',
    phone_personal:'e.phone_personal',phone_alternative:'e.phone_alternative',religion:'e.religion',
    marital_status:'e.marital_status',nationality:'e.nationality',emergency_name:'e.emergency_name',
    emergency_address:'e.emergency_address',emergency_contact:'e.emergency_contact',
    emergency_relation:'e.emergency_relation',bank_name:'e.bank_name',
    bank_account_number:'e.bank_account_number',bank_branch:'e.bank_branch',
    bank_routing_number:'e.bank_routing_number',festival_leave_1_choice:'e.festival_leave_1_choice',
    festival_leave_2_choice:'e.festival_leave_2_choice',festival_worked_period:'e.festival_worked_period',
    living_children:'e.living_children',late_count:'e.late_count',
    designation_track:'e.designation_track',created_at:'e.created_at',updated_at:'e.updated_at'
  };
  return fields.split(',').map(x=>x.trim()).filter(Boolean)
    .map(k=>m[k] ? m[k]+' AS "'+k+'"' : qi(k)).join(',');
};

const legacySelect = (table, fields) => {
  if (table === 'users') return selectUsers(fields);
  const maps = {
    user_permissions:{user_id:'employee_id',permission:'capability'},
    role_feature_grants:{role:'role_code',feature_key:'capability'},
    custom_role_permissions:{role_id:'role_id',feature_key:'capability'},
    unit_approvers:{unit_id:'unit_id',approver_user_id:'employee_id'},
    dept_approvers:{department:'department_id',approver_user_id:'employee_id'}
  };
  if (maps[table]) {
    if (fields === '*') return '*';
    return fields.split(',').map(x=>x.trim()).filter(Boolean)
      .map(k=>maps[table][k] ? maps[table][k]+' AS "'+k+'"' : qi(k)).join(',');
  }
  if (table === 'role_capabilities' && /^role,\s*capabilities$/.test(fields)) {
    return 'role_code AS role, jsonb_agg(capability) AS capabilities';
  }
  if (table === 'custom_roles' && fields === 'id, name, color') {
    return "id,name,COALESCE(description,'') AS color";
  }
  return fields;
};

const bodyMap = (table, body) => {
  const x = {...(body || {})};
  const ren = (a,c) => { if (a in x && !(c in x)) { x[c]=x[a]; delete x[a]; } };
  if (table==='users') { ren('name','full_name'); ren('password','password_hash'); ren('employee_id','employee_code'); }
  if (table==='leaves') ren('user_id','employee_id');
  if (table==='attendance') { ren('user_id','employee_id'); ren('timestamp','occurred_at'); }
  if (table==='gps_logs') ren('user_id','employee_id');
  if (table==='activity_logs') { ren('user_id','actor_id'); ren('timestamp','created_at'); }
  if (table==='weekend_work_permissions') { ren('user_id','employee_id'); ren('date','work_date'); ren('reviewed_by','reviewed_by_name'); }
  if (table==='duty_roster') { ren('user_id','employee_id'); ren('date','duty_date'); ren('shift_start','check_in_time'); ren('shift_end','check_out_time'); ren('shift_label','shift_name'); ren('created_by','created_by_name'); }
  if (table==='holidays') ren('date','holiday_date');
  if (table==='user_permissions') { ren('user_id','employee_id'); ren('permission','capability'); }
  if (table==='role_feature_grants') { ren('role','role_code'); ren('feature_key','capability'); }
  if (table==='custom_role_permissions') ren('feature_key','capability');
  if (table==='unit_approvers') ren('approver_user_id','employee_id');
  if (table==='dept_approvers') ren('approver_user_id','employee_id');
  return x;
};

const legacy = (table, row) => {
  if (!row) return row;
  const x = {...row};
  if (table==='users') { x.name=x.full_name; x.password=x.password_hash; x.employee_id=x.employee_code; if(x.role_code)x.role=x.role_code; }
  if (table==='leaves') { x.user_id=x.employee_id; x.user_name=x.full_name; x.department=x.department_name; }
  if (table==='salaries') { x.user_id=x.employee_id; x.user_name=x.full_name; }
  if (table==='activity_logs') { x.user_id=x.actor_id; x.timestamp=x.created_at; }
  if (table==='attendance') { x.user_id=x.employee_id; x.timestamp=x.occurred_at; }
  if (table==='gps_logs') x.user_id=x.employee_id;
  if (table==='user_permissions') { x.user_id=x.employee_id; x.permission=x.capability; }
  if (table==='role_feature_grants') { x.role=x.role_code; x.feature_key=x.capability; }
  if (table==='custom_role_permissions') x.feature_key=x.capability;
  if (table==='unit_approvers') x.approver_user_id=x.employee_id;
  if (table==='dept_approvers') x.approver_user_id=x.employee_id;
  if (table==='weekend_work_permissions') { x.user_id=x.employee_id; x.date=x.work_date; x.reviewed_by=x.reviewed_by_name; }
  if (table==='duty_roster') { x.user_id=x.employee_id; x.date=x.duty_date; x.shift_start=x.check_in_time; x.shift_end=x.check_out_time; x.shift_label=x.shift_name; x.created_by=x.created_by_name; }
  if (table==='holidays') x.date=x.holiday_date;
  return x;
};

const addScopedReadFilters = (req, table, where, vals) => {
  const id = req.auth.employeeId;
  if (req.auth.role === 'DEVELOPER' || req.auth.role === 'ADMIN') return;
  if (table === 'notifications') { where.push('recipient_id=$'+(vals.length+1)); vals.push(id); }
  if (table === 'attendance') { where.push('employee_id=$'+(vals.length+1)); vals.push(id); }
  if (table === 'gps_logs') { where.push('employee_id=$'+(vals.length+1)); vals.push(id); }
  if (table === 'conversations') { where.push('id IN (SELECT conversation_id FROM conversation_members WHERE employee_id=$'+(vals.length+1)+' AND hidden_at IS NULL)'); vals.push(id); }
  if (table === 'messages') { where.push('conversation_id IN (SELECT conversation_id FROM conversation_members WHERE employee_id=$'+(vals.length+1)+' AND hidden_at IS NULL)'); vals.push(id); }
};

dataRouter.all('/:table', requireAuth, async (req,res,next) => {
  try {
    const table=req.params.table;
    const write=['POST','PATCH','PUT','DELETE'].includes(req.method);
    deny(req,table,write);
    const actual=tableMap(table);

    if (req.method === 'GET') {
      const vals=[],where=[];
      const fields=legacySelect(table,String(req.query.select||'*'));

      for (const [k,v] of Object.entries(req.query)) {
        const m=k.match(/^(eq|neq|gt|gte|lt|lte|ilike|is|in)\[(.+)\]$/);
        if (!m) continue;
        const op=m[1], col=m[2];
        const mapped=table==='users'
          ? ({id:'e.id',email:'e.email',name:'e.full_name',full_name:'e.full_name'}[col] || qi(col))
          : qi(col);
        if (op==='in') { where.push(mapped+'=ANY($'+(vals.length+1)+')'); vals.push(String(v).split(',')); }
        else if (op==='is' && String(v)==='null') where.push(mapped+' IS NULL');
        else { where.push(mapped+' '+({eq:'=',neq:'<>',gt:'>',gte:'>=',lt:'<',lte:'<=',ilike:'ILIKE'})[op]+' $'+(vals.length+1)); vals.push(v); }
      }

      addScopedReadFilters(req,table,where,vals);

      let sql='SELECT '+fields+' FROM '+(table==='users'
        ? 'employees e LEFT JOIN roles r ON r.id=e.role_id LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN units u ON u.id=e.unit_id'
        : qi(actual));
      if (where.length) sql+=' WHERE '+where.join(' AND ');
      if (table==='role_capabilities' && /^role,\s*capabilities$/.test(String(req.query.select||''))) sql+=' GROUP BY role_code';

      if (req.query.order) {
        const p=String(req.query.order).split('.');
        const col=table==='users' && p[0]==='name' ? 'e.full_name' : qi(p[0]);
        sql+=' ORDER BY '+col+' '+(p[1]==='desc'?'DESC':'ASC');
      }
      sql+=' LIMIT '+Math.min(Math.max(Number(req.query.limit||500),1),1000);
      const out=await db.query(sql,vals);
      return res.json({data:out.rows.map(r=>legacy(table,r)),error:null});
    }

    const filterVals=[],where=[];
    for (const [k,v] of Object.entries(req.query)) {
      const m=k.match(/^(eq|neq|gt|gte|lt|lte|ilike|is|in)\[(.+)\]$/);
      if (!m) continue;
      const op=m[1],col=m[2],mapped=qi(col);
      if (op==='in') { where.push(mapped+'=ANY($'+(filterVals.length+1)+')'); filterVals.push(String(v).split(',')); }
      else if (op==='is' && String(v)==='null') where.push(mapped+' IS NULL');
      else { where.push(mapped+' '+({eq:'=',neq:'<>',gt:'>',gte:'>=',lt:'<',lte:'<=',ilike:'ILIKE'})[op]+' $'+(filterVals.length+1)); filterVals.push(v); }
    }
    if (req.query.id) { where.push('"id"=$'+(filterVals.length+1)); filterVals.push(String(req.query.id)); }

    if (req.method==='DELETE') {
      if (!where.length) throw Object.assign(new Error('a filter is required'),{status:400});
      const out=await db.query('DELETE FROM '+qi(actual)+' WHERE '+where.join(' AND ')+' RETURNING *',filterVals);
      return res.json({data:out.rows.map(r=>legacy(table,r)),error:null});
    }

    const raw=Array.isArray(req.body)?req.body:[req.body];
    const bodies=raw.map(row=>bodyMap(table,row));
    if (!bodies.length || !Object.keys(bodies[0]).length) return res.json({data:[],error:null});

    if (table==='messages' && req.method==='POST') {
      for (const row of bodies) {
        if (!row.conversation_id) throw Object.assign(new Error('conversation_id is required'),{status:400});
        const member=await db.query(
          'SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND employee_id=$2 AND hidden_at IS NULL LIMIT 1',
          [row.conversation_id,req.auth.employeeId]
        );
        if (!member.rowCount) throw Object.assign(new Error('Not a member of this conversation'),{status:403});
        row.sender_id=req.auth.employeeId;
        delete row.employee_id;
      }
    }

    const keys=Object.keys(bodies[0]);
    if (bodies.some(row=>Object.keys(row).join(',')!==keys.join(','))) {
      throw Object.assign(new Error('All inserted rows must contain the same columns'),{status:400});
    }

    if (req.method==='POST') {
      const cols=keys.map(qi).join(',');
      const values=[],tuples=[];
      for (const row of bodies) {
        const ph=[];
        for (const key of keys) { values.push(row[key]); ph.push('$'+values.length); }
        tuples.push('('+ph.join(',')+')');
      }
      const conflict=req.query.onConflict ? String(req.query.onConflict).split(',').filter(Boolean).map(qi).join(',') : '';
      const conflictKeys=String(req.query.onConflict||'').split(',').filter(Boolean);
      const updates=keys.filter(k=>!conflictKeys.includes(k)).map(k=>qi(k)+'=EXCLUDED.'+qi(k)).join(',');
      const sql='INSERT INTO '+qi(actual)+' ('+cols+') VALUES '+tuples+' '+
        (conflict ? 'ON CONFLICT ('+conflict+') DO UPDATE SET '+(updates||qi(keys[0])+'=EXCLUDED.'+qi(keys[0])) : '')+
        ' RETURNING *';
      const out=await db.query(sql,values);
      return res.status(201).json({data:out.rows.map(r=>legacy(table,r)),error:null});
    }

    if (!where.length) throw Object.assign(new Error('a filter is required'),{status:400});
    const body=bodies[0],bodyKeys=Object.keys(body),bodyVals=bodyKeys.map(k=>body[k]);
    const offset=bodyVals.length;
    const shifted=where.map(w=>w.replace(/\$(\d+)/g,(_,n)=>'$'+(Number(n)+offset)));
    const out=await db.query(
      'UPDATE '+qi(actual)+' SET '+bodyKeys.map((k,i)=>qi(k)+'=$'+(i+1)).join(',')+
      ' WHERE '+shifted.join(' AND ')+' RETURNING *',
      [...bodyVals,...filterVals]
    );
    return res.json({data:out.rows.map(r=>legacy(table,r)),error:null});
  } catch(e) { next(e); }
});
