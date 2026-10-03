import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';

const accessKey=new TextEncoder().encode(config.accessTokenSecret);
const refreshKey=new TextEncoder().encode(config.refreshTokenSecret);

export async function createAccessToken(employee){
  return new SignJWT({role:employee.role_code,permissions:employee.permissions||[]})
    .setProtectedHeader({alg:'HS256'}).setSubject(employee.id).setIssuedAt().setExpirationTime('15m').sign(accessKey);
}
export async function verifyAccessToken(token){
  const {payload}=await jwtVerify(token,accessKey,{algorithms:['HS256']}); return payload;
}
export function hashRefreshToken(token){ return crypto.createHash('sha256').update(token).digest('hex'); }
export async function createRefreshToken(employeeId,sessionId){
  return new SignJWT({sid:sessionId,jti:crypto.randomUUID()})
    .setProtectedHeader({alg:'HS256'}).setSubject(employeeId).setIssuedAt().setExpirationTime('30d').sign(refreshKey);
}
export async function verifyRefreshToken(token){
  const {payload}=await jwtVerify(token,refreshKey,{algorithms:['HS256']}); return payload;
}
