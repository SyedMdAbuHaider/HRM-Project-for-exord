import fs from 'node:fs/promises';
import path from 'node:path';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const out=process.env.SUPABASE_EXPORT_DIR || path.resolve(process.cwd(),'supabase-export');
if(!url||!key){
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the shell. Do not commit the key.');
  process.exit(1);
}

const tables=[
  'users','units','departments','attendance','leaves','salaries','loan_requests','notifications','activity_logs',
  'gps_logs','pay_scales','leave_policies','holidays','schedule_change_requests','weekend_work_permissions',
  'duty_roster','department_delegates','unit_approvers','department_approvers','role_feature_grants',
  'custom_roles','custom_role_members','custom_role_permissions','user_permissions','system_settings',
  'profile_change_requests','login_attempts','conversations','conversation_members','messages','message_reads','stored_files'
];

await fs.mkdir(out,{recursive:true});
const headers={apikey:key,Authorization:`Bearer ${key}`};
for(const table of tables){
  const rows=[];
  let offset=0;
  const pageSize=1000;
  while(true){
    const res=await fetch(`${url.replace(/\/$/,'')}/rest/v1/${table}?select=*&offset=${offset}&limit=${pageSize}`,{headers});
    if(!res.ok){
      const body=await res.text();
      if(res.status===404){ console.warn(`Skipping missing table ${table}`); break; }
      throw new Error(`${table}: HTTP ${res.status}: ${body.slice(0,500)}`);
    }
    const page=await res.json();
    if(!Array.isArray(page)) throw new Error(`${table}: unexpected response`);
    rows.push(...page);
    if(page.length<pageSize) break;
    offset+=pageSize;
  }
  await fs.writeFile(path.join(out,`${table}.json`),JSON.stringify(rows,null,2));
  console.log(`${table}: ${rows.length} rows`);
}
console.log(`Export complete: ${out}`);
