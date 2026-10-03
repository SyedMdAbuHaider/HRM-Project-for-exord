import { verifyAccessToken } from './tokens.js';
import { authorizationContext } from './authorization.js';

export async function requireAuth(req,res,next){
  try{
    const header=req.headers.authorization||'';
    if(!header.startsWith('Bearer ')) return res.status(401).json({error:'Authentication required'});
    const payload=await verifyAccessToken(header.slice(7));
    const employeeId=String(payload.sub);
    const context=await authorizationContext(employeeId);
    req.auth={employeeId,role:payload.role,permissions:context.permissions};
    next();
  }catch{ res.status(401).json({error:'Invalid or expired access token'}); }
}

export function requireRole(...roles){
  return (req,res,next)=>{
    if(!roles.includes(req.auth?.role)) return res.status(403).json({error:'Permission denied'});
    next();
  };
}
