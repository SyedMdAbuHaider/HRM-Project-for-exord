
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
  theme: 'light' | 'dark';
  isTracking: boolean;
  toggleTheme: () => void;
  setTracking: (active: boolean) => void;
  login: (identifier: string, password: string, role: UserRole) => Promise<boolean>;
  register: (name: string, email: string, password: string, userId: string, department: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateUser: (id: string, updates: Partial<User>) => void;
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
  const [isTracking, setIsTracking] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('exord-theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('exord-theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const setTracking = useCallback((active: boolean) => {
    setIsTracking(active);
  }, []);

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

  const login = async (identifier: string, password: string, role: UserRole): Promise<boolean> => {
    const user = users.find(u => 
      (u.email === identifier || u.id.toUpperCase() === identifier.toUpperCase()) && 
      u.password === password && 
      u.role === role
    );
    
    if (user) {
      setCurrentUser(user);
      addAuditLog('USER_LOGIN', `Node ${user.id} authenticated.`, 'LOW');
      return true;
    }
    addAuditLog('FAILED_LOGIN', `Unauthorized access attempt: ${identifier}`, 'MEDIUM');
    return false;
  };

  const register = async (name: string, email: string, password: string, userId: string, department: string) => {
    const normalizedId = userId.toUpperCase();
    if (!/^E\d{4}$/.test(normalizedId)) {
      return { success: false, message: 'ID Format Mismatch. Use EXXXX.' };
    }

    if (users.find(u => u.id === normalizedId || u.email === email)) {
      return { success: false, message: 'Node collision. ID or Email already exists.' };
    }

    const newUser: User = {
      id: normalizedId,
      name,
      email,
      password,
      role: UserRole.EMPLOYEE,
      department: department,
      baseSalary: 45000, 
      deviceId: `DEV-${normalizedId}`,
      officeLocation: { lat: 40.7128, lng: -74.0060 }
    };

    setUsers(prev => [...prev, newUser]);
    addAuditLog('USER_REGISTER', `New node provisioned: ${normalizedId} in ${department}`, 'LOW');
    return { success: true, message: `Node initialized for ${normalizedId}.` };
  };

  const logout = () => {
    addAuditLog('USER_LOGOUT', 'Session terminated.', 'LOW');
    setCurrentUser(null);
    setIsTracking(false);
  };

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    addAuditLog('USER_UPDATE', `Admin override on node ${id}`, 'MEDIUM');
  }, [addAuditLog]);

  const checkIn = async (lat: number, lng: number, accuracy: number, ip: string) => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };
    
    if (!isOfficeIp(ip)) {
      addAuditLog('ATTENDANCE_FAILED', 'Network restricted access denied.', 'MEDIUM');
      return { success: false, message: 'Network Mismatch. Please connect to Office Fiber.' };
    }

    if (!isWithinOfficeRadius(lat, lng)) {
      addAuditLog('ATTENDANCE_FAILED', 'Geofence breach on check-in.', 'MEDIUM');
      return { success: false, message: 'Geofence Breach. Move to HQ perimeter.' };
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
    addAuditLog('ATTENDANCE_SUCCESS', 'Node linked to duty cycle.', 'LOW');
    return { success: true, message: 'Node synced. Welcome to Exord HQ.' };
  };

  const checkOut = async (lat: number, lng: number, accuracy: number, ip: string) => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };
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
    return { success: true, message: 'Duty sequence ended.' };
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
    setGpsLogs(prev => [...prev, log].slice(-5000));
  }, []);

  return (
    <HRMContext.Provider value={{
      currentUser, users, attendance, leaves, salaries, auditLogs, gpsLogs, theme, toggleTheme, isTracking, setTracking,
      login, register, logout, updateUser, checkIn, checkOut, applyLeave, updateLeave, addAuditLog, addGPSLog
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
