import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware.js';
export const emailRouter=Router();
const canSend=[requireAuth,requireRole('DEVELOPER','ADMIN','CO_ADMIN','HR','MANAGER')];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function sendEmail(to,subject,html,text=''){
  const key=process.env.RESEND_API_KEY;
  if(!key) throw Object.assign(new Error('RESEND_API_KEY is not configured'),{status:503});
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM||'Exord Online HRM <onboarding@resend.dev>',to:[to],subject,html,text})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.message||JSON.stringify(data));
  return data;
}
emailRouter.post('/send',...canSend,async(req,res,next)=>{try{
 const {to,subject,html,text}=req.body||{};
 if(!to||!subject||!html)return res.status(400).json({error:'to, subject and html are required'});
 const result=await sendEmail(to,subject,html,text||''); res.json({success:true,result});
}catch(e){next(e);}});
emailRouter.post('/broadcast',...canSend,async(req,res,next)=>{try{
 const {recipients,subject,message,type,senderName}=req.body||{};
 if(!Array.isArray(recipients)||!recipients.length||!subject||!message)return res.status(400).json({error:'recipients, subject and message are required.'});
 const label={GENERAL:'General Announcement',SALARY:'Salary Notice',LEAVE:'Leave Notice',SYSTEM:'System Notice'};
 const html=name=>`<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;background:#fff"><div style="background:#E31E24;padding:24px 28px"><h1 style="color:#fff;margin:0">Exord Online</h1><p style="color:#fff;opacity:.8;font-size:11px">${label[type]||'Announcement'}</p></div><div style="padding:28px"><p>Dear <strong>${esc(name)}</strong>,</p><h2>${esc(subject)}</h2><div style="white-space:pre-line;line-height:1.8">${esc(message)}</div></div><div style="padding:16px 28px;background:#f8fafc;font-size:11px;color:#94a3b8">Sent by ${esc(senderName||'Exord HRM')} · Do not reply.</div></div></body></html>`;
 let sent=0,errors=[];for(const r of recipients){try{await sendEmail(r.email,subject,html(r.name),message);sent++;}catch(e){errors.push(`${r.email}: ${e.message}`);}}
 res.json({success:sent>0,sent,failed:errors.length,errors});
}catch(e){next(e);}});
emailRouter.post('/salary-slip',...canSend,async(req,res,next)=>{try{
 const {recipientEmail,recipientName,period,base,bonus,deductions,net,status,lateCount,lateDeduction}=req.body||{};
 if(!recipientEmail||!period)return res.status(400).json({error:'recipientEmail and period are required.'});
 const fmt=n=>'৳ '+Number(n||0).toLocaleString('en-BD');
 const html=`<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;background:#fff"><div style="background:#0f172a;padding:24px 28px"><h1 style="color:#fff;margin:0"><span style="color:#E31E24">Exord</span> Online</h1><p style="color:#94a3b8;font-size:10px">Human Resources Management</p></div><div style="padding:24px 28px"><h2>Salary Slip</h2><p>${esc(period)}</p><p>Dear <strong>${esc(recipientName||'Employee')}</strong>, your salary is ready.</p><table style="width:100%;border-collapse:collapse"><tr><td>Basic Salary</td><td style="text-align:right">${fmt(base)}</td></tr><tr><td>Bonus / Allowances</td><td style="text-align:right">+${fmt(bonus)}</td></tr><tr><td>Deductions${lateCount>0?` (${lateCount} late = ${fmt(lateDeduction)})`:''}</td><td style="text-align:right">-${fmt(deductions)}</td></tr><tr style="background:#0f172a;color:#fff"><td style="padding:14px;font-weight:900">Net Payable</td><td style="padding:14px;text-align:right;font-weight:900;color:#E31E24">${fmt(net)}</td></tr></table><p>Status: <strong>${esc(status||'UNPAID')}</strong></p></div></div></body></html>`;
 await sendEmail(recipientEmail,`Your Salary Slip — ${period}`,html,`Salary Slip — ${period}\nNet Payable: ${fmt(net)}\nStatus: ${status||'UNPAID'}`);
 res.json({success:true});
}catch(e){next(e);}});
