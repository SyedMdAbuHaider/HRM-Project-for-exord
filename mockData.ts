
import { User, UserRole, LeaveStatus, AttendanceRecord, LeaveRequest, SalaryRecord, AuditLog } from './types';

export const mockUsers: User[] = [
  {
    id: 'E0001',
    name: 'Exord Administrator',
    email: 'admin@exordonline.com',
    password: 'exord@3214',
    role: UserRole.ADMIN,
    department: 'Management',
    baseSalary: 150000,
    deviceId: 'DEV-EXORD-001',
    officeLocation: { lat: 40.7128, lng: -74.0060 }
  },
  {
    id: 'E0002',
    name: 'Sarah Connor',
    email: 'admin@securewfm.com',
    password: 'password123',
    role: UserRole.ADMIN,
    department: 'Executive',
    baseSalary: 120000,
    deviceId: 'DEV-ADMIN-001',
    officeLocation: { lat: 40.7128, lng: -74.0060 }
  },
  {
    id: 'E1001',
    name: 'John Smith',
    email: 'john.smith@securewfm.com',
    password: 'password123',
    role: UserRole.EMPLOYEE,
    department: 'Engineering',
    baseSalary: 85000,
    deviceId: 'DEV-SMITH-442',
    officeLocation: { lat: 40.7128, lng: -74.0060 }
  },
  {
    id: 'E1002',
    name: 'Emily Davis',
    email: 'emily.d@securewfm.com',
    password: 'password123',
    role: UserRole.EMPLOYEE,
    department: 'Sales',
    baseSalary: 75000,
    deviceId: 'DEV-DAVIS-991',
    officeLocation: { lat: 40.7128, lng: -74.0060 }
  }
];

export const mockAttendance: AttendanceRecord[] = [
  {
    id: 'att-1',
    userId: 'E1001',
    timestamp: new Date().toISOString(),
    type: 'CHECK_IN',
    location: { lat: 40.7127, lng: -74.0059, accuracy: 5 },
    ipAddress: '192.168.1.45',
    status: 'SUCCESS'
  }
];

export const mockLeaves: LeaveRequest[] = [
  {
    id: 'lv-1',
    userId: 'E1001',
    userName: 'John Smith',
    startDate: '2024-06-10',
    endDate: '2024-06-15',
    type: 'Annual',
    status: LeaveStatus.PENDING,
    reason: 'Family vacation'
  }
];

export const mockSalaries: SalaryRecord[] = [
  {
    id: 'sal-1',
    userId: 'E1001',
    userName: 'John Smith',
    month: 'May',
    year: 2024,
    base: 70000,
    bonus: 5000,
    deductions: 2000,
    net: 73000,
    status: 'PAID'
  }
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'audit-1',
    timestamp: new Date().toISOString(),
    userId: 'E0001',
    userName: 'Exord Administrator',
    action: 'USER_LOGIN',
    details: 'Admin logged in from 192.168.1.1',
    severity: 'LOW'
  }
];
