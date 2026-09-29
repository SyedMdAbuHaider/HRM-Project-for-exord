/**
 * HolidayCalendar.tsx — Exord Online HRM
 *
 * Full month calendar showing:
 *  - Regular weekends (per employee's weekendDays)
 *  - Government holidays / off days (editable by HR, Admin, Developer)
 *  - Special duty days — holidays where selected employees must work (paid)
 *  - Extra pay badge for employees assigned to special duty
 *
 * Roles that can edit: DEVELOPER, ADMIN, CO_ADMIN, HR
 */

import React, { useState, useMemo } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import {
  ChevronLeft, ChevronRight, Plus, Edit2, Trash2, X, Save,
  Users, Star, Calendar, AlertCircle, CheckCircle2, Loader2, Search
} from 'lucide-react';
import type { Holiday } from '../store';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const canManage = (role?: string) =>
  role === UserRole.DEVELOPER || role === UserRole.ADMIN ||
  role === UserRole.CO_ADMIN  || role === UserRole.HR;

// ── Small badge component ─────────────────────────────────────────────────────
const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${color}`}>
    {children}
  </span>
);

// ── Edit / Add Modal ──────────────────────────────────────────────────────────
interface HolidayModalProps {
  initial: Partial<Holiday> & { date: string };
  onSave: (h: Omit<Holiday, 'id'>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  users: Array<{ id: string; name: string; department: string }>;
}

const HolidayModal: React.FC<HolidayModalProps & { units?: Array<{ id: string; name: string }> }> = ({ initial, onSave, onDelete, onClose, users, units = [] }) => {
  const [name, setName]     = useState(initial.name || '');
  const [type, setType]     = useState<'holiday' | 'special_duty'>(initial.type || 'holiday');
  const [note, setNote]     = useState(initial.note || '');
  const [assigned, setAssigned] = useState<string[]>(initial.assignedUserIds || []);
  const [applicableTo, setApplicableTo] = useState<Holiday['applicableTo']>((initial as any).applicableTo || 'all');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>((initial as any).unitIds || []);
  const [extraPayMultiplier, setExtraPayMultiplier] = useState<number>((initial as any).extraPayMultiplier || 0);
  const [empSearch, setEmpSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // Filter user list by selected units (if any units are selected)
  const filteredUsers = useMemo(() => {
    const q = empSearch.toLowerCase();
    return users.filter(u => !q || u.name.toLowerCase().includes(q) || u.department.toLowerCase().includes(q));
  }, [users, empSearch]);

  const toggleUser = (uid: string) =>
    setAssigned(p => p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid]);

  const toggleUnit = (uid: string) =>
    setSelectedUnitIds(p => p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        date: initial.date, name: name.trim(), type,
        assignedUserIds: type === 'special_duty' ? assigned : [],
        applicableTo,
        unitIds: selectedUnitIds,
        extraPayMultiplier: type === 'special_duty' ? (extraPayMultiplier || 0) : 0,
        note: note.trim(),
      });
      onClose();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try { await onDelete(); onClose(); } finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E31E24] flex items-center justify-center">
              <Calendar size={18} className="text-white" />
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white">{initial.id ? 'Edit Day' : 'Add Off Day'}</p>
              <p className="text-[10px] text-slate-400 font-bold">{initial.date}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">

          {/* Name */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Holiday / Event Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Eid ul-Fitr, Independence Day..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:border-[#E31E24] transition-colors"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Type</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: 'holiday', label: '🏖 Public Holiday', desc: 'Everyone is off' },
                { v: 'special_duty', label: '⚡ Special Duty', desc: 'Selected staff work (paid)' },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setType(opt.v as any)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                    type === opt.v
                      ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <p className={`text-xs font-black mb-0.5 ${type === opt.v ? 'text-[#E31E24]' : 'text-slate-900 dark:text-white'}`}>{opt.label}</p>
                  <p className="text-[9px] font-medium text-slate-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Note (optional)</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Any additional info..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:border-[#E31E24] transition-colors"
            />
          </div>

          {/* Employee assignment (special_duty only) */}
          {type === 'special_duty' && (
            <div className="space-y-4">
              {/* Unit-wise filter */}
              {units.length > 0 && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Assign by Unit <span className="text-slate-300 font-medium normal-case">(optional — leave blank for all units)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {units.map(u => {
                      const on = selectedUnitIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleUnit(u.id)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black border-2 transition-all ${on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-400'}`}
                        >
                          {u.name}
                        </button>
                      );
                    })}
                  </div>
                  {selectedUnitIds.length > 0 && (
                    <p className="text-[9px] text-blue-500 font-bold mt-1.5">
                      Showing employees from {selectedUnitIds.length} unit(s) only
                    </p>
                  )}
                </div>
              )}

              {/* Extra pay multiplier */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Extra Pay Rate
                </label>
                <div className="flex gap-2">
                  {[0, 1.5, 2, 2.5, 3].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setExtraPayMultiplier(m)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${extraPayMultiplier === m ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-amber-400'}`}
                    >
                      {m === 0 ? 'Default\n1.5×' : `${m}×`}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5">
                  {extraPayMultiplier === 0
                    ? 'Default: 1.5× daily rate for special duty'
                    : `${extraPayMultiplier}× daily salary rate for working this day`}
                </p>
              </div>

              {/* Employee picker */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Assign Employees for Duty
                  <span className="ml-2 text-[#E31E24]">({assigned.length} selected)</span>
                </label>
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={empSearch}
                    onChange={e => setEmpSearch(e.target.value)}
                    placeholder="Filter by name or department..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                  />
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden max-h-52 overflow-y-auto custom-scrollbar">
                  {filteredUsers.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">No employees found</p>
                  )}
                  {filteredUsers.map(u => {
                    const on = assigned.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleUser(u.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors text-left ${on ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${on ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                          {on && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white">{u.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium">{u.department}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {assigned.length > 0 && (
                  <p className="text-[9px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
                    <CheckCircle2 size={10} /> {assigned.length} employee(s) will receive {extraPayMultiplier > 0 ? `${extraPayMultiplier}×` : '1.5×'} extra pay for working this day
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
          {onDelete && !confirmDel && (
            <button
              onClick={() => setConfirmDel(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          {confirmDel && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Confirm Delete
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#E31E24] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#C41217] disabled:opacity-50 transition-all active:scale-95"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Calendar Component ───────────────────────────────────────────────────
const HolidayCalendar: React.FC<{ onDateTap?: (dateStr: string) => void; attendanceDays?: string[] }> = ({ onDateTap, attendanceDays = [] }) => {
  const { currentUser, users, units, holidays, addHoliday, updateHoliday, deleteHoliday } = useHRM();

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [modal, setModal] = useState<{ date: string; holiday?: Holiday } | null>(null);

  const isManager = canManage(currentUser?.role);

  // Build calendar grid
  const { days, firstDOW } = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDOW    = new Date(year, month, 1).getDay();
    const days: number[] = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    return { days, firstDOW };
  }, [year, month]);

  // Holiday map: "YYYY-MM-DD" → Holiday
  const holidayMap = useMemo(() => {
    const map: Record<string, Holiday> = {};
    visibleHolidays.forEach(h => { map[h.date] = h; });
    return map;
  }, [holidays]);

  // Weekends for current user
  const myWeekends: number[] = useMemo(() => {
    const wd = currentUser?.weekendDays || ['Friday', 'Saturday'];
    return wd.map((d: string) => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(d));
  }, [currentUser?.weekendDays]);

  const dateStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Stats for this month
  // Filter holidays by religion — show 'all' + matching religion
  const visibleHolidays = useMemo(() => {
    const userReligion = (currentUser as any)?.religion?.toLowerCase() || '';
    return holidays.filter(h => {
      const app = (h as any).applicableTo || 'all';
      if (app === 'all') return true;
      if (!userReligion) return true; // no religion set — show all
      return app === userReligion;
    });
  }, [holidays, currentUser]);

  const monthHolidays = visibleHolidays.filter(h => h.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`));
  const mySpecialDuty = monthHolidays.filter(h => h.type === 'special_duty' && h.assignedUserIds.includes(currentUser?.id || ''));

  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6 pb-20 animate-[fadeIn_0.4s_ease-out]">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Holiday Calendar</h2>
          <p className="text-slate-400 text-sm font-medium mt-0.5">Off days, public holidays & special duty assignments</p>
        </div>
        {isManager && (
          <button
            onClick={() => setModal({ date: dateStr(today.getDate()) })}
            className="flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-[#C41217] active:scale-95 transition-all shadow-lg shadow-red-900/20"
          >
            <Plus size={15} /> Add Off Day
          </button>
        )}
      </div>

      {/* My duty alerts */}
      {mySpecialDuty.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-amber-700 dark:text-amber-400 mb-1">You have special duty this month</p>
            <div className="flex flex-wrap gap-2">
              {mySpecialDuty.map(h => (
                <span key={h.id} className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-black rounded-xl">
                  {h.date.slice(8)} {MONTHS[month].slice(0,3)} · {h.name}
                </span>
              ))}
            </div>
            <p className="text-[9px] text-amber-500 font-medium mt-1.5">Extra pay applies for working on these days.</p>
          </div>
        </div>
      )}

      {/* Month stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Public Holidays', value: monthHolidays.filter(h => h.type === 'holiday').length, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/10' },
          { label: 'Special Duty Days', value: monthHolidays.filter(h => h.type === 'special_duty').length, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10' },
          { label: 'My Duty Days', value: mySpecialDuty.length, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-slate-100 dark:border-slate-800`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Calendar card */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden soft-shadow">

        {/* Month nav */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <button onClick={prevMonth} className="p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-[#E31E24] hover:text-[#E31E24] transition-all">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-lg font-black text-slate-900 dark:text-white">{MONTHS[month]} {year}</p>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-[#E31E24] hover:text-[#E31E24] transition-all">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
          {DOW_LABELS.map((d, i) => (
            <div key={d} className={`py-3 text-center text-[9px] font-black uppercase tracking-widest ${myWeekends.includes(i) ? 'text-[#E31E24]' : 'text-slate-400'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDOW }).map((_, i) => (
            <div key={`e${i}`} className="border-b border-r border-slate-100 dark:border-slate-800 min-h-[88px]" />
          ))}

          {days.map(d => {
            const dow = (firstDOW + d - 1) % 7;
            const ds  = dateStr(d);
            const holiday = holidayMap[ds];
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isWeekend = myWeekends.includes(dow);
            const isMyDuty  = holiday?.type === 'special_duty' && holiday.assignedUserIds.includes(currentUser?.id || '');
            const isOff     = isWeekend || holiday?.type === 'holiday';

            return (
              <div
                key={d}
                onClick={() => {
                  if (isManager) setModal({ date: ds, holiday });
                  if (onDateTap) onDateTap(ds);
                }}
                className={`relative border-b border-r border-slate-100 dark:border-slate-800 min-h-[88px] p-2 transition-colors flex flex-col gap-1 ${
                  (isManager || onDateTap) ? 'cursor-pointer' : ''
                } ${
                  holiday?.type === 'holiday'
                    ? 'bg-red-50/60 dark:bg-red-900/5'
                    : holiday?.type === 'special_duty'
                    ? 'bg-amber-50/60 dark:bg-amber-900/5'
                    : isWeekend
                    ? 'bg-slate-50/80 dark:bg-slate-800/30'
                    : ''
                } ${(isManager || onDateTap) ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
              >
                {/* Day number */}
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                  isToday
                    ? 'bg-[#E31E24] text-white shadow-md'
                    : isOff && !holiday
                    ? 'text-[#E31E24]'
                    : 'text-slate-900 dark:text-white'
                }`}>
                  {d}
                </div>

                {/* Attendance dot */}
                {attendanceDays.includes(ds) && (
                  <span className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}

                {/* Weekend label */}
                {isWeekend && !holiday && (
                  <span className="text-[8px] font-black text-[#E31E24]/70 uppercase tracking-wider px-1">Weekend</span>
                )}

                {/* Holiday badge */}
                {holiday && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg leading-tight ${
                      holiday.type === 'holiday'
                        ? 'bg-red-100 dark:bg-red-900/20 text-red-600'
                        : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700'
                    }`}>
                      {holiday.type === 'holiday' ? '🏖' : '⚡'} {holiday.name}
                    </span>
                    {holiday.type === 'special_duty' && holiday.assignedUserIds.length > 0 && (
                      <span className="text-[7px] font-bold text-slate-400 px-1">
                        {holiday.assignedUserIds.length} on duty
                      </span>
                    )}
                    {isMyDuty && (
                      <span className="text-[7px] font-black text-emerald-600 px-1 flex items-center gap-0.5">
                        <Star size={7} /> You · Extra pay
                      </span>
                    )}
                  </div>
                )}

                {/* Add button hint for managers */}
                {isManager && !holiday && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100">
                    <Plus size={10} className="text-slate-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {[
          { color: 'bg-red-100 text-red-600', label: 'Public Holiday (everyone off)' },
          { color: 'bg-amber-100 text-amber-700', label: 'Special Duty Day (selected staff work, get paid)' },
          { color: 'bg-slate-100 text-red-500', label: 'Your Weekend' },
          { color: 'bg-emerald-100 text-emerald-600', label: 'You are on special duty' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-md flex-shrink-0 ${l.color}`} />
            <span className="text-[10px] font-medium text-slate-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Holiday list for this month */}
      {monthHolidays.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden soft-shadow">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Calendar size={15} className="text-[#E31E24]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              {MONTHS[month]} — {monthHolidays.length} event{monthHolidays.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {monthHolidays.map(h => {
              const assignedPeople = h.assignedUserIds.map(uid => users.find(u => u.id === uid)?.name).filter(Boolean);
              const isMy = h.assignedUserIds.includes(currentUser?.id || '');
              return (
                <div key={h.id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-center flex-shrink-0 ${h.type === 'holiday' ? 'bg-red-50 dark:bg-red-900/10' : 'bg-amber-50 dark:bg-amber-900/10'}`}>
                      <span className="text-xs font-black text-slate-500">{MONTHS[month].slice(0,3)}</span>
                      <span className={`text-lg font-black leading-none ${h.type === 'holiday' ? 'text-red-600' : 'text-amber-600'}`}>{h.date.slice(8)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-slate-900 dark:text-white">{h.name}</p>
                        {h.type === 'holiday'
                          ? <Badge color="bg-red-100 text-red-600">🏖 Public Holiday</Badge>
                          : <Badge color="bg-amber-100 text-amber-700">⚡ Special Duty</Badge>}
                        {isMy && <Badge color="bg-emerald-100 text-emerald-600">⭐ You · Extra Pay</Badge>}
                      </div>
                      {h.note && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{h.note}</p>}
                      {h.type === 'special_duty' && assignedPeople.length > 0 && (
                        <p className="text-[10px] text-slate-500 font-medium mt-1 flex items-center gap-1">
                          <Users size={10} /> {assignedPeople.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  {isManager && (
                    <button
                      onClick={() => setModal({ date: h.date, holiday: h })}
                      className="flex-shrink-0 p-2 rounded-xl text-slate-400 hover:text-[#E31E24] hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <HolidayModal
          initial={modal.holiday ? { ...modal.holiday } : { date: modal.date }}
          users={users}
          units={units.map(u => ({ id: u.id, name: u.name }))}
          onSave={async h => {
            if (modal.holiday) await updateHoliday(modal.holiday.id, h);
            else await addHoliday(h);
          }}
          onDelete={modal.holiday ? async () => deleteHoliday(modal.holiday!.id) : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default HolidayCalendar;
