export enum RequestType {
  LEAVE = 'LEAVE',
  LOAN = 'LOAN',
  ADVANCE_SALARY = 'ADVANCE_SALARY',
}

export interface LoanRequest {
  id: string;
  userId: string;
  userName: string;
  department: string;
  type: 'LOAN' | 'ADVANCE_SALARY';
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export enum UserRole {
  DEVELOPER = 'DEVELOPER', // Super-admin: full access everywhere, no geofence restriction
  ADMIN = 'ADMIN',
  CO_ADMIN = 'CO_ADMIN',
  HR = 'HR',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE'
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  MANAGER_APPROVED = 'MANAGER_APPROVED',
  UNIT_HEAD_APPROVED = 'UNIT_HEAD_APPROVED',
  HR_APPROVED = 'HR_APPROVED',
  CO_ADMIN_APPROVED = 'CO_ADMIN_APPROVED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

// Days of the week for weekend configuration
export type WeekDay = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export const ALL_WEEK_DAYS: WeekDay[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Duty Schedule ─────────────────────────────────────────────────────────────
export interface DutySchedule {
  checkInTime: string;  // "HH:MM" 24h format e.g. "09:00"
  checkOutTime: string; // "HH:MM" 24h format e.g. "18:00"
  graceMinutes: number; // minutes late before counted as late (default 5)
  earlyCheckInMinutes: number; // how many minutes BEFORE duty time check-in is allowed (default 30)
}

export const DEFAULT_DUTY_SCHEDULE: DutySchedule = {
  checkInTime: '09:00',
  checkOutTime: '18:00',
  graceMinutes: 5,
  earlyCheckInMinutes: 30,
};

// ── Schedule Change Request ──────────────────────────────────────────────────
export type ScheduleChangeType = 'PERMANENT' | 'TEMPORARY';

export interface ScheduleChangeRequest {
  id: string;
  userId: string;
  userName: string;
  department: string;
  changeType: ScheduleChangeType;
  requestedCheckIn: string;  // "HH:MM"
  requestedCheckOut: string; // "HH:MM"
  // For temporary changes
  startDate?: string; // ISO date
  endDate?: string;   // ISO date
  reason: string;
  status: 'PENDING' | 'MANAGER_APPROVED' | 'APPROVED' | 'REJECTED';
  managerApprovedBy?: string;
  hrApprovedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  // ── Policy tracking fields ───────────────────────────────────────────────
  advanceNoticeHours?: number;     // hours between submission and start date
  isPolicyViolation?: boolean;     // flagged if advance notice insufficient
  createdAt: string;
}

export interface User {
  /** Internal PostgreSQL UUID. Keep this for API relationships and authorization. */
  id: string;
  /** Human-facing HR employee code, e.g. E0208. */
  employeeCode?: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  avatar?: string | null;
  baseSalary: number;
  department: string;
  deviceId: string;
  unitId?: string;
  unitLocation: { lat: number; lng: number; };
  fatherName?: string;
  motherName?: string;
  nid?: string;
  presentAddress?: string;
  permanentAddress?: string;
  documents?: string[];
  mustChangePassword?: boolean;
  // ── Document upload deadline ──────────────────────────────────────────────
  // ISO timestamp. If set and past, account is locked until documents uploaded.
  docDeadline?: string | null;
  joinDate?: string;
  weekendDays?: WeekDay[];
  dutySchedule?: DutySchedule;
  lateCount?: number;
  designation?: string;
  designationTrack?: 'EXECUTIVE' | 'TECHNICIAN' | null;
  // ── Extended employee info (from Exord Employee Information Format) ──────
  gender?: string;
  bloodGroup?: string;
  dressSize?: string;
  dateOfBirth?: string;
  phoneOfficial?: string;
  phonePersonal?: string;
  phoneAlternative?: string;
  religion?: string;
  maritalStatus?: string;
  nationality?: string;
  // Emergency contact
  emergencyName?: string;
  emergencyAddress?: string;
  emergencyContact?: string;
  emergencyRelation?: string;
  // Bank account
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  bankRoutingNumber?: string;
  // ── Policy fields (EO/HLPF/16022026-01) ────────────────────────────────
  // Festival leave declarations submitted at joining (Clause 07)
  festivalLeave1Choice?: string;   // e.g. "Eid-ul-Fitr"
  festivalLeave2Choice?: string;   // e.g. "Eid-ul-Adha"
  // Track which festival period was worked (Clause 08)
  festivalWorkedPeriod?: 1 | 2;
  // Maternity leave tracking (Clause 26)
  livingChildren?: number;
}

export type UnitType = 'office' | 'pop' | 'both';

// ── Device type — what kind of network device is at this POP ─────────────────
export type DeviceType = 'router' | 'switch' | 'ap' | 'olt' | 'server' | 'other';

export interface SnmpConfig {
  host: string;       // Management IP or hostname
  community: string;  // SNMP community string (e.g. "public")
  port: number;       // Usually 161
  oid?: string;       // Optional: specific OID to poll (default: sysUpTime)
}

export interface Unit {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  unitType: UnitType;         // 'office' | 'pop' | 'both'
  deviceType?: DeviceType;    // what kind of device is at this POP
  snmpConfig?: SnmpConfig;    // Only relevant when unitType is 'pop' or 'both'
  headUserId?: string;
}

export interface Department {
  id: string;
  name: string;
  /** Primary unit ID — used for geofencing. Legacy single-unit field. */
  unitId: string;
  /** All units this department spans (includes unitId as first entry). */
  unitIds: string[];
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  timestamp: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';
  location: { lat: number; lng: number; accuracy: number; };
  ipAddress: string;
  status: 'SUCCESS' | 'FAILED';
  reason?: string;
  isLate?: boolean;
  lateMinutes?: number;
  breakType?: 'LUNCH' | 'SHORT' | 'PERSONAL' | 'OTHER';
}

export interface GPSLog {
  userId: string;
  lat: number;
  lng: number;
  timestamp: string;
  accuracy: number;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  department: string;
  startDate: string;
  endDate: string;
  type: string;
  status: LeaveStatus;
  reason: string;
  managerApprovedBy?: string;
  hrApprovedBy?: string;
  coAdminApprovedBy?: string;
  finalApprovedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

export interface SalaryRecord {
  id: string;
  userId: string;
  userName: string;
  month: string;
  year: number;
  base: number;
  bonus: number;
  deductions: number;
  net: number;
  status: 'PAID' | 'UNPAID';
}

// ── Pay Scale ─────────────────────────────────────────────────────────────────
export interface PayScale {
  id: string;
  role: UserRole;
  level: number;
  name: string;
  minSalary: number;
  maxSalary: number;
  createdAt: string;
}

// ── Leave Policy ──────────────────────────────────────────────────────────────
export interface LeavePolicy {
  id: string;
  name: string;
  leaveType: string;
  minServiceYears: number;
  maxServiceYears: number;
  daysAllowed: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Helper: get service years
export const getServiceYears = (joinDate?: string): number => {
  if (!joinDate) return 0;
  return (Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
};

// Helper: find applicable leave policy days for an employee
export const getApplicableLeaveDays = (
  policies: LeavePolicy[],
  leaveType: string,
  joinDate?: string,
): number => {
  const years = getServiceYears(joinDate);
  const matching = policies
    .filter(p => p.leaveType === leaveType && years >= p.minServiceYears && years <= p.maxServiceYears)
    .sort((a, b) => b.minServiceYears - a.minServiceYears);
  return matching[0]?.daysAllowed ?? 0;
};

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  category: 'AUTH' | 'EMPLOYEE' | 'ATTENDANCE' | 'LEAVE' | 'SALARY' | 'INFRASTRUCTURE' | 'SYSTEM';
  details: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ipAddress?: string;
  metadata?: any;
}

export type AuditLog = ActivityLog;

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  title: string;
  message: string;
  type: 'SALARY' | 'LEAVE' | 'GENERAL' | 'SYSTEM';
  metadata?: any;
  isRead: boolean;
  createdAt: string;
}

export const getLeaveStatusLabel = (status: LeaveStatus): string => {
  switch (status) {
    case LeaveStatus.PENDING: return 'Pending';
    case LeaveStatus.MANAGER_APPROVED: return 'Mgr Approved';
    case LeaveStatus.HR_APPROVED: return 'HR Approved';
    case LeaveStatus.CO_ADMIN_APPROVED: return 'Co-Admin Approved';
    case LeaveStatus.APPROVED: return 'Approved';
    case LeaveStatus.REJECTED: return 'Rejected';
    default: return status;
  }
};

export const getNextApprover = (
  requesterRole: UserRole,
  currentStatus: LeaveStatus
): UserRole | null => {
  if (requesterRole === UserRole.EMPLOYEE) {
    if (currentStatus === LeaveStatus.PENDING) return UserRole.MANAGER;
    if (currentStatus === LeaveStatus.MANAGER_APPROVED) return UserRole.HR;
    if (currentStatus === LeaveStatus.HR_APPROVED) return UserRole.ADMIN;
    return null;
  }
  if (requesterRole === UserRole.MANAGER) {
    if (currentStatus === LeaveStatus.PENDING) return UserRole.HR;
    if (currentStatus === LeaveStatus.HR_APPROVED) return UserRole.CO_ADMIN;
    if (currentStatus === LeaveStatus.CO_ADMIN_APPROVED) return UserRole.ADMIN;
    return null;
  }
  if (requesterRole === UserRole.HR) {
    if (currentStatus === LeaveStatus.PENDING) return UserRole.CO_ADMIN;
    if (currentStatus === LeaveStatus.CO_ADMIN_APPROVED) return UserRole.ADMIN;
    return null;
  }
  if (requesterRole === UserRole.CO_ADMIN) {
    if (currentStatus === LeaveStatus.PENDING) return UserRole.ADMIN;
    return null;
  }
  return null;
};

export const canApproveLeave = (
  approverRole: UserRole,
  leave: LeaveRequest
): boolean => {
  if (leave.status === LeaveStatus.APPROVED || leave.status === LeaveStatus.REJECTED) return false;
  // DEVELOPER has full approval power like ADMIN
  if (approverRole === UserRole.DEVELOPER) return true;
  const next = getNextApprover(leave.userRole, leave.status);
  return next === approverRole;
};

// Helper: is today a weekend for this employee?
export const isWeekendForUser = (user: User): boolean => {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as WeekDay;
  return (user.weekendDays || ['Friday', 'Saturday']).includes(today);
};

// ── Duty schedule helpers ─────────────────────────────────────────────────────

/** Parse "HH:MM" to today's Date object */
export const parseDutyTime = (timeStr?: string | null): Date => {
  const safe = typeof timeStr === 'string' && /^\d{1,2}:\d{2}$/.test(timeStr) ? timeStr : '09:00';
  const [h, m] = safe.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

/**
 * Check if the current time is within the allowed check-in window.
 * Window opens `earlyCheckInMinutes` before duty start and closes 23h after duty start.
 */
export const isWithinCheckInWindow = (schedule: DutySchedule): { allowed: boolean; reason: string } => {
  const now = new Date();
  const dutyStart = parseDutyTime(schedule.checkInTime);
  const windowOpen = new Date(dutyStart.getTime() - schedule.earlyCheckInMinutes * 60 * 1000);
  const windowClose = new Date(dutyStart.getTime() + 23 * 60 * 60 * 1000); // next 23 hours

  if (now < windowOpen) {
    const minsUntil = Math.ceil((windowOpen.getTime() - now.getTime()) / 60000);
    return { allowed: false, reason: `Check-in opens in ${minsUntil} minute(s) (${schedule.earlyCheckInMinutes} min before duty start).` };
  }
  if (now > windowClose) {
    return { allowed: false, reason: 'Check-in window has closed for today.' };
  }
  return { allowed: true, reason: '' };
};

/**
 * Returns late info for a check-in.
 * Late if actual check-in > duty start + graceMinutes.
 */
export const getLateInfo = (schedule: DutySchedule, checkInTime?: Date): { isLate: boolean; lateMinutes: number } => {
  const now = checkInTime || new Date();
  const dutyStart = parseDutyTime(schedule.checkInTime);
  const graceEnd = new Date(dutyStart.getTime() + schedule.graceMinutes * 60 * 1000);
  if (now <= graceEnd) return { isLate: false, lateMinutes: 0 };
  const lateMinutes = Math.ceil((now.getTime() - dutyStart.getTime()) / 60000);
  return { isLate: true, lateMinutes };
};
