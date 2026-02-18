
export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE'
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Added for authentication simulation
  role: UserRole;
  avatar?: string;
  baseSalary: number;
  department: string;
  deviceId: string;
  officeLocation: {
    lat: number;
    lng: number;
  };
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  timestamp: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  ipAddress: string;
  status: 'SUCCESS' | 'FAILED';
  reason?: string;
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
  startDate: string;
  endDate: string;
  type: string;
  status: LeaveStatus;
  reason: string;
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

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
