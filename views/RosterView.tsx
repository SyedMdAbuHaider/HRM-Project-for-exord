/**
 * RosterView.tsx — Exord Online HRM
 *
 * Month-wise roster scheduling.
 * - Month navigation
 * - Click employee name → Bulk Edit: set entire month shift in one click (skip weekends option)
 * - Click any cell → edit that specific date
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useHRM } from '../store';
import type { DutyRosterEntry } from '../store';
import { ROSTER_DEPARTMENTS as STORE_ROSTER_DEPTS } from '../store';
import { UserRole } from '../types';
import {
  ChevronLeft, ChevronRight, Calendar, Clock, Save,
  X, Plus, Trash2, Loader2, RefreshCw, Printer,
  CheckCircle, AlertCircle, Users, Search, Edit3, Zap
} from 'lucide-react';

// ── Shift presets ─────────────────────────────────────────────────────────────
interface ShiftPreset {
  label: string;
  checkIn: string;
  checkOut: string;
  color: string;
  bg: string;
}

const SHIFT_PRESETS: ShiftPreset[] = [
  { label: 'Morning',  checkIn: '08:00', checkOut: '16:00', color: 'text-amber-700 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  { label: 'Day',      checkIn: '09:00', checkOut: '18:00', color: 'text-blue-700 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  { label: 'Evening',  checkIn: '14:00', checkOut: '22:00', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
  { label: 'Night',    checkIn: '22:00', checkOut: '06:00', color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' },
  { label: 'Off',      checkIn: '',      checkOut: '',       color: 'text-slate-400',  bg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700' },
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const ROSTER_DEPARTMENTS = STORE_ROSTER_DEPTS;

const canEditRoster = (role: string, userDept: string, targetDept: string): boolean => {
  if ([UserRole.DEVELOPER, UserRole.ADMIN, UserRole.CO_ADMIN, UserRole.HR].includes(role as UserRole)) return true;
  if (role === UserRole.MANAGER && userDept === targetDept) return true;
  return false;
};

// ── Shift Cell (compact for month view) ───────────────────────────────────────
interface ShiftCellProps {
  entry: DutyRosterEntry | undefined;
  canEdit: boolean;
  isWeekend: boolean;
  isToday: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const ShiftCell: React.FC<ShiftCellProps> = ({ entry, canEdit, isWeekend, isToday, onEdit, onDelete }) => {
  const preset = entry ? (SHIFT_PRESETS.find(p => p.label === entry.shiftLabel) || SHIFT_PRESETS[1]) : null;

  if (!entry) {
    return (
      <div
        onClick={canEdit ? onEdit : undefined}
        className={`h-10 rounded-lg border flex items-center justify-center transition-all text-[8px] font-black
          ${isToday ? 'border-[#E31E24]/40 bg-red-50/50 dark:bg-red-900/5' : ''}
          ${isWeekend && !isToday ? 'border-dashed border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20' : ''}
          ${!isWeekend && !isToday ? 'border-dashed border-slate-200 dark:border-slate-700' : ''}
          ${canEdit ? 'hover:border-[#E31E24] hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer group' : ''}
        `}
      >
        {canEdit && !isWeekend && <Plus size={10} className="text-slate-300 group-hover:text-[#E31E24] transition-colors" />}
        {isWeekend && <span className="text-slate-300 dark:text-slate-700 text-[7px]">OFF</span>}
      </div>
    );
  }

  return (
    <div
      className={`h-10 rounded-lg border relative flex flex-col items-center justify-center px-0.5 transition-all ${preset!.bg} ${canEdit ? 'cursor-pointer hover:shadow-sm group' : ''}`}
      onClick={canEdit ? onEdit : undefined}
    >
      <p className={`text-[7px] font-black uppercase tracking-wide leading-none ${preset!.color}`}>{entry.shiftLabel || 'Custom'}</p>
      <p className="text-[6px] font-bold text-slate-400 mt-0.5 leading-none">{entry.checkInTime}–{entry.checkOutTime}</p>
      {canEdit && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10"
        >
          <X size={7} />
        </button>
      )}
    </div>
  );
};

// ── Single Date Edit Modal ────────────────────────────────────────────────────
interface ShiftEditModalProps {
  userName: string;
  date: string;
  existing?: DutyRosterEntry;
  onSave: (checkIn: string, checkOut: string, label: string, note: string) => Promise<void>;
  onClose: () => void;
}

const ShiftEditModal: React.FC<ShiftEditModalProps> = ({ userName, date, existing, onSave, onClose }) => {
  const [selectedPreset, setSelectedPreset] = useState<string>(existing?.shiftLabel || 'Day');
  const [checkIn,  setCheckIn]  = useState(existing?.checkInTime  || '09:00');
  const [checkOut, setCheckOut] = useState(existing?.checkOutTime || '18:00');
  const [note, setNote] = useState(existing?.note || '');
  const [saving, setSaving] = useState(false);

  const handlePreset = (p: ShiftPreset) => {
    setSelectedPreset(p.label);
    if (p.checkIn) { setCheckIn(p.checkIn); setCheckOut(p.checkOut); }
  };

  const handleSave = async () => {
    if (selectedPreset === 'Off') { await onSave('', '', 'Off', note); return; }
    if (!checkIn || !checkOut) return;
    setSaving(true);
    try { await onSave(checkIn, checkOut, selectedPreset, note); onClose(); }
    finally { setSaving(false); }
  };

  const dayLabel = DAYS_SHORT[new Date(date + 'T12:00:00').getDay()];
  const [, mm, dd] = date.split('-');

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="font-black text-slate-900 dark:text-white">{userName}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">{dayLabel} {parseInt(dd)} {MONTH_NAMES[parseInt(mm)-1]}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Shift Type</p>
            <div className="grid grid-cols-5 gap-1.5">
              {SHIFT_PRESETS.map(p => (
                <button key={p.label} onClick={() => handlePreset(p)}
                  className={`py-2 rounded-xl text-[9px] font-black border-2 transition-all ${selectedPreset === p.label ? `${p.bg} ${p.color}` : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {selectedPreset !== 'Off' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Check In</p>
                <input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Check Out</p>
                <input type="time" value={checkOut} onChange={e => setCheckOut(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
              </div>
            </div>
          )}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Note (optional)</p>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Emergency coverage..."
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:border-slate-300 transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving || (selectedPreset !== 'Off' && (!checkIn || !checkOut))}
            className="flex-1 py-3 bg-[#E31E24] text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:bg-[#C41217]">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Bulk Month Edit Modal — per day-of-week pattern ───────────────────────────
interface BulkEditModalProps {
  employee: { id: string; name: string; weekendDays?: string[] };
  monthDates: string[];
  onSave: (plan: Array<{ date: string; checkIn: string; checkOut: string; label: string; note: string }>) => Promise<void>;
  onClose: () => void;
}

const FULL_DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Per-day config inside the bulk modal
interface DayConfig {
  label: string;
  checkIn: string;
  checkOut: string;
}

const DEFAULT_DAY_CONFIG: DayConfig = { label: 'Day', checkIn: '09:00', checkOut: '18:00' };

const DayRow: React.FC<{
  dayName: string;
  config: DayConfig;
  onChange: (c: DayConfig) => void;
}> = ({ dayName, config, onChange }) => {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-3 items-center py-2.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
      <p className="text-xs font-black text-slate-700 dark:text-slate-300">{dayName}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Shift preset pills */}
        <div className="flex gap-1 flex-wrap">
          {SHIFT_PRESETS.map(p => (
            <button key={p.label} onClick={() => onChange({ label: p.label, checkIn: p.checkIn || '', checkOut: p.checkOut || '' })}
              className={`px-2 py-1 rounded-lg text-[8px] font-black border transition-all ${
                config.label === p.label
                  ? `${p.bg} ${p.color}`
                  : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {/* Custom time inputs — only if not Off */}
        {config.label !== 'Off' && (
          <div className="flex items-center gap-1.5 ml-auto">
            <input type="time" value={config.checkIn}
              onChange={e => onChange({ ...config, checkIn: e.target.value })}
              className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
            <span className="text-slate-300 text-[10px]">–</span>
            <input type="time" value={config.checkOut}
              onChange={e => onChange({ ...config, checkOut: e.target.value })}
              className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
          </div>
        )}
      </div>
    </div>
  );
};

const BulkEditModal: React.FC<BulkEditModalProps> = ({ employee, monthDates, onSave, onClose }) => {
  const weekendDays = employee.weekendDays || ['Friday', 'Saturday'];

  // Initial config: weekends = Off, rest = Day
  const initConfig = (): Record<number, DayConfig> => {
    const cfg: Record<number, DayConfig> = {};
    for (let i = 0; i < 7; i++) {
      const dayName = FULL_DAY_NAMES[i];
      cfg[i] = weekendDays.includes(dayName)
        ? { label: 'Off', checkIn: '', checkOut: '' }
        : { ...DEFAULT_DAY_CONFIG };
    }
    return cfg;
  };

  const [dayConfigs, setDayConfigs] = useState<Record<number, DayConfig>>(initConfig);
  const [note, setNote]   = useState('');
  const [saving, setSaving] = useState(false);

  const updateDay = (dow: number, cfg: DayConfig) => {
    setDayConfigs(prev => ({ ...prev, [dow]: cfg }));
  };

  // Preview: how many working days (non-Off)
  const workingDays = useMemo(() =>
    monthDates.filter(d => dayConfigs[new Date(d + 'T12:00:00').getDay()]?.label !== 'Off').length,
    [monthDates, dayConfigs]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const plan = monthDates.map(date => {
        const dow = new Date(date + 'T12:00:00').getDay();
        const cfg = dayConfigs[dow] || DEFAULT_DAY_CONFIG;
        return { date, checkIn: cfg.checkIn, checkOut: cfg.checkOut, label: cfg.label, note };
      });
      await onSave(plan);
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-[#E31E24]/5 to-transparent flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E31E24]/10 flex items-center justify-center">
              <Zap size={18} className="text-[#E31E24]" />
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white">{employee.name}</p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">Set weekly pattern — repeats across full month</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Shift Per Day of Week</p>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 py-2 border border-slate-100 dark:border-slate-700">
            {FULL_DAY_NAMES.map((dayName, dow) => (
              <DayRow
                key={dow}
                dayName={dayName}
                config={dayConfigs[dow] || DEFAULT_DAY_CONFIG}
                onChange={cfg => updateDay(dow, cfg)}
              />
            ))}
          </div>

          {/* Note */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Note (optional)</p>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Ramadan schedule, rotation A..."
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
          </div>

          {/* Preview */}
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-900/30">
            <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
            <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">
              Will assign shifts to <span className="text-base">{workingDays}</span> working days · <span className="text-base">{monthDates.length - workingDays}</span> days Off
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 flex gap-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:border-slate-300 transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 bg-[#E31E24] text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:bg-[#C41217]">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {saving ? 'Applying...' : `Apply to ${monthDates.length} Days`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main RosterView ───────────────────────────────────────────────────────────
const RosterView: React.FC = () => {
  const { currentUser, users, dutyRoster, upsertRosterEntry, deleteRosterEntry, refreshData, isLoading } = useHRM();

  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDept, setSelectedDept] = useState(
    currentUser?.role === UserRole.DEVELOPER
      ? ROSTER_DEPARTMENTS[0]
      : ROSTER_DEPARTMENTS.includes(currentUser?.department || '')
        ? currentUser!.department
        : ROSTER_DEPARTMENTS[0]
  );
  const [editCell,   setEditCell]   = useState<{ userId: string; userName: string; date: string } | null>(null);
  const [bulkEmployee, setBulkEmployee] = useState<{ id: string; name: string; weekendDays?: string[] } | null>(null);
  const [toast,      setToast]      = useState<{ ok: boolean; msg: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const canEdit = currentUser?.role === UserRole.DEVELOPER
    ? true
    : canEditRoster(currentUser?.role || '', currentUser?.department || '', selectedDept);

  // Month dates
  const { monthDates, monthLabel, year, month } = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const dates = Array.from({ length: daysInMonth }, (_, i) => {
      const dd = String(i + 1).padStart(2, '0');
      const mm = String(m + 1).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    });
    return { monthDates: dates, monthLabel: `${MONTH_NAMES[m]} ${y}`, year: y, month: m };
  }, [monthOffset]);

  const todayStr = today.toISOString().slice(0, 10);

  // Employees in selected department
  const deptEmployees = useMemo(() => {
    const normalised = selectedDept.toLowerCase().trim();
    const q = searchQuery.toLowerCase().trim();
    return users
      .filter(u => u.department?.toLowerCase().trim() === normalised)
      .filter(u => !q || u.name.toLowerCase().includes(q) || (u.designation || '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, selectedDept, searchQuery]);

  // Roster map: userId+date → entry
  const rosterMap = useMemo(() => {
    const map: Record<string, DutyRosterEntry> = {};
    dutyRoster
      .filter(r => r.department === selectedDept && r.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
      .forEach(r => { map[`${r.userId}_${r.date}`] = r; });
    return map;
  }, [dutyRoster, selectedDept, year, month]);

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveShift = useCallback(async (userId: string, userName: string, date: string, checkIn: string, checkOut: string, label: string, note: string) => {
    if (label === 'Off') {
      const existing = rosterMap[`${userId}_${date}`];
      if (existing) {
        const res = await deleteRosterEntry(existing.id);
        if (!res.success) showToast(false, res.message);
        else showToast(true, `${userName} marked Off on ${date}`);
      }
      return;
    }
    const res = await upsertRosterEntry({ department: selectedDept, userId, userName, date, checkInTime: checkIn, checkOutTime: checkOut, shiftLabel: label, note });
    showToast(res.success, res.success ? `Shift saved for ${userName}` : res.message);
  }, [rosterMap, deleteRosterEntry, upsertRosterEntry, selectedDept]);

  const handleBulkSave = useCallback(async (
    emp: { id: string; name: string },
    plan: Array<{ date: string; checkIn: string; checkOut: string; label: string; note: string }>
  ) => {
    let working = 0;
    for (const { date, checkIn, checkOut, label, note } of plan) {
      if (label === 'Off') {
        const existing = rosterMap[`${emp.id}_${date}`];
        if (existing) await deleteRosterEntry(existing.id);
      } else {
        await upsertRosterEntry({ department: selectedDept, userId: emp.id, userName: emp.name, date, checkInTime: checkIn, checkOutTime: checkOut, shiftLabel: label, note });
        working++;
      }
    }
    showToast(true, `Roster applied: ${working} working days for ${emp.name}`);
  }, [rosterMap, deleteRosterEntry, upsertRosterEntry, selectedDept]);

  const handleDelete = async (id: string) => {
    const res = await deleteRosterEntry(id);
    showToast(res.success, res.success ? 'Entry removed' : res.message);
  };

  const editingEntry = editCell ? rosterMap[`${editCell.userId}_${editCell.date}`] : undefined;

  // Scroll to today's column on mount
  const tableRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (monthOffset !== 0) return;
    const todayIdx = monthDates.indexOf(todayStr);
    if (todayIdx >= 0 && tableRef.current) {
      const cell = tableRef.current.querySelector(`[data-col="${todayIdx}"]`);
      if (cell) cell.scrollIntoView({ inline: 'center', behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="space-y-6 animate-[fadeIn_0.5s_ease-out] pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Duty Roster</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Monthly shift schedule for roster-based departments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refreshData} disabled={isLoading}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl hover:border-[#E31E24] transition-all">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl hover:border-[#E31E24] transition-all">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Department picker */}
      <div className="flex gap-2 flex-wrap">
        {ROSTER_DEPARTMENTS.map(dept => (
          <button key={dept} onClick={() => { setSelectedDept(dept); setSearchQuery(''); }}
            className={`px-4 py-2.5 rounded-2xl text-[12.5px] font-medium border-2 transition-all ${
              selectedDept === dept
                ? 'bg-[#E31E24] border-[#E31E24] text-white shadow-md'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#E31E24] bg-white dark:bg-slate-900'
            }`}>
            {dept}
          </button>
        ))}
      </div>

      {/* Month navigation + table */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 soft-shadow overflow-hidden">

        {/* Month nav bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <button onClick={() => setMonthOffset(p => p - 1)}
            className="p-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24] transition-all">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-sm font-black text-slate-900 dark:text-white">{monthLabel}</p>
            {monthOffset !== 0 && (
              <button onClick={() => setMonthOffset(0)} className="text-[10px] text-[#E31E24] font-bold hover:underline mt-0.5">Back to current month</button>
            )}
          </div>
          <button onClick={() => setMonthOffset(p => p + 1)}
            className="p-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24] transition-all">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search employee…"
              className="w-full pl-9 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#E31E24] outline-none transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
          {canEdit && (
            <p className="text-[9px] text-slate-400 font-bold hidden sm:block">
              <Zap size={10} className="inline text-[#E31E24] mr-1" />Click employee name for bulk month edit · Click cell for single day
            </p>
          )}
        </div>

        {/* Roster grid */}
        <div className="overflow-x-auto" ref={tableRef}>
          <table className="w-full" style={{ minWidth: `${160 + monthDates.length * 52}px` }}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-left sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 w-44">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Users size={12} /> Employee
                  </div>
                </th>
                {monthDates.map((date, idx) => {
                  const d   = new Date(date + 'T12:00:00');
                  const isToday = date === todayStr;
                  const dayNum  = d.getDay();
                  return (
                    <th key={date} data-col={idx}
                      className={`py-3 text-center w-[52px] ${isToday ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                      <p className={`text-[8px] font-black uppercase ${isToday ? 'text-[#E31E24]' : 'text-slate-400'}`}>
                        {DAYS_SHORT[dayNum]}
                      </p>
                      <p className={`text-sm font-black mt-0.5 ${isToday ? 'text-[#E31E24]' : 'text-slate-700 dark:text-slate-300'}`}>
                        {d.getDate()}
                      </p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {deptEmployees.length === 0 && (
                <tr><td colSpan={monthDates.length + 1} className="py-16 text-center text-slate-400 text-sm italic">No employees in {selectedDept}.</td></tr>
              )}
              {deptEmployees.map(emp => {
                const weekendDays = emp.weekendDays || ['Friday', 'Saturday'];
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                    {/* Employee name cell — click for bulk edit */}
                    <td className="px-3 py-2 sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50/80 dark:group-hover:bg-slate-800/30 transition-colors">
                      <div
                        className={`flex items-center gap-2 ${canEdit ? 'cursor-pointer' : ''}`}
                        onClick={canEdit ? () => setBulkEmployee({ id: emp.id, name: emp.name, weekendDays: emp.weekendDays }) : undefined}
                        title={canEdit ? 'Click to bulk edit full month' : ''}
                      >
                        <div className="w-7 h-7 rounded-xl overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0">
                          {emp.avatar
                            ? <img src={emp.avatar} alt="" className="w-full h-full object-cover" />
                            : <span className="text-[9px] font-black text-slate-500">{emp.name.charAt(0)}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[10px] font-black truncate max-w-[110px] ${canEdit ? 'text-[#E31E24] group-hover:underline' : 'text-slate-900 dark:text-white'}`}>
                            {emp.name}
                          </p>
                          <p className="text-[8px] text-slate-400 font-medium truncate">{emp.designation || emp.role}</p>
                        </div>
                        {canEdit && <Zap size={10} className="text-slate-300 group-hover:text-[#E31E24] flex-shrink-0 transition-colors" />}
                      </div>
                    </td>
                    {monthDates.map(date => {
                      const entry    = rosterMap[`${emp.id}_${date}`];
                      const isToday  = date === todayStr;
                      const dayName  = FULL_DAY_NAMES[new Date(date + 'T12:00:00').getDay()];
                      const isWeekend = weekendDays.includes(dayName);
                      return (
                        <td key={date} className={`px-1 py-2 ${isToday ? 'bg-red-50/30 dark:bg-red-900/5' : ''}`}>
                          <ShiftCell
                            entry={entry}
                            canEdit={canEdit}
                            isWeekend={isWeekend}
                            isToday={isToday}
                            onEdit={() => setEditCell({ userId: emp.id, userName: emp.name, date })}
                            onDelete={() => entry && handleDelete(entry.id)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 items-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-2">Shifts</p>
          {SHIFT_PRESETS.filter(p => p.label !== 'Off').map(p => (
            <span key={p.label} className={`px-3 py-1 rounded-xl text-[9px] font-black border ${p.bg} ${p.color}`}>
              {p.label} · {p.checkIn}–{p.checkOut}
            </span>
          ))}
          {canEdit && (
            <span className="ml-auto flex items-center gap-1 text-[9px] text-slate-400 font-medium">
              <Zap size={9} className="text-[#E31E24]" /> Name = bulk · Cell = single day
            </span>
          )}
        </div>
      </div>

      {/* Single day edit modal */}
      {editCell && (
        <ShiftEditModal
          userName={editCell.userName}
          date={editCell.date}
          existing={editingEntry}
          onSave={async (checkIn, checkOut, label, note) => {
            await handleSaveShift(editCell.userId, editCell.userName, editCell.date, checkIn, checkOut, label, note);
            setEditCell(null);
          }}
          onClose={() => setEditCell(null)}
        />
      )}

      {/* Bulk month edit modal */}
      {bulkEmployee && (
        <BulkEditModal
          employee={bulkEmployee}
          monthDates={monthDates}
          onSave={async (plan) => {
            await handleBulkSave(bulkEmployee, plan);
            setBulkEmployee(null);
          }}
          onClose={() => setBulkEmployee(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold border-2 animate-[slideUp_0.3s_ease-out] ${
          toast.ok
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
        }`}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default RosterView;
