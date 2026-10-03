import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '../db/pool.js';
import { TABLE_MAP } from './table-map.js';

const inputArg=process.argv.find(v=>v.startsWith('--input='));
const inputDir=inputArg?inputArg.slice('--input='.length):process.env.SUPABASE_EXPORT_DIR;
if(!inputDir){console.error('Usage: node src/migration/verify-import.js --input=/path/to/export');process.exit(1);}

async function countExport(table){
  for(const ext of ['json','jsonl']){
    try{
      const raw=await fs.readFile(path.join(inputDir,`${table}.${ext}`),'utf8');
      if(ext==='jsonl') return raw.split(/\r?\n/).filter(Boolean).length;
      const data=JSON.parse(raw);
      if(Array.isArray(data)) return data.length;
      return Array.isArray(data?.data)?data.data.length:Array.isArray(data?.rows)?data.rows.length:0;
    }catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return null;
}

const targetCounts={
  employees:'employees',units:'units',departments:'departments',attendance:'attendance',
  leave_requests:'leave_requests',loan_requests:'loan_requests',notifications:'notifications',
  audit_logs:'audit_logs',gps_logs:'gps_logs',pay_scales:'pay_scales',leave_policies:'leave_policies',
  holidays:'holidays',schedule_change_requests:'schedule_change_requests',
  weekend_work_permissions:'weekend_work_permissions',duty_roster:'duty_roster',
  department_delegates:'department_delegates',unit_approvers:'unit_approvers',
  department_approvers:'department_approvers',role_capabilities:'role_capabilities',
  custom_roles:'custom_roles',custom_role_members:'custom_role_members',
  custom_role_permissions:'custom_role_permissions',user_permissions:'user_permissions',
  system_settings:'system_settings',profile_change_requests:'profile_change_requests',
  login_attempts:'login_attempts',conversations:'conversations',conversation_members:'conversation_members',
  messages:'messages',message_reads:'message_reads',stored_files:'stored_files'
};

const report=[];
for(const [source,target] of Object.entries(TABLE_MAP)){
  const sourceCount=await countExport(source);
  if(sourceCount===null) continue;
  if(!targetCounts[target]){report.push({source,target,exportRows:sourceCount,dbRows:null,status:'ARCHIVED/UNMAPPED'});continue;}
  const {rows}=await db.query(`SELECT count(*)::int AS count FROM ${targetCounts[target]}`);
  const dbRows=rows[0].count;
  report.push({source,target,exportRows:sourceCount,dbRows,status:dbRows>=sourceCount?'OK':'CHECK'});
}
console.table(report);
const bad=report.filter(x=>x.status==='CHECK');
if(bad.length){console.error(`Verification found ${bad.length} table count mismatch(es).`);process.exitCode=2;}
else console.log('Verification passed basic row-count checks.');
await db.end();
