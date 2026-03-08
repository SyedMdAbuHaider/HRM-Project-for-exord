
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole, AttendanceRecord, LeaveRequest, SalaryRecord, AuditLog, GPSLog, LeaveStatus, Unit, Department } from './types';
import { mockUsers, mockAttendance, mockLeaves, mockSalaries, mockAuditLogs, mockUnits, mockDepartments } from './mockData';
import { isUnitIp, calculateDistance } from './utils';

interface HRMContextType {
  currentUser: User | null;
  users: User[];
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  salaries: SalaryRecord[];
  auditLogs: AuditLog[];
  gpsLogs: GPSLog[];
  units: Unit[];
  departments: Department[];
  theme: 'light' | 'dark';
  isTracking: boolean;
  toggleTheme: () => void;
  setTracking: (active: boolean) => void;
  login: (identifier: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  changePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>;
  updateUser: (id: string, updates: Partial<User>) => void;
  createEmployee: (employeeData: Omit<User, 'role' | 'unitLocation' | 'deviceId'>) => Promise<{ success: boolean; message: string }>;
  addUnit: (unit: Omit<Unit, 'id'>) => void;
  updateUnit: (id: string, unit: Partial<Unit>) => void;
  addDepartment: (dept: Omit<Department, 'id'>) => void;
  updateDepartment: (id: string, dept: Partial<Department>) => void;
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
  const [units, setUnits] = useState<Unit[]>(mockUnits);
  const [departments, setDepartments] = useState<Department[]>(mockDepartments);
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

  const logout = () => {
    addAuditLog('USER_LOGOUT', 'Session terminated.', 'LOW');
    setCurrentUser(null);
    setIsTracking(false);
  };

  const changePassword = async (newPassword: string) => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };
    
    setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, password: newPassword, mustChangePassword: false } : u));
    setCurrentUser(prev => prev ? { ...prev, password: newPassword, mustChangePassword: false } : null);
    
    addAuditLog('PASSWORD_CHANGE', `Node ${currentUser.id} updated access credentials.`, 'MEDIUM');
    return { success: true, message: 'Credentials updated successfully.' };
  };

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    addAuditLog('USER_UPDATE', `Admin override on node ${id}`, 'MEDIUM');
  }, [addAuditLog]);

  const createEmployee = async (employeeData: Omit<User, 'role' | 'unitLocation' | 'deviceId'>) => {
    const normalizedId = employeeData.id.toUpperCase();
    if (!/^E\d{4}$/.test(normalizedId)) {
      return { success: false, message: 'ID Format Mismatch. Use EXXXX.' };
    }

    if (users.find(u => u.id === normalizedId || u.email === employeeData.email)) {
      return { success: false, message: 'Node collision. ID or Email already exists.' };
    }

    const newUser: User = {
      ...employeeData,
      id: normalizedId,
      password: 'Exord@123', // Default password
      mustChangePassword: true,
      role: UserRole.EMPLOYEE,
      deviceId: `DEV-${normalizedId}`,
      unitLocation: { lat: 40.7128, lng: -74.0060 }
    };

    setUsers(prev => [...prev, newUser]);
    addAuditLog('USER_CREATE', `New employee created by ${currentUser?.name}: ${normalizedId}`, 'MEDIUM');
    return { success: true, message: `Employee ${normalizedId} created successfully.` };
  };

  const addUnit = useCallback((unit: Omit<Unit, 'id'>) => {
    const newUnit: Unit = { ...unit, id: `UNIT-${Math.random().toString(36).substr(2, 5).toUpperCase()}` };
    setUnits(prev => [...prev, newUnit]);
    addAuditLog('UNIT_CREATE', `New unit created: ${unit.name}`, 'MEDIUM');
  }, [addAuditLog]);

  const updateUnit = useCallback((id: string, updates: Partial<Unit>) => {
    setUnits(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    addAuditLog('UNIT_UPDATE', `Unit updated: ${id}`, 'MEDIUM');
  }, [addAuditLog]);

  const addDepartment = useCallback((dept: Omit<Department, 'id'>) => {
    const newDept: Department = { ...dept, id: `DEPT-${Math.random().toString(36).substr(2, 5).toUpperCase()}` };
    setDepartments(prev => [...prev, newDept]);
    addAuditLog('DEPT_CREATE', `New department created: ${dept.name}`, 'MEDIUM');
  }, [addAuditLog]);

  const updateDepartment = useCallback((id: string, updates: Partial<Department>) => {
    setDepartments(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    addAuditLog('DEPT_UPDATE', `Department updated: ${id}`, 'MEDIUM');
  }, [addAuditLog]);

  const checkIn = async (lat: number, lng: number, accuracy: number, ip: string) => {
    if (!currentUser) return { success: false, message: 'Auth Required.' };
    
    // Find user's department and unit
    const userDept = departments.find(d => d.name === currentUser.department);
    const unit = userDept ? units.find(u => u.id === userDept.unitId) : units[0];

    if (!unit) {
      return { success: false, message: 'Unit configuration missing for your department.' };
    }

    const distance = calculateDistance(lat, lng, unit.lat, unit.lng);
    const radius = unit.radius || 50;

    if (distance > radius) {
      addAuditLog('ATTENDANCE_FAILED', `Geofence breach on check-in. Distance: ${Math.round(distance)}m`, 'MEDIUM');
      return { success: false, message: `Geofence Breach. You are ${Math.round(distance)}m away from ${unit.name}. Max allowed: ${radius}m.` };
    }

    if (!isUnitIp(ip)) {
      addAuditLog('ATTENDANCE_FAILED', 'Network restricted access denied.', 'MEDIUM');
      return { success: false, message: 'Network Mismatch. Please connect to Unit Fiber.' };
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
      currentUser, users, attendance, leaves, salaries, auditLogs, gpsLogs, units, departments, theme, toggleTheme, isTracking, setTracking,
      login, logout, changePassword, updateUser, createEmployee, addUnit, updateUnit, addDepartment, updateDepartment, checkIn, checkOut, applyLeave, updateLeave, addAuditLog, addGPSLog
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
