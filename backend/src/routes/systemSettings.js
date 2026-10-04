import { Router } from 'express';
import { db } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export const systemSettingsRouter = Router();
const ALLOWED_KEYS = new Set(['allowed_ip_subnets','allowed_origins','smtp_config','provident_fund_rate']);
const developerOnly = [requireAuth, requireRole('DEVELOPER')];

systemSettingsRouter.get('/', ...developerOnly, async (req,res,next)=>{
  try {
    const requested=String(req.query.keys||'').split(',').map(v=>v.trim()).filter(Boolean);
    const keys=requested.length?requested.filter(k=>ALLOWED_KEYS.has(k)):[...ALLOWED_KEYS];
    const {rows}=await db.query('SELECT key,value,updated_by,updated_at FROM system_settings WHERE key=ANY($1) ORDER BY key',[keys]);
    res.json({settings:rows});
  } catch(e){next(e);}
});

systemSettingsRouter.put('/:key', ...developerOnly, async (req,res,next)=>{
  try {
    const key=String(req.params.key);
    if(!ALLOWED_KEYS.has(key)) return res.status(400).json({error:'Unsupported system setting'});
    if(!Object.prototype.hasOwnProperty.call(req.body||{},'value')) return res.status(400).json({error:'value is required'});
    const {rows}=await db.query(
      `INSERT INTO system_settings(key,value,updated_by,updated_at) VALUES($1,$2::jsonb,$3,now())
       ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=now()
       RETURNING key,value,updated_by,updated_at`,
      [key,JSON.stringify(req.body.value),req.auth.employeeId]
    );
    res.json({setting:rows[0]});
  } catch(e){next(e);}
});
