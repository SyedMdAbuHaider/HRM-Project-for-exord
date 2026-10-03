import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '../db/pool.js';
import { requireAuth } from '../auth/middleware.js';

export const filesRouter = Router();
const ROOT = process.env.HRM_FILE_ROOT || '/srv/hrm-migration/files';
const MAX = Number(process.env.HRM_MAX_FILE_BYTES || 52428800);
const ALLOWED = new Set([
  'image/jpeg','image/png','image/gif','image/webp',
  'video/mp4','video/webm','audio/mpeg','audio/wav','audio/ogg',
  'application/pdf','text/plain','application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

function ext(name='') { const e=path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g,''); return e.slice(0,12); }
function category(mime='') {
  if(mime.startsWith('image/')) return 'image';
  if(mime.startsWith('video/')) return 'video';
  if(mime.startsWith('audio/')) return 'audio';
  return 'document';
}
async function saveUpload(req,res,next,scope) {
  try {
    const file=req.file;
    if(!file) return res.status(400).json({error:'file is required'});
    if(file.size>MAX) return res.status(413).json({error:'file exceeds maximum size'});
    if(!ALLOWED.has(file.mimetype)) return res.status(415).json({error:'file type is not allowed'});
    const ownerId=req.auth.employeeId;
    const conversationId=scope==='chat' ? String(req.header('X-Conv-Id')||'') : null;
    if(scope==='chat' && !conversationId) return res.status(400).json({error:'X-Conv-Id is required'});
    if(scope==='chat'){
      const member=await db.query('SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2',[conversationId,ownerId]);
      if(!member.rowCount) return res.status(403).json({error:'Not a conversation member'});
    }
    const buf=file.buffer;
    const checksum=crypto.createHash('sha256').update(buf).digest('hex');
    const id=crypto.randomUUID();
    const rel=path.join(scope,new Date().toISOString().slice(0,10),id+ext(file.originalname));
    const full=path.join(ROOT,rel);
    await fs.mkdir(path.dirname(full),{recursive:true});
    await fs.writeFile(full,buf,{flag:'wx'});
    const out=await db.query(`INSERT INTO stored_files(id,owner_id,scope,original_name,storage_key,mime_type,size_bytes,checksum_sha256,conversation_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,original_name,storage_key,mime_type,size_bytes,conversation_id,created_at`,
      [id,ownerId,scope,file.originalname,rel,file.mimetype,file.size,checksum,conversationId]);
    const row=out.rows[0];
    res.status(201).json({url:'/files/'+encodeURIComponent(rel),filename:path.basename(rel),originalName:row.original_name,size:Number(row.size_bytes),type:category(row.mime_type),mimeType:row.mime_type,id:row.id});
  } catch(e){next(e);}
}
filesRouter.post('/upload/avatar',requireAuth,async(req,res,next)=>saveUpload(req,res,next,'avatar'));
filesRouter.post('/upload/document',requireAuth,async(req,res,next)=>saveUpload(req,res,next,'document'));
filesRouter.post('/upload/chat',requireAuth,async(req,res,next)=>saveUpload(req,res,next,'chat'));
