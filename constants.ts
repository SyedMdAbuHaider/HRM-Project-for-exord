export const UNIT_CONFIG = {
  IP_SUBNET: '192.168.1',
  RADIUS_METERS: 100,
  // ✅ Fixed: was incorrectly set to New York City (40.7128, -74.0060)
  LOCATION: {
    lat: 23.8103,
    lng: 90.4125,
  },
  NAME: 'Exord HQ - Dhaka'
};

export const SECURITY_RULES = {
  MAX_LOGIN_ATTEMPTS: 5,
  SESSION_TIMEOUT_MINS: 60,
  TRACKING_INTERVAL_MS: 300000, // 5 minutes
};

export const DEPARTMENTS = [
  'Network Operations',
  'Customer Support',
  'Sales',
  'Administration',
  'Field Engineering'
];

// ── Leave types matching Exord Online Holiday & Leave Policy (EO/HLPF/16022026-01) ──
export const LEAVE_TYPES = [
  'Optional/Casual Leave',       // 6 days — after 1 year service
  'Paid/Earned Leave',           // 3 days — after 1 year service
  'Sick Leave',                  // 3 days — after 1 year service
  'Religious Leave',             // 2 days — from joining
  'Festival Leave 1',            // 4 days — from joining (declared at joining)
  'Festival Leave 2',            // 4 days — from joining (declared at joining; must work one festival)
  'National Holiday',            // fixed dates: 21 Feb, 26 Mar, 14 Apr, 1 May, 16 Dec
  'Birthday Leave',              // 1 day — from joining; only on actual birthday
  'Maternity Leave',             // 3 months — after 1 year; max 2 living children
  'Non-Paid Leave',              // any leave beyond entitlement
];

// ── Monthly leave cap — only ONE of these three per month (Clause 06) ──
export const MONTHLY_CAPPED_LEAVE_TYPES = [
  'Optional/Casual Leave',
  'Paid/Earned Leave',
  'Sick Leave',
];

// ── National holidays (fixed dates per policy) ──
export const NATIONAL_HOLIDAYS: { date: string; name: string }[] = [
  { date: '02-21', name: '21st February — International Mother Language Day' },
  { date: '03-26', name: '26th March — Independence Day' },
  { date: '04-14', name: '14th April — Pohela Boishakh' },
  { date: '05-01', name: '1st May — Labour Day' },
  { date: '12-16', name: '16th December — Victory Day' },
];

// ── Leave advance notice requirements (Clause 13) ──
export const LEAVE_ADVANCE_NOTICE = {
  SINGLE_DAY_HOURS: 24,   // 1-day leave: 24 hrs in advance
  MULTI_DAY_HOURS: 72,    // >1 day leave: 72 hrs (3 days) in advance
};

// ── Attendance minimum monthly requirement (Clause 02) ──
export const MIN_MONTHLY_ATTENDANCE_PERCENT = 85;

// ── Late rules (Clauses 18–19) ──
export const LATE_RULES = {
  MAX_LATE_MINUTES: 30,          // up to 30 min = "Late" only
  HALF_ATTENDANCE_THRESHOLD: 240, // 30 min–4 hrs = Late + half attendance
  // >4 hrs late = no attendance
  LATES_PER_DEDUCTION: 3,        // every 3 lates = 1 day attendance deducted
};

// ── Unauthorized leave penalty (Clause 15) ──
export const UNAUTHORIZED_LEAVE_MULTIPLIER = 1.5; // 1 day absent = 1.5 days deducted

// ── Festival leave work obligation (Clause 08) ──
// Employee must work during one of their two festival periods.
// After that festival ends, remaining leave can be taken within 30 days.
export const FESTIVAL_LEAVE_GRACE_DAYS = 30;

// ── Discipline reward (Clause 28) ──
// 6 consecutive months with no late & no unauthorized leave = 2 days bonus attendance
export const DISCIPLINE_REWARD_MONTHS = 6;
export const DISCIPLINE_REWARD_DAYS = 2;

export const EMPLOYEE_DESIGNATIONS = [
  'Assistant Executive Officer', 'Executive Officer', 'Senior Executive Officer',
  'Deputy Assistant Manager', 'Assistant Manager', 'Senior Assistant Manager',
  'Deputy Manager', 'Manager', 'Senior Manager',
  'Assistant General Manager (AGM)', 'Deputy General Manager (DGM)', 'General Manager (GM)',
];

export const TECHNICIAN_DESIGNATIONS = [
  'Associate Technician', 'Junior Technician', 'Assistant Technician',
  'Technician', 'Senior Technician', 'Assistant Chief Technician', 'Chief Technician',
  'Transmission Coordinator', 'Senior Transmission Coordinator',
  'Assistant Transmission Manager', 'Transmission Manager', 'Senior Transmission Manager',
];
