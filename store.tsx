
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole, AttendanceRecord, LeaveRequest, SalaryRecord, AuditLog, GPSLog, LeaveStatus } from './types';
import { mockUsers, mockAttendance, mockLeaves, mockSalaries, mockAuditLogs } from './mockData';
import { isOfficeIp, isWithinOfficeRadius } from './utils';

interface HRMContextType {
  currentUser: User | null;
  users: User[];
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  salaries: SalaryRecord[];
  auditLogs: AuditLog[];
  gpsLogs: GPSLog[];
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  register: (name: string, email: string, password: string, userId: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  checkIn: (lat: number, lng: number, accuracy: number, ip: string) => Promise<{ success: boolean; message: string }>;
  checkOut: (lat: number, lng: number, accuracy: number, ip: string) => Promise<{ success: boolean; message: string }>;
  applyLeave: (leave: Omit<LeaveRequest, 'id' | 'status' | 'userName'>) => void;
  updateLeave: (id: string, status: LeaveStatus) => void;
  addAuditLog: (action: string, details: string, severity: AuditLog['severity']) => void;
  addGPSLog: (log: GPSLog) => void;
}

const HRMContext = createContext<HRMContextType | undefined>(undefined);

export const HRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(mockAttendance);
  const [leaves, setLeaves] = useState<LeaveRequest[]>(mockLeaves);
  const [salaries, setSalaries] = useState<SalaryRecord[]>(mockSalaries);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [gpsLogs, setGpsLogs] = useState<GPSLog[]>([]);

  const addAuditLog = useCallback((action: string, details: string, severity: AuditLog['severity']) => {
    const newLog: AuditLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      userId: currentUser?.id || 'system',
      userName: currentUser?.name || 'System',
      action,
      details,
      severity
    };
    setAuditLogs(prev => [newLog, ...prev].slice(0, 1000));
  }, [currentUser]);

  const login = async (email: string, password: string, role: UserRole): Promise<boolean> => {
    const user = users.find(u => u.email === email && u.password === password && u.role === role);
    if (user) {
      setCurrentUser(user);
      addAuditLog('USER_LOGIN', `User ${user.name} logged in`, 'LOW');
      return true;
    }
    addAuditLog('FAILED_LOGIN', `Failed login attempt for ${email}`, 'MEDIUM');
    return false;
  };

  const register = async (name: string, email: string, password: string, userId: string) => {
    if (users.find(u => u.id === userId || u.email === email)) {
      return { success: false, message: 'User ID or Email already registered.' };
    }

    const newUser: User = {
      id: userId,
      name,
      email,
      password,
      role: UserRole.EMPLOYEE,
      department: 'General Staff',
      baseSalary: 35000, // Default 35,000 TK
      deviceId: `DEV-${userId}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      officeLocation: { lat: 40.7128, lng: -74.0060 }
    };

    setUsers(prev => [...prev, newUser]);
    addAuditLog('USER_REGISTER', `New staff account provisioned: ${name} (${userId})`, 'LOW');
    return { success: true, message: 'Account registered successfully. Use your credentials to log in.' };
  };

  const logout = () => {
    addAuditLog('USER_LOGOUT', 'User session terminated', 'LOW');
    setCurrentUser(null);
  };

  const checkIn = async (lat: number, lng: number, accuracy: number, ip: string) => {
    if (!currentUser) return { success: false, message: 'Not authenticated' };

    const inOfficeRange = isWithinOfficeRadius(lat, lng);
    const inOfficeSubnet = isOfficeIp(ip);

    if (!inOfficeSubnet) {
      addAuditLog('ATTENDANCE_DENIED', `Check-in rejected: Outside network (${ip})`, 'MEDIUM');
      return { success: false, message: 'Unauthorized Network. Access restricted to Exord Office WiFi.' };
    }

    if (!inOfficeRange) {
      addAuditLog('ATTENDANCE_DENIED', `Check-in rejected: Outside geo-fence`, 'MEDIUM');
      return { success: false, message: 'Verification failed. Device detected outside authorized perimeter.' };
    }

    const newRecord: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      type: 'CHECK_IN',
      location: { lat, lng, accuracy },
      ipAddress: ip,
      status: 'SUCCESS'
    };

    setAttendance(prev => [...prev, newRecord]);
    addAuditLog('ATTENDANCE_SUCCESS', 'User verified and checked in', 'LOW');
    return { success: true, message: 'Identity verified. Duty session started.' };
  };

  const checkOut = async (lat: number, lng: number, accuracy: number, ip: string) => {
    if (!currentUser) return { success: false, message: 'Not authenticated' };
    
    const newRecord: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      type: 'CHECK_OUT',
      location: { lat, lng, accuracy },
      ipAddress: ip,
      status: 'SUCCESS'
    };

    setAttendance(prev => [...prev, newRecord]);
    addAuditLog('ATTENDANCE_SUCCESS', 'User checked out', 'LOW');
    return { success: true, message: 'Duty session ended successfully.' };
  };

  const applyLeave = (leave: Omit<LeaveRequest, 'id' | 'status' | 'userName'>) => {
    const newLeave: LeaveRequest = {
      ...leave,
      id: Math.random().toString(36).substr(2, 9),
      status: LeaveStatus.PENDING,
      userName: currentUser?.name || 'Unknown'
    };
    setLeaves(prev => [...prev, newLeave]);
  };

  const updateLeave = (id: string, status: LeaveStatus) => {
    setLeaves(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  };

  const addGPSLog = useCallback((log: GPSLog) => {
    setGpsLogs(prev => [...prev, log].slice(-1000));
  }, []);

  return (
    <HRMContext.Provider value={{
      currentUser, users, attendance, leaves, salaries, auditLogs, gpsLogs,
      login, register, logout, checkIn, checkOut, applyLeave, updateLeave, addAuditLog, addGPSLog
    }}>
      {children}
    </HRMContext.Provider>
  );
};

export const useHRM = () => {
  const context = useContext(HRMContext);
  if (context === undefined) {
    throw new Error('useHRM must be used within an HRMProvider');
  }
  return context;
};
