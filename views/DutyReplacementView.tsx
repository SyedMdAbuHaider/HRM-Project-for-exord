/**
 * DutyReplacementView.tsx — v3
 * Two tabs:
 *   1. Duty Swap Requests  — employee-initiated + HR manual swaps
 *   2. Leave Replacements  — HR assigns cover for approved leaves
 */

import React, { useState, useMemo } from 'react';
import { useHRM } from '../store';
import { UserRole, LeaveStatus } from '../types';
import {
  UserCheck, CalendarDays, ArrowRight, Plus, X, Check,
  AlertTriangle, Trash2, ChevronDown, ChevronUp,
  RefreshCw, Shuffle, Shield, ArrowLeftRight, Users,
  CheckCircle, XCircle, Ban
} from 'lucide-react';
import { useDutyReplacements, detectReplacementType } from './DutyReplacementView.hook';
import type { DutyReplacement } from './DutyReplacementView.hook';
import { useDutySwapRequests } from './DutySwapRequest.hook';
import type { DutySwapRequest, SwapRequestStatus } from './DutySwapRequest.hook';

// ── Shared: ShiftInput ───────────────────────────────────────────────────────
const ShiftInput: React.FC<{
  label: string; checkIn: string; checkOut: string;
  onCheckIn: (v: string) => void; onCheckOut: (v: string) => void;
  color?: string;
}> = ({ label, checkIn, checkOut, onCheckIn, onCheckOut, color = 'text-slate-500' }) => (
  <div className="space-y-2">
    <p className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{label}</p>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <label className="text-[9px] font-bold text-slate-400 uppercase">Check-in</label>
        <input type="time" required value={checkIn} onChange={e => onCheckIn(e.target.value)}
          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] transition-all" />
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-bold text-slate-400 uppercase">Check-out</label>
        <input type="time" required value={checkOut} onChange={e => onCheckOut(e.target.value)}
          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] transition-all" />
      </div>
    </div>
  </div>
);

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_SWAP: Record<SwapRequestStatus, { label: string; cls: string }> = {
  PENDING_MANAGER: { label: 'Pending Manager', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' },
  PENDING_HR:      { label: 'Pending HR',      cls: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' },
  APPROVED:        { label: 'Approved',         cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' },
  REJECTED:        { label: 'Rejected',         cls: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600' },
  CANCELLED:       { label: 'Cancelled',        cls: 'bg-slate-100 dark:bg-slate-800 text-slate-400' },
};

const TypeBadge: React.FC<{ type: DutyReplacement['replacementType'] }> = ({ type }) =>
  type === 'SHIFT_SWAP'
    ? <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 text-blue-600"><Shuffle size={9} /> Shift Swap</span>
    : <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 text-amber-600"><Shield size={9} /> Full Cover</span>;

// ── Replacement card ─────────────────────────────────────────────────────────
const AssignmentCard: React.FC<{ assignment: DutyReplacement; onCancel: (id: string) => void; canManage: boolean }> = ({ assignment, onCancel, canManage }) => {
  const [ex, setEx] = useState(false);
  const isSwap = assignment.replacementType === 'SHIFT_SWAP';
  const sc = assignment.status === 'ACTIVE' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : assignment.status === 'COMPLETED' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-rose-600 bg-rose-50 dark:bg-rose-900/20';
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden soft-shadow">
      <div className="p-5 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${isSwap ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'}`}>{assignment.leaveEmployeeName.charAt(0)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-slate-900 dark:text-white truncate">{assignment.leaveEmployeeName}</span>
            {isSwap ? <Shuffle size={12} className="text-blue-400 flex-shrink-0" /> : <ArrowRight size={12} className="text-slate-400 flex-shrink-0" />}
            <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 truncate">{assignment.replacementEmployeeName}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(assignment.startDate).toLocaleDateString()} – {new Date(assignment.endDate).toLocaleDateString()}</span>
            <TypeBadge type={assignment.replacementType} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-3 py-1 text-[9px] font-black uppercase ${sc}`}>{assignment.status}</span>
          {canManage && assignment.status === 'ACTIVE' && <button onClick={() => onCancel(assignment.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={15} /></button>}
          <button onClick={() => setEx(p => !p)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">{ex ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        </div>
      </div>
      {ex && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-5 bg-slate-50 dark:bg-slate-800/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isSwap ? <>
            <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{assignment.leaveEmployeeName}'s Shift</p><p className="text-sm font-black text-blue-700 dark:text-blue-400">{assignment.leaveEmployeeSchedule?.checkInTime} – {assignment.leaveEmployeeSchedule?.checkOutTime}</p><p className="text-[10px] text-slate-400 mt-0.5">Status: <span className="font-black text-blue-600">Shift Replaced</span></p></div>
            <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{assignment.replacementEmployeeName}'s Shift</p><p className="text-sm font-black text-emerald-700 dark:text-emerald-400">{assignment.replacementEmployeeSchedule?.checkInTime} – {assignment.replacementEmployeeSchedule?.checkOutTime}</p><p className="text-[10px] text-slate-400 mt-0.5">Normal attendance</p></div>
          </> : <>
            <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">On Leave</p><p className="text-sm font-black text-slate-800 dark:text-white">{assignment.leaveEmployeeName}</p><p className="text-[10px] text-slate-400 mt-0.5">Status: <span className="font-black text-rose-600">Absent</span></p></div>
            <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Replacement Shift</p><p className="text-sm font-black text-emerald-700 dark:text-emerald-400">{assignment.replacementEmployeeSchedule?.checkInTime} – {assignment.replacementEmployeeSchedule?.checkOutTime}</p></div>
          </>}
          {assignment.note && <div className="sm:col-span-2"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">HR Note</p><p className="text-sm text-slate-600 dark:text-slate-300">{assignment.note}</p></div>}
          <div className="sm:col-span-2"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">By {assignment.assignedBy} · {new Date(assignment.createdAt).toLocaleString()}</p></div>
        </div>
      )}
    </div>
  );
};

// ── Swap request card ────────────────────────────────────────────────────────
const SwapCard: React.FC<{
  req: DutySwapRequest; onMgrApprove: (id: string) => void; onHrApprove: (id: string) => void;
  onReject: (id: string) => void; onCancel: (id: string) => void;
  canMgr: boolean; canHr: boolean; isOwn: boolean;
}> = ({ req, onMgrApprove, onHrApprove, onReject, onCancel, canMgr, canHr, isOwn }) => {
  const [ex, setEx] = useState(false);
  const cfg = STATUS_SWAP[req.status];
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden soft-shadow">
      <div className="p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0"><ArrowLeftRight size={16} className="text-violet-600" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-slate-900 dark:text-white">{req.requesterName}</span>
            <ArrowLeftRight size={12} className="text-violet-400 flex-shrink-0" />
            <span className="text-sm font-black text-violet-700 dark:text-violet-400">{req.targetName}</span>
            {req.isHrDirect && <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500">HR Direct</span>}
          </div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()} · {req.requesterDepartment}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest ${cfg.cls}`}>{cfg.label}</span>
          {canMgr && <><button onClick={() => onMgrApprove(req.id)} className="p-2 bg-emerald-500 text-white hover:bg-emerald-600 transition-all"><Check size={14} /></button><button onClick={() => onReject(req.id)} className="p-2 bg-rose-500 text-white hover:bg-rose-600 transition-all"><X size={14} /></button></>}
          {canHr  && <><button onClick={() => onHrApprove(req.id)} className="p-2 bg-emerald-500 text-white hover:bg-emerald-600 transition-all"><CheckCircle size={14} /></button><button onClick={() => onReject(req.id)} className="p-2 bg-rose-500 text-white hover:bg-rose-600 transition-all"><XCircle size={14} /></button></>}
          {isOwn && ['PENDING_MANAGER','PENDING_HR'].includes(req.status) && <button onClick={() => onCancel(req.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Ban size={14} /></button>}
          <button onClick={() => setEx(p => !p)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">{ex ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        </div>
      </div>
      {ex && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-5 bg-slate-50 dark:bg-slate-800/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{req.requesterName}'s Shift</p><p className="text-sm font-black text-slate-800 dark:text-white">{req.requesterSchedule.checkInTime} – {req.requesterSchedule.checkOutTime}</p></div>
          <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{req.targetName}'s Shift</p><p className="text-sm font-black text-violet-700 dark:text-violet-400">{req.targetSchedule.checkInTime} – {req.targetSchedule.checkOutTime}</p></div>
          {req.reason && <div className="sm:col-span-2"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Reason</p><p className="text-sm text-slate-600 dark:text-slate-300">{req.reason}</p></div>}
          {req.rejectionReason && <div className="sm:col-span-2 p-3 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20"><p className="text-[9px] font-black uppercase tracking-widest text-rose-500 mb-1">Rejection Reason</p><p className="text-sm text-rose-700 dark:text-rose-400">{req.rejectionReason}</p></div>}
          <div className="sm:col-span-2 space-y-0.5">
            {req.managerApprovedBy && <p className="text-[10px] text-slate-400 font-bold">Manager: <span className="font-black text-slate-700 dark:text-slate-200">{req.managerApprovedBy}</span></p>}
            {req.hrApprovedBy      && <p className="text-[10px] text-slate-400 font-bold">HR: <span className="font-black text-emerald-600">{req.hrApprovedBy}</span></p>}
            {req.rejectedBy        && <p className="text-[10px] text-slate-400 font-bold">Rejected by: <span className="font-black text-rose-600">{req.rejectedBy}</span></p>}
            <p className="text-[9px] text-slate-300 dark:text-slate-600">{new Date(req.createdAt).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main view ────────────────────────────────────────────────────────────────
const DutyReplacementView: React.FC = () => {
  const { currentUser, users, leaves } = useHRM();
  const { assignments, isLoading: loadR, createAssignment, cancelAssignment, refresh: refR } = useDutyReplacements();
  const { visibleRequests, isLoading: loadS, submitSwapRequest, managerApprove, hrApprove, rejectSwapRequest, cancelSwapRequest, hrDirectSwap, canManagerApprove, canHrApprove, refresh: refS } = useDutySwapRequests();

  const isHR = currentUser?.role === UserRole.HR;
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isDev = currentUser?.role === UserRole.DEVELOPER;
  const isManager = currentUser?.role === UserRole.MANAGER;
  const isEmp = currentUser?.role === UserRole.EMPLOYEE;
  const canManage = isHR || isAdmin || isDev;

  const [tab, setTab] = useState<'swaps' | 'replacements'>('swaps');

  // replacement form
  const [showR, setShowR] = useState(false);
  const [rLv, setRLv] = useState(''); const [rRp, setRRp] = useState(''); const [rNote, setRNote] = useState('');
  const [rLIn, setRLIn] = useState('09:00'); const [rLOut, setRLOut] = useState('17:00');
  const [rRIn, setRRIn] = useState('09:00'); const [rROut, setRROut] = useState('17:00');
  const [rBusy, setRBusy] = useState(false); const [rErr, setRErr] = useState<string|null>(null); const [rOk, setROk] = useState<string|null>(null);
  const rLS = { checkInTime: rLIn, checkOutTime: rLOut, graceMinutes: 5, earlyCheckInMinutes: 30 };
  const rRS = { checkInTime: rRIn, checkOutTime: rROut, graceMinutes: 5, earlyCheckInMinutes: 30 };
  const rDet = rLIn && rLOut && rRIn && rROut ? detectReplacementType(rLS, rRS) : null;
  const elLv = useMemo(() => { const used = new Set(assignments.filter(a=>a.status==='ACTIVE').map(a=>a.leaveId)); return leaves.filter(l=>l.status===LeaveStatus.APPROVED && !used.has(l.id)); }, [leaves, assignments]);
  const selLv = useMemo(() => leaves.find(l=>l.id===rLv), [leaves, rLv]);
  const busyOnDates = useMemo(() => { if (!selLv) return new Set<string>(); const s=new Date(selLv.startDate),e=new Date(selLv.endDate); return new Set(leaves.filter(l=>l.status===LeaveStatus.APPROVED&&l.userId!==selLv.userId&&new Date(l.startDate)<=e&&new Date(l.endDate)>=s).map(l=>l.userId)); }, [leaves,selLv]);
  const avRepl = useMemo(() => { if (!selLv) return []; return users.filter(u=>u.id!==selLv.userId&&u.role===UserRole.EMPLOYEE&&!busyOnDates.has(u.id)); }, [users,selLv,busyOnDates]);
  const resetR = () => { setRLv(''); setRRp(''); setRNote(''); setRLIn('09:00'); setRLOut('17:00'); setRRIn('09:00'); setRROut('17:00'); setRErr(null); };
  const submitR = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selLv||!rRp) return; setRBusy(true); setRErr(null);
    const res = await createAssignment({ leaveId: selLv.id, leaveEmployeeId: selLv.userId, leaveEmployeeName: selLv.userName, replacementEmployeeId: rRp, department: selLv.department, startDate: selLv.startDate, endDate: selLv.endDate, leaveEmployeeSchedule: rLS, replacementEmployeeSchedule: rRS, note: rNote.trim()||undefined });
    if (res.success) { setROk(res.message||'Done.'); setShowR(false); resetR(); setTimeout(()=>setROk(null),6000); } else setRErr(res.message);
    setRBusy(false);
  };

  // swap form (employee)
  const [showSw, setShowSw] = useState(false);
  const [swTgt, setSwTgt] = useState(''); const [swS, setSwS] = useState(''); const [swE, setSwE] = useState('');
  const [swReason, setSwReason] = useState('');
  const [swMIn, setSwMIn] = useState(''); const [swMOut, setSwMOut] = useState('');
  const [swTIn, setSwTIn] = useState(''); const [swTOut, setSwTOut] = useState('');
  const [swBusy, setSwBusy] = useState(false); const [swErr, setSwErr] = useState<string|null>(null); const [swOk, setSwOk] = useState<string|null>(null);
  const colleagues = useMemo(() => { if (!currentUser) return []; return users.filter(u=>u.id!==currentUser.id&&u.department===currentUser.department&&u.role===UserRole.EMPLOYEE); }, [users,currentUser]);
  const submitSw = async (e: React.FormEvent) => {
    e.preventDefault(); if (!currentUser||!swTgt||!swS||!swE||!swReason) return;
    const tgt = users.find(u=>u.id===swTgt); if (!tgt) return;
    setSwBusy(true); setSwErr(null);
    const mySch = { checkInTime: swMIn||'09:00', checkOutTime: swMOut||'17:00', graceMinutes: 5, earlyCheckInMinutes: 30 };
    const tSch  = { checkInTime: swTIn||'09:00', checkOutTime: swTOut||'17:00', graceMinutes: 5, earlyCheckInMinutes: 30 };
    const res = await submitSwapRequest({ targetId: tgt.id, targetName: tgt.name, targetDepartment: tgt.department, startDate: swS, endDate: swE, requesterSchedule: mySch, targetSchedule: tSch, reason: swReason });
    if (res.success) { setSwOk(res.message); setShowSw(false); setSwTgt(''); setSwS(''); setSwE(''); setSwReason(''); setTimeout(()=>setSwOk(null),6000); } else setSwErr(res.message);
    setSwBusy(false);
  };

  // HR direct swap
  const [showHD, setShowHD] = useState(false);
  const [hdA, setHdA] = useState(''); const [hdB, setHdB] = useState('');
  const [hdS, setHdS] = useState(''); const [hdE, setHdE] = useState('');
  const [hdAIn, setHdAIn] = useState('09:00'); const [hdAOut, setHdAOut] = useState('17:00');
  const [hdBIn, setHdBIn] = useState('09:00'); const [hdBOut, setHdBOut] = useState('17:00');
  const [hdNote, setHdNote] = useState('');
  const [hdBusy, setHdBusy] = useState(false); const [hdErr, setHdErr] = useState<string|null>(null);
  const submitHD = async (e: React.FormEvent) => {
    e.preventDefault(); if (!hdA||!hdB||!hdS||!hdE) return; setHdBusy(true); setHdErr(null);
    const res = await hrDirectSwap({ employeeAId: hdA, employeeBId: hdB, startDate: hdS, endDate: hdE, scheduleA: {checkInTime:hdAIn,checkOutTime:hdAOut,graceMinutes:5,earlyCheckInMinutes:30}, scheduleB: {checkInTime:hdBIn,checkOutTime:hdBOut,graceMinutes:5,earlyCheckInMinutes:30}, note: hdNote.trim()||undefined });
    if (res.success) { setSwOk(res.message); setShowHD(false); setHdA(''); setHdB(''); setHdS(''); setHdE(''); setHdNote(''); setTimeout(()=>setSwOk(null),6000); } else setHdErr(res.message);
    setHdBusy(false);
  };

  // rejection modal
  const [rejId, setRejId] = useState<string|null>(null); const [rejReason, setRejReason] = useState('');
  const confirmReject = async () => { if (!rejId) return; await rejectSwapRequest(rejId, rejReason); setRejId(null); setRejReason(''); };

  const swapList = visibleRequests();
  const pendingMe = swapList.filter(r => canManagerApprove(r) || canHrApprove(r)).length;
  const globalOk = rOk || swOk;

  return (
    <div className="space-y-8 animate-[fadeIn_0.4s_ease-out] pb-20">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Duty Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Leave replacements, employee swap requests and HR direct swaps.</p>
        </div>
        <button onClick={() => { refR(); refS(); }} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white w-fit transition-all">
          <RefreshCw size={16} className={(loadR||loadS) ? 'animate-spin' : ''} />
        </button>
      </div>

      {globalOk && <div className="flex items-center gap-3 px-5 py-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-sm font-bold"><Check size={16} /> {globalOk}</div>}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 w-fit">
        {([['swaps','Duty Swap Requests',ArrowLeftRight,pendingMe],['replacements','Leave Replacements',UserCheck,0]] as any[]).map(([id,label,Icon,badge]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all relative ${tab===id ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <Icon size={14} />{label}
            {badge > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#E31E24] text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">{badge}</span>}
          </button>
        ))}
      </div>

      {/* ─── TAB: SWAP REQUESTS ─────────────────────────────────────────── */}
      {tab === 'swaps' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            {(isEmp || isManager) && (
              <button onClick={() => { setShowSw(true); setSwErr(null); const s=currentUser?users.find(u=>u.id===currentUser.id)?.dutySchedule:undefined; if(s){setSwMIn(s.checkInTime);setSwMOut(s.checkOutTime);} }}
                className="px-5 py-3 bg-violet-600 text-white font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-violet-700 transition-all shadow-lg">
                <ArrowLeftRight size={14} /> Request Swap
              </button>
            )}
            {canManage && (
              <button onClick={() => { setShowHD(true); setHdErr(null); }}
                className="px-5 py-3 bg-[#E31E24] text-white font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-xl shadow-red-900/20 hover:bg-red-700 transition-all">
                <Plus size={14} /> HR Direct Swap
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l:'Pending Manager', v:swapList.filter(r=>r.status==='PENDING_MANAGER').length, c:'from-amber-500 to-orange-600' },
              { l:'Pending HR',      v:swapList.filter(r=>r.status==='PENDING_HR').length,      c:'from-indigo-500 to-violet-600' },
              { l:'Approved',        v:swapList.filter(r=>r.status==='APPROVED').length,        c:'from-emerald-500 to-teal-600' },
              { l:'My Action',       v:pendingMe,                                               c:'from-red-500 to-rose-600' },
            ].map((s,i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 soft-shadow">
                <p className="text-2xl font-black text-slate-900 dark:text-white">{s.v}</p>
                <p className={`text-[10px] font-black uppercase tracking-widest mt-1 bg-gradient-to-r ${s.c} bg-clip-text text-transparent`}>{s.l}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {loadS && <div className="py-12 text-center text-slate-400 text-sm italic">Loading…</div>}
            {!loadS && swapList.length === 0 && <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-700"><ArrowLeftRight size={28} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" /><p className="text-sm text-slate-400 font-medium">No swap requests yet.</p></div>}
            {swapList.map(req => (
              <SwapCard key={req.id} req={req}
                onMgrApprove={managerApprove} onHrApprove={hrApprove}
                onReject={id => { setRejId(id); setRejReason(''); }}
                onCancel={cancelSwapRequest}
                canMgr={canManagerApprove(req)} canHr={canHrApprove(req)}
                isOwn={currentUser?.id === req.requesterId}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB: REPLACEMENTS ──────────────────────────────────────────── */}
      {tab === 'replacements' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            {canManage && <button onClick={() => { setShowR(true); setRErr(null); }} className="px-6 py-3.5 bg-[#E31E24] text-white font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-xl shadow-red-900/20 hover:bg-red-700 transition-all"><Plus size={16} /> Assign Replacement</button>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[{l:'Active',v:assignments.filter(a=>a.status==='ACTIVE').length,c:'from-emerald-500 to-teal-600'},{l:'Shift Swaps',v:assignments.filter(a=>a.status==='ACTIVE'&&a.replacementType==='SHIFT_SWAP').length,c:'from-blue-500 to-indigo-600'},{l:'Full Cover',v:assignments.filter(a=>a.status==='ACTIVE'&&a.replacementType==='FULL_LEAVE_COVER').length,c:'from-amber-500 to-orange-600'}].map((s,i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 soft-shadow"><p className="text-2xl font-black text-slate-900 dark:text-white">{s.v}</p><p className={`text-[10px] font-black uppercase tracking-widest mt-1 bg-gradient-to-r ${s.c} bg-clip-text text-transparent`}>{s.l}</p></div>
            ))}
          </div>
          <div className="space-y-3">
            {loadR && <div className="py-12 text-center text-slate-400 text-sm italic">Loading…</div>}
            {!loadR && assignments.length === 0 && <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-700"><CalendarDays size={28} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" /><p className="text-sm text-slate-400 font-medium">No replacements yet.</p></div>}
            {assignments.map(a => <AssignmentCard key={a.id} assignment={a} onCancel={id => { if (confirm('Cancel assignment?')) cancelAssignment(id); }} canManage={canManage} />)}
          </div>
        </div>
      )}

      {/* ─── MODALS ──────────────────────────────────────────────────────── */}

      {/* Employee swap request */}
      {showSw && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.25s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl border border-slate-300 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <div className="flex items-center gap-3"><div className="p-2.5 bg-violet-100 dark:bg-violet-900/20 text-violet-600"><ArrowLeftRight size={18} /></div><h3 className="text-lg font-black text-slate-900 dark:text-white">Request Duty Swap</h3></div>
              <button onClick={() => setShowSw(false)} className="p-2 text-slate-400 hover:text-red-600 transition-all"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {swErr && <div className="flex gap-3 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 text-rose-700 text-sm font-bold"><AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />{swErr}</div>}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Swap With (same department) <span className="text-red-500">*</span></label>
                <select required value={swTgt} onChange={e => { setSwTgt(e.target.value); const u=users.find(x=>x.id===e.target.value); if(u?.dutySchedule){setSwTIn(u.dutySchedule.checkInTime);setSwTOut(u.dutySchedule.checkOutTime);} }} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-violet-500 transition-all appearance-none">
                  <option value="">— Select colleague —</option>
                  {colleagues.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date <span className="text-red-500">*</span></label><input type="date" required value={swS} onChange={e=>setSwS(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-violet-500 transition-all" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date <span className="text-red-500">*</span></label><input type="date" required value={swE} onChange={e=>setSwE(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-violet-500 transition-all" /></div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Shift Times</p>
                <ShiftInput label="My Shift" checkIn={swMIn} checkOut={swMOut} onCheckIn={setSwMIn} onCheckOut={setSwMOut} color="text-blue-600" />
                <ShiftInput label={swTgt ? `${users.find(u=>u.id===swTgt)?.name}'s Shift` : "Colleague's Shift"} checkIn={swTIn} checkOut={swTOut} onCheckIn={setSwTIn} onCheckOut={setSwTOut} color="text-violet-600" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason <span className="text-red-500">*</span></label>
                <textarea required rows={3} value={swReason} onChange={e=>setSwReason(e.target.value)} placeholder="Why do you need this swap?" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-violet-500 transition-all resize-none" />
              </div>
              <div className="px-4 py-3 bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/20 text-xs font-bold text-violet-700 dark:text-violet-400">
                <p className="font-black uppercase tracking-widest text-[9px] mb-1">Approval Flow</p>
                <p>Your request → Department Manager approves → HR finalizes → Both employees notified via app + email</p>
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex gap-3 flex-shrink-0">
              <button type="button" onClick={() => setShowSw(false)} className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancel</button>
              <button onClick={submitSw} disabled={swBusy||!swTgt||!swS||!swE||!swReason} className="flex-1 py-3 bg-violet-600 text-white font-black text-xs uppercase tracking-widest hover:bg-violet-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {swBusy ? <><RefreshCw size={13} className="animate-spin" />Submitting…</> : <><Check size={13} />Submit Request</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HR Direct Swap */}
      {showHD && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.25s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl border border-slate-300 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <div className="flex items-center gap-3"><div className="p-2.5 bg-[#E31E24]/10 text-[#E31E24]"><Users size={18} /></div><h3 className="text-lg font-black text-slate-900 dark:text-white">HR Direct Duty Swap</h3></div>
              <button onClick={() => setShowHD(false)} className="p-2 text-slate-400 hover:text-red-600 transition-all"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {hdErr && <div className="flex gap-3 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 text-rose-700 text-sm font-bold"><AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />{hdErr}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employee A <span className="text-red-500">*</span></label>
                  <select required value={hdA} onChange={e=>{setHdA(e.target.value);const u=users.find(x=>x.id===e.target.value);if(u?.dutySchedule){setHdAIn(u.dutySchedule.checkInTime);setHdAOut(u.dutySchedule.checkOutTime);}}} className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] transition-all appearance-none">
                    <option value="">— Select —</option>
                    {users.filter(u=>u.id!==hdB).map(u=><option key={u.id} value={u.id}>{u.name} · {u.department}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employee B <span className="text-red-500">*</span></label>
                  <select required value={hdB} onChange={e=>{setHdB(e.target.value);const u=users.find(x=>x.id===e.target.value);if(u?.dutySchedule){setHdBIn(u.dutySchedule.checkInTime);setHdBOut(u.dutySchedule.checkOutTime);}}} className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] transition-all appearance-none">
                    <option value="">— Select —</option>
                    {users.filter(u=>u.id!==hdA).map(u=><option key={u.id} value={u.id}>{u.name} · {u.department}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date <span className="text-red-500">*</span></label><input type="date" required value={hdS} onChange={e=>setHdS(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] transition-all" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date <span className="text-red-500">*</span></label><input type="date" required value={hdE} onChange={e=>setHdE(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] transition-all" /></div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assign Shift Times</p>
                <ShiftInput label={hdA?`${users.find(u=>u.id===hdA)?.name}'s Shift`:'Employee A Shift'} checkIn={hdAIn} checkOut={hdAOut} onCheckIn={setHdAIn} onCheckOut={setHdAOut} color="text-rose-500" />
                <ShiftInput label={hdB?`${users.find(u=>u.id===hdB)?.name}'s Shift`:'Employee B Shift'} checkIn={hdBIn} checkOut={hdBOut} onCheckIn={setHdBIn} onCheckOut={setHdBOut} color="text-emerald-600" />
              </div>
              <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">HR Note (optional)</label><textarea rows={2} value={hdNote} onChange={e=>setHdNote(e.target.value)} placeholder="Reason or instructions…" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] transition-all resize-none" /></div>
            </div>
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex gap-3 flex-shrink-0">
              <button type="button" onClick={() => setShowHD(false)} className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancel</button>
              <button onClick={submitHD} disabled={hdBusy||!hdA||!hdB||!hdS||!hdE} className="flex-1 py-3 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest hover:bg-[#C41217] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {hdBusy ? <><RefreshCw size={13} className="animate-spin" />Creating…</> : <><Check size={13} />Create Swap</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Replacement form */}
      {showR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.25s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl border border-slate-300 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <div className="flex items-center gap-3"><div className="p-2.5 bg-[#E31E24]/10 text-[#E31E24]"><UserCheck size={18} /></div><h3 className="text-lg font-black text-slate-900 dark:text-white">Assign Leave Replacement</h3></div>
              <button onClick={() => { setShowR(false); resetR(); }} className="p-2 text-slate-400 hover:text-red-600 transition-all"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {rErr && <div className="flex gap-3 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 text-rose-700 text-sm font-bold"><AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />{rErr}</div>}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Approved Leave <span className="text-red-500">*</span></label>
                {elLv.length === 0
                  ? <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 text-amber-700 text-xs font-bold flex items-center gap-2"><AlertTriangle size={14} />No approved leaves pending replacement.</div>
                  : <select required value={rLv} onChange={e=>{setRLv(e.target.value);setRRp('');const lv=leaves.find(l=>l.id===e.target.value);if(lv){const emp=users.find(u=>u.id===lv.userId);if(emp?.dutySchedule){setRLIn(emp.dutySchedule.checkInTime);setRLOut(emp.dutySchedule.checkOutTime);}}}} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] transition-all appearance-none">
                      <option value="">— Select a leave —</option>
                      {elLv.map(l=><option key={l.id} value={l.id}>{l.userName} · {l.type} · {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}</option>)}
                    </select>
                }
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Replacement Employee <span className="text-red-500">*</span></label>
                <select required disabled={!rLv} value={rRp} onChange={e=>{setRRp(e.target.value);const u=users.find(x=>x.id===e.target.value);if(u?.dutySchedule){setRRIn(u.dutySchedule.checkInTime);setRROut(u.dutySchedule.checkOutTime);}}} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] transition-all appearance-none disabled:opacity-50">
                  <option value="">— Select —</option>
                  {avRepl.map(u=><option key={u.id} value={u.id}>{u.name} · {u.department}</option>)}
                </select>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Shift Times (auto-fills from employee schedules)</p>
                <ShiftInput label={selLv?`${selLv.userName}'s shift`:'On-leave employee'} checkIn={rLIn} checkOut={rLOut} onCheckIn={setRLIn} onCheckOut={setRLOut} color="text-rose-500" />
                <ShiftInput label="Replacement shift" checkIn={rRIn} checkOut={rROut} onCheckIn={setRRIn} onCheckOut={setRROut} color="text-emerald-600" />
              </div>
              {rDet && (
                <div className={`px-4 py-3 border text-sm font-bold flex items-center gap-2 ${rDet==='SHIFT_SWAP'?'bg-blue-50 dark:bg-blue-900/10 border-blue-100 text-blue-700 dark:text-blue-400':'bg-amber-50 dark:bg-amber-900/10 border-amber-100 text-amber-700 dark:text-amber-400'}`}>
                  {rDet==='SHIFT_SWAP'?<><Shuffle size={14}/><span><strong>Shift Swap</strong> — shifts don't overlap. No absent marking.</span></>:<><Shield size={14}/><span><strong>Full Leave Cover</strong> — on-leave employee will be marked absent.</span></>}
                </div>
              )}
              <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">HR Note (optional)</label><textarea rows={2} value={rNote} onChange={e=>setRNote(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] transition-all resize-none" /></div>
            </div>
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex gap-3 flex-shrink-0">
              <button type="button" onClick={() => { setShowR(false); resetR(); }} className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancel</button>
              <button onClick={submitR} disabled={rBusy||!rLv||!rRp} className="flex-1 py-3 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest hover:bg-[#C41217] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {rBusy?<><RefreshCw size={13} className="animate-spin"/>Assigning…</>:<><Check size={13}/>Confirm</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection modal */}
      {rejId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl p-8 space-y-5">
            <div className="flex items-center gap-3"><div className="p-3 bg-rose-50 dark:bg-rose-900/20"><AlertTriangle size={20} className="text-rose-500" /></div><h3 className="text-lg font-black text-slate-900 dark:text-white">Reject Swap Request</h3></div>
            <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Reason (optional)</label><textarea rows={3} value={rejReason} onChange={e=>setRejReason(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-red-600 transition-all resize-none" /></div>
            <div className="flex gap-3">
              <button onClick={() => { setRejId(null); setRejReason(''); }} className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
              <button onClick={confirmReject} className="flex-1 py-3 bg-rose-500 text-white font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DutyReplacementView;
