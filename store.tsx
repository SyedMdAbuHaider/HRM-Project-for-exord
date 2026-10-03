import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from './serverOwnedClient';
import { api } from './apiClient';

// ── Offline Attendance Queue (inlined to avoid Vite circular dep issues) ─────
const _AQ_KEY = 'exord_attendance_queue';
const _aqGet  = (): any[] => { try { return JSON.parse(localStorage.getItem(_AQ_KEY) || '[]'); } catch { return []; } };
const _aqSave = (q: any[]) => localStorage.setItem(_AQ_KEY, JSON.stringify(q));
const _aqAdd  = (entry: { userId: string; type: string; timestamp: string; location: any; ipAddress: string }) => {
  const item = { ...entry, _qid: crypto.randomUUID(), _retries: 0, _qAt: new Date().toISOString() };
  _aqSave([..._aqGet(), item]);
  return item;
};
const _aqDone = (qid: string) => _aqSave(_aqGet().filter((i: any) => i._qid !== qid));
const _aqRetry= (qid: string) => _aqSave(_aqGet().map((i: any) => i._qid === qid ? { ...i, _retries: i._retries + 1 } : i));
// ─────────────────────────────────────────────────────────────────────────────

// ── Local PostgreSQL mirror (dual-write backup) ───────────────────────────────
const LOCAL_API     = 'http://127.0.0.1:3002';
const LOCAL_API_KEY = 'exord-local-mirror-k9x2m7p4';
const _mirrorAttendance = async (record: Record<string, any>): Promise<void> => {
  try {
    await fetch('/mirror/attendance', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': LOCAL_API_KEY },
      body:    JSON.stringify(record),
    });
  } catch {
    // Mirror failure is silent — Supabase is the source of truth
  }
};
// ─────────────────────────────────────────────────────────────────────────────


import { resolveDesignationFromSalary, getTierIndex } from './designationConstants';
import {
  User, UserRole, AttendanceRecord, LeaveRequest, LoanRequest, SalaryRecord,
  ActivityLog, GPSLog, LeaveStatus, Unit, Department, Notification,
  WeekDay, canApproveLeave, getNextApprover, PayScale, LeavePolicy,
  ScheduleChangeRequest, getLateInfo, DEFAULT_DUTY_SCHEDULE
} from './types';
import { isUnitIp, calculateDistance, formatCurrency, hashPassword } from './utils';
import { SECURITY_RULES } from './constants';
import { uploadAvatar as uploadAvatarToFileServer } from './fileService';

// ── CIDR IP matching ─────────────────────────────────────────────────────────
// Checks whether an IPv4 address falls inside a CIDR block (e.g. "43.230.120.0/22").
// Uses proper bitmask arithmetic — NOT string prefix matching.
const ipv4ToInt = (ip: string): number => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return -1;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};
const ipInCidr = (ip: string, cidr: string): boolean => {
  try {
    const [base, bits] = cidr.split('/');
    const mask = bits === undefined ? 32 : parseInt(bits, 10);
    const baseInt = ipv4ToInt(base);
    const ipInt   = ipv4ToInt(ip);
    if (baseInt === -1 || ipInt === -1) return false;
    const maskBits = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
    return (ipInt & maskBits) === (baseInt & maskBits);
  } catch { return false; }
};

// All IP ranges that are considered "on the corporate/LAN network"
// → geofence is skipped, nearest unit is found from ALL units instead.
const ALLOWED_IP_CIDRS: string[] = [
  // Private / LAN
  '10.0.0.0/8', '192.168.0.0/16', '172.16.0.0/12', '127.0.0.0/8',
  // Exord subscriber public IPv4 blocks
  '43.230.120.0/22', '103.49.168.0/22', '103.85.240.0/22',
  '116.204.154.0/23', '119.15.154.0/23',
  // Exord VPN host
  '103.125.235.23/32',
];
const isAllowedIp = (ip: string): boolean =>
  ALLOWED_IP_CIDRS.some(cidr => ipInCidr(ip, cidr));

// ── Dhaka timestamp ───────────────────────────────────────────────────────────
// Always stores attendance in Asia/Dhaka local time (UTC+6) as an ISO string.
// This prevents the "3 PM shows as 4:20 AM" bug caused by toISOString() using UTC.
const dhakaISOString = (): string => {
  // Use Intl to format in Dhaka timezone, then reconstruct ISO
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  // Returns e.g. "2025-05-29T15:30:00+06:00"
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+06:00`;
};

// Returns a date string for today in Dhaka timezone for "same day" comparisons.
// Prevents midnight UTC rollover (18:00 UTC = 00:00 Dhaka next day) from
// breaking todayRecs filters.
const dhakaTodayStr = (): string => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); // "YYYY-MM-DD"
};
// Compare a stored timestamp (may be UTC or +06:00) against Dhaka today
const isSameDhakaDay = (timestamp: string): boolean => {
  return new Date(timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }) === dhakaTodayStr();
};

// ── Login rate limiter ────────────────────────────────────────────────────────
// Two-layer defence:
//   1. localStorage (fast client-side UX guard — survives tab reloads)
//   2. Supabase DB table `login_attempts` (server-side — cannot be bypassed
//      by clearing localStorage or switching browsers)
//
// Required SQL (run once in Supabase SQL editor):
// -----------------------------------------------
// CREATE TABLE IF NOT EXISTS login_attempts (
//   identifier   text PRIMARY KEY,
//   count        int  NOT NULL DEFAULT 0,
//   locked_until timestamptz,
//   updated_at   timestamptz DEFAULT now()
// );
// -----------------------------------------------
interface AttemptEntry { count: number; lockedUntil: number; }

const RL_KEY = 'exord_login_attempts';
const LOGIN_LOCK_MS = 15 * 60 * 1000;

// ── localStorage helpers (layer 1) ───────────────────────────────────────────
const _loadAttempts = (): Map<string, AttemptEntry> => {
  try {
    const raw = localStorage.getItem(RL_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch { return new Map(); }
};

const _saveAttempts = (map: Map<string, AttemptEntry>) => {
  try {
    localStorage.setItem(RL_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {}
};

const loginAttempts = _loadAttempts();

const checkRateLimit = (identifier: string): { allowed: boolean; waitMs: number } => {
  const entry = loginAttempts.get(identifier);
  if (!entry) return { allowed: true, waitMs: 0 };
  const now = Date.now();
  if (entry.lockedUntil > now) return { allowed: false, waitMs: entry.lockedUntil - now };
  if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
    loginAttempts.delete(identifier);
    _saveAttempts(loginAttempts);
    return { allowed: true, waitMs: 0 };
  }
  return { allowed: true, waitMs: 0 };
};

const recordFailedAttempt = (identifier: string) => {
  const now = Date.now();
  const entry = loginAttempts.get(identifier) || { count: 0, lockedUntil: 0 };
  const newCount = entry.count + 1;
  loginAttempts.set(identifier, {
    count: newCount,
    lockedUntil: newCount >= SECURITY_RULES.MAX_LOGIN_ATTEMPTS ? now + LOGIN_LOCK_MS : 0,
  });
  _saveAttempts(loginAttempts);
};

const clearAttempts = (identifier: string) => {
  loginAttempts.delete(identifier);
  _saveAttempts(loginAttempts);
};

// ── Supabase DB rate-limit helpers (layer 2 — cannot be bypassed) ────────────
const checkServerRateLimit = async (identifier: string): Promise<{ allowed: boolean; waitMs: number }> => {
  try {
    const { data } = await supabase
      .from('login_attempts')
      .select('count, locked_until')
      .eq('identifier', identifier)
      .maybeSingle();
    if (!data) return { allowed: true, waitMs: 0 };
    if (data.locked_until) {
      const lockedUntil = new Date(data.locked_until).getTime();
      const now = Date.now();
      if (lockedUntil > now) return { allowed: false, waitMs: lockedUntil - now };
    }
    return { allowed: true, waitMs: 0 };
  } catch { return { allowed: true, waitMs: 0 }; }
};

const recordServerFailedAttempt = async (identifier: string): Promise<void> => {
  try {
    const { data: existing } = await supabase
      .from('login_attempts')
      .select('count')
      .eq('identifier', identifier)
      .maybeSingle();
    const newCount = (existing?.count || 0) + 1;
    const lockedUntil = newCount >= SECURITY_RULES.MAX_LOGIN_ATTEMPTS
      ? new Date(Date.now() + LOGIN_LOCK_MS).toISOString()
      : null;
    await supabase.from('login_attempts').upsert(
      { identifier, count: newCount, locked_until: lockedUntil, updated_at: new Date().toISOString() },
      { onConflict: 'identifier' }
    );
  } catch { /* table not yet created — client-side guard still active */ }
};

const clearServerAttempts = async (identifier: string): Promise<void> => {
  try {
    await supabase.from('login_attempts').delete().eq('identifier', identifier);
  } catch { /* silent */ }
};

interface HRMContextType {
  currentUser: User | null;
  users: User[];
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  salaries: SalaryRecord[];
  activityLogs: ActivityLog[];
  gpsLogs: GPSLog[];
  units: Unit[];
  departments: Department[];
  notifications: Notification[];
  payScales: PayScale[];
  theme: 'light' | 'dark';
  isTracking: boolean;
  isLoading: boolean;
  toggleTheme: () => void;
  setTracking: (active: boolean) => void;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; message: string }>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  createEmployee: (employeeData: any) => Promise<{ success: boolean; message: string }>;
  deleteEmployee: (id: string) => Promise<{ success: boolean; message: string }>;
  uploadAvatar: (userId: string, file: File) => Promise<{ success: boolean; url?: string; message: string }>;
  addUnit: (unit: Omit<Unit, 'id'>) => Promise<void>;
  updateUnit: (id: string, unit: Partial<Unit>) => Promise<void>;
  addDepartment: (dept: Omit<Department, 'id'>) => Promise<void>;
  updateDepartment: (id: string, dept: Partial<Department>) => Promise<void>;
  checkIn: (lat: number, lng: number, accuracy: number, ip: string) => Promise<{ success: boolean; message: string }>;
  checkOut: (lat: number, lng: number, accuracy: number, ip: string) => Promise<{ success: boolean; message: string }>;
  breakStart: (lat: number, lng: number, accuracy: number, ip: string, breakType?: string) => Promise<{ success: boolean; message: string }>;
  breakEnd: (lat: number, lng: number, accuracy: number, ip: string) => Promise<{ success: boolean; message: string }>;
  applyLeave: (leave: Omit<LeaveRequest, 'id' | 'status' | 'userName' | 'userRole' | 'department'>) => Promise<void>;
  deleteLeave: (id: string) => Promise<void>;
  loanRequests: LoanRequest[];
  applyLoan: (type: 'LOAN' | 'ADVANCE_SALARY', amount: number, reason: string) => Promise<{ success: boolean; message: string }>;
  reviewLoan: (id: string, status: 'APPROVED' | 'REJECTED', note?: string) => Promise<void>;
  addExistingLoan: (userId: string, type: 'LOAN' | 'ADVANCE_SALARY', amount: number, reason: string, totalMonths: number, paidMonths: number, amountPaid: number, startMonth: string) => Promise<{ success: boolean; message: string }>;
  setLoanRepaymentPlan: (id: string, totalMonths: number, monthlyInstallment: number, startMonth: string) => Promise<void>;
  updateLoanRepayment: (id: string, paidMonths: number, amountPaid: number) => Promise<void>;
  updateLeave: (id: string, status: LeaveStatus, rejectionReason?: string) => Promise<void>;
  addSalary: (salary: Omit<SalaryRecord, 'id'>) => Promise<void>;
  updateSalary: (id: string, updates: Partial<SalaryRecord>) => Promise<void>;
  deleteSalary: (id: string) => Promise<void>;
  sendNotification: (recipientId: string, title: string, message: string, type: Notification['type'], metadata?: any) => Promise<{ success: boolean; message: string }>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  addActivityLog: (action: string, category: ActivityLog['category'], details: string, severity: ActivityLog['severity'], metadata?: any) => Promise<void>;
  addAuditLog: (action: string, details: string, severity: ActivityLog['severity']) => Promise<void>;
  // ── Activity log deletion (admin only) ──────────────────────────────────────
  deleteActivityLog: (id: string) => Promise<void>;
  deleteAllActivityLogs: () => Promise<void>;
  // ────────────────────────────────────────────────────────────────────────────
  addGPSLog: (log: GPSLog) => void;
  refreshData: () => Promise<void>;
  refreshGpsLogs: () => Promise<void>;
  deleteUnit: (id: string) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  addPayScale: (ps: Omit<PayScale, 'id' | 'createdAt'>) => Promise<void>;
  updatePayScale: (id: string, updates: Partial<PayScale>) => Promise<void>;
  deletePayScale: (id: string) => Promise<void>;
  userPermissions: Record<string, string[]>;
  // ── Delegation: find the active approver for a dept (considering leaves/weekends) ──
  departmentDelegates: DepartmentDelegate[];
  setDepartmentDelegate: (dept: string, userId: string) => Promise<{ success: boolean; message: string }>;
  removeDepartmentDelegate: (dept: string) => Promise<{ success: boolean; message: string }>;
  getDelegateApprover: (dept: string, normalRole: UserRole) => User | null;
  canApproveLeaveExtended: (leave: LeaveRequest) => boolean;
  customRoles: { id: string; name: string; color: string }[];
  roleFeatureGrants: Record<string, string[]>;  // built-in role -> feature keys
  customRoleFeatureGrants: Record<string, string[]>; // custom role ID -> feature keys
  grantPermission: (userId: string, permission: string) => Promise<void>;
  revokePermission: (userId: string, permission: string) => Promise<void>;
  hasPermission: (userId: string, permission: string) => boolean;
  refreshCustomRolePerms: () => Promise<void>;
  leavePolicies: LeavePolicy[];
  addLeavePolicy: (p: Omit<LeavePolicy, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateLeavePolicy: (id: string, updates: Partial<LeavePolicy>) => Promise<void>;
  deleteLeavePolicy: (id: string) => Promise<void>;
  // ── Schedule Change Requests ─────────────────────────────────────────────
  scheduleChangeRequests: any[];
  requestScheduleChange: (data: any) => Promise<{ success: boolean; message: string }>;
  reviewScheduleChange: (id: string, status: string, rejectionReason?: string) => Promise<void>;
  // ── Attendance deletion ──────────────────────────────────────────────────
  deleteAttendanceRecord: (id: string) => Promise<void>;
  deleteAllAttendanceForDate: (dateStr: string, userId?: string) => Promise<void>;
  // ── Document deadline ────────────────────────────────────────────────────
  setDocDeadline: (userId: string, deadline: string | null) => Promise<{ success: boolean; message: string }>;
  setDocDeadlineBulk: (userIds: string[], deadline: string | null) => Promise<{ success: boolean; message: string }>;
  // ── Holidays / Off-day calendar ──────────────────────────────────────────
  holidays: Holiday[];
  addHoliday: (h: Omit<Holiday, 'id' | 'createdAt'>) => Promise<{ success: boolean; message: string }>;
  updateHoliday: (id: string, updates: Partial<Omit<Holiday, 'id' | 'createdAt'>>) => Promise<{ success: boolean; message: string }>;
  deleteHoliday: (id: string) => Promise<{ success: boolean; message: string }>;
  // ── Weekend Work Permissions ────────────────────────────────────────────────
  weekendWorkPermissions: WeekendWorkPermission[];
  requestWeekendWork: (date: string, reason: string) => Promise<{ success: boolean; message: string }>;
  reviewWeekendWork: (id: string, status: 'APPROVED' | 'REJECTED', note?: string) => Promise<{ success: boolean; message: string }>;
  // ── Duty Roster ─────────────────────────────────────────────────────────────
  dutyRoster: RosterEntry[];
  upsertRosterEntry: (entry: Omit<RosterEntry, 'id' | 'createdAt' | 'createdBy'>) => Promise<{ success: boolean; message: string }>;
  deleteRosterEntry: (id: string) => Promise<{ success: boolean; message: string }>;
}

// FEATURES is now auto-generated from featureRegistry.ts.
// To add a new feature to the permissions system, edit featureRegistry.ts only.
export { FEATURES } from './featureRegistry';

export interface Holiday {
  id: string;
  date: string;          // 'YYYY-MM-DD'
  name: string;
  type: 'holiday' | 'special_duty';
  assignedUserIds: string[];  // who must work on special_duty days
  applicableTo: 'all' | 'muslim' | 'hindu' | 'christian' | 'buddhist' | 'custom'; // religion filter
  unitIds: string[];           // unit-wise filter for special duty (empty = all units)
  extraPayMultiplier: number;  // 1.5, 2, 2.5, 3 — default 0 means 1.5×
  note: string;
  createdAt: string;
}

// ── Weekend Work Permission ────────────────────────────────────────────────────
export interface WeekendWorkPermission {
  id: string;
  userId: string;
  userName: string;
  department: string;
  date: string;          // 'YYYY-MM-DD' — the weekend date they want to work
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
}

// ── Duty Roster (Support dept & shift-based teams) ────────────────────────────
export interface RosterEntry {
  id: string;
  userId: string;
  userName: string;
  department: string;
  date: string;          // 'YYYY-MM-DD'
  shiftStart: string;    // 'HH:MM' — kept for DB compat, same as checkInTime
  shiftEnd: string;      // 'HH:MM' — kept for DB compat, same as checkOutTime
  checkInTime: string;   // alias for shiftStart (used in view)
  checkOutTime: string;  // alias for shiftEnd (used in view)
  shiftLabel: string;    // 'Morning' | 'Day' | 'Evening' | 'Night' | 'Custom'
  note?: string;
  createdBy: string;
  createdAt: string;
}
// Alias for backward compat
export type DutyRosterEntry = RosterEntry;

// Departments that use roster-based scheduling
export const ROSTER_DEPARTMENTS = [
  'Accounting & Finance Department',
  'Administration',
  'Administration and Legal Department',
  'Customer Relationship Management',
  'Graphics Design & Multimedia Department',
  'Human Resource & Administration Department',
  'Human Resource Management',
  'Inventory & Asset Management Department',
  'Network Operation & Engineering Department',
  'Sales & Business Development Department',
  'Support & Technology Department',
];

export interface DepartmentDelegate {
  id: string;
  department: string;
  normalRole: string;
  delegateUserId: string;
  delegateUserName: string;
  createdBy: string;
  createdAt: string;
}

const HRMContext = createContext<HRMContextType | undefined>(undefined);

const genId = (prefix: string) => `${prefix}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

const mapUnit = (r: any): Unit => ({
  id: r.id,
  name: r.name,
  lat: r.lat,
  lng: r.lng,
  radius: r.radius,
  unitType: r.unit_type || r.unitType || 'office',
  snmpConfig: r.snmp_config || r.snmpConfig || undefined,
  headUserId: r.head_user_id || undefined,
});
const mapDept = (r: any): Department => {
  const unitIds: string[] = r.unit_ids
    ? (typeof r.unit_ids === 'string' ? JSON.parse(r.unit_ids) : r.unit_ids)
    : (r.unit_id ? [r.unit_id] : []);
  const unitId = unitIds[0] || r.unit_id || '';
  return { id: r.id, name: r.name, unitId, unitIds };
};

const mapUser = (r: any): User => ({
  id: r.id, name: r.name, email: r.email,
  role: r.role as UserRole, department: r.department, baseSalary: r.base_salary,
  deviceId: r.device_id, unitLocation: { lat: r.unit_location_lat || 0, lng: r.unit_location_lng || 0 },
  fatherName: r.father_name, motherName: r.mother_name, nid: r.nid,
  presentAddress: r.present_address, permanentAddress: r.permanent_address,
  mustChangePassword: r.must_change_password, joinDate: r.join_date,
  avatar: r.avatar || null,
  weekendDays: r.weekend_days
    ? (typeof r.weekend_days === 'string' ? JSON.parse(r.weekend_days) : r.weekend_days)
    : ['Friday', 'Saturday'],
  dutySchedule: r.duty_schedule
    ? (typeof r.duty_schedule === 'string' ? JSON.parse(r.duty_schedule) : r.duty_schedule)
    : undefined,
  lateCount: r.late_count || 0,
  designation: r.designation || undefined,
  designationTrack: (r.designation_track as 'EXECUTIVE' | 'TECHNICIAN' | null) ?? null,
  unitId: r.unit_id || undefined,
  gender: r.gender || undefined,
  bloodGroup: r.blood_group || undefined,
  dressSize: r.dress_size || undefined,
  dateOfBirth: r.date_of_birth || undefined,
  phoneOfficial: r.phone_official || undefined,
  phonePersonal: r.phone_personal || undefined,
  phoneAlternative: r.phone_alternative || undefined,
  religion: r.religion || undefined,
  maritalStatus: r.marital_status || undefined,
  nationality: r.nationality || undefined,
  emergencyName: r.emergency_name || undefined,
  emergencyAddress: r.emergency_address || undefined,
  emergencyContact: r.emergency_contact || undefined,
  emergencyRelation: r.emergency_relation || undefined,
  bankName: r.bank_name || undefined,
  bankAccountNumber: r.bank_account_number || undefined,
  bankBranch: r.bank_branch || undefined,
  bankRoutingNumber: r.bank_routing_number || undefined,
  documents: r.documents
    ? (typeof r.documents === 'string' ? JSON.parse(r.documents) : r.documents)
    : undefined,
  docDeadline: r.doc_deadline || null,
});

// ── FIX #17: Map isLate and lateMinutes from DB columns ──────────────────────
const mapAttendance = (r: any): AttendanceRecord => ({
  id: r.id, userId: r.user_id, timestamp: r.timestamp, type: r.type,
  location: { lat: r.lat || 0, lng: r.lng || 0, accuracy: r.accuracy || 0 },
  ipAddress: r.ip_address, status: r.status, reason: r.reason,
  isLate: r.is_late ?? false,
  lateMinutes: r.late_minutes ?? 0,
});

const mapLeave = (r: any): LeaveRequest => ({
  id: r.id, userId: r.user_id, userName: r.user_name,
  userRole: (r.user_role as UserRole) || UserRole.EMPLOYEE,
  department: r.department || '',
  startDate: r.start_date, endDate: r.end_date,
  type: r.type, status: r.status as LeaveStatus, reason: r.reason,
  managerApprovedBy: r.manager_approved_by, hrApprovedBy: r.hr_approved_by,
  coAdminApprovedBy: r.co_admin_approved_by, finalApprovedBy: r.final_approved_by,
  rejectedBy: r.rejected_by, rejectionReason: r.rejection_reason,
});
const mapSalary = (r: any): SalaryRecord => ({
  id: r.id, userId: r.user_id, userName: r.user_name,
  month: r.month, year: r.year, base: r.base, bonus: r.bonus,
  deductions: r.deductions, net: r.net, status: r.status,
});
const mapLog = (r: any): ActivityLog => ({
  id: r.id, timestamp: r.timestamp, userId: r.user_id, userName: r.user_name,
  action: r.action, category: r.category, details: r.details,
  severity: r.severity, ipAddress: r.ip_address, metadata: r.metadata,
});
const mapNotification = (r: any): Notification => ({
  id: r.id, recipientId: r.recipient_id, senderId: r.sender_id,
  senderName: r.sender_name, title: r.title, message: r.message,
  type: r.type, metadata: r.metadata, isRead: r.is_read, createdAt: r.created_at,
});
const mapLoan = (r: any): LoanRequest => ({
  id: r.id, userId: r.user_id, userName: r.user_name,
  department: r.department, type: r.type, amount: r.amount,
  reason: r.reason, status: r.status, createdAt: r.created_at,
  reviewedBy: r.reviewed_by, reviewNote: r.review_note,
  // ── Repayment fields ──────────────────────────────────────────────────────
  totalMonths:       r.total_months       ?? 0,
  paidMonths:        r.paid_months        ?? 0,
  amountPaid:        r.amount_paid        ?? 0,
  monthlyInstallment:r.monthly_installment?? 0,
  startMonth:        r.start_month        ?? null,
  isExistingLoan:    r.is_existing_loan   ?? false,
} as any);
const mapPayScale = (r: any): PayScale => ({
  id: r.id, role: r.role as UserRole, level: r.level,
  name: r.name, minSalary: r.min_salary, maxSalary: r.max_salary,
  createdAt: r.created_at,
});
const mapLeavePolicy = (r: any): LeavePolicy => ({
  id: r.id, name: r.name, leaveType: r.leave_type,
  minServiceYears: r.min_service_years ?? 0,
  maxServiceYears: r.max_service_years ?? 99,
  daysAllowed: r.days_allowed,
  description: r.description || '',
  createdAt: r.created_at,
  updatedAt: r.updated_at || r.created_at,
});

const mapScheduleChangeRequest = (r: any): ScheduleChangeRequest => ({
  id: r.id,
  userId: r.user_id,
  userName: r.user_name,
  department: r.department,
  changeType: r.change_type,
  requestedCheckIn: r.requested_check_in,
  requestedCheckOut: r.requested_check_out,
  startDate: r.start_date || undefined,
  endDate: r.end_date || undefined,
  reason: r.reason,
  status: r.status,
  managerApprovedBy: r.manager_approved_by || undefined,
  hrApprovedBy: r.hr_approved_by || undefined,
  rejectedBy: r.rejected_by || undefined,
  rejectionReason: r.rejection_reason || undefined,
  createdAt: r.created_at,
});

export const HRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [gpsLogs, setGpsLogs] = useState<GPSLog[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitApproversMap, setUnitApproversMap] = useState<Record<string, string>>({});
  const [deptApproversMap, setDeptApproversMap] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [payScales, setPayScales] = useState<PayScale[]>([]);
  const [userPermissions, setUserPermissions] = useState<Record<string, string[]>>({});
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string; color: string }[]>([]);
  const [roleFeatureGrants, setRoleFeatureGrants] = useState<Record<string, string[]>>({});
  // custom role ID → feature keys granted to that custom role
  const [customRoleFeatureGrants, setCustomRoleFeatureGrants] = useState<Record<string, string[]>>({});
  // role → capability keys from role_capabilities table (RoleCapabilitiesView)
  const [roleCapabilities, setRoleCapabilities] = useState<Record<string, string[]>>({});
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [profileChangeRequests, setProfileChangeRequests] = useState<any[]>([]);
  const [scheduleChangeRequests, setScheduleChangeRequests] = useState<ScheduleChangeRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [weekendWorkPermissions, setWeekendWorkPermissions] = useState<WeekendWorkPermission[]>([]);
  const [dutyRoster, setDutyRoster] = useState<RosterEntry[]>([]);
  const [departmentDelegates, setDepartmentDelegates] = useState<DepartmentDelegate[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [allowedSubnets, setAllowedSubnets] = useState<string[]>(['192.168.1']);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('exord-theme') as 'light' | 'dark') || 'dark'; } catch { return 'dark'; }
  });

  useEffect(() => {
    try { localStorage.setItem('exord-theme', theme); } catch {}
    theme === 'dark' ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(p => p === 'light' ? 'dark' : 'light'), []);
  const setTracking = useCallback((active: boolean) => setIsTracking(active), []);

  const loadNotificationsForUser = useCallback(async (userId: string) => {
    const { data } = await supabase.from('notifications').select('*')
      .eq('recipient_id', userId).order('created_at', { ascending: false }).limit(100);
    if (data) setNotifications(data.map(mapNotification));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase
      .channel(`notif-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${currentUser.id}` },
        (payload) => { setNotifications(prev => [mapNotification(payload.new as any), ...prev]); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // PHASE 1: Critical only — unblocks UI fast
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const [u, d, us, atToday] = await Promise.all([
        supabase.from('units').select('*').order('created_at'),
        supabase.from('departments').select('*').order('created_at'),
        supabase.from('users').select('id,name,email,role,department,base_salary,unit_id,device_id,unit_location_lat,unit_location_lng,father_name,mother_name,nid,present_address,permanent_address,must_change_password,join_date,avatar,weekend_days,duty_schedule,late_count,gender,blood_group,dress_size,date_of_birth,phone_official,phone_personal,phone_alternative,religion,marital_status,nationality,emergency_name,emergency_address,emergency_contact,emergency_relation,documents,doc_deadline,designation,designation_track,bank_name,bank_account_number,bank_branch,bank_routing_number').order('created_at'),
        supabase.from('attendance').select('*')
          .gte('timestamp', todayStart.toISOString())
          .order('timestamp', { ascending: false }),
      ]);

      if (u.data) setUnits(u.data.map(mapUnit));
      if (d.data) setDepartments(d.data.map(mapDept));

      if (us.data) {
        const mappedUsers = us.data.map(mapUser);
        try {
          const { data: crm } = await supabase.from('custom_role_members').select('user_id,role_id');
          const { data: crNative } = await supabase.from('custom_roles').select('id,native_role');
          if (crm?.length) crm.forEach(m => {
            const idx = mappedUsers.findIndex(u => u.id === m.user_id);
            if (idx !== -1) {
              const nativeRole = crNative?.find(r => r.id === m.role_id)?.native_role;
              const resolvedRole = (nativeRole && Object.values(UserRole).includes(nativeRole as UserRole))
                ? nativeRole as UserRole
                : `custom::${m.role_id}` as any;
              mappedUsers[idx] = { ...mappedUsers[idx], role: resolvedRole };
            }
          });
        } catch {}
        setUsers(mappedUsers);
        try {
          const saved = localStorage.getItem('exord-session');
          if (saved) {
            const { id } = JSON.parse(saved);
            const found = mappedUsers.find(u => u.id === id);
            if (found) { setCurrentUser(found); await loadNotificationsForUser(found.id); }
          }
        } catch {}
      }
      if (atToday.data) setAttendance(atToday.data.map(mapAttendance));

      // UI unblocked here
      setIsLoading(false);

      // PHASE 2: Background loads — fire and forget
      (async () => {
        // Attendance history (last 90 days, excluding today)
        try {
          const { data: atHist } = await supabase.from('attendance').select('*')
            .gte('timestamp', ninetyDaysAgo.toISOString())
            .lt('timestamp', todayStart.toISOString())
            .order('timestamp', { ascending: false })
            .limit(2000);
          if (atHist) setAttendance(prev => {
            const existingIds = new Set(prev.map((a: any) => a.id));
            const newRecs = atHist.map(mapAttendance).filter((a: any) => !existingIds.has(a.id));
            return [...prev, ...newRecs];
          });
        } catch {}

        // Leaves, loans, salaries
        try {
          const [lv, ln, sl] = await Promise.all([
            supabase.from('leaves').select('*').order('created_at', { ascending: false }),
            supabase.from('loan_requests').select('*').order('created_at', { ascending: false }),
            supabase.from('salaries').select('*').order('created_at', { ascending: false }),
          ]);
          if (lv.data) setLeaves(lv.data.map(mapLeave));
          if (ln.data) setLoanRequests(ln.data.map(mapLoan));
          if (sl.data) setSalaries(sl.data.map(mapSalary));
        } catch {}

        // Activity logs + pay scales
        try {
          const [lg, ps] = await Promise.all([
            supabase.from('activity_logs').select('*')
              .gte('timestamp', thirtyDaysAgo.toISOString())
              .order('timestamp', { ascending: false })
              .limit(1000),
            supabase.from('pay_scales').select('*').order('role,level'),
          ]);
          if (lg.data) setActivityLogs(lg.data.map(mapLog));
          if (ps.data) setPayScales(ps.data.map(mapPayScale));
        } catch {}

        // GPS logs
        try {
          const { data: gpsData } = await supabase.from('gps_logs').select('*')
            .gte('timestamp', new Date(Date.now() - 86400000).toISOString())
            .order('timestamp', { ascending: false })
            .limit(500);
          if (gpsData) setGpsLogs(gpsData.map(r => ({
            userId: r.user_id, lat: r.lat, lng: r.lng,
            accuracy: r.accuracy || 0, timestamp: r.timestamp,
          })));
        } catch {}

        // Permissions
        try {
          const { data: permData } = await supabase.from('user_permissions').select('user_id, permission');
          if (permData) {
            const map: Record<string, string[]> = {};
            permData.forEach(r => { if (!map[r.user_id]) map[r.user_id] = []; map[r.user_id].push(r.permission); });
            setUserPermissions(map);
          }
        } catch {}

        try {
          const { data: rfgData } = await supabase.from('role_feature_grants').select('role, feature_key');
          if (rfgData) {
            const map: Record<string, string[]> = {};
            rfgData.forEach((r: any) => { if (!map[r.role]) map[r.role] = []; map[r.role].push(r.feature_key); });
            setRoleFeatureGrants(map);
          }
        } catch {}

        try {
          const { data: crpData } = await supabase.from('custom_role_permissions').select('role_id, feature_key');
          if (crpData) {
            const map: Record<string, string[]> = {};
            crpData.forEach((r: any) => { if (!map[r.role_id]) map[r.role_id] = []; map[r.role_id].push(r.feature_key); });
            setCustomRoleFeatureGrants(map);
          }
        } catch {}

        try {
          const { data: rcData } = await supabase.from('role_capabilities').select('role, capabilities');
          if (rcData) {
            const map: Record<string, string[]> = {};
            rcData.forEach((r: any) => {
              try { map[r.role] = typeof r.capabilities === 'string' ? JSON.parse(r.capabilities) : (r.capabilities || []); }
              catch { map[r.role] = []; }
            });
            setRoleCapabilities(map);
          }
        } catch {}

        try {
          const { data: lpData } = await supabase.from('leave_policies').select('*').order('leave_type,min_service_years');
          if (lpData) setLeavePolicies(lpData.map(mapLeavePolicy));
        } catch {}

        try {
          const { data: pcrData, error: pcrErr } = await supabase.from('profile_change_requests')
            .select('*').order('created_at', { ascending: false }).limit(200);
          if (pcrErr) console.warn('PCR load error:', pcrErr.message);
          if (pcrData) setProfileChangeRequests(pcrData);
        } catch (e) { console.warn('profile_change_requests:', e); }

        try {
          const { data: sysData } = await supabase.from('system_settings').select('key,value');
          if (sysData) {
            const subnetRow = sysData.find((r: any) => r.key === 'allowed_ip_subnets');
            if (subnetRow) { try { setAllowedSubnets(JSON.parse(subnetRow.value)); } catch {} }
          }
        } catch {}

        try {
          const { data: scrData } = await supabase.from('schedule_change_requests')
            .select('*').order('created_at', { ascending: false }).limit(200);
          if (scrData) setScheduleChangeRequests(scrData.map(mapScheduleChangeRequest));
        } catch {}

        try {
          const { data: holData } = await supabase.from('holidays').select('*').order('date', { ascending: true });
          if (holData) setHolidays(holData.map((h: any) => ({
            id: h.id, date: h.date, name: h.name, type: h.type,
            assignedUserIds: (() => { try { return JSON.parse(h.assigned_user_ids || '[]'); } catch { return []; } })(),
            applicableTo: (h.applicable_to || 'all') as Holiday['applicableTo'],
            unitIds: (() => { try { return JSON.parse(h.unit_ids || '[]'); } catch { return []; } })(),
            extraPayMultiplier: h.extra_pay_multiplier || 0,
            note: h.note || '', createdAt: h.created_at,
          })));
        } catch {}

        try {
          const { data: wwpData } = await supabase.from('weekend_work_permissions')
            .select('*').order('created_at', { ascending: false });
          if (wwpData) setWeekendWorkPermissions(wwpData.map((r: any) => ({
            id: r.id, userId: r.user_id, userName: r.user_name,
            department: r.department, date: r.date, reason: r.reason || '',
            status: r.status as WeekendWorkPermission['status'],
            reviewedBy: r.reviewed_by, reviewNote: r.review_note, createdAt: r.created_at,
          })));
        } catch {}

        try {
          const { data: rosterData } = await supabase.from('duty_roster').select('*').order('date', { ascending: true });
          if (rosterData) setDutyRoster(rosterData.map((r: any) => ({
            id: r.id, userId: r.user_id, userName: r.user_name,
            department: r.department, date: r.date,
            shiftStart: r.shift_start || r.check_in_time || '',
            shiftEnd: r.shift_end || r.check_out_time || '',
            checkInTime: r.check_in_time || r.shift_start || '',
            checkOutTime: r.check_out_time || r.shift_end || '',
            shiftLabel: r.shift_label || 'Day',
            note: r.note || '', createdBy: r.created_by, createdAt: r.created_at,
          })));
        } catch {}

        try {
          const { data: ddData } = await supabase.from('department_delegates').select('*');
          if (ddData) setDepartmentDelegates(ddData.map((d: any) => ({
            id: d.id, department: d.department, normalRole: d.normal_role || 'MANAGER',
            delegateUserId: d.delegate_user_id, delegateUserName: d.delegate_user_name,
            createdBy: d.created_by || '', createdAt: d.created_at,
          })));
        } catch {}

        try {
          const { data: crData } = await supabase.from('custom_roles').select('id, name, color').order('name');
          if (crData) setCustomRoles(crData);
        } catch {}
      })();

    } catch (err) {
      console.error('Supabase load error:', err);
      setIsLoading(false);
    }
  }, [loadNotificationsForUser]);

  const refreshData = useCallback(() => loadData(), [loadData]);

  // ── Flush offline attendance queue when internet reconnects ──────────────
  const flushOfflineQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const queue = _aqGet();
    if (!queue.length) return;
    for (const item of queue) {
      if ((item._retries || 0) >= 5) continue;
      try {
        const { data: synced, error } = await supabase
          .from('attendance')
          .insert({ user_id: item.userId, type: item.type, status: 'SUCCESS',
                    timestamp: item.timestamp, location: item.location ?? null,
                    ip_address: item.ipAddress ?? '', source: 'offline_queue' })
          .select().single();
        if (error) throw error;
        _aqDone(item._qid);
        if (synced) setAttendance(prev => [synced, ...prev]);
        // Mirror synced offline record to local DB too
        _mirrorAttendance({ user_id: item.userId, type: item.type, status: 'SUCCESS',
          timestamp: item.timestamp, location: item.location ?? null,
          ip_address: item.ipAddress ?? '', source: 'offline_queue' });
      } catch { _aqRetry(item._qid); }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('online', flushOfflineQueue);
    flushOfflineQueue(); // flush any leftover from previous session
    return () => window.removeEventListener('online', flushOfflineQueue);
  }, [flushOfflineQueue]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── FIX #8: GPS — Realtime only, NO polling interval ──────────────────────
  // Polling caused double-updates. Realtime handles live inserts; refreshGpsLogs
  // is kept for manual refresh (e.g. the Refresh button in LiveTracking).
  const refreshGpsLogs = useCallback(async () => {
    try {
      const { data } = await supabase.from('gps_logs').select('*')
        .gte('timestamp', new Date(Date.now() - 86400000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(500);
      if (data) setGpsLogs(data.map(r => ({
        userId: r.user_id, lat: r.lat, lng: r.lng,
        accuracy: r.accuracy || 0, timestamp: r.timestamp,
      })));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const channel = supabase.channel('gps_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gps_logs' }, (payload) => {
        const r = payload.new as any;
        if (!r?.user_id) return;
        setGpsLogs(prev => {
          const newLog = { userId: r.user_id, lat: r.lat, lng: r.lng, accuracy: r.accuracy || 0, timestamp: r.timestamp };
          const filtered = prev.filter(l => l.userId !== r.user_id);
          return [...filtered, newLog].slice(-500);
        });
      })
      .subscribe((status) => {
        console.log('[GPS Realtime]', status);
      });

    // No setInterval — realtime subscription handles live updates.
    // refreshGpsLogs() is still available for the manual Refresh button.

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  // ── End GPS fix ────────────────────────────────────────────────────────────

  const addActivityLog = useCallback(async (
    action: string, category: ActivityLog['category'],
    details: string, severity: ActivityLog['severity'], metadata?: any
  ) => {
    const log = {
      id: genId('LOG'), timestamp: new Date().toISOString(),
      user_id: currentUser?.id || 'system', user_name: currentUser?.name || 'System',
      action, category, details, severity, metadata: metadata || null,
    };
    const { data } = await supabase.from('activity_logs').insert(log).select().single();
    if (data) setActivityLogs(prev => [mapLog(data), ...prev].slice(0, 1000));
  }, [currentUser]);

  const addAuditLog = useCallback(async (action: string, details: string, severity: ActivityLog['severity']) => {
    await addActivityLog(action, 'ATTENDANCE', details, severity);
  }, [addActivityLog]);

  const deleteActivityLog = useCallback(async (id: string) => {
    if (currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.DEVELOPER) return;
    const { error } = await supabase.from('activity_logs').delete().eq('id', id);
    if (!error) {
      setActivityLogs(prev => prev.filter(l => l.id !== id));
    }
  }, [currentUser]);

  const deleteAllActivityLogs = useCallback(async () => {
    if (currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.DEVELOPER) return;
    const { error } = await supabase
      .from('activity_logs')
      .delete()
      .lte('timestamp', new Date().toISOString());
    if (!error) {
      setActivityLogs([]);
      const cleanLog = {
        id: genId('LOG'), timestamp: new Date().toISOString(),
        user_id: currentUser.id, user_name: currentUser.name,
        action: 'LOGS_CLEARED', category: 'SYSTEM' as const,
        details: `All activity logs cleared by ${currentUser.name}.`,
        severity: 'CRITICAL' as const, metadata: null,
      };
      const { data } = await supabase.from('activity_logs').insert(cleanLog).select().single();
      if (data) setActivityLogs([mapLog(data)]);
    }
  }, [currentUser]);

  const sendNotification = useCallback(async (
    recipientId: string, title: string, message: string,
    type: Notification['type'], metadata?: any
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };
    const row = {
      id: genId('NOTIF'), recipient_id: recipientId,
      sender_id: currentUser.id, sender_name: currentUser.name,
      title, message, type, metadata: metadata || null,
      is_read: false, created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('notifications').insert(row);
    if (error) return { success: false, message: error.message };
    await addActivityLog('NOTIFICATION_SENT', 'SALARY', `Notification sent to ${recipientId}: ${title}`, 'LOW');
    return { success: true, message: 'Notification sent.' };
  }, [currentUser, addActivityLog]);

  const login = async (identifier: string, password: string): Promise<boolean> => {
    const key = identifier.toLowerCase().trim();
    const rateCheck = checkRateLimit(key);
    if (!rateCheck.allowed) return false;
    try {
      const result = await api.post<any>('/api/v1/auth/login', { identifier, password });
      const token = result.accessToken || result.access_token;
      if (!token) throw new Error('Authentication response did not include an access token.');
      localStorage.setItem('exord_auth_token', token);
      if (result.refreshToken || result.refresh_token) localStorage.setItem('exord_refresh_token', result.refreshToken || result.refresh_token);
      const me = await api.get<any>('/api/v1/me');
      const user = mapUser(me.employee || me.user || me);
      setCurrentUser(user);
      localStorage.setItem('exord-session', JSON.stringify({ id: user.id }));
      clearAttempts(key);
      const log = { id: genId('LOG'), timestamp: new Date().toISOString(), user_id: user.id, user_name: user.name, action: 'USER_LOGIN', category: 'AUTH' as const, details: user.name + ' (' + user.role + ') logged in.', severity: 'LOW' as const, metadata: null };
      setActivityLogs(prev => [mapLog(log), ...prev]);
      await loadNotificationsForUser(user.id);
      return true;
    } catch (e) {
      recordFailedAttempt(key);
      return false;
    }
  };

  const logout = useCallback(async () => {
    if (currentUser) await addActivityLog('USER_LOGOUT', 'AUTH', `${currentUser.name} ended session.`, 'LOW');
    setCurrentUser(null); setIsTracking(false); setNotifications([]);
    try { localStorage.removeItem('exord-session'); } catch {}
    try { localStorage.removeItem('exord-active-view'); } catch {}
    try { sessionStorage.removeItem('supabase_token'); } catch {}
    try { localStorage.removeItem('exord_auth_token'); } catch {}
  }, [currentUser, addActivityLog]);

  const changePassword = async (newPassword: string, currentPassword?: string) => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };
    try {
      await api.post('/api/v1/me/password', { currentPassword, newPassword });
      return { success: true, message: 'Password changed successfully.' };
    } catch (e:any) {
      return { success: false, message: e?.message || 'Could not change password.' };
    }
  };

  const updateUser = useCallback(async (id: string, updatesInput: Partial<User>) => {
    let updates = updatesInput;
    const db: any = {};
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.email !== undefined) db.email = updates.email;
    if (updates.role !== undefined) {
      db.role = (updates.role as string).startsWith('custom::') ? 'EMPLOYEE' : updates.role;
    }
    if (updates.department !== undefined) {
      // ── Department transfer: check if dept actually changed ──────────────────
      const existingUser = users.find(u => u.id === id);
      const deptChanged = existingUser && existingUser.department !== updates.department;
      db.department = updates.department;
      if (deptChanged) {
        // Reset late count on department transfer — old dept's late history
        // shouldn't carry over to the new department.
        db.late_count = 0;
        updates = { ...updates, lateCount: 0 };
      }
    }
    if (updates.baseSalary !== undefined) {
      db.base_salary = updates.baseSalary;
      // ── Promotion detector ───────────────────────────────────────────────
      const existingUserForPromo = users.find(u => u.id === id);
      if (existingUserForPromo?.designationTrack) {
        const oldSalary = existingUserForPromo.baseSalary || 0;
        const newSalary = updates.baseSalary;
        const track = existingUserForPromo.designationTrack;
        const oldTier = getTierIndex(track, oldSalary);
        const newTier = getTierIndex(track, newSalary);
        if (newTier > oldTier && newTier >= 0 && oldTier >= 0) {
          // Genuine promotion — update designation in DB patch too
          const newDesignation = resolveDesignationFromSalary(track, newSalary)!;
          db.designation = newDesignation;
          updates = { ...updates, designation: newDesignation };
          // Fire promotion event via custom DOM event so App.tsx can show the cert
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('exord-promotion', {
              detail: {
                employeeName: existingUserForPromo.name,
                previousDesignation: existingUserForPromo.designation || resolveDesignationFromSalary(track, oldSalary) || 'Previous Role',
                newDesignation,
              }
            }));
          }, 500);
        } else if (newTier >= 0 && !existingUserForPromo.designation) {
          // First-time designation assignment (no cert shown)
          db.designation = resolveDesignationFromSalary(track, newSalary)!;
          updates = { ...updates, designation: db.designation };
        }
      }
    }
    if (updates.fatherName !== undefined) db.father_name = updates.fatherName;
    if (updates.motherName !== undefined) db.mother_name = updates.motherName;
    if (updates.nid !== undefined) db.nid = updates.nid;
    if (updates.presentAddress !== undefined) db.present_address = updates.presentAddress;
    if (updates.permanentAddress !== undefined) db.permanent_address = updates.permanentAddress;
    if (updates.avatar !== undefined) db.avatar = updates.avatar;
    if (updates.weekendDays !== undefined)      db.weekend_days      = JSON.stringify(updates.weekendDays);
    if (updates.gender !== undefined)            db.gender            = updates.gender;
    if (updates.bloodGroup !== undefined)        db.blood_group       = updates.bloodGroup;
    if (updates.dressSize !== undefined)         db.dress_size        = updates.dressSize;
    if (updates.dateOfBirth !== undefined)       db.date_of_birth     = updates.dateOfBirth;
    if (updates.phoneOfficial !== undefined)     db.phone_official    = updates.phoneOfficial;
    if (updates.phonePersonal !== undefined)     db.phone_personal    = updates.phonePersonal;
    if (updates.phoneAlternative !== undefined)  db.phone_alternative = updates.phoneAlternative;
    if (updates.religion !== undefined)          db.religion          = updates.religion;
    if (updates.maritalStatus !== undefined)     db.marital_status    = updates.maritalStatus;
    if (updates.nationality !== undefined)       db.nationality       = updates.nationality;
    if (updates.emergencyName !== undefined)     db.emergency_name    = updates.emergencyName;
    if (updates.emergencyAddress !== undefined)  db.emergency_address = updates.emergencyAddress;
    if (updates.emergencyContact !== undefined)  db.emergency_contact = updates.emergencyContact;
    if (updates.emergencyRelation !== undefined) db.emergency_relation= updates.emergencyRelation;
    if (updates.bankName !== undefined)          db.bank_name         = updates.bankName;
    if (updates.bankAccountNumber !== undefined) db.bank_account_number = updates.bankAccountNumber;
    if (updates.bankBranch !== undefined)        db.bank_branch       = updates.bankBranch;
    if (updates.bankRoutingNumber !== undefined) db.bank_routing_number = updates.bankRoutingNumber;
    if (updates.docDeadline !== undefined)       db.doc_deadline      = updates.docDeadline;
    if (updates.joinDate !== undefined)          db.join_date         = updates.joinDate;
    if (updates.designation !== undefined)       db.designation       = updates.designation;
    if (updates.designationTrack !== undefined)  db.designation_track = updates.designationTrack ?? null;
    if (updates.unitId !== undefined && updates.unitId !== '')  db.unit_id = updates.unitId;
    if (updates.unitLocation !== undefined) {
      db.unit_location_lat = (updates.unitLocation as any).lat ?? 0;
      db.unit_location_lng = (updates.unitLocation as any).lng ?? 0;
    }
    if (updates.dutySchedule !== undefined)      db.duty_schedule     = JSON.stringify(updates.dutySchedule);
    if (updates.documents !== undefined)         db.documents         = JSON.stringify(updates.documents);
    await supabase.from('users').update(db).eq('id', id);
    setUsers(p => p.map(u => u.id === id ? { ...u, ...updates } : u));
    if (currentUser?.id === id) setCurrentUser(p => p ? { ...p, ...updates } : null);
    const deptTransferNote = db.late_count === 0 && db.department ? ' Department transferred — late count reset to 0.' : '';
    await addActivityLog('EMPLOYEE_UPDATE', 'EMPLOYEE', `Employee ${id} was updated by ${currentUser?.name}.${deptTransferNote}`, 'MEDIUM', { id, fields: Object.keys(updates) });
  }, [currentUser, addActivityLog, users]);

  const uploadAvatar = useCallback(async (userId: string, file: File): Promise<{ success: boolean; url?: string; message: string }> => {
    try {
      const result = await uploadAvatarToFileServer(file);
      const url = result.url;
      const { error: dbError } = await supabase.from('users').update({ avatar: url }).eq('id', userId);
      if (dbError) return { success: false, message: `DB update failed: ${dbError.message}` };
      setUsers(p => p.map(u => u.id === userId ? { ...u, avatar: url } : u));
      setCurrentUser(p => (p && p.id === userId) ? { ...p, avatar: url } : p);
      return { success: true, url, message: 'Profile photo updated successfully.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Upload failed.' };
    }
  }, []);

  const createEmployee = useCallback(async (employeeData: any) => {
    const nid = employeeData.id.toUpperCase();
    if (!/^E\d{4}$/.test(nid)) return { success: false, message: 'ID Format: EXXXX (e.g. E1005)' };
    const { data: existingById } = await supabase.from('users').select('id').eq('id', nid).maybeSingle();
    if (existingById) return { success: false, message: `Employee ID "${nid}" already exists.` };
    const { data: existingByEmail } = await supabase.from('users').select('id').eq('email', employeeData.email).maybeSingle();
    if (existingByEmail) return { success: false, message: `Email "${employeeData.email}" is already registered.` };
    const role = employeeData.role || 'EMPLOYEE';
    const weekendDays = employeeData.weekendDays || ['Friday', 'Saturday'];

    let unitLat = 23.8103;
    let unitLng = 90.4125;
    if (employeeData.unitId) {
      const selectedUnit = units.find(u => u.id === employeeData.unitId);
      if (selectedUnit) { unitLat = selectedUnit.lat; unitLng = selectedUnit.lng; }
    } else {
      const dept = departments.find(d => d.name === employeeData.department);
      const primaryUnitId = dept?.unitIds?.[0] || dept?.unitId;
      const primaryUnit = primaryUnitId ? units.find(u => u.id === primaryUnitId) : null;
      if (primaryUnit) { unitLat = primaryUnit.lat; unitLng = primaryUnit.lng; }
    }

    const row = {
      id: nid, name: employeeData.name, email: employeeData.email,
      password: 'Exord@123', role, department: employeeData.department,
      base_salary: employeeData.baseSalary, device_id: `DEV-${nid}`,
      unit_location_lat: unitLat, unit_location_lng: unitLng,
      father_name: employeeData.fatherName || null, mother_name: employeeData.motherName || null,
      nid: employeeData.nid || null, present_address: employeeData.presentAddress || null,
      permanent_address: employeeData.permanentAddress || null,
      must_change_password: true, avatar: null,
      weekend_days: JSON.stringify(weekendDays),
      documents: employeeData.documents ? JSON.stringify(employeeData.documents) : null,
      doc_deadline: employeeData.docDeadline || null,
      gender: employeeData.gender || null,
      blood_group: employeeData.bloodGroup || null,
      dress_size: employeeData.dressSize || null,
      date_of_birth: employeeData.dateOfBirth || null,
      phone_official: employeeData.phoneOfficial || null,
      phone_personal: employeeData.phonePersonal || null,
      phone_alternative: employeeData.phoneAlternative || null,
      religion: employeeData.religion || null,
      marital_status: employeeData.maritalStatus || null,
      nationality: employeeData.nationality || null,
      emergency_name: employeeData.emergencyName || null,
      emergency_address: employeeData.emergencyAddress || null,
      emergency_contact: employeeData.emergencyContact || null,
      emergency_relation: employeeData.emergencyRelation || null,
      designation: employeeData.designation || null,
      unit_id: employeeData.unitId || null,
      bank_name: employeeData.bankName || null,
      bank_account_number: employeeData.bankAccountNumber || null,
      bank_branch: employeeData.bankBranch || null,
      bank_routing_number: employeeData.bankRoutingNumber || null,
    };
    const { error } = await supabase.from('users').insert(row);
    if (error) return { success: false, message: error.message };
    setUsers(p => [...p, mapUser(row)]);
    await addActivityLog('EMPLOYEE_CREATE', 'EMPLOYEE', `Employee ${nid} (${employeeData.name}) onboarded by ${currentUser?.name}.`, 'MEDIUM', { id: nid, department: employeeData.department });
    try {
      const { data: deptConvs } = await supabase.from('conversations')
        .select('id').eq('type', 'DEPARTMENT').eq('department', employeeData.department);
      if (deptConvs?.length) {
        await supabase.from('conversation_members').upsert(
          deptConvs.map((c: any) => ({ conversation_id: c.id, user_id: nid })),
          { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
        );
      }
    } catch { /* non-critical */ }
    return { success: true, message: `Employee ${nid} created. Default password: Exord@123` };
  }, [currentUser, addActivityLog, units, departments]);

  const deleteEmployee = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.DEVELOPER)) return { success: false, message: 'Only ADMIN or DEVELOPER can delete employees.' };
    if (id === currentUser.id) return { success: false, message: 'You cannot delete your own account.' };
    const emp = users.find(u => u.id === id);
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return { success: false, message: error.message };
    setUsers(p => p.filter(u => u.id !== id));
    await addActivityLog('EMPLOYEE_DELETE', 'EMPLOYEE', `Employee ${id} (${emp?.name}) deleted by ${currentUser.name}.`, 'HIGH', { id, name: emp?.name });
    return { success: true, message: `Employee ${emp?.name} has been removed.` };
  }, [currentUser, users, addActivityLog]);

  const addUnit = useCallback(async (unit: Omit<Unit, 'id'>) => {
    const id = `UNIT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const row = { id, name: unit.name, lat: unit.lat, lng: unit.lng, radius: unit.radius, unit_type: unit.unitType || 'office', snmp_config: unit.snmpConfig || null, head_user_id: unit.headUserId || null };
    const { error } = await supabase.from('units').insert(row);
    if (!error) { setUnits(p => [...p, { ...unit, id }]); await addActivityLog('UNIT_CREATE', 'INFRASTRUCTURE', `Unit "${unit.name}" created.`, 'MEDIUM'); }
  }, [addActivityLog]);

  const updateUnit = useCallback(async (id: string, updates: Partial<Unit>) => {
    const row: any = { ...updates };
    if ('unitType' in updates) { row.unit_type = updates.unitType; delete row.unitType; }
    if ('snmpConfig' in updates) { row.snmp_config = updates.snmpConfig ?? null; delete row.snmpConfig; }
    if ('headUserId' in updates) { row.head_user_id = updates.headUserId ?? null; delete row.headUserId; }
    await supabase.from('units').update(row).eq('id', id);
    setUnits(p => p.map(u => u.id === id ? { ...u, ...updates } : u));
    await addActivityLog('UNIT_UPDATE', 'INFRASTRUCTURE', `Unit ${id} updated.`, 'MEDIUM');
  }, [addActivityLog]);

  const addDepartment = useCallback(async (dept: Omit<Department, 'id'>) => {
    const id = `DEPT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const unitIds = (dept as any).unitIds?.length ? (dept as any).unitIds : [dept.unitId];
    const { error } = await supabase.from('departments').insert({ id, name: dept.name, unit_id: unitIds[0], unit_ids: JSON.stringify(unitIds) });
    if (!error) { setDepartments(p => [...p, { ...dept, id }]); await addActivityLog('DEPT_CREATE', 'INFRASTRUCTURE', `Department "${dept.name}" created.`, 'MEDIUM'); }
  }, [addActivityLog]);

  const updateDepartment = useCallback(async (id: string, updates: Partial<Department>) => {
    const db: any = {};
    if (updates.name) db.name = updates.name;
    if (updates.unitId) db.unit_id = updates.unitId;
    if ((updates as any).unitIds) db.unit_ids = JSON.stringify((updates as any).unitIds);
    await supabase.from('departments').update(db).eq('id', id);
    setDepartments(p => p.map(d => d.id === id ? { ...d, ...updates } : d));
    await addActivityLog('DEPT_UPDATE', 'INFRASTRUCTURE', `Department ${id} updated.`, 'MEDIUM');
  }, [addActivityLog]);

  // ── Permission check — declared here so attendance functions (checkOut) can reference it ──
  const hasPermission = useCallback((userId: string, permission: string): boolean => {
    if ((userPermissions[userId] || []).includes(permission)) return true;
    const user = users.find(u => u.id === userId);
    if (!user) return false;
    const roleVal = user.role as string;
    if ((roleFeatureGrants[roleVal] || []).includes(permission)) return true;
    if (roleVal.startsWith('custom::')) {
      const customRoleId = roleVal.replace('custom::', '');
      if ((customRoleFeatureGrants[customRoleId] || []).includes(permission)) return true;
    }
    const capsRoleKey = roleVal.startsWith('custom::') ? roleVal.replace('custom::', '') : roleVal;
    if ((roleCapabilities[capsRoleKey] || []).includes(permission)) return true;
    return false;
  }, [userPermissions, roleFeatureGrants, customRoleFeatureGrants, roleCapabilities, users]);

  const insertAttendance = useCallback(async (
    type: AttendanceRecord['type'],
    lat: number, lng: number, accuracy: number, ip: string,
    extra?: { breakType?: string }
  ): Promise<{ success: boolean; message: string; isLate?: boolean; lateMinutes?: number }> => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };

    // ── Late calculation (CHECK_IN only) ──────────────────────────────────────
    let isLate = false;
    let lateMinutes = 0;
    if (type === 'CHECK_IN') {
      // If a Duty Roster entry exists for this employee today, use its shift
      // check-in time instead of the default duty schedule. This prevents a
      // wrong late penalty when an employee is on an evening/night roster shift.
      const todayDateStr = dhakaTodayStr();
      const todayRosterEntry = dutyRoster.find(
        r => r.userId === currentUser.id && r.date === todayDateStr
      );
      let schedule = currentUser.dutySchedule || DEFAULT_DUTY_SCHEDULE;
      if (todayRosterEntry && todayRosterEntry.checkInTime) {
        schedule = {
          ...schedule,
          checkInTime: todayRosterEntry.checkInTime,
          checkOutTime: todayRosterEntry.checkOutTime || schedule.checkOutTime,
        };
      }
      const lateInfo = getLateInfo(schedule);
      isLate = lateInfo.isLate;
      lateMinutes = lateInfo.lateMinutes;
    }

    const row = {
      id: genId('ATT'), user_id: currentUser.id,
      timestamp: dhakaISOString(),
      type, lat, lng, accuracy, ip_address: ip, status: 'SUCCESS',
      is_late: isLate,
      late_minutes: lateMinutes,
      ...(extra?.breakType ? { reason: extra.breakType } : {}),
    };
    // ── OFFLINE: queue if no internet ───────────────────────────────────────
    if (!navigator.onLine) {
      _aqAdd({ userId: row.user_id, type, timestamp: row.timestamp, location: (row.lat != null && row.lng != null) ? { lat: row.lat, lng: row.lng, accuracy: row.accuracy ?? 0 } : null, ipAddress: row.ip_address ?? '' });
      const localRec = { ...row, id: crypto.randomUUID(), userId: row.user_id, status: 'SUCCESS' as const };
      setAttendance(prev => [localRec as any, ...prev]);
      return { success: true, message: '⚡ Saved offline — will sync when connected.', isLate: false, lateMinutes: 0 };
    }
    // ── ONLINE: insert to Supabase + update local state immediately ──────────
    const { data: inserted, error } = await supabase.from('attendance').insert(row).select().single();
    if (error) return { success: false, message: error.message };
    if (inserted) setAttendance(prev => [inserted, ...prev]);
    // ── Dual-write: mirror to local PostgreSQL (fire-and-forget) ────────────
    _mirrorAttendance({
      user_id:      row.user_id,
      type,
      status:       'SUCCESS',
      timestamp:    row.timestamp,
      location:     (inserted?.lat && inserted?.lng) ? { lat: inserted.lat, lng: inserted.lng, accuracy: inserted.accuracy ?? 0 }
                    : (row.lat && row.lng) ? { lat: row.lat, lng: row.lng, accuracy: row.accuracy ?? 0 } : null,
      ip_address:   row.ip_address ?? '',
      is_late:      row.is_late ?? false,
      late_minutes: row.late_minutes ?? 0,
      reason:       row.reason ?? null,
      source:       'live',
    });

    // ── Increment late_count on user if late ───────────────────────────────────
    if (isLate && type === 'CHECK_IN') {
      const newCount = (currentUser.lateCount || 0) + 1;
      await supabase.from('users').update({ late_count: newCount }).eq('id', currentUser.id);
      setUsers(p => p.map(u => u.id === currentUser.id ? { ...u, lateCount: newCount } : u));
      setCurrentUser(p => p ? { ...p, lateCount: newCount } : null);
    }

    setAttendance(p => [mapAttendance(row), ...p]);
    return { success: true, message: '', isLate, lateMinutes };
  }, [currentUser]);

  const checkIn = useCallback(async (lat: number, lng: number, accuracy: number, ip: string) => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };
    const todayRecs = attendance.filter(a => a.userId === currentUser.id && isSameDhakaDay(a.timestamp));
    const alreadyIn = todayRecs.find(a => a.type === 'CHECK_IN' && a.status === 'SUCCESS');
    const alreadyOut = todayRecs.find(a => a.type === 'CHECK_OUT' && a.status === 'SUCCESS');
    if (alreadyIn && !alreadyOut) return { success: false, message: 'Already checked in. Check out first.' };

    // ── Weekend check — allow but queue for HR review ─────────────────────────
    const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const userWeekends = currentUser.weekendDays || ['Friday', 'Saturday'];
    if (userWeekends.includes(todayDay)) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const exemptRolesWknd: UserRole[] = [UserRole.DEVELOPER, UserRole.ADMIN, UserRole.CO_ADMIN];
      if (!exemptRolesWknd.includes(currentUser.role)) {
        // Auto-create a pending weekend work permission if one doesn't exist yet
        const existing = weekendWorkPermissions.find(
          p => p.userId === currentUser.id && p.date === todayStr
        );
        if (!existing) {
          // Auto-queue for HR review — employee can check in immediately
          const id = `WWP-AUTO-${Date.now()}`;
          const now = new Date().toISOString();
          await supabase.from('weekend_work_permissions').insert({
            id, user_id: currentUser.id, user_name: currentUser.name,
            department: currentUser.department, date: todayStr,
            reason: 'Auto-queued on weekend check-in',
            status: 'PENDING', created_at: now,
          }).then(() => {});
          const newPerm: WeekendWorkPermission = {
            id, userId: currentUser.id, userName: currentUser.name,
            department: currentUser.department, date: todayStr,
            reason: 'Auto-queued on weekend check-in',
            status: 'PENDING', createdAt: now,
          };
          setWeekendWorkPermissions(prev => [newPerm, ...prev]);
        }
        // Allow check-in regardless — HR reviews after the fact
        await addActivityLog('WEEKEND_CHECKIN', 'ATTENDANCE',
          `${currentUser.name} checked in on weekend (${todayStr}) — queued for HR review.`, 'LOW');
      }
    }

    const userDept = departments.find(d => d.name === currentUser.department);
    const exemptRoles: UserRole[] = [UserRole.DEVELOPER, UserRole.ADMIN, UserRole.CO_ADMIN];
    if (exemptRoles.includes(currentUser.role)) {
      const res = await insertAttendance('CHECK_IN', lat, lng, accuracy, ip);
      if (res.success) {
        await addActivityLog('CHECK_IN', 'ATTENDANCE', `${currentUser.name} (${currentUser.role}) checked in remotely.${res.isLate ? ` LATE by ${res.lateMinutes} min.` : ''}`, 'LOW');
        const msg = res.isLate
          ? `Checked in (remote). ⚠️ You are ${res.lateMinutes} minute(s) late.`
          : 'Checked in (remote access).';
        return { success: true, message: msg };
      }
      return res;
    }

    // ── Corporate / LAN IP path — skip geofence, find nearest unit from all ──
    if (isAllowedIp(ip)) {
      const nearest = units.reduce((best, u) => {
        const dist = calculateDistance(lat, lng, u.lat, u.lng);
        return dist < best.dist ? { unit: u, dist } : best;
      }, { unit: units[0], dist: Infinity });
      const nearestName = nearest?.unit?.name || 'Corporate Network';
      const res = await insertAttendance('CHECK_IN', lat, lng, accuracy, ip);
      if (res.success) {
        await addActivityLog('CHECK_IN', 'ATTENDANCE', `${currentUser.name} checked in via corporate network (${nearestName}). IP: ${ip}.${res.isLate ? ` LATE by ${res.lateMinutes} min.` : ''}`, 'LOW');
        const msg = res.isLate
          ? `Checked in via corporate network (${nearestName}). ⚠️ You are ${res.lateMinutes} minute(s) late. This has been recorded.`
          : `Checked in via corporate network (${nearestName}).`;
        return { success: true, message: msg };
      }
      return res;
    }

    // ── Standard LAN geofence path ────────────────────────────────────────────
    const deptUnitIds = userDept?.unitIds?.length ? userDept.unitIds : (userDept?.unitId ? [userDept.unitId] : []);
    const deptUnits = deptUnitIds.map(uid => units.find(u => u.id === uid)).filter(Boolean) as typeof units;
    if (deptUnits.length === 0) return { success: false, message: 'Unit not configured.' };
    const closestResult = deptUnits.reduce((best, u) => {
      const dist = calculateDistance(lat, lng, u.lat, u.lng);
      return dist < best.dist ? { unit: u, dist } : best;
    }, { unit: deptUnits[0], dist: Infinity });
    const { unit, dist: distance } = closestResult;
    if (distance > (unit.radius || 50)) {
      const unitNames = deptUnits.map(u => u.name).join(' / ');
      await addActivityLog('CHECKIN_FAILED', 'ATTENDANCE', `Geofence breach: ${Math.round(distance)}m from nearest unit (${unitNames}).`, 'MEDIUM');
      return { success: false, message: `Geofence Breach. ${Math.round(distance)}m from nearest unit. Max: ${unit.radius}m.` };
    }
    const ipAllowed = allowedSubnets.some(subnet => ip.startsWith(subnet));
    if (!ipAllowed) {
      await addActivityLog('CHECKIN_FAILED', 'ATTENDANCE', `Network mismatch. IP: ${ip}`, 'MEDIUM');
      return { success: false, message: 'Network Mismatch. Connect to Unit network.' };
    }
    const res = await insertAttendance('CHECK_IN', lat, lng, accuracy, ip);
    if (res.success) {
      await addActivityLog('CHECK_IN', 'ATTENDANCE', `${currentUser.name} checked in at ${unit.name}.${res.isLate ? ` LATE by ${res.lateMinutes} min.` : ''}`, 'LOW');
      const msg = res.isLate
        ? `Checked in at ${unit.name}. ⚠️ You are ${res.lateMinutes} minute(s) late. This has been recorded.`
        : `Checked in at ${unit.name}.`;
      return { success: true, message: msg };
    }
    return res;
  }, [currentUser, departments, units, attendance, addActivityLog, insertAttendance, allowedSubnets, weekendWorkPermissions]);

  const checkOut = useCallback(async (lat: number, lng: number, accuracy: number, ip: string) => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };
    const todayRecs = attendance.filter(a => a.userId === currentUser.id && isSameDhakaDay(a.timestamp));
    const alreadyIn = todayRecs.find(a => a.type === 'CHECK_IN' && a.status === 'SUCCESS');
    if (!alreadyIn) return { success: false, message: 'Not checked in yet.' };
    const alreadyOut = todayRecs.find(a => a.type === 'CHECK_OUT' && a.status === 'SUCCESS');
    if (alreadyOut) return { success: false, message: 'Already checked out today.' };

    // ── Early checkout block ───────────────────────────────────────────────────
    const exemptFromEarlyBlock: UserRole[] = [UserRole.DEVELOPER, UserRole.ADMIN, UserRole.CO_ADMIN, UserRole.HR];
    if (!exemptFromEarlyBlock.includes(currentUser.role)) {
      const schedule = currentUser.dutySchedule || DEFAULT_DUTY_SCHEDULE;
      const [h, m] = schedule.checkOutTime.split(':').map(Number);
      const dutyEnd = new Date();
      dutyEnd.setHours(h, m, 0, 0);
      const now = new Date();
      const minsBeforeEnd = Math.round((dutyEnd.getTime() - now.getTime()) / 60000);

      if (minsBeforeEnd > 0) {
        const canEarlyOut = hasPermission(currentUser.id, 'early_checkout');
        if (!canEarlyOut) {
          return {
            success: false,
            message: `Early checkout not allowed. Duty ends at ${schedule.checkOutTime}. Remaining: ${minsBeforeEnd} min. Contact HR for permission.`,
          };
        }
        await addActivityLog(
          'EARLY_CHECKOUT', 'ATTENDANCE',
          `${currentUser.name} checked out ${minsBeforeEnd} min early (HR permission granted).`,
          'MEDIUM'
        );
      }
    }

    const res = await insertAttendance('CHECK_OUT', lat, lng, accuracy, ip);
    if (res.success) await addActivityLog('CHECK_OUT', 'ATTENDANCE', `${currentUser.name} checked out.`, 'LOW');
    return res.success ? { success: true, message: 'Checked out successfully.' } : res;
  }, [currentUser, attendance, addActivityLog, insertAttendance, hasPermission]);

  const breakStart = useCallback(async (lat: number, lng: number, accuracy: number, ip: string, breakType?: string) => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };
    const res = await insertAttendance('BREAK_START', lat, lng, accuracy, ip, { breakType });
    if (res.success) await addActivityLog('BREAK_START', 'ATTENDANCE', `${currentUser.name} started break${breakType ? ` (${breakType})` : ''}.`, 'LOW');
    return res.success ? { success: true, message: 'Break started.' } : res;
  }, [currentUser, addActivityLog, insertAttendance]);

  const breakEnd = useCallback(async (lat: number, lng: number, accuracy: number, ip: string) => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };
    const res = await insertAttendance('BREAK_END', lat, lng, accuracy, ip);
    if (res.success) await addActivityLog('BREAK_END', 'ATTENDANCE', `${currentUser.name} ended break.`, 'LOW');
    return res.success ? { success: true, message: 'Break ended.' } : res;
  }, [currentUser, addActivityLog, insertAttendance]);

  const applyLeave = useCallback(async (
    leave: Omit<LeaveRequest, 'id' | 'status' | 'userName' | 'userRole' | 'department'>
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };

    const start  = new Date(leave.startDate);
    const end    = new Date(leave.endDate);
    const now    = new Date();

    // ── Clause 13: advance notice ────────────────────────────────────────────
    const hoursUntilStart = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const requiredHours = dayCount > 1 ? 72 : 24;
    if (hoursUntilStart < requiredHours) {
      return {
        success: false,
        message: `Advance notice required: ${dayCount > 1 ? '72 hours (3 days)' : '24 hours'} before leave start. Please submit earlier.`,
      };
    }

    // ── Clause 06: only 1 leave from Casual/Earned/Sick per month ────────────
    const CAPPED = ['Optional/Casual Leave', 'Paid/Earned Leave', 'Sick Leave'];
    if (CAPPED.includes(leave.type)) {
      const leaveMonth = start.getMonth();
      const leaveYear  = start.getFullYear();
      const alreadyThisMonth = leaves.some(l =>
        l.userId === currentUser.id &&
        CAPPED.includes(l.type) &&
        l.status !== LeaveStatus.REJECTED &&
        new Date(l.startDate).getMonth()  === leaveMonth &&
        new Date(l.startDate).getFullYear() === leaveYear
      );
      if (alreadyThisMonth) {
        return {
          success: false,
          message: 'Policy limit: only one Optional/Casual, Paid/Earned, or Sick leave is allowed per month (Clause 06). Additional days will be treated as Non-Paid Leave.',
        };
      }
    }

    // ── Clause 24: Birthday Leave only on actual birthday ────────────────────
    if (leave.type === 'Birthday Leave') {
      const dob = currentUser.dateOfBirth;
      if (dob) {
        const birthDate = new Date(dob);
        const isBirthday =
          start.getDate()  === birthDate.getDate() &&
          start.getMonth() === birthDate.getMonth();
        if (!isBirthday) {
          return {
            success: false,
            message: 'Birthday Leave can only be taken on your actual birthday. In special circumstances, apply through HR for same-month approval (Clause 24).',
          };
        }
      }
    }

    // ── Clause 26: Maternity Leave eligibility ───────────────────────────────
    if (leave.type === 'Maternity Leave') {
      const serviceYears = currentUser.joinDate
        ? (Date.now() - new Date(currentUser.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
        : 0;
      if (serviceYears < 1) {
        return { success: false, message: 'Maternity Leave requires at least 1 year of continuous service (Clause 26).' };
      }
      if ((currentUser.livingChildren || 0) >= 2) {
        return { success: false, message: 'Maternity Leave is not granted if the employee already has two or more living children (Clause 26).' };
      }
    }

    const row = {
      id: genId('LV'), user_id: currentUser.id, user_name: currentUser.name,
      user_role: currentUser.role, department: currentUser.department,
      start_date: leave.startDate, end_date: leave.endDate, type: leave.type,
      status: LeaveStatus.PENDING, reason: leave.reason,
      advance_notice_hours: Math.floor(hoursUntilStart),
    };

    const { error } = await supabase.from('leaves').insert(row);
    if (error) return { success: false, message: error.message };

    setLeaves(p => [mapLeave(row), ...p]);
    await addActivityLog(
      'LEAVE_APPLY', 'LEAVE',
      `${currentUser.name} applied for ${leave.type} leave (${leave.startDate}–${leave.endDate}). Notice: ${Math.floor(hoursUntilStart)}h.`,
      'LOW'
    );
    // ── Notify unit/dept approver + confirm to requester ────────────────────
    try {
      const unitId = (currentUser as any).unitId;
      let approverId: string | null = null;
      if (unitId) {
        const configured = unitApproversMap[unitId];
        if (configured) {
          approverId = configured;
        } else {
          const peers = users.filter(u => (u as any).unitId === unitId && u.id !== currentUser.id);
          if (peers.length) approverId = peers.reduce((b, u) => u.baseSalary > b.baseSalary ? u : b, peers[0]).id;
        }
      }
      if (!approverId) approverId = deptApproversMap[currentUser.department] || null;
      if (approverId && approverId !== currentUser.id) {
        const approverUser = users.find(u => u.id === approverId);
        const approverName = approverUser?.name || approverId;
        const ts = new Date().toISOString();
        await supabase.from('notifications').insert([
          { id: `NOTIF-UA-${Date.now()}`, recipient_id: approverId, sender_id: currentUser.id, sender_name: currentUser.name, title: 'New Leave Request — Action Required', message: `${currentUser.name} (${currentUser.id}) submitted a ${leave.type} request for ${leave.startDate} to ${leave.endDate}. Please review in Requests Hub.`, type: 'LEAVE', metadata: { leaveId: row.id }, is_read: false, created_at: ts },
          { id: `NOTIF-UA-${Date.now()+1}`, recipient_id: currentUser.id, sender_id: 'system', sender_name: 'System', title: 'Leave Request Submitted', message: `Your ${leave.type} request has been forwarded to ${approverName} (${approverId}) for review.`, type: 'LEAVE', metadata: { leaveId: row.id, approverId, approverName }, is_read: false, created_at: ts },
        ]);
      }
    } catch (_) {}

    return { success: true, message: 'Leave request submitted successfully.' };
  }, [currentUser, leaves, addActivityLog, unitApproversMap, deptApproversMap, users]);

  const deleteLeave = useCallback(async (id: string) => {
    await supabase.from('leaves').delete().eq('id', id);
    setLeaves(p => p.filter(l => l.id !== id));
  }, []);

  const updateLeave = useCallback(async (id: string, status: LeaveStatus, rejectionReason?: string) => {
    if (!currentUser) return;
    const leave = leaves.find(l => l.id === id);
    if (!leave) return;
    const dbUpdate: any = { status };
    if (status === LeaveStatus.REJECTED) { dbUpdate.rejected_by = currentUser.name; dbUpdate.rejection_reason = rejectionReason || ''; }
    else if (status === LeaveStatus.UNIT_HEAD_APPROVED) dbUpdate.unit_head_approved_by = currentUser.name;
    else if (status === LeaveStatus.MANAGER_APPROVED) dbUpdate.manager_approved_by = currentUser.name;
    else if (status === LeaveStatus.HR_APPROVED) dbUpdate.hr_approved_by = currentUser.name;
    else if (status === LeaveStatus.CO_ADMIN_APPROVED) dbUpdate.co_admin_approved_by = currentUser.name;
    else if (status === LeaveStatus.APPROVED) dbUpdate.final_approved_by = currentUser.name;
    await supabase.from('leaves').update(dbUpdate).eq('id', id);
    setLeaves(p => p.map(l => l.id === id ? { ...l, status, ...(dbUpdate.rejected_by && { rejectedBy: dbUpdate.rejected_by, rejectionReason }), ...(dbUpdate.unit_head_approved_by && { unitHeadApprovedBy: dbUpdate.unit_head_approved_by }), ...(dbUpdate.manager_approved_by && { managerApprovedBy: dbUpdate.manager_approved_by }), ...(dbUpdate.hr_approved_by && { hrApprovedBy: dbUpdate.hr_approved_by }), ...(dbUpdate.co_admin_approved_by && { coAdminApprovedBy: dbUpdate.co_admin_approved_by }), ...(dbUpdate.final_approved_by && { finalApprovedBy: dbUpdate.final_approved_by }) } : l));
    const actionLabel = status === LeaveStatus.REJECTED ? 'REJECTED' : 'APPROVED';
    await addActivityLog(`LEAVE_${actionLabel}`, 'LEAVE', `Leave for ${leave.userName} ${status} by ${currentUser.name}.`, 'MEDIUM', { leaveId: id, status });
  }, [currentUser, leaves, addActivityLog]);

  const checkPayScaleMilestone = useCallback(async (salary: Omit<SalaryRecord, 'id'>, senderUser: User) => {
    const employee = users.find(u => u.id === salary.userId);
    if (!employee || !payScales.length) return;
    const roleScales = payScales.filter(ps => ps.role === employee.role).sort((a, b) => a.minSalary - b.minSalary);
    if (!roleScales.length) return;
    const newScale = roleScales.find(ps => salary.base >= ps.minSalary && salary.base <= ps.maxSalary);
    if (!newScale) return;
    const prevSalaries = salaries.filter(s => s.userId === salary.userId);
    const prevBase = prevSalaries.length > 0 ? prevSalaries[0].base : 0;
    const prevScale = roleScales.find(ps => prevBase >= ps.minSalary && prevBase <= ps.maxSalary);
    if (newScale.id !== prevScale?.id) {
      const congratsRow = {
        id: genId('NOTIF'), recipient_id: salary.userId,
        sender_id: senderUser.id, sender_name: senderUser.name,
        title: `🎉 Congratulations! New Pay Scale: ${newScale.name}`,
        message: `You have reached the ${newScale.name} pay scale tier (${formatCurrency(newScale.minSalary)} – ${formatCurrency(newScale.maxSalary)}). Your dedication and hard work are being recognized. Keep up the excellent work!`,
        type: 'SYSTEM',
        metadata: { type: 'PAY_SCALE_MILESTONE', scaleId: newScale.id, scaleName: newScale.name, newBase: salary.base },
        is_read: false, created_at: new Date().toISOString(),
      };
      await supabase.from('notifications').insert(congratsRow);
    }
  }, [users, payScales, salaries]);

  const addSalary = useCallback(async (salary: Omit<SalaryRecord, 'id'>) => {
    const row = {
      id: genId('SAL'), user_id: salary.userId, user_name: salary.userName,
      month: salary.month, year: salary.year, base: salary.base,
      bonus: salary.bonus, deductions: salary.deductions, net: salary.net, status: salary.status,
    };
    const { error } = await supabase.from('salaries').insert(row);
    if (!error) {
      setSalaries(p => [mapSalary(row), ...p]);
      await addActivityLog('SALARY_CREATE', 'SALARY', `Salary for ${salary.userName}: ৳${salary.net}`, 'MEDIUM');
      if (currentUser) await checkPayScaleMilestone(salary, currentUser);
    }
  }, [addActivityLog, checkPayScaleMilestone, currentUser]);

  const updateSalary = useCallback(async (id: string, updates: Partial<SalaryRecord>) => {
    const db: any = {};
    if (updates.status !== undefined) db.status = updates.status;
    if (updates.base !== undefined) db.base = updates.base;
    if (updates.bonus !== undefined) db.bonus = updates.bonus;
    if (updates.deductions !== undefined) db.deductions = updates.deductions;
    if (updates.net !== undefined) db.net = updates.net;
    if (updates.month !== undefined) db.month = updates.month;
    if (updates.year !== undefined) db.year = updates.year;
    await supabase.from('salaries').update(db).eq('id', id);
    setSalaries(p => p.map(s => s.id === id ? { ...s, ...updates } : s));
    const sal = salaries.find(s => s.id === id);
    await addActivityLog('SALARY_UPDATE', 'SALARY', `Salary for ${sal?.userName} updated.`, 'MEDIUM');
    if (updates.base !== undefined && sal && currentUser) {
      await checkPayScaleMilestone({ ...sal, base: updates.base }, currentUser);
    }
  }, [currentUser, salaries, addActivityLog, checkPayScaleMilestone]);

  const applyLoan = useCallback(async (type: 'LOAN' | 'ADVANCE_SALARY', amount: number, reason: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not logged in.' };
    if (type === 'LOAN') {
      const joinDate = currentUser.joinDate ? new Date(currentUser.joinDate) : null;
      if (!joinDate) return { success: false, message: 'Join date not set. Contact HR.' };
      const monthsWorked = (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsWorked < 6) return { success: false, message: 'Loan available after 6 months of service.' };
    }
    const existing = loanRequests.find(l => l.userId === currentUser.id && l.status === 'PENDING');
    if (existing) return { success: false, message: 'You already have a pending request.' };
    const id = `LN-${Date.now()}`;
    const row = { id, user_id: currentUser.id, user_name: currentUser.name, department: currentUser.department, type, amount, reason, status: 'PENDING', created_at: new Date().toISOString() };
    const { error } = await supabase.from('loan_requests').insert(row);
    if (error) return { success: false, message: error.message };
    setLoanRequests(p => [mapLoan(row), ...p]);
    return { success: true, message: `${type === 'LOAN' ? 'Loan' : 'Advance salary'} request submitted.` };
  }, [currentUser, loanRequests]);

  const reviewLoan = useCallback(async (id: string, status: 'APPROVED' | 'REJECTED', note?: string) => {
    if (!currentUser) return;
    await supabase.from('loan_requests').update({ status, reviewed_by: currentUser.name, review_note: note || null }).eq('id', id);
    setLoanRequests(p => p.map(l => l.id === id ? { ...l, status, reviewedBy: currentUser.name, reviewNote: note } : l));
  }, [currentUser]);

  // ── Loan: enter a pre-existing running loan ───────────────────────────────
  const addExistingLoan = useCallback(async (
    userId: string, type: 'LOAN' | 'ADVANCE_SALARY',
    amount: number, reason: string,
    totalMonths: number, paidMonths: number,
    amountPaid: number, startMonth: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not logged in.' };
    const employee = users.find(u => u.id === userId);
    if (!employee) return { success: false, message: 'Employee not found.' };
    const monthlyInstallment = totalMonths > paidMonths
      ? Math.ceil((amount - amountPaid) / (totalMonths - paidMonths))
      : 0;
    const loanStatus = paidMonths >= totalMonths && totalMonths > 0 ? 'CLOSED' : 'ACTIVE';
    const id = `LN-${Date.now()}`;
    const row = {
      id,
      user_id: userId,
      user_name: employee.name,
      department: employee.department,
      type, amount, reason,
      status: loanStatus,
      created_at: new Date().toISOString(),
      reviewed_by: currentUser.name,
      review_note: 'Pre-existing loan entered by HR/Admin.',
      total_months: totalMonths,
      paid_months: paidMonths,
      amount_paid: amountPaid,
      monthly_installment: monthlyInstallment,
      start_month: startMonth,
      is_existing_loan: true,
    };
    const { error } = await supabase.from('loan_requests').insert(row);
    if (error) return { success: false, message: error.message };
    setLoanRequests(p => [mapLoan(row), ...p]);
    await addActivityLog('LOAN_EXISTING_ENTRY', 'SALARY',
      `Existing loan for ${employee.name} (${id}) entered by ${currentUser.name}. Amount: ৳${amount}, Paid: ৳${amountPaid}.`,
      'MEDIUM', { loanId: id, userId, amount, amountPaid, totalMonths, paidMonths });
    return { success: true, message: 'Existing loan recorded successfully.' };
  }, [currentUser, users, addActivityLog]);

  // ── Loan: set / update the repayment plan on an approved loan ────────────
  const setLoanRepaymentPlan = useCallback(async (
    id: string, totalMonths: number,
    monthlyInstallment: number, startMonth: string
  ): Promise<void> => {
    if (!currentUser) return;
    await supabase.from('loan_requests').update({
      total_months: totalMonths,
      monthly_installment: monthlyInstallment,
      start_month: startMonth,
      status: 'ACTIVE',
    }).eq('id', id);
    setLoanRequests(p => p.map(l => l.id === id
      ? { ...l, totalMonths, monthlyInstallment, startMonth, status: 'ACTIVE' } as any
      : l
    ));
    await addActivityLog('LOAN_PLAN_SET', 'SALARY',
      `Repayment plan set for loan ${id}: ${totalMonths} months @ ৳${monthlyInstallment}/mo by ${currentUser.name}.`,
      'MEDIUM', { loanId: id, totalMonths, monthlyInstallment });
  }, [currentUser, addActivityLog]);

  // ── Loan: record a monthly payment ───────────────────────────────────────
  const updateLoanRepayment = useCallback(async (
    id: string, paidMonths: number, amountPaid: number
  ): Promise<void> => {
    if (!currentUser) return;
    const loan = loanRequests.find(l => l.id === id) as any;
    if (!loan) return;
    const isClosed = paidMonths >= (loan.totalMonths || 0) || amountPaid >= loan.amount;
    const newStatus = isClosed ? 'CLOSED' : 'ACTIVE';
    await supabase.from('loan_requests').update({
      paid_months: paidMonths,
      amount_paid: amountPaid,
      status: newStatus,
    }).eq('id', id);
    setLoanRequests(p => p.map(l => l.id === id
      ? { ...l, paidMonths, amountPaid, status: newStatus } as any
      : l
    ));
    await addActivityLog('LOAN_PAYMENT_RECORDED', 'SALARY',
      `Payment recorded for loan ${id}: month ${paidMonths} paid (৳${amountPaid} total) by ${currentUser.name}. ${isClosed ? 'LOAN CLOSED.' : ''}`,
      'LOW', { loanId: id, paidMonths, amountPaid, closed: isClosed });
  }, [currentUser, loanRequests, addActivityLog]);

  const deleteSalary = useCallback(async (id: string) => {
    const sal = salaries.find(s => s.id === id);
    const { error } = await supabase.from('salaries').delete().eq('id', id);
    if (!error) { setSalaries(p => p.filter(s => s.id !== id)); await addActivityLog('SALARY_DELETE', 'SALARY', `Salary for ${sal?.userName} deleted.`, 'HIGH'); }
  }, [salaries, addActivityLog]);

  // ── FIX #11: markNotificationRead — single record ─────────────────────────
  const markNotificationRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(p => p.map(n => n.id === id ? { ...n, isRead: true } : n));
  }, []);

  // ── FIX #11: markAllNotificationsRead — single DB call for all unread ──────
  const markAllNotificationsRead = useCallback(async () => {
    if (!currentUser) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', currentUser.id)
      .eq('is_read', false);
    setNotifications(p => p.map(n => ({ ...n, isRead: true })));
  }, [currentUser]);

  const deleteUnit = useCallback(async (id: string) => {
    await supabase.from('units').delete().eq('id', id);
    setUnits(p => p.filter(u => u.id !== id));
    await addActivityLog('UNIT_DELETE', 'INFRASTRUCTURE', `Unit ${id} deleted.`, 'HIGH');
  }, [addActivityLog]);

  const deleteDepartment = useCallback(async (id: string) => {
    await supabase.from('departments').delete().eq('id', id);
    setDepartments(p => p.filter(d => d.id !== id));
    await addActivityLog('DEPT_DELETE', 'INFRASTRUCTURE', `Department ${id} deleted.`, 'HIGH');
  }, [addActivityLog]);

  const addGPSLog = useCallback(async (log: GPSLog) => {
    setGpsLogs(p => [...p, log].slice(-5000));
    supabase.from('gps_logs').insert({
      id: genId('GPS'), user_id: log.userId, lat: log.lat, lng: log.lng,
      accuracy: log.accuracy, timestamp: log.timestamp,
    }).then(({ error }) => {
      if (error) console.warn('[addGPSLog] Supabase insert failed:', error.message);
    });
  }, []);

  const addPayScale = useCallback(async (ps: Omit<PayScale, 'id' | 'createdAt'>) => {
    const row = {
      id: genId('PS'), role: ps.role, level: ps.level, name: ps.name,
      min_salary: ps.minSalary, max_salary: ps.maxSalary, created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('pay_scales').insert(row);
    if (!error) {
      setPayScales(p => [...p, mapPayScale(row)].sort((a, b) => a.level - b.level));
      await addActivityLog('PAY_SCALE_CREATE', 'SALARY', `Pay scale "${ps.name}" created for ${ps.role}.`, 'MEDIUM');
    }
  }, [addActivityLog]);

  const updatePayScale = useCallback(async (id: string, updates: Partial<PayScale>) => {
    const db: any = {};
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.level !== undefined) db.level = updates.level;
    if (updates.minSalary !== undefined) db.min_salary = updates.minSalary;
    if (updates.maxSalary !== undefined) db.max_salary = updates.maxSalary;
    await supabase.from('pay_scales').update(db).eq('id', id);
    setPayScales(p => p.map(ps => ps.id === id ? { ...ps, ...updates } : ps));
    await addActivityLog('PAY_SCALE_UPDATE', 'SALARY', `Pay scale ${id} updated.`, 'MEDIUM');
  }, [addActivityLog]);

  const deletePayScale = useCallback(async (id: string) => {
    const ps = payScales.find(p => p.id === id);
    await supabase.from('pay_scales').delete().eq('id', id);
    setPayScales(p => p.filter(x => x.id !== id));
    await addActivityLog('PAY_SCALE_DELETE', 'SALARY', `Pay scale "${ps?.name}" deleted.`, 'MEDIUM');
  }, [payScales, addActivityLog]);

  const addLeavePolicy = useCallback(async (policy: Omit<LeavePolicy, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const row = {
      id: genId('LP'), name: policy.name, leave_type: policy.leaveType,
      min_service_years: policy.minServiceYears, max_service_years: policy.maxServiceYears,
      days_allowed: policy.daysAllowed, description: policy.description || null,
      created_at: now, updated_at: now,
    };
    const { error } = await supabase.from('leave_policies').insert(row);
    if (!error) {
      setLeavePolicies(p => [...p, mapLeavePolicy(row)]);
      await addActivityLog('LEAVE_POLICY_CREATE', 'LEAVE', `Leave policy "${policy.name}" created.`, 'MEDIUM');
    }
  }, [addActivityLog]);

  const updateLeavePolicy = useCallback(async (id: string, updates: Partial<LeavePolicy>) => {
    const db: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined)           db.name              = updates.name;
    if (updates.leaveType !== undefined)      db.leave_type        = updates.leaveType;
    if (updates.minServiceYears !== undefined) db.min_service_years = updates.minServiceYears;
    if (updates.maxServiceYears !== undefined) db.max_service_years = updates.maxServiceYears;
    if (updates.daysAllowed !== undefined)    db.days_allowed      = updates.daysAllowed;
    if (updates.description !== undefined)    db.description       = updates.description;
    await supabase.from('leave_policies').update(db).eq('id', id);
    setLeavePolicies(p => p.map(lp => lp.id === id ? { ...lp, ...updates, updatedAt: db.updated_at } : lp));
    await addActivityLog('LEAVE_POLICY_UPDATE', 'LEAVE', `Leave policy ${id} updated.`, 'MEDIUM');
  }, [addActivityLog]);

  const deleteLeavePolicy = useCallback(async (id: string) => {
    const lp = leavePolicies.find(p => p.id === id);
    await supabase.from('leave_policies').delete().eq('id', id);
    setLeavePolicies(p => p.filter(x => x.id !== id));
    await addActivityLog('LEAVE_POLICY_DELETE', 'LEAVE', `Leave policy "${lp?.name}" deleted.`, 'MEDIUM');
  }, [leavePolicies, addActivityLog]);

  const submitProfileChangeRequest = useCallback(async (
    changes: Record<string, { old: string; new: string }>,
    reason: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Auth required.' };
    const id = `PCR-${Date.now()}`;
    const row = {
      id,
      user_id: currentUser.id,
      user_name: currentUser.name,
      department: currentUser.department,
      field_changes: changes,
      reason: reason || null,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('profile_change_requests').insert(row);
    if (error) return { success: false, message: error.message };
    setProfileChangeRequests(prev => [row, ...prev]);
    await addActivityLog('PROFILE_CHANGE_REQUEST', 'EMPLOYEE', `${currentUser.name} submitted a profile change request.`, 'LOW');
    const hrUsers = users.filter(u => u.role === UserRole.HR || u.role === UserRole.ADMIN || u.role === UserRole.DEVELOPER);
    for (const hr of hrUsers.slice(0, 3)) {
      await supabase.from('notifications').insert({
        id: genId('NOTIF'), recipient_id: hr.id, sender_id: currentUser.id,
        sender_name: currentUser.name,
        title: `Profile Change Request — ${currentUser.name}`,
        message: `${currentUser.name} has submitted a request to update their profile data. Please review in Workforce Hub.`,
        type: 'GENERAL', is_read: false, created_at: new Date().toISOString(),
      });
    }
    return { success: true, message: 'Request submitted. HR will review it shortly.' };
  }, [currentUser, users, addActivityLog]);

  const reviewProfileChangeRequest = useCallback(async (
    id: string, status: 'APPROVED' | 'REJECTED', note?: string
  ) => {
    if (!currentUser) return;
    const req = profileChangeRequests.find(r => r.id === id);
    if (!req) return;

    const now = new Date().toISOString();
    await supabase.from('profile_change_requests')
      .update({ status, reviewed_by: currentUser.name, review_note: note || null, updated_at: now })
      .eq('id', id);

    setProfileChangeRequests(prev => prev.map(r => r.id === id ? { ...r, status, reviewed_by: currentUser.name, review_note: note } : r));

    if (status === 'APPROVED') {
      const fieldMap: Record<string, string> = {
        // Contact
        'Phone (Official)': 'phoneOfficial', 'Phone (Personal)': 'phonePersonal',
        'Alternative Number': 'phoneAlternative', 'Email': 'email',
        // Address
        'Present Address': 'presentAddress', 'Permanent Address': 'permanentAddress',
        // Personal
        'Father Name': 'fatherName', 'Mother Name': 'motherName',
        'NID Number': 'nid', 'Date of Birth': 'dateOfBirth',
        'Gender': 'gender', 'Blood Group': 'bloodGroup',
        'Dress Size': 'dressSize', 'Religion': 'religion',
        'Marital Status': 'maritalStatus', 'Nationality': 'nationality',
        // Emergency
        'Emergency Contact Name': 'emergencyName',
        'Emergency Contact Number': 'emergencyContact',
        'Emergency Contact Address': 'emergencyAddress',
        'Emergency Relation': 'emergencyRelation',
        // Bank account
        'Bank Name': 'bankName',
        'Bank Account Number': 'bankAccountNumber',
        'Bank Branch': 'bankBranch',
        'Bank Routing Number': 'bankRoutingNumber',
        // Employment (HR-only approval fields)
        'Department': 'department', 'Join Date': 'joinDate',
        'Base Salary': 'baseSalary', 'Role': 'role',
        'Office': 'office',
      };
      const updates: Record<string, any> = {};
      Object.entries(req.field_changes).forEach(([field, val]: [string, any]) => {
        const key = fieldMap[field];
        if (key) {
          // Coerce numeric fields
          if (key === 'baseSalary') updates[key] = Number(val.new);
          else updates[key] = val.new;
        }
      });
      if (Object.keys(updates).length > 0) {
        await updateUser(req.user_id, updates as any);
      }
      await supabase.from('notifications').insert({
        id: genId('NOTIF'), recipient_id: req.user_id, sender_id: currentUser.id,
        sender_name: currentUser.name,
        title: '✅ Profile Update Approved',
        message: `Your profile change request has been approved by ${currentUser.name}. Your information has been updated.`,
        type: 'GENERAL', is_read: false, created_at: now,
      });
    } else {
      await supabase.from('notifications').insert({
        id: genId('NOTIF'), recipient_id: req.user_id, sender_id: currentUser.id,
        sender_name: currentUser.name,
        title: '❌ Profile Update Rejected',
        message: `Your profile change request was rejected by ${currentUser.name}${note ? `: ${note}` : '.'}`,
        type: 'GENERAL', is_read: false, created_at: now,
      });
    }
    await addActivityLog(`PROFILE_CHANGE_${status}`, 'EMPLOYEE', `Profile change request for ${req.user_name} ${status.toLowerCase()} by ${currentUser.name}.`, 'MEDIUM');
  }, [currentUser, profileChangeRequests, updateUser, addActivityLog]);

  const grantPermission = useCallback(async (userId: string, permission: string) => {
    const id = `PERM-${Date.now()}`;
    const { error } = await supabase.from('user_permissions').upsert({
      id, user_id: userId, permission, granted_by: currentUser!.id, granted_at: new Date().toISOString(),
    }, { onConflict: 'user_id,permission' });
    if (!error) {
      setUserPermissions(prev => ({
        ...prev,
        [userId]: [...(prev[userId] || []).filter(p => p !== permission), permission],
      }));
      await addActivityLog(`Granted '${permission}' access to user ${userId}`, 'SECURITY' as any, `Permission granted by ${currentUser?.name}`, 'MEDIUM');
    }
  }, [currentUser, addActivityLog]);

  const revokePermission = useCallback(async (userId: string, permission: string) => {
    const { error } = await supabase.from('user_permissions').delete()
      .eq('user_id', userId).eq('permission', permission);
    if (!error) {
      setUserPermissions(prev => ({
        ...prev,
        [userId]: (prev[userId] || []).filter(p => p !== permission),
      }));
      await addActivityLog(`Revoked '${permission}' access from user ${userId}`, 'SECURITY' as any, `Permission revoked by ${currentUser?.name}`, 'MEDIUM');
    }
  }, [currentUser, addActivityLog]);

  // ── Schedule Change Requests ──────────────────────────────────────────────
  const requestScheduleChange = useCallback(async (data: any): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Auth required.' };
    const id = `SCR-${Date.now()}`;
    const row = {
      id,
      user_id: data.userId,
      user_name: data.userName,
      department: data.department,
      change_type: data.changeType,
      requested_check_in: data.requestedCheckIn,
      requested_check_out: data.requestedCheckOut,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      reason: data.reason,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('schedule_change_requests').insert(row);
    if (error) return { success: false, message: error.message };
    setScheduleChangeRequests(p => [mapScheduleChangeRequest(row), ...p]);
    await addActivityLog(
      'SCHEDULE_CHANGE_REQUEST', 'ATTENDANCE',
      `${currentUser.name} requested a ${data.changeType} schedule change (${data.requestedCheckIn}–${data.requestedCheckOut}).`,
      'LOW'
    );
    // Notify department manager
    const managers = users.filter(u =>
      (u.role === UserRole.MANAGER || u.role === UserRole.HR || u.role === UserRole.ADMIN || u.role === UserRole.DEVELOPER)
      && u.department === currentUser.department
    );
    for (const mgr of managers.slice(0, 3)) {
      await supabase.from('notifications').insert({
        id: genId('NOTIF'), recipient_id: mgr.id, sender_id: currentUser.id,
        sender_name: currentUser.name,
        title: `📋 Schedule Change Request — ${currentUser.name}`,
        message: `${currentUser.name} has requested a ${data.changeType.toLowerCase()} schedule change to ${data.requestedCheckIn}–${data.requestedCheckOut}. Please review.`,
        type: 'GENERAL', is_read: false, created_at: new Date().toISOString(),
      });
    }
    return { success: true, message: 'Schedule change request submitted.' };
  }, [currentUser, users, addActivityLog]);

  const reviewScheduleChange = useCallback(async (id: string, status: string, rejectionReason?: string) => {
    if (!currentUser) return;
    const req = scheduleChangeRequests.find(r => r.id === id);
    if (!req) return;
    const db: any = { status };
    if (status === 'MANAGER_APPROVED') db.manager_approved_by = currentUser.name;
    else if (status === 'APPROVED')    db.hr_approved_by = currentUser.name;
    else if (status === 'REJECTED') {
      db.rejected_by = currentUser.name;
      db.rejection_reason = rejectionReason || '';
    }
    await supabase.from('schedule_change_requests').update(db).eq('id', id);
    setScheduleChangeRequests(p => p.map(r => r.id === id ? { ...r, status: status as any, ...db } : r));
    // If fully approved + permanent → apply the new schedule to the employee
    if (status === 'APPROVED') {
      await updateUser(req.userId, {
        dutySchedule: {
          checkInTime: req.requestedCheckIn,
          checkOutTime: req.requestedCheckOut,
          graceMinutes: req.changeType === 'PERMANENT' ? 5 : (currentUser as any)?.dutySchedule?.graceMinutes || 5,
          earlyCheckInMinutes: 30,
        }
      });
      // Notify employee
      await supabase.from('notifications').insert({
        id: genId('NOTIF'), recipient_id: req.userId, sender_id: currentUser.id,
        sender_name: currentUser.name,
        title: '✅ Schedule Change Approved',
        message: `Your ${req.changeType.toLowerCase()} schedule change to ${req.requestedCheckIn}–${req.requestedCheckOut} has been approved by ${currentUser.name}.`,
        type: 'GENERAL', is_read: false, created_at: new Date().toISOString(),
      });
    } else if (status === 'REJECTED') {
      await supabase.from('notifications').insert({
        id: genId('NOTIF'), recipient_id: req.userId, sender_id: currentUser.id,
        sender_name: currentUser.name,
        title: '❌ Schedule Change Rejected',
        message: `Your schedule change request was rejected by ${currentUser.name}.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        type: 'GENERAL', is_read: false, created_at: new Date().toISOString(),
      });
    }
    await addActivityLog(
      `SCHEDULE_CHANGE_${status}`, 'ATTENDANCE',
      `Schedule change for ${req.userName} set to ${status} by ${currentUser.name}.`,
      'MEDIUM'
    );
  }, [currentUser, scheduleChangeRequests, updateUser, addActivityLog]);

  // ── Attendance deletion (admin only) ─────────────────────────────────────
  const deleteAttendanceRecord = useCallback(async (id: string) => {
    if (!currentUser) return;
    const { error } = await supabase.from('attendance').delete().eq('id', id);
    if (!error) {
      setAttendance(p => p.filter(a => a.id !== id));
      await addActivityLog('ATTENDANCE_DELETE', 'ATTENDANCE', `Attendance record ${id} deleted by ${currentUser.name}.`, 'HIGH');
    }
  }, [currentUser, addActivityLog]);

  const deleteAllAttendanceForDate = useCallback(async (dateStr: string, userId?: string) => {
    if (!currentUser) return;
    // Build query — Supabase doesn't support CAST in client, so filter by timestamp range
    const dayStart = new Date(dateStr + 'T00:00:00.000Z').toISOString();
    const dayEnd   = new Date(dateStr + 'T23:59:59.999Z').toISOString();
    let q = supabase.from('attendance').delete()
      .gte('timestamp', dayStart)
      .lte('timestamp', dayEnd);
    if (userId) q = (q as any).eq('user_id', userId);
    const { error } = await q;
    if (!error) {
      setAttendance(p => p.filter(a => {
        const aDate = a.timestamp.split('T')[0];
        return !(aDate === dateStr && (!userId || a.userId === userId));
      }));
      await addActivityLog(
        'ATTENDANCE_BULK_DELETE', 'ATTENDANCE',
        `All attendance for ${dateStr}${userId ? ` (user ${userId})` : ''} deleted by ${currentUser.name}.`,
        'HIGH'
      );
    }
  }, [currentUser, addActivityLog]);

  // ── Document deadline ─────────────────────────────────────────────────────
  const setDocDeadline = useCallback(async (userId: string, deadline: string | null): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not authenticated.' };
    const { error } = await supabase.from('users').update({ doc_deadline: deadline }).eq('id', userId);
    if (error) return { success: false, message: error.message };
    setUsers(p => p.map(u => u.id === userId ? { ...u, docDeadline: deadline } : u));
    await addActivityLog(
      'DOC_DEADLINE_SET', 'EMPLOYEE',
      `Document deadline for ${userId} set to ${deadline ?? 'none'} by ${currentUser.name}.`,
      'MEDIUM', { userId, deadline }
    );
    return { success: true, message: deadline ? `Deadline set to ${new Date(deadline).toLocaleDateString()}.` : 'Deadline cleared.' };
  }, [currentUser, addActivityLog]);

  const setDocDeadlineBulk = useCallback(async (userIds: string[], deadline: string | null): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not authenticated.' };
    const { error } = await supabase.from('users').update({ doc_deadline: deadline }).in('id', userIds);
    if (error) return { success: false, message: error.message };
    setUsers(p => p.map(u => userIds.includes(u.id) ? { ...u, docDeadline: deadline } : u));
    await addActivityLog(
      'DOC_DEADLINE_BULK_SET', 'EMPLOYEE',
      `Document deadline bulk-set for ${userIds.length} employees to ${deadline ?? 'none'} by ${currentUser.name}.`,
      'MEDIUM', { count: userIds.length, deadline }
    );
    return { success: true, message: `Deadline applied to ${userIds.length} employee(s).` };
  }, [currentUser, addActivityLog]);

  const addHoliday = useCallback(async (h: Omit<Holiday, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not authenticated.' };
    const id = genId('HOL');
    const now = new Date().toISOString();
    const { error } = await supabase.from('holidays').insert({
      id, date: h.date, name: h.name, type: h.type,
      assigned_user_ids: JSON.stringify(h.assignedUserIds || []),
      applicable_to: h.applicableTo || 'all',
      unit_ids: JSON.stringify(h.unitIds || []),
      extra_pay_multiplier: h.extraPayMultiplier || 0,
      note: h.note || '', created_at: now,
    });
    if (error) return { success: false, message: error.message };
    setHolidays(prev => [...prev, { ...h, id, createdAt: now }].sort((a, b) => a.date.localeCompare(b.date)));
    return { success: true, message: 'Holiday added.' };
  }, [currentUser]);

  const updateHoliday = useCallback(async (id: string, updates: Partial<Omit<Holiday, 'id' | 'createdAt'>>): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not authenticated.' };
    const dbUpdates: any = { ...updates };
    if (updates.assignedUserIds !== undefined) {
      dbUpdates.assigned_user_ids = JSON.stringify(updates.assignedUserIds);
      delete dbUpdates.assignedUserIds;
    }
    if (updates.applicableTo !== undefined) {
      dbUpdates.applicable_to = updates.applicableTo;
      delete dbUpdates.applicableTo;
    }
    if (updates.unitIds !== undefined) {
      dbUpdates.unit_ids = JSON.stringify(updates.unitIds);
      delete dbUpdates.unitIds;
    }
    if (updates.extraPayMultiplier !== undefined) {
      dbUpdates.extra_pay_multiplier = updates.extraPayMultiplier;
      delete dbUpdates.extraPayMultiplier;
    }
    const { error } = await supabase.from('holidays').update(dbUpdates).eq('id', id);
    if (error) return { success: false, message: error.message };
    setHolidays(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
    return { success: true, message: 'Holiday updated.' };
  }, [currentUser]);

  const deleteHoliday = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not authenticated.' };
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) return { success: false, message: error.message };
    setHolidays(prev => prev.filter(h => h.id !== id));
    return { success: true, message: 'Holiday deleted.' };
  }, [currentUser]);

  // ── Weekend Work Permission functions ─────────────────────────────────────
  const requestWeekendWork = useCallback(async (date: string, reason: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not authenticated.' };
    // Check not already requested for this date
    const existing = weekendWorkPermissions.find(p => p.userId === currentUser.id && p.date === date && p.status !== 'REJECTED');
    if (existing) return { success: false, message: existing.status === 'APPROVED' ? 'Already approved for this date.' : 'Request already pending for this date.' };
    const id = genId('WWP');
    const now = new Date().toISOString();
    const { error } = await supabase.from('weekend_work_permissions').insert({
      id, user_id: currentUser.id, user_name: currentUser.name,
      department: currentUser.department, date, reason,
      status: 'PENDING', created_at: now,
    });
    if (error) return { success: false, message: error.message };
    const newPerm: WeekendWorkPermission = {
      id, userId: currentUser.id, userName: currentUser.name,
      department: currentUser.department, date, reason,
      status: 'PENDING', createdAt: now,
    };
    setWeekendWorkPermissions(prev => [newPerm, ...prev]);
    return { success: true, message: 'Weekend work request submitted. Awaiting HR approval.' };
  }, [currentUser, weekendWorkPermissions]);

  const reviewWeekendWork = useCallback(async (id: string, status: 'APPROVED' | 'REJECTED', note?: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not authenticated.' };
    const { error } = await supabase.from('weekend_work_permissions').update({
      status, reviewed_by: currentUser.name, review_note: note || null,
    }).eq('id', id);
    if (error) return { success: false, message: error.message };
    setWeekendWorkPermissions(prev => prev.map(p => p.id === id ? { ...p, status, reviewedBy: currentUser.name, reviewNote: note } : p));
    return { success: true, message: `Request ${status.toLowerCase()}.` };
  }, [currentUser]);

  // ── Duty Roster functions ──────────────────────────────────────────────────
  const upsertRosterEntry = useCallback(async (entry: Omit<RosterEntry, 'id' | 'createdAt' | 'createdBy'>): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not authenticated.' };
    const existing = dutyRoster.find(r => r.userId === entry.userId && r.date === entry.date);
    const id = existing?.id || genId('RST');
    const now = new Date().toISOString();
    const shiftStart = entry.checkInTime || entry.shiftStart || '';
    const shiftEnd   = entry.checkOutTime || entry.shiftEnd || '';
    if (existing) {
      const { error } = await supabase.from('duty_roster').update({
        shift_start: shiftStart, shift_end: shiftEnd,
        check_in_time: shiftStart, check_out_time: shiftEnd,
        shift_label: entry.shiftLabel || 'Day',
        note: entry.note || null,
      }).eq('id', id);
      if (error) return { success: false, message: error.message };
      setDutyRoster(prev => prev.map(r => r.id === id
        ? { ...r, ...entry, shiftStart, shiftEnd, checkInTime: shiftStart, checkOutTime: shiftEnd }
        : r));
    } else {
      const { error } = await supabase.from('duty_roster').insert({
        id, user_id: entry.userId, user_name: entry.userName,
        department: entry.department, date: entry.date,
        shift_start: shiftStart, shift_end: shiftEnd,
        check_in_time: shiftStart, check_out_time: shiftEnd,
        shift_label: entry.shiftLabel || 'Day',
        note: entry.note || null,
        created_by: currentUser.name, created_at: now,
      });
      if (error) return { success: false, message: error.message };
      setDutyRoster(prev => [...prev, {
        ...entry, id, shiftStart, shiftEnd,
        checkInTime: shiftStart, checkOutTime: shiftEnd,
        createdBy: currentUser.name, createdAt: now,
      }]);
    }
    return { success: true, message: 'Roster entry saved.' };
  }, [currentUser, dutyRoster]);

  const deleteRosterEntry = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not authenticated.' };
    const { error } = await supabase.from('duty_roster').delete().eq('id', id);
    if (error) return { success: false, message: error.message };
    setDutyRoster(prev => prev.filter(r => r.id !== id));
    return { success: true, message: 'Roster entry removed.' };
  }, [currentUser]);

  // Lightweight refresh of custom_role_permissions — called by PermissionsView after any toggle
  // so hasPermission reflects changes immediately without a full page reload.
  const refreshCustomRolePerms = useCallback(async () => {
    try {
      const { data } = await supabase.from('custom_role_permissions').select('role_id, feature_key');
      if (data) {
        const map: Record<string, string[]> = {};
        data.forEach((r: any) => { if (!map[r.role_id]) map[r.role_id] = []; map[r.role_id].push(r.feature_key); });
        setCustomRoleFeatureGrants(map);
      }
    } catch { /* ignore */ }
  }, []);

  /**
   * getDelegateApprover — finds the active approver for a department.
   *
   * Logic:
   * 1. Find the normal approver (manager / HR) in that dept.
   * 2. If they are on approved leave today or it is their weekend → look for an
   *    "Assistant Dept Manager" custom-role member in the same dept.
   *    For POP units: look for an "incharge" (any custom-role whose name contains
   *    "incharge") in the same unit/dept.
   * 3. If no delegate found → return null (caller falls back to HR directly).
   *
   * Returns the User who should receive the request, or null if none found.
   */
  const setDepartmentDelegate = useCallback(async (dept: string, userId: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not authenticated.' };
    const delegateUser = users.find(u => u.id === userId);
    if (!delegateUser) return { success: false, message: 'User not found.' };
    const id = genId('DD');
    const now = new Date().toISOString();
    // Upsert — one delegate per department
    const existing = departmentDelegates.find(d => d.department === dept);
    if (existing) {
      const { error } = await supabase.from('department_delegates')
        .update({ delegate_user_id: userId, delegate_user_name: delegateUser.name, created_by: currentUser.id })
        .eq('id', existing.id);
      if (error) return { success: false, message: error.message };
      setDepartmentDelegates(prev => prev.map(d => d.department === dept
        ? { ...d, delegateUserId: userId, delegateUserName: delegateUser.name } : d));
    } else {
      const { error } = await supabase.from('department_delegates').insert({
        id, department: dept, normal_role: 'MANAGER',
        delegate_user_id: userId, delegate_user_name: delegateUser.name,
        created_by: currentUser.id, created_at: now,
      });
      if (error) return { success: false, message: error.message };
      setDepartmentDelegates(prev => [...prev, { id, department: dept, normalRole: 'MANAGER', delegateUserId: userId, delegateUserName: delegateUser.name, createdBy: currentUser.id, createdAt: now }]);
    }
    await addActivityLog('DELEGATE_SET', 'INFRASTRUCTURE', `Acting manager for ${dept} set to ${delegateUser.name}.`, 'LOW');
    return { success: true, message: `${delegateUser.name} set as acting manager for ${dept}.` };
  }, [currentUser, users, departmentDelegates, addActivityLog]);

  const removeDepartmentDelegate = useCallback(async (dept: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not authenticated.' };
    const existing = departmentDelegates.find(d => d.department === dept);
    if (!existing) return { success: false, message: 'No delegate found.' };
    const { error } = await supabase.from('department_delegates').delete().eq('id', existing.id);
    if (error) return { success: false, message: error.message };
    setDepartmentDelegates(prev => prev.filter(d => d.department !== dept));
    await addActivityLog('DELEGATE_REMOVED', 'INFRASTRUCTURE', `Acting manager for ${dept} removed.`, 'LOW');
    return { success: true, message: 'Acting manager removed.' };
  }, [currentUser, departmentDelegates, addActivityLog]);

  const getDelegateApprover = useCallback((dept: string, normalRole: UserRole): User | null => {
    const today = new Date().toDateString();

    const isOnLeaveToday = (u: User): boolean => leaves.some(l =>
      l.userId === u.id &&
      (l.status === LeaveStatus.APPROVED || l.status === 'APPROVED' as any) &&
      new Date(l.startDate).toDateString() <= today &&
      new Date(l.endDate).toDateString() >= today
    );

    const isOnWeekend = (u: User): boolean => {
      const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      return (u.weekendDays || ['Friday', 'Saturday']).includes(todayDay as any);
    };

    const isUnavailable = (u: User) => isOnLeaveToday(u) || isOnWeekend(u);

    // Find the primary manager for this dept
    const primaryManager = users.find(u =>
      u.role === normalRole && u.department === dept
    );

    // If primary is available, they are the approver
    if (primaryManager && !isUnavailable(primaryManager)) return primaryManager;

    // Primary is unavailable — check department_delegates table first (explicit assignment)
    const explicitDelegate = departmentDelegates.find(d => d.department === dept);
    if (explicitDelegate) {
      const delegateUser = users.find(u => u.id === explicitDelegate.delegateUserId);
      if (delegateUser && !isUnavailable(delegateUser)) return delegateUser;
    }

    // Fallback: find a delegate from custom roles
    // customRoles are already loaded: { id, name, color }
    const delegateRoles = customRoles.filter(r =>
      r.name.toLowerCase().includes('assistant') ||
      r.name.toLowerCase().includes('incharge') ||
      r.name.toLowerCase().includes('in-charge') ||
      r.name.toLowerCase().includes('agm')
    );

    for (const dr of delegateRoles) {
      // customRoleFeatureGrants maps roleId → feature keys
      // We need the members — look in users whose customRoleMemberships include dr.id
      // Since we don't store member IDs in store directly, check userPermissions keyed by user id
      // The user's custom-role is reflected in their id field of customRoles memberships via hasPermission
      // Instead, iterate users and check if any are member of this delegate role in the same dept
      const delegate = users.find(u =>
        u.department === dept &&
        u.id !== primaryManager?.id &&
        // Check if user is a member of this custom role via customRoleFeatureGrants membership
        // We check via the permissions system — users with approve_leaves in the delegate role's grants
        hasPermission(u.id, 'approve_leaves')
      );
      if (delegate && !isUnavailable(delegate)) return delegate;
    }

    return null;
  }, [users, leaves, customRoles, customRoleFeatureGrants, hasPermission, departmentDelegates]);

  // ── Load unit/dept approver maps ─────────────────────────────────────────────
  const refreshApproverMaps = useCallback(async () => {
    const [{ data: ua }, { data: da }] = await Promise.all([
      supabase.from('unit_approvers').select('unit_id,approver_user_id'),
      supabase.from('dept_approvers').select('department,approver_user_id'),
    ]);
    const uMap: Record<string, string> = {};
    (ua || []).forEach((r: any) => { uMap[r.unit_id] = r.approver_user_id; });
    setUnitApproversMap(uMap);
    const dMap: Record<string, string> = {};
    (da || []).forEach((r: any) => { dMap[r.department] = r.approver_user_id; });
    setDeptApproversMap(dMap);
  }, []);
  useEffect(() => { refreshApproverMaps(); }, [refreshApproverMaps]);

  // ── Unit-aware leave approval check ──────────────────────────────────────────
  // Pay-scale-based: routes to highest-salary person in unit (or configured
  // override via unit_approvers table), then HR. Dept fallback for non-unit staff.
  const canApproveLeaveExtended = useCallback((leave: LeaveRequest): boolean => {
    if (!currentUser) return false;
    if (leave.status === LeaveStatus.APPROVED || leave.status === LeaveStatus.REJECTED) return false;
    if (currentUser.role === UserRole.DEVELOPER || currentUser.role === UserRole.ADMIN) return true;

    const requester = users.find(u => u.id === leave.userId);
    const unitId = (requester as any)?.unitId;

    if (unitId) {
      if (leave.status === LeaveStatus.PENDING) {
        const configuredId = unitApproversMap[unitId];
        if (configuredId) return currentUser.id === configuredId;
        // Auto: highest baseSalary in same unit (excluding requester)
        const peers = users.filter(u => (u as any).unitId === unitId && u.id !== requester?.id);
        if (peers.length) {
          const senior = peers.reduce((b, u) => u.baseSalary > b.baseSalary ? u : b, peers[0]);
          return currentUser.id === senior.id;
        }
        return currentUser.role === UserRole.HR;
      }
      if (leave.status === LeaveStatus.UNIT_HEAD_APPROVED) {
        return currentUser.role === UserRole.HR || currentUser.role === UserRole.CO_ADMIN;
      }
      if (leave.status === LeaveStatus.HR_APPROVED) {
        return currentUser.role === UserRole.CO_ADMIN;
      }
      if (leave.status === LeaveStatus.CO_ADMIN_APPROVED) {
        return currentUser.role === UserRole.CO_ADMIN;
      }
      return false;
    }

    // Dept-level configured approver for non-unit employees
    const deptApproverId = deptApproversMap[leave.department];
    if (deptApproverId && leave.status === LeaveStatus.PENDING) {
      return currentUser.id === deptApproverId;
    }

    return canApproveLeave(currentUser.role, leave);
  }, [currentUser, users, units, unitApproversMap, deptApproversMap]);

  return (
    <HRMContext.Provider value={{
      currentUser, users, attendance, leaves, salaries, activityLogs,
      gpsLogs, units, departments, notifications, payScales,
      theme, toggleTheme, isTracking, setTracking, isLoading,
      login, logout, changePassword, updateUser, createEmployee,
      deleteEmployee, uploadAvatar, deleteLeave, loanRequests, applyLoan, reviewLoan,
      addExistingLoan, setLoanRepaymentPlan, updateLoanRepayment,
      addUnit, updateUnit, addDepartment, updateDepartment,
      checkIn, checkOut, breakStart, breakEnd,
      applyLeave, updateLeave,
      addSalary, updateSalary, deleteSalary,
      sendNotification, markNotificationRead, markAllNotificationsRead,
      addActivityLog, addAuditLog,
      deleteActivityLog, deleteAllActivityLogs,
      addGPSLog, refreshData, refreshGpsLogs,
      deleteUnit, deleteDepartment,
      addPayScale, updatePayScale, deletePayScale,
      leavePolicies, addLeavePolicy, updateLeavePolicy, deleteLeavePolicy,
      profileChangeRequests, submitProfileChangeRequest, reviewProfileChangeRequest,
      customRoles,
      departmentDelegates, setDepartmentDelegate, removeDepartmentDelegate,
      getDelegateApprover, canApproveLeaveExtended,
      userPermissions, roleFeatureGrants, customRoleFeatureGrants, grantPermission, revokePermission, hasPermission,
      refreshCustomRolePerms,
      scheduleChangeRequests, requestScheduleChange, reviewScheduleChange,
      deleteAttendanceRecord, deleteAllAttendanceForDate,
      setDocDeadline, setDocDeadlineBulk,
      holidays, addHoliday, updateHoliday, deleteHoliday,
      weekendWorkPermissions, requestWeekendWork, reviewWeekendWork,
      dutyRoster, upsertRosterEntry, deleteRosterEntry,
    }}>
      {children}
    </HRMContext.Provider>
  );
};

export const useHRM = () => {
  const ctx = useContext(HRMContext);
  if (!ctx) throw new Error('useHRM must be used within HRMProvider');
  return ctx;
};
