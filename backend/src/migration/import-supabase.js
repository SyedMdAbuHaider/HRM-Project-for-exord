import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import argon2 from 'argon2';
import { db, withTransaction } from '../db/pool.js';
import { IMPORT_ORDER, TABLE_MAP } from './table-map.js';

const args = new Set(process.argv.slice(2));
const inputArg = process.argv.find((v) => v.startsWith('--input='));
const INPUT_DIR = inputArg ? inputArg.slice('--input='.length) : process.env.SUPABASE_EXPORT_DIR;
const DRY_RUN = args.has('--dry-run');
const RESET_MAP = args.has('--reset-map');

if (!INPUT_DIR) {
  console.error('Usage: node src/migration/import-supabase.js --input=/path/to/export [--dry-run]');
  process.exit(1);
}

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const pick = (row, ...keys) => keys.map((k) => row?.[k]).find((v) => v !== undefined && v !== null);
const textOrNull = (v) => v === undefined || v === null || v === '' ? null : String(v);
const numOr = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const boolOr = (v, fallback = false) => v === undefined || v === null ? fallback : Boolean(v);
const jsonOr = (v, fallback = {}) => {
  if (v === undefined || v === null || v === '') {
    return fallback === null ? null : JSON.stringify(fallback);
  }
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return JSON.stringify(String(v)); }
  }
  const s = String(v);
  try {
    return JSON.stringify(JSON.parse(s));
  } catch {
    return JSON.stringify(s);
  }
};
const dateOrNull = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const dateOnlyOrNull = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

async function filesFor(table) {
  const candidates = [
    path.join(INPUT_DIR, `${table}.json`),
    path.join(INPUT_DIR, `${table}.jsonl`),
  ];
  for (const file of candidates) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      if (file.endsWith('.jsonl')) return raw.split(/\\r?\\n/).filter(Boolean).map((x) => JSON.parse(x));
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.data)) return parsed.data;
      if (Array.isArray(parsed?.rows)) return parsed.rows;
      return [];
    } catch (err) {
      if (err.code !== 'ENOENT') throw new Error(`Cannot read ${file}: ${err.message}`);
    }
  }
  return null;
}

async function mappedId(client, sourceTable, sourceId, create = true) {
  if (sourceId === undefined || sourceId === null || sourceId === '') return null;
  const key = String(sourceId);
  const existing = await client.query(
    'SELECT target_id FROM migration_id_map WHERE source_table=$1 AND source_id=$2',
    [sourceTable, key],
  );
  if (existing.rowCount) return existing.rows[0].target_id;
  if (!create) return null;
  const targetId = isUuid(key) ? key : crypto.randomUUID();
  await client.query(
    'INSERT INTO migration_id_map(source_table,source_id,target_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
    [sourceTable, key, targetId],
  );
  const check = await client.query(
    'SELECT target_id FROM migration_id_map WHERE source_table=$1 AND source_id=$2',
    [sourceTable, key],
  );
  return check.rows[0].target_id;
}

async function resolve(client, table, value) {
  return mappedId(client, table, value, true);
}


async function resolveEmployeeReference(client, value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const key = String(value).trim();

  const mapped = await mappedId(client, 'users', key, false);
  if (mapped) return mapped;

  const byCode = await client.query(
    'SELECT id FROM employees WHERE lower(trim(employee_code)) = lower(trim($1)) LIMIT 1',
    [key],
  );
  if (byCode.rowCount) return byCode.rows[0].id;

  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  const byName = await client.query(
    "SELECT id FROM employees WHERE lower(regexp_replace(full_name, '[^a-z0-9]', '', 'g')) = $1 LIMIT 1",
    [normalized],
  );
  return byName.rowCount ? byName.rows[0].id : null;
}


const stableUuid = (seed) => {
  const hex = crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
};

async function ensureRole(client, code) {
  const role = String(code || 'EMPLOYEE').toUpperCase();
  const r = await client.query('SELECT id FROM roles WHERE code=$1', [role]);
  if (r.rowCount) return r.rows[0].id;
  const created = await client.query(
    'INSERT INTO roles(code,name) VALUES($1,$2) RETURNING id',
    [role, role.replaceAll('_', ' ')],
  );
  return created.rows[0].id;
}

async function importRoles(client) {
  // Roles are seeded by migration; custom source roles are reconciled by code.
  const rows = (await filesFor('roles')) || [];
  for (const row of rows) await ensureRole(client, pick(row, 'code', 'role', 'name'));
  return rows.length;
}

async function importUnits(client, rows) {
  for (const r of rows) {
    const id = await resolve(client, 'units', pick(r, 'id', 'unit_id'));
    const name = textOrNull(pick(r, 'name', 'unit_name', 'title')) || `Imported Unit ${id.slice(0,8)}`;
    await client.query(
      `INSERT INTO units(id,name,address,latitude,longitude,radius_meters,allowed_ip_cidrs,unit_type,device_type,snmp_config)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,address=EXCLUDED.address,latitude=EXCLUDED.latitude,
       longitude=EXCLUDED.longitude,radius_meters=EXCLUDED.radius_meters,allowed_ip_cidrs=EXCLUDED.allowed_ip_cidrs,
       unit_type=EXCLUDED.unit_type,device_type=EXCLUDED.device_type,snmp_config=EXCLUDED.snmp_config,updated_at=now()`,
      [id, name, textOrNull(pick(r,'address','location')),
       numOr(pick(r,'lat','latitude'), null), numOr(pick(r,'lng','lon','longitude'), null),
       numOr(pick(r,'radius','radius_meters','radiusMeters'), 150),
       Array.isArray(pick(r,'allowed_ip_cidrs','allowedIpCidrs')) ? pick(r,'allowed_ip_cidrs','allowedIpCidrs') : [],
       textOrNull(pick(r,'unit_type','unitType')), textOrNull(pick(r,'device_type','deviceType')),
       jsonOr(pick(r,'snmp_config','snmpConfig'), null)]
    );
  }
}

async function importDepartments(client, rows) {
  for (const r of rows) {
    const id = await resolve(client, 'departments', pick(r, 'id', 'department_id'));
    const primarySource = pick(r, 'unit_id','unitId');
    const list = pick(r, 'unit_ids','unitIds');
    const sourceUnits = Array.isArray(list) ? list : (primarySource ? [primarySource] : []);
    const unitIds = (await Promise.all(sourceUnits.map((x) => resolve(client, 'units', x)))).filter(Boolean);
    const primary = unitIds[0] || null;
    const name = textOrNull(pick(r,'name','department_name','title')) || `Imported Department ${id.slice(0,8)}`;
    await client.query(
      `INSERT INTO departments(id,name,description,unit_id,unit_ids)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,
       unit_id=EXCLUDED.unit_id,unit_ids=EXCLUDED.unit_ids,updated_at=now()`,
      [id,name,textOrNull(pick(r,'description')),primary,unitIds]
    );
  }
}

function normalizePassword(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\$argon2(id|i|d)\$/.test(s) || /^\$2[aby]\$/.test(s) || /^pbkdf2[:$]/i.test(s)) return s;
  return null;
}

async function passwordHash(row) {
  const direct = pick(row,'password_hash','passwordHash');
  const legacy = pick(row,'password');
  const already = normalizePassword(direct || legacy);
  if (already) return already;
  if (legacy) return argon2.hash(String(legacy));
  return null;
}

async function importUsers(client, rows) {
  for (const r of rows) {
    const id = await resolve(client,'users',pick(r,'id','user_id','employee_id'));
    const roleId = await ensureRole(client,pick(r,'role','role_code','user_role'));
    const departmentId = await resolve(client,'departments',pick(r,'department_id','departmentId'));
    const unitId = await resolve(client,'units',pick(r,'unit_id','unitId'));
    const password = await passwordHash(r);
    await client.query(
      `INSERT INTO employees(
        id,employee_code,full_name,email,phone,password_hash,role_id,department_id,unit_id,designation,status,joining_date,
        weekend_days,avatar_url,base_salary,device_id,father_name,mother_name,nid,present_address,permanent_address,
        doc_deadline,must_change_password,gender,blood_group,dress_size,date_of_birth,phone_official,phone_personal,
        phone_alternative,religion,marital_status,nationality,emergency_name,emergency_address,emergency_contact,
        emergency_relation,bank_name,bank_account_number,bank_branch,bank_routing_number,festival_leave_1_choice,
        festival_leave_2_choice,festival_worked_period,living_children,late_count,designation_track
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47)
      ON CONFLICT(id) DO UPDATE SET full_name=EXCLUDED.full_name,email=EXCLUDED.email,phone=EXCLUDED.phone,password_hash=COALESCE(EXCLUDED.password_hash,employees.password_hash),
      role_id=EXCLUDED.role_id,department_id=EXCLUDED.department_id,unit_id=EXCLUDED.unit_id,designation=EXCLUDED.designation,status=EXCLUDED.status,
      joining_date=EXCLUDED.joining_date,weekend_days=EXCLUDED.weekend_days,avatar_url=EXCLUDED.avatar_url,base_salary=EXCLUDED.base_salary,
      device_id=EXCLUDED.device_id,father_name=EXCLUDED.father_name,mother_name=EXCLUDED.mother_name,nid=EXCLUDED.nid,present_address=EXCLUDED.present_address,
      permanent_address=EXCLUDED.permanent_address,doc_deadline=EXCLUDED.doc_deadline,must_change_password=EXCLUDED.must_change_password,gender=EXCLUDED.gender,
      blood_group=EXCLUDED.blood_group,dress_size=EXCLUDED.dress_size,date_of_birth=EXCLUDED.date_of_birth,phone_official=EXCLUDED.phone_official,
      phone_personal=EXCLUDED.phone_personal,phone_alternative=EXCLUDED.phone_alternative,religion=EXCLUDED.religion,marital_status=EXCLUDED.marital_status,
      nationality=EXCLUDED.nationality,emergency_name=EXCLUDED.emergency_name,emergency_address=EXCLUDED.emergency_address,emergency_contact=EXCLUDED.emergency_contact,
      emergency_relation=EXCLUDED.emergency_relation,bank_name=EXCLUDED.bank_name,bank_account_number=EXCLUDED.bank_account_number,bank_branch=EXCLUDED.bank_branch,
      bank_routing_number=EXCLUDED.bank_routing_number,festival_leave_1_choice=EXCLUDED.festival_leave_1_choice,festival_leave_2_choice=EXCLUDED.festival_leave_2_choice,
      festival_worked_period=EXCLUDED.festival_worked_period,living_children=EXCLUDED.living_children,late_count=EXCLUDED.late_count,designation_track=EXCLUDED.designation_track,
      updated_at=now()`,
      [
        id,textOrNull(pick(r,'employee_code','employeeCode','code')),
        textOrNull(pick(r,'name','full_name','fullName')) || 'Imported Employee',
        textOrNull(pick(r,'email')),textOrNull(pick(r,'phone','phone_personal','phonePersonal')),password,roleId,departmentId,unitId,
        textOrNull(pick(r,'designation')),String(pick(r,'status','account_status') || 'ACTIVE').toUpperCase(),
        dateOnlyOrNull(pick(r,'join_date','joining_date','joinDate')),
        Array.isArray(pick(r,'weekend_days','weekendDays')) ? pick(r,'weekend_days','weekendDays') : ['Friday','Saturday'],
        textOrNull(pick(r,'avatar','avatar_url','avatarUrl')),numOr(pick(r,'base_salary','baseSalary'),0),textOrNull(pick(r,'device_id','deviceId')),
        textOrNull(pick(r,'father_name','fatherName')),textOrNull(pick(r,'mother_name','motherName')),textOrNull(pick(r,'nid')),
        textOrNull(pick(r,'present_address','presentAddress')),textOrNull(pick(r,'permanent_address','permanentAddress')),
        dateOrNull(pick(r,'doc_deadline','docDeadline')),boolOr(pick(r,'must_change_password','mustChangePassword'),false),
        textOrNull(pick(r,'gender')),textOrNull(pick(r,'blood_group','bloodGroup')),textOrNull(pick(r,'dress_size','dressSize')),
        dateOnlyOrNull(pick(r,'date_of_birth','dateOfBirth')),
        textOrNull(pick(r,'phone_official','phoneOfficial')),textOrNull(pick(r,'phone_personal','phonePersonal')),textOrNull(pick(r,'phone_alternative','phoneAlternative')),
        textOrNull(pick(r,'religion')),textOrNull(pick(r,'marital_status','maritalStatus')),textOrNull(pick(r,'nationality')),
        textOrNull(pick(r,'emergency_name','emergencyName')),textOrNull(pick(r,'emergency_address','emergencyAddress')),textOrNull(pick(r,'emergency_contact','emergencyContact')),
        textOrNull(pick(r,'emergency_relation','emergencyRelation')),textOrNull(pick(r,'bank_name','bankName')),textOrNull(pick(r,'bank_account_number','bankAccountNumber')),
        textOrNull(pick(r,'bank_branch','bankBranch')),textOrNull(pick(r,'bank_routing_number','bankRoutingNumber')),
        textOrNull(pick(r,'festival_leave_1_choice','festivalLeave1Choice')),textOrNull(pick(r,'festival_leave_2_choice','festivalLeave2Choice')),
        pick(r,'festival_worked_period','festivalWorkedPeriod') == null ? null : Number(pick(r,'festival_worked_period','festivalWorkedPeriod')),
        pick(r,'living_children','livingChildren') == null ? null : Number(pick(r,'living_children','livingChildren')),
        numOr(pick(r,'late_count','lateCount'),0),textOrNull(pick(r,'designation_track','designationTrack'))
      ]
    );
  }
}

async function archiveLegacyRow(client, sourceTable, row) {
  const sourceId = String(pick(row, 'id', 'user_id', 'employee_id', 'key') ?? crypto.randomUUID());
  await client.query(
    'INSERT INTO legacy_import_rows(source_table,source_id,payload) VALUES($1,$2,$3) ON CONFLICT(source_table,source_id) DO UPDATE SET payload=EXCLUDED.payload, imported_at=now()',
    [sourceTable, sourceId, row],
  );
}

async function insertGeneric(client, target, row, sourceTable) {
  const id = await resolve(client, sourceTable, pick(row,'id'));
  const common = {
    attendance: ['employee_id','type','status','occurred_at','location','ip_address','device_id','app_version','source','is_late','late_minutes','reason','client_event_id','synced_at'],
  };
  if (target === 'attendance') {
    const employeeId=await resolve(client,'users',pick(row,'user_id','userId','employee_id'));
    await client.query(`INSERT INTO attendance(id,employee_id,type,status,occurred_at,location,ip_address,device_id,app_version,source,is_late,late_minutes,reason,client_event_id,synced_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(id) DO NOTHING`,
      [id,employeeId,String(pick(row,'type','attendance_type')||'CHECK_IN').toUpperCase(),String(pick(row,'status')||'SUCCESS').toUpperCase(),
       dateOrNull(pick(row,'timestamp','occurred_at','created_at'))||new Date().toISOString(),jsonOr(pick(row,'location'),null),textOrNull(pick(row,'ip_address','ipAddress')),
       textOrNull(pick(row,'device_id','deviceId')),textOrNull(pick(row,'app_version','appVersion')),textOrNull(pick(row,'source'))||'migration',
       boolOr(pick(row,'is_late','isLate'),false),numOr(pick(row,'late_minutes','lateMinutes'),0),textOrNull(pick(row,'reason')),
       isUuid(pick(row,'client_event_id','clientEventId'))?pick(row,'client_event_id','clientEventId'):null,dateOrNull(pick(row,'synced_at'))]); return;
  }
  if (target === 'leave_requests') {
    const employeeId=await resolve(client,'users',pick(row,'user_id','userId','employee_id'));
    const startDate=dateOnlyOrNull(pick(row,'start_date','startDate') ?? pick(row,'from_date'));
    const endDate=dateOnlyOrNull(pick(row,'end_date','endDate') ?? pick(row,'to_date'));
    if (!startDate || !endDate) {
      await archiveLegacyRow(client, sourceTable, {
        ...row,
        _migration_reason: 'Skipped leave request because required start_date/end_date could not be recovered from legacy data',
      });
      return;
    }
    await client.query(`INSERT INTO leave_requests(id,employee_id,leave_type,start_date,end_date,reason,status,current_approver_role,rejection_reason,created_at,updated_at,metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO NOTHING`,
      [id,employeeId,textOrNull(pick(row,'leave_type','leaveType','type'))||'OTHER',
       startDate,endDate,textOrNull(pick(row,'reason')),String(pick(row,'status')||'PENDING').toUpperCase(),
       textOrNull(pick(row,'current_approver_role','currentApproverRole')),textOrNull(pick(row,'rejection_reason','rejectionReason')),
       dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString(),
       dateOrNull(pick(row,'updated_at','updatedAt'))||new Date().toISOString(),jsonOr(pick(row,'metadata'),{})]); return;
  }
  if (target === 'loan_requests') {
    const employeeId=await resolve(client,'users',pick(row,'user_id','userId','employee_id'));
    const reviewedBy=await resolve(client,'users',pick(row,'reviewed_by','reviewedBy'));
    await client.query(`INSERT INTO loan_requests(id,employee_id,type,amount,reason,status,total_months,paid_months,amount_paid,start_month,reviewed_by,reviewed_at,review_note,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(id) DO NOTHING`,
      [id,employeeId,String(pick(row,'type')||'LOAN').toUpperCase(),numOr(pick(row,'amount'),0),textOrNull(pick(row,'reason')),
       String(pick(row,'status')||'PENDING').toUpperCase(),pick(row,'total_months','totalMonths')??null,numOr(pick(row,'paid_months','paidMonths'),0),
       numOr(pick(row,'amount_paid','amountPaid'),0),textOrNull(pick(row,'start_month','startMonth')),reviewedBy,dateOrNull(pick(row,'reviewed_at','reviewedAt')),
       textOrNull(pick(row,'review_note','reviewNote')),dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString()]); return;
  }
  if (target === 'notifications') {
    const recipient=await resolve(client,'users',pick(row,'user_id','userId','recipient_id','recipientId'));
    await client.query(`INSERT INTO notifications(id,recipient_id,title,message,type,metadata,read_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,
      [id,recipient,textOrNull(pick(row,'title'))||'',textOrNull(pick(row,'message','body'))||'',textOrNull(pick(row,'type'))||'SYSTEM',jsonOr(pick(row,'metadata'),{}),
       dateOrNull(pick(row,'read_at','readAt')),dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString()]); return;
  }
  if (target === 'audit_logs') {
    const actorSource=pick(row,'user_id','userId','actor_id','actorId');
    const actor=actorSource ? await mappedId(client,'users',actorSource,false) : null;
    await client.query(`INSERT INTO audit_logs(id,actor_id,action,category,severity,details,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,
      [id,actor,textOrNull(pick(row,'action','event','type'))||'MIGRATED',textOrNull(pick(row,'category'))||'LEGACY',
       textOrNull(pick(row,'severity'))||'INFO',textOrNull(pick(row,'details','description','message')),jsonOr(pick(row,'metadata'),{}),
       dateOrNull(pick(row,'created_at','createdAt','timestamp'))||new Date().toISOString()]); return;
  }
  if (target === 'salary_records') {
    const employee=await resolve(client,'users',pick(row,'user_id','userId','employee_id'));
    const period=String(pick(row,'period','month_year','monthYear') || (pick(row,'year') && pick(row,'month') ? `${pick(row,'year')}-${String(pick(row,'month')).padStart(2,'0')}` : 'IMPORTED'));
    const pr=await client.query('INSERT INTO salary_periods(period) VALUES($1) ON CONFLICT(period) DO UPDATE SET period=EXCLUDED.period RETURNING id',[period]);
    const periodId=pr.rows[0].id;
    await client.query(`INSERT INTO salary_records(id,period_id,employee_id,base_salary,bonus,deductions,net_salary,status,paid_at,metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET base_salary=EXCLUDED.base_salary,bonus=EXCLUDED.bonus,deductions=EXCLUDED.deductions,net_salary=EXCLUDED.net_salary,status=EXCLUDED.status,paid_at=EXCLUDED.paid_at,metadata=EXCLUDED.metadata`,
      [id,periodId,employee,numOr(pick(row,'base_salary','baseSalary','base'),0),numOr(pick(row,'bonus'),0),numOr(pick(row,'deductions','deduction'),0),
       numOr(pick(row,'net_salary','netSalary','net'),0),String(pick(row,'status')||'IMPORTED').toUpperCase(),dateOrNull(pick(row,'paid_at','paidAt')),jsonOr(row,{})]); return;
  }
  if (target === 'conversations') {
    const department=await resolve(client,'departments',pick(row,'department_id','departmentId'));
    const creator=await resolve(client,'users',pick(row,'created_by','createdBy'));
    await client.query(`INSERT INTO conversations(id,type,department_id,name,is_private,created_by,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,
      [id,String(pick(row,'type')||'CUSTOM').toUpperCase(),department,textOrNull(pick(row,'name','title')),boolOr(pick(row,'is_private','isPrivate'),false),creator,dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString(),dateOrNull(pick(row,'updated_at','updatedAt'))||new Date().toISOString()]); return;
  }
  if (target === 'conversation_members') {
    const conversationSource=pick(row,'conversation_id','conversationId');
    const employeeSource=pick(row,'user_id','userId','employee_id');

    const conversation=conversationSource
      ? await mappedId(client,'conversations',conversationSource,false)
      : null;

    const employee=employeeSource
      ? await resolveEmployeeReference(client,employeeSource)
      : null;

    if (!conversation || !employee) {
      await archiveLegacyRow(client, sourceTable, {
        ...row,
        _migration_reason: !conversation && !employee
          ? 'Skipped conversation member because conversation and employee references could not be resolved'
          : !conversation
            ? 'Skipped conversation member because conversation reference could not be resolved'
            : 'Skipped conversation member because employee reference could not be resolved',
      });
      return;
    }

    await client.query(`INSERT INTO conversation_members(conversation_id,employee_id,hidden_at,last_read_at,joined_at)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(conversation_id,employee_id) DO UPDATE SET hidden_at=EXCLUDED.hidden_at,last_read_at=EXCLUDED.last_read_at`,
      [conversation,employee,dateOrNull(pick(row,'hidden_at','hiddenAt')),dateOrNull(pick(row,'last_read_at','lastReadAt')),dateOrNull(pick(row,'joined_at','joinedAt'))||new Date().toISOString()]); return;
  }
  if (target === 'messages') {
    const conversation=await resolve(client,'conversations',pick(row,'conversation_id','conversationId'));
    const sender=await resolve(client,'users',pick(row,'sender_id','senderId','user_id','userId'));

    const replySource=pick(row,'reply_to_id','replyToId');
    const reply=replySource
      ? await mappedId(client,'messages',replySource,false)
      : null;

    await client.query(`INSERT INTO messages(id,conversation_id,sender_id,content,file_url,file_type,file_name,file_size,mentions,reply_to_id,is_deleted,edited_at,created_at,sender_name)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(id) DO NOTHING`,
      [id,conversation,sender,textOrNull(pick(row,'content','message','body')),textOrNull(pick(row,'file_url','fileUrl')),textOrNull(pick(row,'file_type','fileType')),
       textOrNull(pick(row,'file_name','fileName')),pick(row,'file_size','fileSize')==null?null:Number(pick(row,'file_size','fileSize')),
       Array.isArray(pick(row,'mentions'))?pick(row,'mentions'):[],reply,boolOr(pick(row,'is_deleted','isDeleted'),false),dateOrNull(pick(row,'edited_at','editedAt')),
       dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString(),textOrNull(pick(row,'sender_name','senderName'))]); return;
  }
  if (target === 'gps_logs') {
    const employee=await resolve(client,'users',pick(row,'user_id','userId','employee_id'));
    await client.query(`INSERT INTO gps_logs(id,employee_id,latitude,longitude,accuracy_meters,recorded_at,source) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
      [id,employee,numOr(pick(row,'lat','latitude'),0),numOr(pick(row,'lng','longitude'),0),numOr(pick(row,'accuracy','accuracy_meters'),null),
       dateOrNull(pick(row,'timestamp','recorded_at','created_at'))||new Date().toISOString(),textOrNull(pick(row,'source'))||'migration']); return;
  }
  if (target === 'schedule_change_requests') {
    const employee=await resolve(client,'users',pick(row,'employee_id','user_id','userId'));
    const managerSource=pick(row,'manager_approved_by','managerApprovedBy');
    const manager=managerSource ? await mappedId(client,'users',managerSource,false) : null;
    const hrSource=pick(row,'hr_approved_by','hrApprovedBy');
    const hr=hrSource ? await mappedId(client,'users',hrSource,false) : null;
    const rejectedSource=pick(row,'rejected_by','rejectedBy');
    const rejected=rejectedSource ? await mappedId(client,'users',rejectedSource,false) : null;
    await client.query(`INSERT INTO schedule_change_requests(id,employee_id,change_type,requested_check_in,requested_check_out,start_date,end_date,reason,status,advance_notice_hours,policy_violation,manager_approved_by,hr_approved_by,rejected_by,rejection_reason,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT(id) DO NOTHING`,
      [id,employee,String(pick(row,'change_type','changeType')||'TEMPORARY').toUpperCase(),pick(row,'requested_check_in','requestedCheckIn')||'09:00',pick(row,'requested_check_out','requestedCheckOut')||'18:00',
       dateOnlyOrNull(pick(row,'start_date','startDate')),dateOnlyOrNull(pick(row,'end_date','endDate')),
       textOrNull(pick(row,'reason')),String(pick(row,'status')||'PENDING').toUpperCase(),numOr(pick(row,'advance_notice_hours','advanceNoticeHours'),null),
       boolOr(pick(row,'policy_violation','policyViolation'),false),manager,hr,rejected,textOrNull(pick(row,'rejection_reason','rejectionReason')),
       dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString(),dateOrNull(pick(row,'updated_at','updatedAt'))||new Date().toISOString()]); return;
  }
  if (target === 'weekend_work_permissions') {
    const employee=await resolve(client,'users',pick(row,'employee_id','user_id','userId'));
    const approver=await resolve(client,'users',pick(row,'approved_by','approvedBy'));
    await client.query(`INSERT INTO weekend_work_permissions(id,employee_id,work_date,reason,status,approved_by,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
      [id,employee,dateOnlyOrNull(pick(row,'work_date','workDate')),textOrNull(pick(row,'reason')),String(pick(row,'status')||'PENDING').toUpperCase(),approver,dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString()]); return;
  }
  if (target === 'duty_roster') {
    const employee=await resolve(client,'users',pick(row,'employee_id','user_id','userId'));
    const dutyDate=dateOnlyOrNull(pick(row,'duty_date','dutyDate','date'));
    if (!dutyDate) {
      await archiveLegacyRow(client, sourceTable, {
        ...row,
        _migration_reason: 'Skipped duty roster row because required duty_date could not be recovered from legacy data',
      });
      return;
    }
    await client.query(`INSERT INTO duty_roster(id,employee_id,duty_date,check_in_time,check_out_time,shift_name,status,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,
      [id,employee,dutyDate,pick(row,'check_in_time','checkInTime')||null,pick(row,'check_out_time','checkOutTime')||null,
       textOrNull(pick(row,'shift_name','shiftName')),String(pick(row,'status')||'SCHEDULED').toUpperCase(),dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString()]); return;
  }
  if (target === 'department_delegates') {
    const departmentSource=pick(row,'department_id','departmentId');
    let department=departmentSource ? await mappedId(client,'departments',departmentSource,false) : null;
    if (!department) {
      const departmentName=pick(row,'department','department_name','departmentName');
      if (departmentName) {
        const normalized=String(departmentName).trim().toLowerCase();
        const compact=(value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/engineering/g,'').replace(/department|dept/g,'');
        const dr=await client.query(
          "SELECT id,name FROM departments WHERE lower(trim(name)) = $1 LIMIT 1",
          [normalized],
        );
        if (dr.rowCount) department=dr.rows[0].id;
        else {
          const candidates=await client.query('SELECT id,name FROM departments');
          const wanted=compact(departmentName);
          const match=candidates.rows.find((candidate) => compact(candidate.name) === wanted);
          department=match ? match.id : null;
        }
      }
    }
    const employeeSource=pick(row,'employee_id','user_id','userId','delegate_user_id','delegateUserId');
    const employee=employeeSource ? await resolveEmployeeReference(client,employeeSource) : null;
    if (!department || !employee) {
      await archiveLegacyRow(client, sourceTable, {
        ...row,
        _migration_reason: !department && !employee
          ? 'Skipped department delegate because department and employee references could not be resolved'
          : !department
            ? 'Skipped department delegate because department reference could not be resolved'
            : 'Skipped department delegate because employee reference could not be resolved',
      });
      return;
    }
    await client.query(`INSERT INTO department_delegates(id,department_id,employee_id,starts_at,ends_at,created_at)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
      [id,department,employee,dateOrNull(pick(row,'starts_at','startsAt'))||new Date().toISOString(),dateOrNull(pick(row,'ends_at','endsAt')),dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString()]); return;
  }
  if (target === 'unit_approvers') {
    const unitSource=pick(row,'unit_id','unitId');
    const unit=unitSource ? await mappedId(client,'units',unitSource,false) : null;
    const employeeSource=pick(row,'employee_id','user_id','userId','approver_user_id','approverUserId');
    const employee=employeeSource ? await resolveEmployeeReference(client,employeeSource) : null;
    if (!unit || !employee) {
      await archiveLegacyRow(client, sourceTable, {
        ...row,
        _migration_reason: !unit && !employee
          ? 'Skipped unit approver because unit and employee references could not be resolved'
          : !unit
            ? 'Skipped unit approver because unit reference could not be resolved'
            : 'Skipped unit approver because employee reference could not be resolved',
      });
      return;
    }
    await client.query(`INSERT INTO unit_approvers(unit_id,employee_id,role_code) VALUES($1,$2,$3) ON CONFLICT(unit_id,employee_id,role_code) DO NOTHING`,
      [unit,employee,String(pick(row,'role_code','roleCode','role')||'MANAGER').toUpperCase()]); return;
  }
  if (target === 'department_approvers') {
    const department=await resolve(client,'departments',pick(row,'department_id','departmentId'));
    const employee=await resolve(client,'users',pick(row,'employee_id','user_id','userId'));
    await client.query(`INSERT INTO department_approvers(department_id,employee_id,role_code) VALUES($1,$2,$3) ON CONFLICT(department_id,employee_id,role_code) DO NOTHING`,
      [department,employee,String(pick(row,'role_code','roleCode','role')||'MANAGER').toUpperCase()]); return;
  }
  if (target === 'role_capabilities') {
    await client.query(`INSERT INTO role_capabilities(role_code,capability,granted) VALUES($1,$2,$3)
      ON CONFLICT(role_code,capability) DO UPDATE SET granted=EXCLUDED.granted`,
      [String(pick(row,'role_code','roleCode','role')||'EMPLOYEE').toUpperCase(),String(pick(row,'capability','permission','feature')||''),boolOr(pick(row,'granted'),true)]); return;
  }
  if (target === 'custom_roles') {
    const creator=await resolve(client,'users',pick(row,'created_by','createdBy'));
    await client.query(`INSERT INTO custom_roles(id,name,description,created_by,created_at) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,created_by=EXCLUDED.created_by`,
      [id,textOrNull(pick(row,'name','title'))||'Imported Role',textOrNull(pick(row,'description')),creator,dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString()]); return;
  }
  if (target === 'custom_role_members') {
    const role=await resolve(client,'custom_roles',pick(row,'role_id','roleId'));
    const employee=await resolve(client,'users',pick(row,'employee_id','user_id','userId'));
    await client.query(`INSERT INTO custom_role_members(role_id,employee_id) VALUES($1,$2) ON CONFLICT(role_id,employee_id) DO NOTHING`,[role,employee]); return;
  }
  if (target === 'custom_role_permissions') {
    const role=await resolve(client,'custom_roles',pick(row,'role_id','roleId'));
    await client.query(`INSERT INTO custom_role_permissions(role_id,capability,granted) VALUES($1,$2,$3)
      ON CONFLICT(role_id,capability) DO UPDATE SET granted=EXCLUDED.granted`,
      [role,String(pick(row,'capability','permission','feature')||''),boolOr(pick(row,'granted'),true)]); return;
  }
  if (target === 'user_permissions') {
    const employee=await resolve(client,'users',pick(row,'employee_id','user_id','userId'));
    await client.query(`INSERT INTO user_permissions(employee_id,capability,granted) VALUES($1,$2,$3)
      ON CONFLICT(employee_id,capability) DO UPDATE SET granted=EXCLUDED.granted`,
      [employee,String(pick(row,'capability','permission','feature')||''),boolOr(pick(row,'granted'),true)]); return;
  }
  if (target === 'profile_change_requests') {
    const employeeSource=pick(row,'employee_id','user_id','userId');
    const employee=employeeSource ? await resolveEmployeeReference(client,employeeSource) : null;
    if (!employee) {
      await archiveLegacyRow(client, sourceTable, {
        ...row,
        _migration_reason: 'Skipped profile change request because employee reference could not be resolved',
      });
      return;
    }

    const reviewerSource=pick(row,'reviewed_by','reviewedBy');
    const reviewer=reviewerSource ? await resolveEmployeeReference(client,reviewerSource) : null;
    const fieldChanges=pick(row,'field_changes','fieldChanges');
    const entries=fieldChanges && typeof fieldChanges === 'object' && !Array.isArray(fieldChanges)
      ? Object.entries(fieldChanges)
      : [[pick(row,'field_name','fieldName') || 'Legacy Change', {
          old: pick(row,'old_value','oldValue'),
          new: pick(row,'new_value','newValue'),
        }]];

    for (const [fieldName, change] of entries) {
      const value=change && typeof change === 'object' ? change : { new: change, old: null };
      const requestSourceId=String(pick(row,'id') ?? crypto.randomUUID());
      const fieldId=stableUuid(`profile_change_requests:${requestSourceId}:${fieldName}`);
      await client.query(`INSERT INTO profile_change_requests(id,employee_id,field_name,old_value,new_value,reason,status,reviewed_by,review_note,created_at,reviewed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET employee_id=EXCLUDED.employee_id,field_name=EXCLUDED.field_name,old_value=EXCLUDED.old_value,new_value=EXCLUDED.new_value,reason=EXCLUDED.reason,status=EXCLUDED.status,reviewed_by=EXCLUDED.reviewed_by,review_note=EXCLUDED.review_note,created_at=EXCLUDED.created_at,reviewed_at=EXCLUDED.reviewed_at`,
        [fieldId,employee,textOrNull(fieldName) || 'Legacy Change',textOrNull(value.old),textOrNull(value.new),
         textOrNull(pick(row,'reason')),String(pick(row,'status')||'PENDING').toUpperCase(),reviewer,textOrNull(pick(row,'review_note','reviewNote')),
         dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString(),dateOrNull(pick(row,'reviewed_at','reviewedAt'))]);
    }
    return;
  }
  if (target === 'message_reads') {
    const message=await resolve(client,'messages',pick(row,'message_id','messageId'));
    const employee=await resolve(client,'users',pick(row,'employee_id','user_id','userId'));
    await client.query(`INSERT INTO message_reads(message_id,employee_id,read_at) VALUES($1,$2,$3)
      ON CONFLICT(message_id,employee_id) DO UPDATE SET read_at=EXCLUDED.read_at`,
      [message,employee,dateOrNull(pick(row,'read_at','readAt'))||new Date().toISOString()]); return;
  }
  if (target === 'stored_files') {
    const owner=await resolve(client,'users',pick(row,'owner_id','user_id','userId'));
    const conversation=await resolve(client,'conversations',pick(row,'conversation_id','conversationId'));
    await client.query(`INSERT INTO stored_files(id,owner_id,scope,original_name,storage_key,mime_type,size_bytes,checksum_sha256,conversation_id,created_at,deleted_at,source_url)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO NOTHING`,
      [id,owner,String(pick(row,'scope')||'private'),textOrNull(pick(row,'original_name','originalName','file_name','fileName'))||'imported',
       textOrNull(pick(row,'storage_key','storageKey'))||`legacy/${id}`,String(pick(row,'mime_type','mimeType')||'application/octet-stream'),
       numOr(pick(row,'size_bytes','sizeBytes','file_size','fileSize'),0),textOrNull(pick(row,'checksum_sha256','checksumSha256')),conversation,
       dateOrNull(pick(row,'created_at','createdAt'))||new Date().toISOString(),dateOrNull(pick(row,'deleted_at','deletedAt')),textOrNull(pick(row,'source_url','sourceUrl','url'))]); return;
  }

  // For small configuration tables, build a deterministic insert from known target columns.
  const specs = {
    login_attempts: [['identifier','identifier'],['count','count'],['locked_until','locked_until'],['updated_at','updated_at']],
    pay_scales: [['id','id'],['role_code','role_code'],['level','level'],['name','name'],['min_salary','min_salary'],['max_salary','max_salary'],['created_at','created_at']],
    leave_policies: [['id','id'],['name','name'],['leave_type','leave_type'],['min_service_years','min_service_years'],['max_service_years','max_service_years'],['days_allowed','days_allowed'],['created_at','created_at'],['updated_at','updated_at']],
    holidays: [['id','id'],['holiday_date','holiday_date'],['name','name'],['type','type'],['applicable_to','applicable_to'],['extra_pay_multiplier','extra_pay_multiplier'],['note','note'],['created_at','created_at']],
    system_settings: [['key','key'],['value','value'],['description','description'],['updated_by','updated_by'],['updated_at','updated_at']],
  };
  const spec=specs[target];
  if(!spec) { console.warn(`Skipping unsupported target ${target}`); return; }
  const cols=[], vals=[];
  for(const [col,source] of spec){
    let v=pick(row,source);
    if(target==='holidays' && col==='holiday_date') v=pick(row,'holiday_date','holidayDate','date','holidayDateValue','day','start_date');
    if(col==='id') v=id;
    if(col==='updated_by') {
      const updatedBySource=v;
      v=updatedBySource ? await mappedId(client,'users',updatedBySource,false) : null;
      if (updatedBySource && !v) {
        v=null;
      }
    }
    if(col==='value') v=jsonOr(v,{});
    if(['created_at','updated_at','locked_until'].includes(col)) v=dateOrNull(v);
    cols.push(col);
    vals.push(v);
  }
  const placeholders=vals.map((_,i)=>'$'+(i+1)).join(',');
  await client.query(`INSERT INTO ${target}(${cols.join(',')}) VALUES(${placeholders}) ON CONFLICT DO NOTHING`,vals);
}

async function main() {
  const client = await db.connect();
  try {
    if (RESET_MAP && !DRY_RUN) await client.query('TRUNCATE migration_id_map');
    const report=[];
    for (const sourceTable of IMPORT_ORDER) {
      const rows=await filesFor(sourceTable);
      if (rows === null) continue;
      const target=sourceTable==='roles' ? 'roles' : TABLE_MAP[sourceTable];
      if (!target) continue;
      if (DRY_RUN) { report.push({sourceTable,target,count:rows.length}); continue; }
      await withTransaction(async (tx) => {
        if(sourceTable==='roles') await importRoles(tx);
        else if(sourceTable==='units') await importUnits(tx,rows);
        else if(sourceTable==='departments') await importDepartments(tx,rows);
        else if(sourceTable==='users') await importUsers(tx,rows);
        else for(const row of rows) await insertGeneric(tx,target,row,sourceTable);
      });
      report.push({sourceTable,target,count:rows.length});
    }
    console.table(report);
    console.log(DRY_RUN ? 'Dry run complete. No data was written.' : 'Supabase import complete.');
  } finally { client.release(); await db.end(); }
}
main().catch((err)=>{ console.error(err); process.exit(1); });
