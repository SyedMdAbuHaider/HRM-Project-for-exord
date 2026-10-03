import { useLanguage } from '../i18n';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHRM } from '../store';
import {
  Wifi, ShieldCheck, Clock, Activity, Navigation, ShieldAlert,
  Crosshair, Building2, Bell, BellDot, CheckCircle, Banknote,
  Calendar, Zap, Camera, Coffee, Play, Users, Eye,
  AlertCircle, Check, X,
  FileText, Printer, MessageSquare, DollarSign, MapPin,
  ChevronRight, Star, Award, Target, Briefcase, Edit2, Send, CalendarDays,
  Search, Filter, SortAsc, ChevronDown, CalendarCheck2, Plus, RefreshCw
} from 'lucide-react';
import { formatCurrency } from '../utils';
import { isWeekendForUser, DEFAULT_DUTY_SCHEDULE, parseDutyTime } from '../types';
import HolidayCalendar from '../components/HolidayCalendar';

// ─── Live Clock ───────────────────────────────────────────────────────────────
const LiveClock: React.FC<{ isTracking: boolean; isCheckedIn: boolean; isOnBreak: boolean }> = ({ isTracking, isCheckedIn, isOnBreak }) => {
  const [now, setNow] = useState(new Date());
  const { t } = useLanguage();
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const statusGradient = isOnBreak
    ? 'from-amber-500 to-orange-500'
    : isCheckedIn
    ? 'from-emerald-500 to-teal-600'
    : 'from-slate-800 to-slate-950';

  return (
    <div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${statusGradient} p-6 text-white shadow-2xl`}>
      <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-black/10 rounded-full blur-2xl" />
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-1">
            {isOnBreak ? t('on_break') : isCheckedIn ? t('active_session') : t('not_clocked_in')}
          </p>
          <p className="text-4xl font-black tracking-tighter tabular-nums leading-none">{timeStr}</p>
          <p className="text-xs text-white/60 font-medium mt-2">{dateStr}</p>
        </div>
        {isTracking && (
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Crosshair size={18} className="text-white" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/70 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Live
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// DD/MM/YYYY masked text input — stores value as ISO yyyy-mm-dd internally
const DateInput: React.FC<{
  value: string;
  onChange: (iso: string) => void;
  className?: string;
}> = ({ value, onChange, className = '' }) => {
  const isoToDisplay = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso; // already display format or partial
    return `${d}/${m}/${y}`;
  };
  const displayToISO = (display: string) => {
    const digits = display.replace(/\D/g, '');
    if (digits.length === 8) {
      return `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
    }
    return '';
  };
  const formatDigits = (digits: string) => {
    if (digits.length > 4) return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4,8)}`;
    if (digits.length > 2) return `${digits.slice(0,2)}/${digits.slice(2)}`;
    return digits;
  };

  const [display, setDisplay] = React.useState(() => isoToDisplay(value));
  const prevValue = React.useRef(value);

  React.useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      setDisplay(isoToDisplay(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Extract only digits, cap at 8
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const formatted = formatDigits(digits);
    setDisplay(formatted);
    onChange(displayToISO(formatted));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If user presses backspace on a slash, skip over it
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const pos = input.selectionStart ?? display.length;
      if (pos > 0 && display[pos - 1] === '/') {
        e.preventDefault();
        const digits = display.replace(/\D/g, '').slice(0, -1);
        const formatted = formatDigits(digits);
        setDisplay(formatted);
        onChange(displayToISO(formatted));
      }
    }
  };

  return (
    <input
      type="text"
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="DD/MM/YYYY"
      maxLength={10}
      className={className}
    />
  );
};

// ─── Workforce Status Board ───────────────────────────────────────────────────
const WorkforceStatusBoard: React.FC = () => {
  const { users, attendance, leaves, departments, customRoles, currentUser } = useHRM();
  const { t } = useLanguage();
  const todayStr     = new Date().toDateString();
  const todayDateStr = new Date().toISOString().split('T')[0];

  // Managers are scoped to their own department; all other elevated roles see everyone
  const isManager = currentUser?.role === 'MANAGER';
  const scopedUsers = isManager
    ? users.filter(u => u.department === currentUser?.department)
    : users;

  // ── Filter / sort state ────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [filterDept,  setFilterDept]  = useState('');
  const [filterRole,  setFilterRole]  = useState('');
  const [filterStatus,setFilterStatus]= useState('');
  const [sortBy,      setSortBy]      = useState<'id' | 'name' | 'dept' | 'role'>('id');
  const [groupBy,     setGroupBy]     = useState<'none' | 'dept' | 'role' | 'status'>('dept');

  const employeeStatuses = useMemo(() => {
    return scopedUsers.map(user => {
      const recs = attendance.filter(a => a.userId === user.id && new Date(a.timestamp).toDateString() === todayStr);
      const ci  = recs.find(a => a.type === 'CHECK_IN'    && a.status === 'SUCCESS');
      const co  = recs.find(a => a.type === 'CHECK_OUT'   && a.status === 'SUCCESS');
      const bs  = recs.find(a => a.type === 'BREAK_START' && a.status === 'SUCCESS');
      const be  = recs.find(a => a.type === 'BREAK_END'   && a.status === 'SUCCESS');
      if (isWeekendForUser(user)) return { user, status: 'WEEKEND' as const };
      const onLeave = leaves.find(l => l.userId === user.id && l.status === 'APPROVED' && todayDateStr >= l.startDate && todayDateStr <= l.endDate);
      if (onLeave) return { user, status: 'ON_LEAVE' as const };
      if (ci && !co) return { user, status: (bs && !be ? 'ON_BREAK' : 'PRESENT') as any };
      if (ci && co)  return { user, status: 'CHECKED_OUT' as const };
      return { user, status: 'ABSENT' as const };
    });
  }, [scopedUsers, attendance, leaves, todayStr, todayDateStr]);

  const CFG: Record<string, { label: string; dot: string; badge: string }> = {
    PRESENT:     { label: t('active'),      dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' },
    ON_BREAK:    { label: t('on_break'),    dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' },
    CHECKED_OUT: { label: t('checked_out'),dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-100 dark:border-blue-900/30' },
    ON_LEAVE:    { label: t('on_leave'),    dot: 'bg-purple-500',  badge: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-100 dark:border-purple-900/30' },
    WEEKEND:     { label: t('weekend'),     dot: 'bg-teal-400',    badge: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-100 dark:border-teal-900/30' },
    ABSENT:      { label: t('absent'),      dot: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-100 dark:border-rose-900/30' },
  };

  // numeric sort helper: extracts trailing number from ID like E0001 → 1
  const idNum = (id: string) => parseInt(id.replace(/\D/g, '') || '0', 10);

  const getRoleDisplay = (role: string): string => {
    if (!role) return 'Employee';
    if (role.startsWith('custom::')) {
      const cr = customRoles.find(r => r.id === role.replace('custom::', ''));
      return cr ? cr.name : 'Custom Role';
    }
    if (role === 'CO_ADMIN') return 'Co-Admin';
    if (role === 'DEVELOPER') return 'Developer';
    return role.charAt(0) + role.slice(1).toLowerCase();
  };

  // unique values for filter dropdowns
  const allDepts  = useMemo(() => [...new Set(scopedUsers.map(u => u.department).filter(Boolean))].sort(), [scopedUsers]);
  const allRoles  = useMemo(() => [...new Set(scopedUsers.map(u => u.role))].sort(), [scopedUsers]);

  // filtered + sorted list
  const filtered = useMemo(() => {
    let list = [...employeeStatuses];
    const q = search.toLowerCase().trim();
    if (q)            list = list.filter(({ user }) => user.name.toLowerCase().includes(q) || user.id.toLowerCase().includes(q) || user.department?.toLowerCase().includes(q));
    if (filterDept)   list = list.filter(({ user }) => user.department === filterDept);
    if (filterRole)   list = list.filter(({ user }) => user.role === filterRole);
    if (filterStatus) list = list.filter(({ status }) => status === filterStatus);

    list.sort((a, b) => {
      if (sortBy === 'id')   return idNum(a.user.id) - idNum(b.user.id);
      if (sortBy === 'name') return a.user.name.localeCompare(b.user.name);
      if (sortBy === 'dept') return (a.user.department || '').localeCompare(b.user.department || '') || idNum(a.user.id) - idNum(b.user.id);
      if (sortBy === 'role') return a.user.role.localeCompare(b.user.role) || idNum(a.user.id) - idNum(b.user.id);
      return 0;
    });
    return list;
  }, [employeeStatuses, search, filterDept, filterRole, filterStatus, sortBy]);

  // grouped view
  const grouped = useMemo(() => {
    if (groupBy === 'none') return { 'All Employees': filtered };
    const map: Record<string, typeof filtered> = {};
    filtered.forEach(es => {
      const key = groupBy === 'dept'   ? (es.user.department || 'No Dept')
                : groupBy === 'role'   ? getRoleDisplay(es.user.role)
                : CFG[es.status]?.label || es.status;
      if (!map[key]) map[key] = [];
      map[key].push(es);
    });
    return map;
  }, [filtered, groupBy]);

  const counts = useMemo(() => ({
    present: employeeStatuses.filter(e => e.status === 'PRESENT').length,
    onBreak: employeeStatuses.filter(e => e.status === 'ON_BREAK').length,
    absent:  employeeStatuses.filter(e => e.status === 'ABSENT').length,
    onLeave: employeeStatuses.filter(e => e.status === 'ON_LEAVE').length,
  }), [employeeStatuses]);

  const hasFilters = search || filterDept || filterRole || filterStatus;

  return (
    <div className="space-y-4">
      {/* ── Manager scope notice ── */}
      {isManager && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
          <Building2 size={11} className="text-amber-500 flex-shrink-0" />
          <p className="text-[10px] font-black text-amber-700 dark:text-amber-400">
            Showing your department: <span className="uppercase">{currentUser?.department}</span>
          </p>
        </div>
      )}

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: t('active'),  val: counts.present, dot: 'bg-emerald-500' },
          { label: t('break_start'),   val: counts.onBreak, dot: 'bg-amber-500' },
          { label: t('absent'),  val: counts.absent,  dot: 'bg-rose-500' },
          { label: 'Leave',   val: counts.onLeave, dot: 'bg-purple-500' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl p-3 text-center border border-slate-100 dark:border-slate-800">
            <div className={`w-2 h-2 ${s.dot} rounded-full mx-auto mb-1.5`} />
            <p className="text-lg font-black text-slate-900 dark:text-white">{s.val}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Search bar ── */}
      <div className="relative">
        <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, ID or department…"
          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── Filter + Sort row ── */}
      <div className="flex gap-2 flex-wrap">
        {/* Department filter */}
        <div className="relative flex-1 min-w-[120px]">
          <Building2 size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="w-full pl-7 pr-6 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 focus:border-[#E31E24] outline-none appearance-none cursor-pointer">
            <option value="">All Depts</option>
            {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Role filter */}
        <div className="relative flex-1 min-w-[110px]">
          <Filter size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="w-full pl-7 pr-6 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 focus:border-[#E31E24] outline-none appearance-none cursor-pointer">
            <option value="">All Roles</option>
            {allRoles.map(r => <option key={r} value={r}>{getRoleDisplay(r)}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Status filter */}
        <div className="relative flex-1 min-w-[110px]">
          <Activity size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="w-full pl-7 pr-6 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 focus:border-[#E31E24] outline-none appearance-none cursor-pointer">
            <option value="">All Status</option>
            <option value="PRESENT">Active</option>
            <option value="ON_BREAK">On Break</option>
            <option value="CHECKED_OUT">Checked Out</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="ABSENT">Absent</option>
            <option value="WEEKEND">Weekend</option>
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Group by + Sort by row ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[8px] font-black uppercase text-slate-400 pointer-events-none">Group</span>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)}
            className="w-full pl-12 pr-6 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 focus:border-[#E31E24] outline-none appearance-none cursor-pointer">
            <option value="dept">By Department</option>
            <option value="role">By Role</option>
            <option value="status">By Status</option>
            <option value="none">No Grouping</option>
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative flex-1">
          <SortAsc size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="w-full pl-7 pr-6 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 focus:border-[#E31E24] outline-none appearance-none cursor-pointer">
            <option value="id">Sort: Employee ID</option>
            <option value="name">Sort: Name A–Z</option>
            <option value="dept">Sort: Department</option>
            <option value="role">Sort: Role</option>
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Results count ── */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-black text-slate-400">
          {filtered.length} of {employeeStatuses.length} employees
          {hasFilters && <button onClick={() => { setSearch(''); setFilterDept(''); setFilterRole(''); setFilterStatus(''); }} className="ml-2 text-[#E31E24] hover:underline">Clear filters</button>}
        </p>
      </div>

      {/* ── Employee list ── */}
      {Object.entries(grouped).map(([groupKey, emps]) => (
        <div key={groupKey} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          {groupBy !== 'none' && (
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50">
              <Building2 size={12} className="text-[#E31E24]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{groupKey}</span>
              <span className="ml-auto text-[9px] font-black text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{(emps as any[]).length}</span>
            </div>
          )}
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {(emps as any[]).map(({ user, status }) => {
              const cfg = CFG[status] || CFG.ABSENT;
              return (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="w-9 h-9 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
                    {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-black text-slate-600 dark:text-slate-300">{user.name.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{user.id} {groupBy !== 'dept' && user.department ? <span className="text-slate-300">· {user.department}</span> : null}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[9px] font-black uppercase tracking-widest ${cfg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'PRESENT' ? 'animate-pulse' : ''}`} />
                      {cfg.label}
                    </span>
                    {groupBy !== 'role' && user.designation && <span className="text-[8px] font-black text-slate-400 uppercase">{user.designation}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <Users size={32} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm font-bold">No employees match your filters.</p>
          {hasFilters && <button onClick={() => { setSearch(''); setFilterDept(''); setFilterRole(''); setFilterStatus(''); }} className="mt-2 text-xs text-[#E31E24] font-black">Clear all filters</button>}
        </div>
      )}
    </div>
  );
};

// ─── Duty Schedule Card (extracted from portal IIFE to fix React#300) ──────────
const DutyScheduleCard: React.FC<{
  currentUser: any;
  scheduleChangeRequests: any[];
  requestScheduleChange: (data: any) => Promise<{ success: boolean; message: string }>;
}> = ({ currentUser, scheduleChangeRequests, requestScheduleChange }) => {
  const schedule = currentUser?.dutySchedule || { checkInTime: '09:00', checkOutTime: '18:00', earlyCheckInMinutes: 30 };
  const myReqs = scheduleChangeRequests
    .filter((r: any) => r.userId === currentUser?.id)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latestReq = myReqs[0];
  const [showDutyEdit, setShowDutyEdit] = useState(false);
  const [dutyForm, setDutyForm] = useState({ checkIn: schedule.checkInTime, checkOut: schedule.checkOutTime, reason: '' });
  const [dutySubmitting, setDutySubmitting] = useState(false);
  const [dutyMsg, setDutyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 ">
        <div className="flex items-center gap-2 justify-center">
          <Clock size={13} className="text-[#E31E24]" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">My Duty Schedule</p>
        </div>
       

      </div>
      <div className="px-4 py-3 grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Check In</p>
          <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{schedule.checkInTime}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Check Out</p>
          <p className="font-black text-blue-600 dark:text-blue-400 text-sm">{schedule.checkOutTime}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Early CI</p>
          <p className="font-black text-amber-600 dark:text-amber-400 text-sm">{schedule.earlyCheckInMinutes ?? 30}m</p>
        </div>


      </div>
      {latestReq && (
        <div className="px-4 pb-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold ${
            latestReq.status === 'APPROVED' ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400' :
            latestReq.status === 'REJECTED' ? 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400' :
            'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400'
          }`}>
            <span className="uppercase font-black">{latestReq.status}</span>
            <span className="text-slate-400">—</span>
            <span>Last request: {latestReq.requestedCheckIn} → {latestReq.requestedCheckOut}</span>
          </div>

        </div>
      )}
      {showDutyEdit && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">New Check In</label>
              <input type="time" value={dutyForm.checkIn}
                onChange={e => setDutyForm(p => ({ ...p, checkIn: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">New Check Out</label>
              <input type="time" value={dutyForm.checkOut}
                onChange={e => setDutyForm(p => ({ ...p, checkOut: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Reason <span className="text-red-500">*</span></label>
            <textarea value={dutyForm.reason}
              onChange={e => setDutyForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Why do you need this schedule change?" rows={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none resize-none" />
          </div>
          {dutyMsg && (
            <div className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${dutyMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-400'}`}>
              {dutyMsg.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />} {dutyMsg.text}
            </div>
          )}
          <button
            disabled={dutySubmitting}
            onClick={async () => {
              if (!dutyForm.reason.trim()) { setDutyMsg({ type: 'error', text: 'Please provide a reason.' }); return; }
              if (dutyForm.checkIn === schedule.checkInTime && dutyForm.checkOut === schedule.checkOutTime) { setDutyMsg({ type: 'error', text: 'No changes detected.' }); return; }
              setDutySubmitting(true);
              const res = await requestScheduleChange({
                userId: currentUser!.id, userName: currentUser!.name,
                department: currentUser!.department, changeType: 'PERMANENT',
                requestedCheckIn: dutyForm.checkIn, requestedCheckOut: dutyForm.checkOut,
                reason: dutyForm.reason,
              });
              setDutySubmitting(false);
              setDutyMsg({ type: res.success ? 'success' : 'error', text: res.message });
              if (res.success) { setShowDutyEdit(false); setDutyForm({ checkIn: schedule.checkInTime, checkOut: schedule.checkOutTime, reason: '' }); }
            }}
            className="w-full py-2.5 text-xs font-black uppercase text-white bg-[#E31E24] rounded-xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2">
            {dutySubmitting ? <><AlertCircle size={12} className="animate-spin" /> Submitting...</> : <><Send size={12} /> Submit Request</>}
          </button>
        </div>
      )}



       <div className="flex justify-center mb-[10px]">
         <button
          onClick={() => { setShowDutyEdit(p => !p); setDutyMsg(null); setDutyForm({ checkIn: schedule.checkInTime, checkOut: schedule.checkOutTime, reason: '' }); }}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#E31E24] text-white text-[9px] font-black uppercase tracking-widest rounded-lg active:scale-95 transition-all">
          <Edit2 size={10} /> {showDutyEdit ? 'Cancel' : 'Request Change'}
        </button>
       </div>
    </div>
  );
};

// ─── Calendar Tab Panel (extracted to avoid IIFE/React#300 error) ─────────────
const CalendarTabPanel: React.FC<{
  attendance: any[];
  currentUser: any;
  onDateTap: (d: string) => void;
  selectedDate: string | null;
  onClose: () => void;
}> = ({ attendance, currentUser, onDateTap, selectedDate, onClose }) => {
  const myAttendance = attendance.filter((a: any) => a.userId === currentUser?.id);
  const attendanceDays = [...new Set(myAttendance.map((a: any) =>
    new Date(a.timestamp).toISOString().split('T')[0]
  ))] as string[];

  const fmtT = (ts: string) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const fmtDur = (ms: number) => { const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); return h > 0 ? `${h}h ${m}m` : `${m}m`; };

  const dayRecs: Record<string, any[]> = {};
  myAttendance.forEach((a: any) => {
    const key = new Date(a.timestamp).toISOString().split('T')[0];
    if (!dayRecs[key]) dayRecs[key] = [];
    dayRecs[key].push(a);
  });

  const recs = selectedDate ? (dayRecs[selectedDate] || []) : [];
  const ci = recs.find((r: any) => r.type === 'CHECK_IN' && r.status === 'SUCCESS');
  const co = recs.find((r: any) => r.type === 'CHECK_OUT' && r.status === 'SUCCESS');
  const bStarts = recs.filter((r: any) => r.type === 'BREAK_START' && r.status === 'SUCCESS').sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const bEnds   = recs.filter((r: any) => r.type === 'BREAK_END'   && r.status === 'SUCCESS').sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const breakPairs = bStarts.map((bs: any, i: number) => ({ start: bs, end: bEnds[i] || null }));
  const totalBreakMs = breakPairs.reduce((sum: number, { start, end }: any) => end ? sum + (new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime()) : sum, 0);
  const totalWorkMs = ci && co ? (new Date(co.timestamp).getTime() - new Date(ci.timestamp).getTime()) - totalBreakMs : null;
  const dateParts = selectedDate ? selectedDate.split('-') : ['', '', ''];

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-2">
        <CalendarDays size={11} /> Tap a date to see attendance detail
      </p>
      <HolidayCalendar onDateTap={onDateTap} attendanceDays={attendanceDays} />
      {selectedDate && (
        <div className="fixed inset-0 z-[800] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
          onClick={onClose}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2rem] shadow-2xl pb-8 animate-[slideUp_0.3s_ease-out]"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" /></div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attendance Detail</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{dateParts[2]}/{dateParts[1]}/{dateParts[0]}</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"><X size={16} /></button>
            </div>
            {recs.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3 text-slate-400">
                <Calendar size={28} className="text-slate-200 dark:text-slate-700" />
                <p className="text-sm font-bold">No attendance records for this day.</p>
              </div>
            ) : (
              <div className="px-6 pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Check In</p>
                    <p className="font-black text-emerald-600 dark:text-emerald-400 text-base">{ci ? fmtT(ci.timestamp) : '—'}</p>
                    {ci?.isLate && <p className="text-[9px] text-amber-500 font-black mt-1">⚠ {ci.lateMinutes}m late</p>}
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Check Out</p>
                    <p className="font-black text-blue-600 dark:text-blue-400 text-base">{co ? fmtT(co.timestamp) : '—'}</p>
                  </div>
                </div>
                {breakPairs.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Breaks ({breakPairs.length})</p>
                    {breakPairs.map(({ start, end }: any, i: number) => {
                      const dur = end ? new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime() : null;
                      return (
                        <div key={i} className="flex items-center justify-between text-xs font-bold">
                          <span className="text-amber-600 dark:text-amber-400">{fmtT(start.timestamp)} → {end ? fmtT(end.timestamp) : <span className="italic">ongoing</span>}</span>
                          {dur !== null && <span className="text-slate-500 text-[10px]">{fmtDur(dur)}</span>}
                        </div>
                      );
                    })}
                    <div className="border-t border-amber-100 dark:border-amber-900/30 pt-2 flex justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Break</span>
                      <span className="text-xs font-black text-amber-600">{fmtDur(totalBreakMs)}</span>
                    </div>
                  </div>
                )}
                {totalWorkMs !== null && (
                  <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-4 flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Net Work Hours</p>
                    <p className="text-lg font-black text-white">{fmtDur(totalWorkMs)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Portal ──────────────────────────────────────────────────────────────
const EmployeePortal: React.FC = () => {
  const {
    currentUser, checkIn, checkOut, breakStart, breakEnd,
    attendance, addGPSLog, isTracking, setTracking, addAuditLog,
    units, departments, notifications, markNotificationRead, uploadAvatar, salaries,
    leaves, users,
    profileChangeRequests, submitProfileChangeRequest, scheduleChangeRequests, requestScheduleChange,
    weekendWorkPermissions, requestWeekendWork,
  } = useHRM();
  const { t, lang } = useLanguage();

  const [loading, setLoading]               = useState(false);
  const [feedback, setFeedback]             = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [mockIp, setMockIp]                 = useState('192.168.1.52');
  const [activeTab, setActiveTab]           = useState<'portal' | 'team' | 'inbox' | 'salary' | 'profile' | 'calendar' | 'weekend'>('portal');
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);
  const [pdfSlipId, setPdfSlipId]           = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const watchIdRef    = useRef<number | null>(null);


  // Profile change request state
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileEditFields, setProfileEditFields] = useState<Record<string, string>>({});
  const [profileEditReason, setProfileEditReason] = useState('');
  const [profileEditSubmitting, setProfileEditSubmitting] = useState(false);
  const [profileEditMsg, setProfileEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const userDept    = departments.find(d => d.name === currentUser?.department);
  // Use primary unit (first in unitIds) for display; geofence checks all units via store
  const primaryUnitId = userDept?.unitIds?.[0] || userDept?.unitId;
  const unit        = primaryUnitId ? units.find(u => u.id === primaryUnitId) : units[0];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const todayStr = new Date().toDateString();
  const todayRecs = useMemo(() =>
    attendance.filter(a => a.userId === currentUser?.id && new Date(a.timestamp).toDateString() === todayStr),
    [attendance, currentUser, todayStr]
  );
  const todayCheckIn    = [...todayRecs].reverse().find(a => a.type === 'CHECK_IN'    && a.status === 'SUCCESS');
  const todayCheckOut   = [...todayRecs].reverse().find(a => a.type === 'CHECK_OUT'   && a.status === 'SUCCESS');
  const todayBreakStart = [...todayRecs].reverse().find(a => a.type === 'BREAK_START' && a.status === 'SUCCESS');
  const todayBreakEnd   = [...todayRecs].reverse().find(a => a.type === 'BREAK_END'   && a.status === 'SUCCESS');
  const isOnBreak   = !!todayBreakStart && !todayBreakEnd;
  const isCheckedIn = !!todayCheckIn && !todayCheckOut;

  // Live work duration counter
  const [workMins, setWorkMins] = useState(0);
  useEffect(() => {
    if (!todayCheckIn || todayCheckOut) return;
    const calc = () => setWorkMins(Math.floor((Date.now() - new Date(todayCheckIn.timestamp).getTime()) / 60000));
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [todayCheckIn, todayCheckOut]);

  // Monthly check-ins count
  const monthStart = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; }, []);
  const monthCheckIns = useMemo(() =>
    attendance.filter(a => a.userId === currentUser?.id && a.type === 'CHECK_IN' && a.status === 'SUCCESS' && new Date(a.timestamp) >= monthStart),
    [attendance, currentUser, monthStart]
  );

  // ── GPS auto-tracking ──────────────────────────────────────────────────────
  const startTracking = () => {
    if (!navigator.geolocation || watchIdRef.current !== null) return;
    setTracking(true);
    addAuditLog('SURVEILLANCE_START', 'GPS tracking initiated.', 'LOW');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => addGPSLog({ userId: currentUser?.id || '', lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date().toISOString(), accuracy: pos.coords.accuracy }),
      (err) => { setTracking(false); watchIdRef.current = null; addAuditLog('SURVEILLANCE_ERROR', `GPS failure: ${err.message}`, 'MEDIUM'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setTracking(false);
    addAuditLog('SURVEILLANCE_STOP', 'GPS tracking stopped.', 'LOW');
  };

  useEffect(() => {
    if (!currentUser) return;
    const schedule = currentUser.dutySchedule || DEFAULT_DUTY_SCHEDULE;
    const evaluate = () => {
      const now         = new Date();
      const dutyStart   = parseDutyTime(schedule.checkInTime);
      const windowOpen  = new Date(dutyStart.getTime() - schedule.earlyCheckInMinutes * 60 * 1000);
      const dutyEnd     = parseDutyTime(schedule.checkOutTime);
      const windowClose = new Date(dutyEnd.getTime() + 30 * 60 * 1000);
      const inWindow    = now >= windowOpen && now <= windowClose && !todayCheckOut;
      if (inWindow) {
        if (!isTracking && watchIdRef.current === null && navigator.geolocation)
          navigator.geolocation.getCurrentPosition(() => startTracking(), () => {});
      } else {
        if (isTracking || watchIdRef.current !== null) stopTracking();
      }
    };
    evaluate();
    const timer = setInterval(evaluate, 30_000);
    return () => { clearInterval(timer); if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.dutySchedule, isTracking, todayCheckOut]);

  const showFeedback = (type: 'success' | 'error' | 'warning', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), type === 'warning' ? 8000 : 6000);
  };

  const withGPS = (fn: (lat: number, lng: number, acc: number) => Promise<{ success: boolean; message: string }>) => {
    setLoading(true);
    // Fast path: use a cached position (≤10s old) immediately, then try to get a fresh fix.
    // This makes the button feel instant while a better fix is still being acquired.
    const GPS_OPTS: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 };
    const GPS_FRESH: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 };
    const ACCEPTABLE_ACCURACY = 120; // metres — enough for office-level geofencing

    let committed = false; // prevent double-fire

    const commit = async (pos: GeolocationPosition) => {
      if (committed) return;
      committed = true;
      const res = await fn(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      showFeedback(res.success ? 'success' : 'error', res.message);
      setLoading(false);
    };

    // 1. Try cached position first — responds instantly if available
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (pos.coords.accuracy <= ACCEPTABLE_ACCURACY) {
          await commit(pos);
        } else {
          // Cached fix is too inaccurate — wait for a fresh one (below)
        }
      },
      () => {}, // ignore error, fresh attempt below handles it
      GPS_OPTS,
    );

    // 2. Always also request a fresh fix in parallel — use it if better or if cached wasn't good enough
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await commit(pos); // committed flag prevents double-fire
      },
      (err) => {
        if (!committed) {
          let msg = '';
          if (err.code === 1) msg = 'Location permission denied. Open browser Settings → Site Settings → Location, allow access for this site, then try again.';
          else if (err.code === 2) msg = 'GPS signal unavailable. Enable device location and move to an open area, then try again.';
          else if (err.code === 3) msg = 'GPS timed out. Make sure device location is ON and try again.';
          else msg = 'GPS unavailable. Please try again.';
          showFeedback('error', msg);
          setLoading(false);
        }
      },
      GPS_FRESH,
    );
  };

  const handleCheckIn    = () => withGPS(async (lat, lng, acc) => {
    const res = await checkIn(lat, lng, acc, mockIp);
    if (res.success) {
      startTracking();
      if (res.message.includes('late')) {
        showFeedback('warning', res.message);
        return res;
      }
    }
    return res;
  });
  const handleCheckOut   = () => withGPS(async (lat, lng, acc) => { const res = await checkOut(lat, lng, acc, mockIp); if (res.success) stopTracking(); return res; });
  const handleBreakStart = () => withGPS(async (lat, lng, acc) => breakStart(lat, lng, acc, mockIp));
  const handleBreakEnd   = () => withGPS(async (lat, lng, acc) => breakEnd(lat, lng, acc, mockIp));

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    if (!file.type.startsWith('image/')) { showFeedback('error', 'Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { showFeedback('error', 'Image must be under 2MB.'); return; }
    setAvatarUploading(true);
    const res = await uploadAvatar(currentUser.id, file);
    setAvatarUploading(false);
    showFeedback(res.success ? 'success' : 'error', res.message);
    e.target.value = '';
  };

  const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const typeIcon = (type: string) => {
    if (type === 'SALARY') return <Banknote size={16} className="text-emerald-500" />;
    if (type === 'LEAVE')  return <Calendar  size={16} className="text-blue-500" />;
    if (type === 'SYSTEM') return <Zap       size={16} className="text-amber-500" />;
    return <Bell size={16} className="text-slate-400" />;
  };

  const TABS = [
    { id: 'portal'   as const, label: t('attendance'),                                      icon: Crosshair },
    { id: 'team'     as const, label: t('live_workforce').split('—')[0].trim(),              icon: Users },
    { id: 'calendar' as const, label: 'Calendar',                                            icon: CalendarDays },
    { id: 'inbox'    as const, label: t('inbox'),                                            icon: Bell },
    { id: 'salary'   as const, label: t('payslip'),                                          icon: DollarSign },
    { id: 'weekend'  as const, label: 'Weekend Work',                                        icon: CalendarCheck2 },
    { id: 'profile'  as const, label: t('my_profile'),                                       icon: Edit2 },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-[fadeIn_0.4s_ease-out] pb-28 px-2 sm:px-0">

      {/* ── Hero Clock ─────────────────────────────────────────────────────── */}
      <LiveClock isTracking={isTracking} isCheckedIn={isCheckedIn} isOnBreak={isOnBreak} />

      {/* ── Profile Card ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Banner */}
        <div className="h-16 bg-gradient-to-r from-slate-900 via-slate-800 to-[#E31E24] relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        </div>

        <div className="px-5 pb-5 -mt-8">
          <div className="flex items-end gap-4 mb-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-[#E31E24] to-red-700 shadow-xl border-4 border-white dark:border-slate-900 flex items-center justify-center">
                {currentUser?.avatar
                  ? <img src={currentUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="font-black text-2xl text-white">{currentUser?.name.charAt(0)}</span>
                }
              </div>
              <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center shadow text-slate-600 hover:bg-slate-50 transition-all">
                {avatarUploading ? <div className="w-3 h-3 border-2 border-slate-500 border-t-transparent animate-spin rounded-full" /> : <Camera size={10} />}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            <div className="flex-1 pt-8">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="px-2 py-0.5 bg-[#E31E24] text-white text-[9px] font-black uppercase tracking-widest rounded-lg">{currentUser?.id}</span>
                {isTracking && <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase rounded-lg"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> GPS</span>}
                {isOnBreak  && <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase rounded-lg"><Coffee size={9} /> Break</span>}
              </div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none">{currentUser?.name}</h2>
            </div>
          </div>

          {/* Info chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
              <Briefcase size={10} className="text-[#E31E24]" /> {currentUser?.department}
            </span>
            {currentUser?.designation && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800">
                🏅 {currentUser.designation}
              </span>
            )}
            {unit && <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700"><MapPin size={10} className="text-[#E31E24]" /> {unit.name}</span>}
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
              <Wifi size={10} className={mockIp.startsWith('192.168.1') ? 'text-blue-500' : 'text-amber-500'} />
              {mockIp.startsWith('192.168.1') ? 'Unit LAN' : 'External'}
            </span>
          </div>

          {/* Timeline grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: t('check_in'),    val: todayCheckIn,    color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-100 dark:border-emerald-900/30' },
              { label: t('check_out'),   val: todayCheckOut,   color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/10',         border: 'border-blue-100 dark:border-blue-900/30' },
              { label: 'Break Start', val: todayBreakStart, color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/10',       border: 'border-amber-100 dark:border-amber-900/30' },
              { label: 'Break End',   val: todayBreakEnd,   color: 'text-teal-600 dark:text-teal-400',       bg: 'bg-teal-50 dark:bg-teal-900/10',         border: 'border-teal-100 dark:border-teal-900/30' },
            ].map(item => (
              <div key={item.label} className={`${item.bg} border ${item.border} rounded-2xl p-3`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                <p className={`font-black text-sm ${item.val ? item.color : 'text-slate-300 dark:text-slate-600'}`}>
                  {item.val ? fmtTime(item.val.timestamp) : '— : —'}
                </p>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 text-center border border-slate-100 dark:border-slate-700">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Today</p>
              <p className="font-black text-sm text-slate-900 dark:text-white">
                {isCheckedIn ? `${Math.floor(workMins / 60)}h ${workMins % 60}m` : todayCheckIn ? t('checked_out') : '—'}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 text-center border border-slate-100 dark:border-slate-700">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">This Month</p>
              <p className="font-black text-sm text-slate-900 dark:text-white">{monthCheckIns.length}d</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 text-center border border-slate-100 dark:border-slate-700">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Weekend</p>
              <p className="font-black text-[10px] text-slate-700 dark:text-slate-300">
                {(currentUser?.weekendDays || ['Friday', 'Saturday']).map(d => d.slice(0, 3)).join(' & ')}
              </p>
            </div>
          </div>

          {/* ── Monthly Attendance Mini-Calendar ──────────────────────────────── */}
          {(() => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
            const todayDate = now.getDate();
            const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
            const dayRecs: Record<string, { ci?: any; co?: any; isLate?: boolean; lateMinutes?: number; breaks: any[] }> = {};
            (attendance || []).filter(a => a.userId === currentUser?.id && a.timestamp.startsWith(monthStr)).forEach(a => {
              const d = a.timestamp.slice(8, 10);
              if (!dayRecs[d]) dayRecs[d] = { breaks: [] };
              if (a.type === 'CHECK_IN'  && a.status === 'SUCCESS') { dayRecs[d].ci = a; dayRecs[d].isLate = a.isLate; dayRecs[d].lateMinutes = a.lateMinutes; }
              if (a.type === 'CHECK_OUT' && a.status === 'SUCCESS') dayRecs[d].co = a;
              if ((a.type === 'BREAK_START' || a.type === 'BREAK_END') && a.status === 'SUCCESS') dayRecs[d].breaks.push(a);
            });
            const selRec = selectedCalDate ? dayRecs[selectedCalDate.slice(8, 10)] : null;
            return (
              <div className="mt-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <CalendarDays size={11} className="text-[#E31E24]" />
                    {now.toLocaleString('default', { month: 'long' })} Attendance
                  </p>
                  {selectedCalDate && (
                    <button onClick={() => setSelectedCalDate(null)} className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest">✕ Close</button>
                  )}
                </div>
                {/* Day grid */}
                <div className="p-3">
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {['S','M','T','W','T','F','S'].map((d, i) => (
                      <div key={i} className="text-center text-[9px] font-black text-slate-300 dark:text-slate-600 py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const ds = String(day).padStart(2, '0');
                      const fullDs = `${monthStr}-${ds}`;
                      const rec = dayRecs[ds];
                      const isFuture = day > todayDate;
                      const isToday = day === todayDate;
                      const isSelected = selectedCalDate === fullDs;
                      const hasCI = !!rec?.ci;
                      const hasCO = !!rec?.co;
                      const isLate = rec?.isLate;
                      return (
                        <button key={day} onClick={() => !isFuture && setSelectedCalDate(isSelected ? null : fullDs)}
                          disabled={isFuture}
                          className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-[10px] font-black transition-all
                            ${isFuture ? 'text-slate-200 dark:text-slate-700 cursor-default' :
                              isSelected ? 'bg-slate-900 dark:bg-[#E31E24] text-white shadow-lg scale-105' :
                              isToday ? 'bg-[#E31E24]/10 text-[#E31E24] border-2 border-[#E31E24]/30' :
                              hasCI ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:scale-105' :
                              'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:scale-105'
                            }`}>
                          {day}
                          {!isFuture && (
                            <div className="flex gap-0.5 mt-0.5">
                              {hasCI && <span className={`w-1 h-1 rounded-full ${isLate ? 'bg-amber-500' : 'bg-emerald-500'}`} />}
                              {hasCO && <span className="w-1 h-1 rounded-full bg-blue-500" />}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-3 px-1">
                    <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold"><span className="w-2 h-2 rounded-full bg-emerald-500" /> On time</span>
                    <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold"><span className="w-2 h-2 rounded-full bg-amber-500" /> Late</span>
                    <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold"><span className="w-2 h-2 rounded-full bg-blue-500" /> Checked out</span>
                  </div>
                </div>

                {/* Day detail panel */}
                {selectedCalDate && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-4 space-y-3 animate-[slideDown_0.2s_ease-out]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {new Date(selectedCalDate + 'T12:00:00').toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {!selRec?.ci ? (
                      <p className="text-xs text-slate-400 font-medium italic py-2">No attendance record for this day.</p>
                    ) : (
                      <div className="space-y-2">
                        {/* Check-in */}
                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/10 rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-black text-slate-700 dark:text-slate-300">Check-in</span>
                            {selRec.isLate && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg">
                                Late {selRec.lateMinutes >= 60 ? `${Math.floor(selRec.lateMinutes / 60)}h ${selRec.lateMinutes % 60}m` : `${selRec.lateMinutes}m`}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                            {new Date(selRec.ci.timestamp).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {/* Breaks */}
                        {selRec.breaks.length > 0 && (() => {
                          const starts = selRec.breaks.filter((b: any) => b.type === 'BREAK_START').sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
                          const ends   = selRec.breaks.filter((b: any) => b.type === 'BREAK_END').sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
                          return starts.map((bs: any, idx: number) => {
                            const be = ends[idx];
                            const durMins = be ? Math.round((new Date(be.timestamp).getTime() - new Date(bs.timestamp).getTime()) / 60000) : null;
                            return (
                              <div key={idx} className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/10 rounded-xl px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">Break {idx + 1}</span>
                                  {durMins !== null && <span className="text-[9px] text-slate-400 font-bold">{durMins}m</span>}
                                </div>
                                <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                                  {new Date(bs.timestamp).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}
                                  {be ? ` – ${new Date(be.timestamp).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}` : ' – ongoing'}
                                </span>
                              </div>
                            );
                          });
                        })()}
                        {/* Check-out */}
                        {selRec.co ? (
                          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/10 rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="text-xs font-black text-slate-700 dark:text-slate-300">Check-out</span>
                            </div>
                            <span className="text-xs font-black text-blue-700 dark:text-blue-400">
                              {new Date(selRec.co.timestamp).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic px-1">No check-out recorded.</p>
                        )}
                        {/* Total worked hours */}
                        {selRec.ci && selRec.co && (() => {
                          const total = new Date(selRec.co.timestamp).getTime() - new Date(selRec.ci.timestamp).getTime();
                          const breakMins = selRec.breaks.filter((b: any) => b.type === 'BREAK_START').reduce((acc: number, bs: any, idx: number) => {
                            const be = selRec.breaks.filter((b: any) => b.type === 'BREAK_END')[idx];
                            if (!be) return acc;
                            return acc + Math.round((new Date(be.timestamp).getTime() - new Date(bs.timestamp).getTime()) / 60000);
                          }, 0);
                          const workedMins = Math.max(0, Math.round(total / 60000) - breakMins);
                          return (
                            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                              <span className="text-xs font-black text-slate-700 dark:text-slate-300">Total worked</span>
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                {Math.floor(workedMins / 60)}h {workedMins % 60}m
                                {breakMins > 0 && <span className="text-[10px] text-slate-400 font-medium ml-1">(excl. {breakMins}m break)</span>}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-1.5 flex gap-1 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 min-w-[58px] py-2.5 px-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all flex flex-col items-center gap-1 ${
              activeTab === tab.id ? 'bg-slate-900 dark:bg-[#E31E24] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}>
            <tab.icon size={14} className="flex-shrink-0" />
            <span className="truncate w-full text-center leading-tight">{tab.label}</span>
            {tab.id === 'inbox' && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#E31E24] text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Attendance Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'portal' && (
        <div className="space-y-4">
          {feedback && (
            <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-sm font-bold ${
              feedback.type === 'warning'
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-900/30'
                : feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/30'
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-900/30'
            }`}>
              {feedback.type === 'warning' ? <AlertCircle size={18} /> : feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              {feedback.message}
            </div>
          )}

          {/* Main action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleCheckIn} disabled={loading || (isCheckedIn && !isOnBreak)}
              className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 active:scale-95 text-white rounded-2xl p-6 flex flex-col items-center gap-3 transition-all shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center"><Clock size={22} /></div>
              <div className="text-center relative z-10">
                <p className="text-sm font-black uppercase tracking-wide">Check In</p>
                <p className="text-[10px] text-emerald-200 font-bold mt-0.5">Start Session</p>
              </div>
              {todayCheckIn && <span className="absolute top-3 right-3 text-[9px] font-black text-emerald-200">{fmtTime(todayCheckIn.timestamp)}</span>}
            </button>

            <button onClick={handleCheckOut} disabled={loading || !isCheckedIn}
              className="group relative overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 active:scale-95 text-white rounded-2xl p-6 flex flex-col items-center gap-3 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><Navigation size={22} /></div>
              <div className="text-center relative z-10">
                <p className="text-sm font-black uppercase tracking-wide">Check Out</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">End Session</p>
              </div>
              {todayCheckOut && <span className="absolute top-3 right-3 text-[9px] font-black text-slate-400">{fmtTime(todayCheckOut.timestamp)}</span>}
            </button>
          </div>

          {/* Break buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { if (!loading && isCheckedIn && !isOnBreak) setShowBreakModal(true); }}
              disabled={loading || !isCheckedIn || isOnBreak}
              className="group relative overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 active:scale-95 text-white rounded-2xl p-5 flex flex-col items-center gap-2 transition-all shadow-md shadow-amber-200 dark:shadow-amber-900/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
              <Coffee size={20} />
              <div className="text-center"><p className="text-xs font-black uppercase">Break</p><p className="text-[9px] text-amber-100 font-bold">Start Break</p></div>
            </button>
            <button onClick={handleBreakEnd} disabled={loading || !isOnBreak}
              className="group relative overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700 hover:from-teal-400 hover:to-teal-600 active:scale-95 text-white rounded-2xl p-5 flex flex-col items-center gap-2 transition-all shadow-md shadow-teal-200 dark:shadow-teal-900/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
              <Play size={20} />
              <div className="text-center"><p className="text-xs font-black uppercase">Resume</p><p className="text-[9px] text-teal-100 font-bold">End Break</p></div>
            </button>
          </div>

          {/* Status hint */}
          <p className="text-[11px] text-slate-400 text-center font-medium leading-relaxed px-4">
            {!isCheckedIn && !todayCheckIn && t('check_in_to_start')}
            {isCheckedIn && !isOnBreak && t('session_active')}
            {isOnBreak && t('enjoy_break')}
            {!isCheckedIn && todayCheckIn && t('session_complete')}
          </p>

          {/* Duty Schedule Card */}
          <DutyScheduleCard
            currentUser={currentUser}
            scheduleChangeRequests={scheduleChangeRequests}
            requestScheduleChange={requestScheduleChange}
          />

          {/* GPS status */}
          <div className={`rounded-2xl border-2 p-4 flex items-center gap-4 transition-all ${
            isTracking ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
          }`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${isTracking ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
              <Crosshair size={18} className={isTracking ? 'animate-pulse' : ''} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-black uppercase tracking-widest ${isTracking ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
                GPS {isTracking ? 'Transmitting' : 'Standby'}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">
                {isTracking ? 'Location sent automatically. Stops at end of duty window.' : 'Auto-starts at duty window. No action needed.'}
              </p>
            </div>
            {isTracking && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />}
          </div>

          {/* Network simulation */}
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/30">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Activity size={10} /> Network Simulation</p>
            <div className="flex gap-2">
              <button onClick={() => setMockIp('192.168.1.1')} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl border-2 transition-all ${mockIp.startsWith('192.168.1') ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>Unit WiFi</button>
              <button onClick={() => setMockIp('10.0.0.1')} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl border-2 transition-all ${!mockIp.startsWith('192.168.1') ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>Public 4G</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Team Tab ────────────────────────────────────────────────────────── */}
      {activeTab === 'team' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Eye size={12} className="text-[#E31E24]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Workforce — Today</p>
          </div>
          <WorkforceStatusBoard />
        </div>
      )}

      {/* ── Calendar Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <CalendarTabPanel
          attendance={attendance}
          currentUser={currentUser}
          onDateTap={setSelectedCalDate}
          selectedDate={selectedCalDate}
          onClose={() => setSelectedCalDate(null)}
        />
      )}

      {/* ── Inbox Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'inbox' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Bell size={11} /> {notifications.length} message{notifications.length !== 1 ? 's' : ''} · {unreadCount} unread
            </p>
            {unreadCount > 0 && (
              <button onClick={() => notifications.filter(n => !n.isRead).forEach(n => markNotificationRead(n.id))}
                className="text-[10px] font-black uppercase tracking-widest text-[#E31E24] hover:underline">Mark all read</button>
            )}
          </div>

          {notifications.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-16 text-center">
              <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3"><Bell size={22} className="text-slate-300" /></div>
              <p className="text-slate-400 text-sm font-bold">No messages yet</p>
            </div>
          )}

          {notifications.map(notif => (
            <div key={notif.id} onClick={() => { if (!notif.isRead) markNotificationRead(notif.id); }}
              className={`rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md ${notif.isRead ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800' : 'bg-blue-50/40 dark:bg-blue-900/5 border-blue-200 dark:border-blue-900/30'}`}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${notif.isRead ? 'bg-slate-100 dark:bg-slate-800' : 'bg-white dark:bg-slate-800 shadow-sm'}`}>
                    {typeIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{notif.title}</p>
                      {!notif.isRead && <span className="w-2 h-2 bg-[#E31E24] rounded-full flex-shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">From {notif.senderName} · {new Date(notif.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    {notif.type === 'SALARY' && notif.metadata && (
                      <div className="mt-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 space-y-1.5">
                        {notif.metadata.net !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-bold">Net Payable</span>
                            <span className="text-base font-black text-[#E31E24]">{formatCurrency(notif.metadata.net)}</span>
                          </div>
                        )}
                        {notif.metadata.status && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-bold">Status</span>
                            <span className={`text-xs font-black uppercase ${notif.metadata.status === 'PAID' ? 'text-emerald-500' : 'text-amber-500'}`}>{notif.metadata.status}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {notif.type === 'SALARY' && (
                      <div className="mt-3 flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setPdfSlipId(notif.metadata?.salaryId || null); setTimeout(() => window.print(), 300); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all active:scale-95">
                          <Printer size={11} /> Print
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); const hr = users.find(u => u.role === 'HR'); if (hr) { try { localStorage.setItem('exord-dm-target', hr.id); } catch {} } window.dispatchEvent(new CustomEvent('exord-navigate', { detail: 'chat' })); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-[#E31E24] transition-all active:scale-95">
                          <MessageSquare size={11} /> Discuss
                        </button>
                      </div>
                    )}
                    {notif.type !== 'SALARY' && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed line-clamp-2">{notif.message}</p>}
                  </div>
                </div>
              </div>
              {!notif.isRead && (
                <div className="border-t border-blue-100 dark:border-blue-900/30 px-4 py-2 bg-blue-50/50 dark:bg-blue-900/5 rounded-b-2xl flex items-center gap-2">
                  <CheckCircle size={10} className="text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Tap to mark as read</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Salary Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'salary' && (() => {
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const mySalaries = salaries.filter(s => s.userId === currentUser?.id).sort((a, b) => b.year - a.year || months.indexOf(b.month) - months.indexOf(a.month));
        const hrUser = users.find(u => u.role === 'HR');
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Banknote size={11} /> {mySalaries.length} record{mySalaries.length !== 1 ? 's' : ''}</p>
              {hrUser && (
                <button onClick={() => { try { localStorage.setItem('exord-dm-target', hrUser.id); } catch {} window.dispatchEvent(new CustomEvent('exord-navigate', { detail: 'chat' })); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-[#E31E24] transition-all active:scale-95">
                  <MessageSquare size={12} /> Discuss with HR
                </button>
              )}
            </div>

            {mySalaries.length === 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-16 text-center">
                <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3"><DollarSign size={22} className="text-slate-300" /></div>
                <p className="text-slate-400 text-sm font-bold">No salary records yet</p>
              </div>
            )}

            {mySalaries.map(sal => (
              <div key={sal.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center"><Banknote size={18} className="text-emerald-600" /></div>
                    <div>
                      <p className="font-black text-slate-900 dark:text-white">{sal.month} {sal.year}</p>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${sal.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{sal.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-black text-[#E31E24]">{formatCurrency(sal.net)}</p>
                      <p className="text-[10px] text-slate-400 font-bold">Net Payable</p>
                    </div>
                    <button onClick={() => { setPdfSlipId(sal.id); setTimeout(() => window.print(), 300); }}
                      className="w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-md shadow-blue-200 dark:shadow-blue-900/30">
                      <Printer size={15} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
                  {[
                    { label: 'Base',       val: formatCurrency(sal.base),             color: 'text-slate-900 dark:text-white' },
                    { label: 'Bonus',      val: '+' + formatCurrency(sal.bonus),      color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Deductions', val: '−' + formatCurrency(sal.deductions), color: 'text-rose-500' },
                  ].map(item => (
                    <div key={item.label} className="p-4 text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                      <p className={`text-xs font-black ${item.color}`}>{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Print-only salary slip */}
            {pdfSlipId && (() => {
              const slip = mySalaries.find(s => s.id === pdfSlipId);
              if (!slip) return null;
              return (
                <div className="hidden print:block fixed inset-0 bg-white z-[200] p-12 font-sans">
                  <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between border-b-4 border-[#E31E24] pb-6 mb-8">
                      <div><h1 className="text-3xl font-black text-slate-900">Exord Online</h1><p className="text-slate-500 text-sm mt-1">Human Resources Management</p></div>
                      <div className="text-right"><p className="text-xl font-black text-[#E31E24]">SALARY SLIP</p><p className="text-slate-500 text-sm">{slip.month} {slip.year}</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-6 mb-8 p-6 bg-gray-50 border border-gray-200">
                      <div><p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Employee Name</p><p className="text-lg font-black text-gray-900">{slip.userName}</p></div>
                      <div><p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Employee ID</p><p className="text-lg font-black text-gray-900">{slip.userId}</p></div>
                      <div><p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Pay Period</p><p className="text-base font-bold text-gray-900">{slip.month} {slip.year}</p></div>
                      <div><p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Payment Status</p><p className={`text-base font-black ${slip.status === 'PAID' ? 'text-green-600' : 'text-amber-600'}`}>{slip.status}</p></div>
                    </div>
                    <table className="w-full border-collapse mb-8">
                      <thead><tr className="bg-gray-900 text-white"><th className="text-left p-4 text-xs font-black uppercase tracking-widest">Description</th><th className="text-right p-4 text-xs font-black uppercase tracking-widest">Amount (৳)</th></tr></thead>
                      <tbody>
                        <tr className="border-b border-gray-200"><td className="p-4 text-sm text-gray-700">Base Salary</td><td className="p-4 text-sm font-bold text-gray-900 text-right">{slip.base.toLocaleString()}</td></tr>
                        <tr className="border-b border-gray-200 bg-green-50"><td className="p-4 text-sm text-gray-700">Bonus / Allowances</td><td className="p-4 text-sm font-bold text-green-700 text-right">+{slip.bonus.toLocaleString()}</td></tr>
                        <tr className="border-b border-gray-200 bg-red-50"><td className="p-4 text-sm text-gray-700">Total Deductions</td><td className="p-4 text-sm font-bold text-red-700 text-right">-{slip.deductions.toLocaleString()}</td></tr>
                        <tr className="bg-gray-900 text-white"><td className="p-4 font-black">NET PAYABLE</td><td className="p-4 font-black text-right text-xl">{slip.net.toLocaleString()}</td></tr>
                      </tbody>
                    </table>
                    <div className="border-t-2 border-gray-300 pt-6 text-center">
                      <p className="text-xs text-gray-400">This is a computer-generated salary slip. No signature required.</p>
                      <p className="text-xs text-gray-400 mt-1">Generated on {new Date().toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ── My Profile Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Edit2 size={11} /> Request Profile Changes
            </p>
            {currentUser?.designation && (
              <button
                onClick={() => {
                  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
                  const w = window.open('', '_blank');
                  if (!w) return;
                  w.document.write('<html><head><title>Designation Certificate</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5;font-family:Georgia,serif}.cert{background:#fffdf5;border:8px double #E31E24;padding:48px 56px;max-width:640px;width:90%;text-align:center}.gold{color:#E31E24}.line{width:70px;height:2px;background:#E31E24;margin:14px auto}.box{background:#fff5f5;border:1px solid #E31E24;border-radius:8px;padding:14px 24px;display:inline-block;margin:12px 0}.sig{display:flex;justify-content:space-around;margin-top:24px}.sig-line{width:110px;height:1px;background:#333;margin-bottom:5px}@media print{body{background:#fff}}</style></head><body><div class="cert"><div style="font-size:11px;letter-spacing:4px;text-transform:uppercase" class="gold">Exord Online</div><div style="font-size:24px;font-weight:700;margin:8px 0">Certificate of Designation</div><div class="line"></div><p style="color:#555;font-size:13px">This is to certify that</p><div style="font-size:28px;font-weight:700;margin:8px 0">' + (currentUser?.name || '') + '</div><p style="color:#555;font-size:13px">has been officially designated as</p><div class="box"><span style="font-size:17px;font-weight:700;font-family:Inter,sans-serif">' + (currentUser?.designation || '') + '</span></div><p style="color:#777;font-size:12px;font-family:Inter,sans-serif">Effective from <strong>' + today + '</strong></p><div class="sig"><div><div class="sig-line"></div><div style="font-size:11px;color:#555;font-family:Inter,sans-serif">HR Department</div></div><div><div class="sig-line"></div><div style="font-size:11px;color:#555;font-family:Inter,sans-serif">General Manager</div></div></div></div><script>window.onload=()=>{window.print();}<\/script></body></html>');
                  w.document.close();
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-600 transition-all active:scale-95"
              >
                🎓 Download Certificate
              </button>
            )}
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
            <AlertCircle size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-700 dark:text-blue-400 font-bold leading-relaxed">
              Fill in the fields you want to change below and submit — HR will review and apply the updates. Fields marked <span className="text-amber-600">★ HR</span> require additional approval.
            </p>
          </div>

          {/* ── Personal Information ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">👤 Personal Information</p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Full Name', field: 'Full Name', cur: currentUser?.name || '' },
                { label: 'Email', field: 'Email', cur: currentUser?.email || '' },
                { label: 'Father Name', field: 'Father Name', cur: currentUser?.fatherName || '' },
                { label: 'Mother Name', field: 'Mother Name', cur: currentUser?.motherName || '' },
                { label: 'NID Number', field: 'NID Number', cur: currentUser?.nid || '' },
                { label: 'Religion', field: 'Religion', cur: currentUser?.religion || '' },
                { label: 'Nationality', field: 'Nationality', cur: currentUser?.nationality || '' },
                { label: 'Dress Size', field: 'Dress Size', cur: currentUser?.dressSize || '' },
              ].map(({ label, field, cur }) => (
                <div key={field}>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">{label}</label>
                  <input type="text" placeholder={cur || `Enter ${label}`}
                    value={profileEditFields[field] ?? ''}
                    onChange={e => setProfileEditFields(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600" />
                  {cur && <p className="text-[9px] text-slate-400 mt-0.5 truncate">Current: {cur}</p>}
                </div>
              ))}
              {/* Date of Birth — DD/MM/YYYY */}
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Date of Birth</label>
                <DateInput
                  value={profileEditFields['Date of Birth'] ?? ''}
                  onChange={v => setProfileEditFields(prev => ({ ...prev, 'Date of Birth': v }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all" />
                {currentUser?.dateOfBirth && <p className="text-[9px] text-slate-400 mt-0.5 truncate">Current: {currentUser.dateOfBirth.includes('-') ? currentUser.dateOfBirth.split('-').reverse().join('/') : currentUser.dateOfBirth}</p>}
              </div>
              {/* Select fields */}
              {[
                { label: 'Gender', field: 'Gender', cur: currentUser?.gender || '', opts: ['Male', 'Female', 'Other'] },
                { label: 'Blood Group', field: 'Blood Group', cur: currentUser?.bloodGroup || '', opts: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
                { label: 'Marital Status', field: 'Marital Status', cur: currentUser?.maritalStatus || '', opts: ['Single', 'Married', 'Divorced', 'Widowed'] },
              ].map(({ label, field, cur, opts }) => (
                <div key={field}>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">{label}</label>
                  <select value={profileEditFields[field] ?? ''}
                    onChange={e => setProfileEditFields(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all">
                    <option value="">— Select {label} —</option>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  {cur && <p className="text-[9px] text-slate-400 mt-0.5">Current: {cur}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Contact ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">📞 Contact</p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Phone (Official)', field: 'Phone (Official)', cur: currentUser?.phoneOfficial || '' },
                { label: 'Phone (Personal)', field: 'Phone (Personal)', cur: currentUser?.phonePersonal || '' },
                { label: 'Alternative Number', field: 'Alternative Number', cur: currentUser?.phoneAlternative || '' },
              ].map(({ label, field, cur }) => (
                <div key={field}>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">{label}</label>
                  <input type="tel" placeholder={cur || `Enter ${label}`}
                    value={profileEditFields[field] ?? ''}
                    onChange={e => setProfileEditFields(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600" />
                  {cur && <p className="text-[9px] text-slate-400 mt-0.5">Current: {cur}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Address ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">🏠 Address</p>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: 'Present Address', field: 'Present Address', cur: currentUser?.presentAddress || '' },
                { label: 'Permanent Address', field: 'Permanent Address', cur: currentUser?.permanentAddress || '' },
              ].map(({ label, field, cur }) => (
                <div key={field}>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">{label}</label>
                  <textarea placeholder={cur || `Enter ${label}`}
                    value={profileEditFields[field] ?? ''}
                    onChange={e => setProfileEditFields(prev => ({ ...prev, [field]: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600" />
                  {cur && <p className="text-[9px] text-slate-400 mt-0.5">Current: {cur}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Emergency Contact ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">🆘 Emergency Contact</p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Emergency Contact Name', field: 'Emergency Contact Name', cur: currentUser?.emergencyName || '' },
                { label: 'Emergency Relation', field: 'Emergency Relation', cur: currentUser?.emergencyRelation || '' },
                { label: 'Emergency Contact Number', field: 'Emergency Contact Number', cur: currentUser?.emergencyContact || '' },
                { label: 'Emergency Contact Address', field: 'Emergency Contact Address', cur: currentUser?.emergencyAddress || '' },
              ].map(({ label, field, cur }) => (
                <div key={field}>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">{label}</label>
                  <input type="text" placeholder={cur || `Enter ${label}`}
                    value={profileEditFields[field] ?? ''}
                    onChange={e => setProfileEditFields(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600" />
                  {cur && <p className="text-[9px] text-slate-400 mt-0.5">Current: {cur}</p>}
                </div>
              ))}
            </div>
          </div>


          {/* ── Bank Account ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">🏦 Bank Account</p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Bank Name', field: 'Bank Name', cur: currentUser?.bankName || '' },
                { label: 'Bank Account Number', field: 'Bank Account Number', cur: currentUser?.bankAccountNumber || '' },
                { label: 'Bank Branch', field: 'Bank Branch', cur: currentUser?.bankBranch || '' },
                { label: 'Bank Routing Number', field: 'Bank Routing Number', cur: currentUser?.bankRoutingNumber || '' },
              ].map(({ label, field, cur }) => (
                <div key={field}>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">{label}</label>
                  <input type="text" placeholder={cur || `Enter ${label}`}
                    value={profileEditFields[field] ?? ''}
                    onChange={e => setProfileEditFields(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600" />
                  {cur && <p className="text-[9px] text-slate-400 mt-0.5">Current: {cur}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Employment (HR approval) ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/40 overflow-hidden">
            <div className="px-5 py-3 border-b border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">💼 Employment <span className="text-amber-500">★ HR Required</span></p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Department dropdown */}
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Department</label>
                <select value={profileEditFields['Department'] ?? ''}
                  onChange={e => setProfileEditFields(prev => ({ ...prev, 'Department': e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all">
                  <option value="">— Select Department —</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
                {currentUser?.department && <p className="text-[9px] text-slate-400 mt-0.5">Current: {currentUser.department}</p>}
              </div>
              {/* Office / Unit dropdown */}
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Office / Branch</label>
                <select value={profileEditFields['Office'] ?? ''}
                  onChange={e => setProfileEditFields(prev => ({ ...prev, 'Office': e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all">
                  <option value="">— Select Office —</option>
                  {units.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
                {unit && <p className="text-[9px] text-slate-400 mt-0.5">Current: {unit.name}</p>}
              </div>
              {/* Join Date */}
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Join Date</label>
                <DateInput
                  value={profileEditFields['Join Date'] ?? ''}
                  onChange={v => setProfileEditFields(prev => ({ ...prev, 'Join Date': v }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all" />
                {currentUser?.joinDate && <p className="text-[9px] text-slate-400 mt-0.5">Current: {currentUser.joinDate.includes('-') ? currentUser.joinDate.split('-').reverse().join('/') : currentUser.joinDate}</p>}
              </div>
            </div>
          </div>

          {/* ── Salary (HR approval) ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/40 overflow-hidden">
            <div className="px-5 py-3 border-b border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">💰 Salary <span className="text-amber-500">★ HR Required</span></p>
            </div>
            <div className="p-4">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Base Salary</label>
              <input type="number" placeholder={currentUser?.baseSalary?.toString() || 'Enter Base Salary'}
                value={profileEditFields['Base Salary'] ?? ''}
                onChange={e => setProfileEditFields(prev => ({ ...prev, 'Base Salary': e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all" />
              {currentUser?.baseSalary && <p className="text-[9px] text-slate-400 mt-0.5">Current: {currentUser.baseSalary.toLocaleString()}</p>}
            </div>
          </div>

          {/* ── Reason + Submit ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Reason for Changes <span className="text-red-500">*</span></label>
              <textarea value={profileEditReason} onChange={e => setProfileEditReason(e.target.value)}
                placeholder="Briefly explain why you need to update this information..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all resize-none" />
            </div>
            {profileEditMsg && (
              <div className={`flex items-center gap-3 p-3 rounded-xl text-xs font-bold ${profileEditMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/10 dark:text-rose-400'}`}>
                {profileEditMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {profileEditMsg.text}
              </div>
            )}
            <button disabled={profileEditSubmitting}
              onClick={async () => {
                // Build current values map for all 24 fields
                const currentData: Record<string, string> = {
                  'Full Name': currentUser?.name || '',
                  'Email': currentUser?.email || '',
                  'Father Name': currentUser?.fatherName || '',
                  'Mother Name': currentUser?.motherName || '',
                  'NID Number': currentUser?.nid || '',
                  'Date of Birth': currentUser?.dateOfBirth || '',
                  'Gender': currentUser?.gender || '',
                  'Blood Group': currentUser?.bloodGroup || '',
                  'Religion': currentUser?.religion || '',
                  'Marital Status': currentUser?.maritalStatus || '',
                  'Nationality': currentUser?.nationality || '',
                  'Dress Size': currentUser?.dressSize || '',
                  'Phone (Official)': currentUser?.phoneOfficial || '',
                  'Phone (Personal)': currentUser?.phonePersonal || '',
                  'Alternative Number': currentUser?.phoneAlternative || '',
                  'Present Address': currentUser?.presentAddress || '',
                  'Permanent Address': currentUser?.permanentAddress || '',
                  'Emergency Contact Name': currentUser?.emergencyName || '',
                  'Emergency Relation': currentUser?.emergencyRelation || '',
                  'Emergency Contact Number': currentUser?.emergencyContact || '',
                  'Emergency Contact Address': currentUser?.emergencyAddress || '',
                  'Bank Name': currentUser?.bankName || '',
                  'Bank Account Number': currentUser?.bankAccountNumber || '',
                  'Bank Branch': currentUser?.bankBranch || '',
                  'Bank Routing Number': currentUser?.bankRoutingNumber || '',
                  'Department': currentUser?.department || '',
                  'Office': unit?.name || '',
                  'Join Date': currentUser?.joinDate || '',
                  'Base Salary': currentUser?.baseSalary?.toString() || '',
                };
                const changes: Record<string, { old: string; new: string }> = {};
                Object.entries(profileEditFields).forEach(([field, newVal]) => {
                  if (String(newVal).trim() !== '' && String(newVal).trim() !== String(currentData[field] || '').trim()) {
                    changes[field] = { old: currentData[field] || '', new: String(newVal).trim() };
                  }
                });
                if (Object.keys(changes).length === 0) {
                  setProfileEditMsg({ type: 'error', text: t('no_changes_detected') }); return;
                }
                if (!profileEditReason.trim()) {
                  setProfileEditMsg({ type: 'error', text: 'Please provide a reason for the changes.' }); return;
                }
                setProfileEditSubmitting(true);
                const res = await submitProfileChangeRequest(changes, profileEditReason);
                setProfileEditSubmitting(false);
                setProfileEditMsg({ type: res.success ? 'success' : 'error', text: res.message });
                if (res.success) {
                  setProfileEditFields({});
                  setProfileEditReason('');
                }
              }}
              className="w-full py-3 text-xs font-black uppercase text-white bg-[#E31E24] rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2">
              {profileEditSubmitting ? <><AlertCircle size={14} className="animate-spin" /> Submitting...</> : <><Send size={14} /> Submit Change Request</>}
            </button>
          </div>

          {/* ── My past requests ── */}
          {(() => {
            const myReqs = profileChangeRequests.filter((r: any) => r.user_id === currentUser?.id)
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            if (myReqs.length === 0) return null;
            return (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">My Previous Requests</p>
                {myReqs.map((req: any) => (
                  <div key={req.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-black text-slate-900 dark:text-white">
                        {Object.keys(req.field_changes).join(', ')}
                      </p>
                      <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-xl flex-shrink-0 ${
                        req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        req.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>{req.status}</span>
                    </div>
                    {req.reason && <p className="text-[10px] text-slate-400">{req.reason}</p>}
                    {req.review_note && <p className="text-[10px] text-slate-500 italic mt-1">Note: {req.review_note}</p>}
                    <p className="text-[9px] text-slate-300 dark:text-slate-600 mt-1">{new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
      {/* ── Break Type Picker Modal ───────────────────────────────────────────── */}
      {showBreakModal && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 backdrop-blur-md p-6 animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
                <Coffee size={18} className="text-white" />
              </div>
              <div>
                <p className="font-black text-slate-900 dark:text-white text-base leading-tight">What kind of break?</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Choose a type to log your break</p>
              </div>
            </div>
            {/* Options */}
            <div className="p-5 grid grid-cols-2 gap-3">
              {([
                { type: 'LUNCH',    emoji: '🍱', label: 'Lunch',    desc: 'Meal break' },
                { type: 'SHORT',    emoji: '☕', label: 'Short',    desc: 'Quick rest' },
                { type: 'PERSONAL', emoji: '🚶', label: 'Personal', desc: 'Personal errand' },
                { type: 'OTHER',    emoji: '⏸',  label: 'Other',    desc: 'Other reason' },
              ] as const).map(({ type, emoji, label, desc }) => (
                <button
                  key={type}
                  onClick={() => {
                    setShowBreakModal(false);
                    withGPS(async (lat, lng, acc) => breakStart(lat, lng, acc, mockIp, type));
                  }}
                  className="p-4 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 active:scale-95 transition-all text-left group"
                >
                  <span className="text-2xl block mb-2">{emoji}</span>
                  <p className="font-black text-slate-900 dark:text-white text-sm group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">{label}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
            {/* Cancel */}
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowBreakModal(false)}
                className="w-full py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-xs font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeePortal;
