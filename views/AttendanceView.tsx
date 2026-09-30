import React, { useState, useMemo } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import {
  Clock, CheckCircle, XCircle, LogIn, LogOut,
  Calendar, Users, Search, ChevronLeft, ChevronRight, Trash2, AlertTriangle, Download, MapPin, Wifi, X
} from 'lucide-react';

const STATUS_CONFIG = {
  PRESENT: { label: 'Present', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle },
  CHECKED_OUT: { label: 'Checked Out', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: LogOut },
  ON_LEAVE: { label: 'On Leave', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: Calendar },
  ABSENT: { label: 'Absent', color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20', icon: XCircle },
};

const PAGE_SIZE = 20;

const AttendanceView: React.FC = () => {
  const { users, attendance, currentUser, leaves, units, deleteAttendanceRecord, deleteAllAttendanceForDate } = useHRM();
  const isDeveloper = currentUser?.role === UserRole.DEVELOPER;
  const isAdminOrHR = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR || isDeveloper;
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day');
  const selectedMonth = selectedDate.slice(0, 7); // YYYY-MM
  const [dayDetail, setDayDetail] = useState<{ userId: string; date: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // Unified confirm-delete state (matches JSX that already uses confirmDelete)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'all' | 'row'; userId?: string; userName?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const getFullDayDetail = (userId: string) => {
    const recs = dateAttendance.filter(a => a.userId === userId);
    const ci  = recs.find(r => r.type === 'CHECK_IN'    && r.status === 'SUCCESS');
    const co  = recs.find(r => r.type === 'CHECK_OUT'   && r.status === 'SUCCESS');
    const bStarts = recs.filter(r => r.type === 'BREAK_START' && r.status === 'SUCCESS').sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const bEnds   = recs.filter(r => r.type === 'BREAK_END'   && r.status === 'SUCCESS').sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const breakPairs = bStarts.map((bs, i) => ({ start: bs, end: bEnds[i] || null }));
    const totalBreakMs = breakPairs.reduce((sum, { start, end }) => {
      if (!end) return sum;
      return sum + (new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime());
    }, 0);
    const totalWorkMs = ci && co
      ? (new Date(co.timestamp).getTime() - new Date(ci.timestamp).getTime()) - totalBreakMs
      : null;
    const isLate = (ci as any)?.is_late;
    const lateMinutes = (ci as any)?.late_minutes;
    return { ci, co, breakPairs, totalBreakMs, totalWorkMs, isLate, lateMinutes };
  };

  const fmtDur = (ms: number) => {
    const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Bug 17: MANAGER included in admin-level view ───────────────────────
  const isAdmin =
    currentUser?.role === UserRole.DEVELOPER ||
    currentUser?.role === UserRole.ADMIN ||
    currentUser?.role === UserRole.HR ||
    currentUser?.role === UserRole.MANAGER;

  const handleDeleteAll = async () => {
    setDeleting(true);
    const toDelete = attendance.filter(a => {
      const d = new Date(a.timestamp);
      const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return dStr === selectedDate;
    });
    for (const rec of toDelete) await deleteAttendanceRecord(rec.id);
    setDeleting(false);
    setConfirmDelete(null);
    showToast(true, `Cleared all records for ${selectedDate}.`);
  };

  const handleDeleteRow = async (userId: string) => {
    setDeleting(true);
    const recs = dateAttendance.filter(a => a.userId === userId);
    for (const rec of recs) await deleteAttendanceRecord(rec.id);
    setDeleting(false);
    setConfirmDelete(null);
    showToast(true, 'Records deleted.');
  };

  const displayUsers = useMemo(() => {
    let pool: typeof users;
    if (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.DEVELOPER || currentUser?.role === UserRole.HR) {
      // Admin/HR see everyone except other admins
      pool = users.filter(u => u.role !== UserRole.ADMIN && u.role !== UserRole.DEVELOPER);
    } else if (currentUser?.role === UserRole.MANAGER) {
      // Managers see only their own department
      pool = users.filter(u => u.department === currentUser.department && u.role !== UserRole.ADMIN);
    } else {
      // Employee sees only themselves
      pool = users.filter(u => u.id === currentUser?.id);
    }
    return pool.filter(u =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, isAdmin, currentUser, search]);

  // attendance records for the selected date
  const dateAttendance = useMemo(() => {
    return attendance.filter(a => {
      const d = new Date(a.timestamp);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return dStr === selectedDate;
    });
  }, [attendance, selectedDate]);

  const getUserStatus = (userId: string) => {
    const records = dateAttendance.filter(a => a.userId === userId);
    const checkIn = records.find(a => a.type === 'CHECK_IN' && a.status === 'SUCCESS');
    const checkOut = records.find(a => a.type === 'CHECK_OUT' && a.status === 'SUCCESS');
    if (checkIn && checkOut) return { status: 'CHECKED_OUT', checkIn, checkOut };
    if (checkIn) return { status: 'PRESENT', checkIn, checkOut: null };
    const onLeave = leaves.find(l =>
      l.userId === userId && l.status === 'APPROVED' &&
      selectedDate >= l.startDate && selectedDate <= l.endDate
    );
    if (onLeave) return { status: 'ON_LEAVE', checkIn: null, checkOut: null };
    return { status: 'ABSENT', checkIn: null, checkOut: null };
  };

  const getDuration = (checkIn: any, checkOut: any) => {
    if (!checkIn) return '-';
    const end = checkOut ? new Date(checkOut.timestamp).getTime() : Date.now();
    const diff = end - new Date(checkIn.timestamp).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return checkOut ? `${h}h ${m}m` : `${h}h ${m}m ●`;
  };

  const stats = useMemo(() => {
    const total = displayUsers.length;
    let present = 0, absent = 0, onLeave = 0;
    displayUsers.forEach(u => {
      const s = getUserStatus(u.id).status;
      if (s === 'PRESENT' || s === 'CHECKED_OUT') present++;
      else if (s === 'ON_LEAVE') onLeave++;
      else absent++;
    });
    return { total, present, absent, onLeave };
  }, [displayUsers, dateAttendance, leaves]);

  // Month view helpers
  const monthDays = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const days: string[] = [];
    const total = new Date(y, m, 0).getDate();
    for (let d = 1; d <= total; d++) {
      days.push(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    }
    return days;
  }, [selectedMonth]);

  const monthAttendance = useMemo(() => {
    return attendance.filter(a => a.date?.startsWith(selectedMonth) || a.timestamp?.startsWith(selectedMonth));
  }, [attendance, selectedMonth]);

  const getMonthStatus = (userId: string, dateStr: string) => {
    const recs = monthAttendance.filter(a => {
      const d = (a.date || a.timestamp || '').slice(0, 10);
      return a.userId === userId && d === dateStr;
    });
    const ci = recs.find(r => r.type === 'CHECK_IN' && r.status === 'SUCCESS');
    const co = recs.find(r => r.type === 'CHECK_OUT' && r.status === 'SUCCESS');
    if (!ci) return { symbol: '—', color: 'text-slate-300', hours: '' };
    if (ci && !co) return { symbol: '●', color: 'text-emerald-500', hours: '' };
    const h = Math.floor((new Date(co!.timestamp).getTime() - new Date(ci.timestamp).getTime()) / 3600000);
    const mn = Math.floor(((new Date(co!.timestamp).getTime() - new Date(ci.timestamp).getTime()) % 3600000) / 60000);
    return { symbol: '✓', color: 'text-emerald-600', hours: `${h}h${mn>0?mn+'m':''}` };
  };

  // pagination
  const totalPages = Math.max(1, Math.ceil(displayUsers.length / PAGE_SIZE));
  const paged = displayUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
    setPage(1);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Employee', 'ID', 'Department', 'Check In', 'Check Out', 'Duration', 'Status'];
    const fmt = (ts?: string) => ts ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
    const rows = displayUsers.map(user => {
      const recs = dateAttendance.filter(a => a.userId === user.id);
      const checkIn  = recs.find(r => r.type === 'CHECK_IN'  && r.status === 'SUCCESS');
      const checkOut = recs.find(r => r.type === 'CHECK_OUT' && r.status === 'SUCCESS');
      const duration = checkIn && checkOut
        ? `${Math.floor((new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime()) / 3600000)}h`
        : '-';
      const status = checkIn && checkOut ? 'CHECKED_OUT' : checkIn ? 'PRESENT' : 'ABSENT';
      return [
        selectedDate, '"' + user.name + '"', user.id, '"' + user.department + '"',
        fmt(checkIn?.timestamp), fmt(checkOut?.timestamp), duration, status
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `exord-attendance-${selectedDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };


  // Get all records for a specific user+date (works across day and month view)
  const getDayRecords = (userId: string, date: string) => {
    return attendance.filter(a => {
      const d = (a.timestamp || '').slice(0, 10);
      return a.userId === userId && d === date && a.status === 'SUCCESS';
    });
  };

  const renderDayDetailSheet = () => {
    if (!dayDetail) return null;
    const { userId, date } = dayDetail;
    const user = users.find(u => u.id === userId);
    const recs = getDayRecords(userId, date);
    const ci = recs.find(r => r.type === 'CHECK_IN');
    const co = recs.find(r => r.type === 'CHECK_OUT');
    const bStarts = recs.filter(r => r.type === 'BREAK_START').sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const bEnds   = recs.filter(r => r.type === 'BREAK_END').sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const breakPairs = bStarts.map((s, i) => ({ start: s, end: bEnds[i] || null }));
    const totalBreakMs = breakPairs.reduce((acc, { start, end }) => end ? acc + (new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime()) : acc, 0);
    const totalWorkMs = ci && co ? (new Date(co.timestamp).getTime() - new Date(ci.timestamp).getTime()) - totalBreakMs : null;
    const fmtT = (ts: string) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const getNearestUnit = (loc?: { lat: number; lng: number; accuracy: number }) => {
      if (!loc || units.length === 0) return null;
      const R = 6371000;
      const toRad = (x: number) => x * Math.PI / 180;
      let best = { name: '', dist: Infinity, lat: 0, lng: 0 };
      units.forEach(u => {
        const dLat = toRad(u.lat - loc.lat);
        const dLng = toRad(u.lng - loc.lng);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(loc.lat)) * Math.cos(toRad(u.lat)) * Math.sin(dLng/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        if (dist < best.dist) best = { name: u.name, dist, lat: u.lat, lng: u.lng };
      });
      return best.dist < 5000 ? { name: best.name, dist: Math.round(best.dist), lat: best.lat, lng: best.lng } : null;
    };
    const mapsUrl = (loc?: { lat: number; lng: number; accuracy: number }) => loc ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}` : null;
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setDayDetail(null)}>
        <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#E31E24] mb-1">{fmtDate(date)}</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">{user?.name || userId}</p>
              <p className="text-xs text-slate-400 font-bold uppercase">{user?.id} · {user?.department}</p>
            </div>
            <button onClick={() => setDayDetail(null)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              <X size={18} />
            </button>
          </div>
          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {!ci && (
              <div className="text-center py-8 text-slate-400 text-sm">No attendance records for this day.</div>
            )}
            {/* Check In */}
            {ci && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <LogIn size={14} className="text-emerald-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Check In</span>
                  {ci.isLate && <span className="ml-auto text-[9px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">⚠ Late {ci.lateMinutes}m</span>}
                </div>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{fmtT(ci.timestamp)}</p>
                {ci.location && (() => {
                  const nearest = getNearestUnit(ci.location);
                  return (
                    <a href={mapsUrl(ci.location)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600/70 hover:text-emerald-600 transition-colors">
                      <MapPin size={10} />
                      {nearest ? <span className="font-black text-emerald-700 dark:text-emerald-300">{nearest.name}</span> : <span>Unknown location</span>}
                      {nearest && <span className="text-emerald-400 font-normal">{nearest.dist}m away</span>}
                      <span className="underline ml-1 text-emerald-400">Map</span>
                    </a>
                  );
                })()}
                {ci.ipAddress && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                    <Wifi size={10} />
                    {ci.ipAddress}
                  </div>
                )}
              </div>
            )}
            {/* Check Out */}
            {co && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <LogOut size={14} className="text-blue-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Check Out</span>
                </div>
                <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{fmtT(co.timestamp)}</p>
                {co.location && (() => {
                  const nearest = getNearestUnit(co.location);
                  return (
                    <a href={mapsUrl(co.location)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600/70 hover:text-blue-600 transition-colors">
                      <MapPin size={10} />
                      {nearest ? <span className="font-black text-blue-700 dark:text-blue-300">{nearest.name}</span> : <span>Unknown location</span>}
                      {nearest && <span className="text-blue-400 font-normal">{nearest.dist}m away</span>}
                      <span className="underline ml-1 text-blue-400">Map</span>
                    </a>
                  );
                })()}
                {co.ipAddress && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                    <Wifi size={10} />
                    {co.ipAddress}
                  </div>
                )}
              </div>
            )}
            {/* Breaks */}
            {breakPairs.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-amber-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Breaks</span>
                  <span className="ml-auto text-[10px] font-black text-amber-600">{fmtDur(totalBreakMs)} total</span>
                </div>
                <div className="space-y-2">
                  {breakPairs.map(({ start, end }, i) => {
                    const dur = end ? new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime() : null;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-300 bg-white/60 dark:bg-slate-800/40 rounded-xl px-3 py-2">
                        <span>{fmtT(start.timestamp)} → {end ? fmtT(end.timestamp) : <span className="text-emerald-500 animate-pulse">ongoing</span>}</span>
                        {dur !== null && <span className="text-amber-500 text-[10px]">{fmtDur(dur)}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Net Work Summary */}
            {totalWorkMs !== null && (
              <div className="bg-slate-900 dark:bg-slate-700 rounded-2xl px-5 py-4 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Work Time</span>
                <span className="text-xl font-black text-white">{fmtDur(totalWorkMs)}</span>
              </div>
            )}
            {/* Active indicator */}
            {ci && !co && (
              <div className="bg-emerald-500 rounded-2xl px-5 py-3 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Currently Working</span>
                <span className="flex items-center gap-2 text-white font-black text-sm">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  {fmtDur(Date.now() - new Date(ci.timestamp).getTime())}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMobileDetail = (userId: string) => {
    const { breakPairs, totalBreakMs, totalWorkMs, isLate, lateMinutes } = getFullDayDetail(userId);
    const fmtTime2 = (ts: string) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-3 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
        {isLate && <p className="text-[10px] font-black text-amber-500">⚠ Late by {lateMinutes} minute(s)</p>}
        {breakPairs.length > 0 && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Breaks</p>
            {breakPairs.map(({ start, end }, i) => {
              const dur = end ? new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime() : null;
              return (
                <div key={i} className="flex justify-between text-[10px] font-bold text-amber-600 dark:text-amber-400 py-0.5">
                  <span>{fmtTime2(start.timestamp)} → {end ? fmtTime2(end.timestamp) : 'ongoing'}</span>
                  {dur !== null && <span className="text-slate-400">{fmtDur(dur)}</span>}
                </div>
              );
            })}
            <div className="flex justify-between text-[10px] mt-1 pt-1 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 font-bold">Total Break</span>
              <span className="font-black text-amber-600">{fmtDur(totalBreakMs)}</span>
            </div>
          </div>
        )}
        {totalWorkMs !== null && (
          <div className="flex justify-between bg-slate-900 dark:bg-slate-700 rounded-xl px-4 py-2.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Net Work</span>
            <span className="text-sm font-black text-white">{fmtDur(totalWorkMs)}</span>
          </div>
        )}
      </div>
    );
  };

  const renderDetailRow = (userId: string, dev: boolean) => {
    const { breakPairs, totalBreakMs, totalWorkMs, isLate, lateMinutes } = getFullDayDetail(userId);
    const colSpan = dev ? 7 : 6;
    const fmtTime2 = (ts: string) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return (
      <tr className="bg-slate-50/50 dark:bg-slate-800/20">
        <td colSpan={colSpan} className="px-6 py-3">
          <div className="flex flex-wrap gap-4 items-start">
            {isLate && <span className="text-[10px] font-black text-amber-500 self-center">⚠ Late {lateMinutes}m</span>}
            {breakPairs.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Breaks</p>
                {breakPairs.map(({ start, end }, i) => {
                  const dur = end ? new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime() : null;
                  return (
                    <span key={i} className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      {fmtTime2(start.timestamp)} → {end ? fmtTime2(end.timestamp) : 'ongoing'}
                      {dur !== null && <span className="text-slate-400 ml-1">({fmtDur(dur)})</span>}
                    </span>
                  );
                })}
                <span className="text-[9px] text-slate-400 font-bold">Total break: {fmtDur(totalBreakMs)}</span>
              </div>
            )}
            {totalWorkMs !== null && (
              <div className="ml-auto bg-slate-900 dark:bg-slate-700 rounded-xl px-5 py-2 flex items-center gap-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Net Work</span>
                <span className="text-base font-black text-white">{fmtDur(totalWorkMs)}</span>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-8 animate-[fadeIn_0.5s_ease-out] pb-20">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-black text-white flex items-center gap-2 animate-[slideDown_0.3s_ease-out] ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle size={26} className="text-red-600" />
              </div>
              <div>
                <p className="font-black text-slate-900 dark:text-white text-base">
                  {confirmDelete.type === 'all'
                    ? `Clear ALL records for ${selectedDate}?`
                    : `Delete records for ${confirmDelete.userName}?`}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {confirmDelete.type === 'all'
                    ? 'This will permanently remove every shift log for this date. This cannot be undone.'
                    : 'All check-in/out records for this employee on this date will be permanently deleted.'}
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDelete.type === 'all' ? handleDeleteAll() : handleDeleteRow(confirmDelete.userId!)}
                  disabled={deleting}
                  className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            Shift Logs
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Daily attendance records and workforce presence tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'day' ? 'bg-[#E31E24] text-white' : 'text-slate-500 hover:text-[#E31E24]'}`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'month' ? 'bg-[#E31E24] text-white' : 'text-slate-500 hover:text-[#E31E24]'}`}
            >
              Month
            </button>
          </div>

          {/* Export CSV */}
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-[#E31E24] hover:text-[#E31E24] transition-all"
          >
            <Download size={14} />
            Export
          </button>

          {/* Date navigator */}
          <button onClick={() => changeDate(-1)} className="p-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24] transition-all">
            <ChevronLeft size={18} />
          </button>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            {viewMode === 'day' ? (
              <input
                type="date"
                value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setPage(1); }}
                className="pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all"
              />
            ) : (
              <input
                type="month"
                value={selectedMonth}
                onChange={e => { setSelectedDate(e.target.value + '-01'); setPage(1); }}
                className="pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all"
              />
            )}
          </div>
          <button
            onClick={() => changeDate(1)}
            disabled={selectedDate >= new Date().toISOString().split('T')[0]}
            className="p-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>

          {/* Developer-only: delete all records for this date */}
          {isDeveloper && dateAttendance.length > 0 && (
            <button
              onClick={() => setConfirmDelete({ type: 'all' })}
              className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-all"
            >
              <Trash2 size={14} /> Clear Day
            </button>
          )}
        </div>
      </div>

      {/* Stats — admin / HR / manager only */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: currentUser?.role === UserRole.MANAGER ? 'Team Size' : 'Total Staff', value: stats.total, color: 'from-blue-500 to-indigo-600', icon: Users },
            { label: 'Present', value: stats.present, color: 'from-emerald-500 to-teal-600', icon: CheckCircle },
            { label: 'Absent', value: stats.absent, color: 'from-rose-500 to-red-600', icon: XCircle },
            { label: 'On Leave', value: stats.onLeave, color: 'from-amber-500 to-orange-500', icon: Calendar },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 soft-shadow">
              <div className={`p-3 w-fit rounded-xl bg-gradient-to-br ${s.color} text-white shadow-lg mb-4`}>
                <s.icon size={18} />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {isAdmin && (
        <div className="relative max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all"
          />
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {paged.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm italic bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">No records found for this date.</div>
        )}
        {paged.map(user => {
          const { status, checkIn, checkOut } = getUserStatus(user.id);
          const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
          const fmtT = (ts: string) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={user.id} className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${status === 'ABSENT' ? 'opacity-60' : ''}`}>
              <div className="p-4 cursor-pointer" onClick={() => checkIn && setDayDetail({ userId: user.id, date: selectedDate })}>
                <div className="flex items-center justify-between mb-3">
                  <div><p className="text-sm font-black text-slate-900 dark:text-white">{user.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{user.id} · {user.department}</p></div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.color}`}><cfg.icon size={10}/>{cfg.label}</span>
                    {isDeveloper && <button onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'row', userId: user.id, userName: user.name }); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={13}/></button>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">In</p>
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{checkIn ? fmtT(checkIn.timestamp) : '—'}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Out</p>
                    <p className="text-xs font-black text-blue-600 dark:text-blue-400">{checkOut ? fmtT(checkOut.timestamp) : '—'}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Duration</p>
                    <p className={`text-xs font-black ${checkIn && !checkOut ? 'text-emerald-500' : 'text-slate-600 dark:text-slate-300'}`}>{getDuration(checkIn, checkOut)}{checkIn && !checkOut && <span className="ml-1 text-[8px] text-emerald-400 animate-pulse">●</span>}</p>
                  </div>
                </div>
                {checkIn && <p className="text-[9px] text-slate-300 dark:text-slate-600 text-center mt-2 font-bold">▼ Tap for detail</p>}
              </div>

            </div>
          );
        })}
        {totalPages > 1 && (
          <div className="flex items-center justify-between py-2">
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-40"><ChevronLeft size={16}/></button>
            <span className="text-xs font-black text-slate-600 dark:text-slate-300">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-40"><ChevronRight size={16}/></button>
          </div>
        )}
      </div>

      {/* Month View Table */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden soft-shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: Math.max(800, monthDays.length * 48 + 260) }}>
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-800/50 z-10 min-w-[180px]">Employee</th>
                  {monthDays.map(d => {
                    const day = new Date(d + 'T00:00:00');
                    const isToday = d === new Date().toISOString().split('T')[0];
                    const isSun = day.getDay() === 0;
                    const isSat = day.getDay() === 6;
                    return (
                      <th key={d} className={`px-1 py-4 text-center text-[9px] font-black uppercase tracking-widest min-w-[40px] ${isToday ? 'text-[#E31E24]' : isSun || isSat ? 'text-amber-400' : 'text-slate-400'}`}>
                        <div>{day.toLocaleDateString('en-US', { weekday: 'narrow' })}</div>
                        <div className={`text-[11px] font-black ${isToday ? 'text-[#E31E24]' : 'text-slate-600 dark:text-slate-300'}`}>{day.getDate()}</div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center min-w-[60px]">Present</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center min-w-[70px]">Total Hrs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayUsers.map((user, i) => {
                  let presentDays = 0;
                  let totalMins = 0;
                  const cells = monthDays.map(d => {
                    const s = getMonthStatus(user.id, d);
                    if (s.symbol === '✓' || s.symbol === '●') presentDays++;
                    if (s.hours) {
                      const hm = s.hours.match(/(\d+)h(\d+)?m?/);
                      if (hm) totalMins += parseInt(hm[1]||'0')*60 + parseInt(hm[2]||'0');
                    }
                    return s;
                  });
                  const totalHrs = totalMins > 0 ? `${Math.floor(totalMins/60)}h ${totalMins%60>0?totalMins%60+'m':''}` : '—';
                  return (
                    <tr key={user.id} className={i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/10'}>
                      <td className="px-5 py-3 sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-100 dark:border-slate-800">
                        <p className="text-sm font-black text-slate-900 dark:text-white whitespace-nowrap">{user.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{user.department}</p>
                      </td>
                      {cells.map((s, ci2) => (
                        <td key={ci2}
                          className={`px-1 py-3 text-center text-[11px] font-black ${s.color} ${s.symbol !== '—' ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors' : ''}`}
                          title={s.hours || undefined}
                          onClick={() => s.symbol !== '—' && setDayDetail({ userId: user.id, date: monthDays[ci2] })}
                        >
                          {s.symbol}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-black text-emerald-600">{presentDays}</span>
                        <span className="text-[9px] text-slate-400">/{monthDays.length}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-500">{totalHrs}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Desktop table */}
      {viewMode === 'day' && <div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden soft-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Employee', 'Department', 'Check In', 'Check Out', 'Duration', 'Status', ...(isDeveloper ? [''] : [])].map(h => (
                  <th key={h} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paged.length === 0 && (
                <tr>
                  <td colSpan={isDeveloper ? 7 : 6} className="py-20 text-center text-slate-400 text-sm italic">
                    No records found for this date.
                  </td>
                </tr>
              )}
              {paged.map(user => {
                const { status, checkIn, checkOut } = getUserStatus(user.id);
                const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
                const fmtTime = (ts: string) =>
                  new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                return (
                  <React.Fragment key={user.id}>
                  <tr
                    onClick={() => checkIn && setDayDetail({ userId: user.id, date: selectedDate })}
                    className={`transition-colors ${checkIn ? 'cursor-pointer' : ''} ${expandedUserId === user.id ? 'bg-slate-50 dark:bg-slate-800/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'} ${
                      status === 'ABSENT' ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{user.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{user.id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {user.department}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                        {checkIn
                          ? <><LogIn size={13} className="text-emerald-500" />{fmtTime(checkIn.timestamp)}</>
                          : <span className="text-slate-300 dark:text-slate-600">—</span>
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                        {checkOut
                          ? <><LogOut size={13} className="text-blue-500" />{fmtTime(checkOut.timestamp)}</>
                          : <span className="text-slate-300 dark:text-slate-600">—</span>
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold ${checkIn && !checkOut ? 'text-emerald-500' : 'text-slate-600 dark:text-slate-300'}`}>
                        {getDuration(checkIn, checkOut)}
                        {checkIn && !checkOut && <span className="ml-1 text-[9px] font-black text-emerald-400 animate-pulse">LIVE</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.color}`}>
                        <cfg.icon size={10} />
                        {cfg.label}
                      </span>
                    </td>
                    {isDeveloper && (
                      <td className="px-4 py-4">
                        <button
                          onClick={() => setConfirmDelete({ type: 'row', userId: user.id, userName: user.name })}
                          className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-600 transition-colors"
                          title="Delete all records for this user on this date"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                  {checkIn && expandedUserId === user.id && renderDetailRow(user.id, isDeveloper)}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-bold">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, displayUsers.length)} of {displayUsers.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24] disabled:opacity-40 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-black text-slate-600 dark:text-slate-300 px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24] disabled:opacity-40 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>}
      {renderDayDetailSheet()}
    </div>
  );
};

export default AttendanceView;
