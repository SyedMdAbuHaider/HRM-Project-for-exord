/**
 * RequestsHub.tsx — Unified Request Management Panel
 *
 * All request types in one place:
 *   1. Leave Requests      — apply, approve/reject multi-step
 *   2. Loan & Advance      — apply, admin review
 *   3. Schedule Change     — request shift change, manager → HR approve
 *   4. Duty Swap           — swap shifts with a colleague
 *
 * Role-aware: each tab only shows what's relevant to the current user.
 * Pending-action badges guide approvers to what needs their attention.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useHRM } from '../store';
import { UserRole, LeaveStatus, getLeaveStatusLabel, ScheduleChangeRequest, ScheduleChangeType } from '../types';
import { LEAVE_TYPES } from '../constants';
import { useApprovalFlow } from './ApprovalFlowView';
import { useDutySwapRequests } from './DutySwapRequest.hook';
import LoanSection from '../components/LoanSection';
import {
  Calendar, DollarSign, Clock, ArrowLeftRight,
  Plus, X, Check, ChevronDown, ChevronUp,
  AlertTriangle, Trash2, RefreshCw, Loader2,
  FileText, Users, ArrowRight, Shuffle, Shield,
  Filter, Search, CheckCircle2, XCircle, Timer,
  Banknote, CalendarDays, UserCheck, CalendarCheck2
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all outline-none';

const Badge: React.FC<{ children: React.ReactNode; color: string }> = ({ children, color }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg ${color}`}>
    {children}
  </span>
);

const statusLeaveColor = (s: LeaveStatus) => ({
  [LeaveStatus.PENDING]:             'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
  [LeaveStatus.UNIT_HEAD_APPROVED]:  'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600',
  [LeaveStatus.MANAGER_APPROVED]:    'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
  [LeaveStatus.HR_APPROVED]:         'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600',
  [LeaveStatus.CO_ADMIN_APPROVED]:   'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
  [LeaveStatus.APPROVED]:            'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
  [LeaveStatus.REJECTED]:            'bg-rose-50 dark:bg-rose-900/20 text-rose-600',
}[s] ?? 'bg-slate-100 text-slate-500');

const statusGenericColor = (s: string) => {
  if (s === 'APPROVED' || s === 'ACTIVE') return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600';
  if (s === 'REJECTED' || s === 'CANCELLED') return 'bg-rose-50 dark:bg-rose-900/20 text-rose-600';
  if (s === 'MANAGER_APPROVED' || s === 'PENDING_HR') return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600';
  return 'bg-amber-50 dark:bg-amber-900/20 text-amber-600';
};

const fmt = (d: string) => new Date(d).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' });

// ─────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────────────────────────────────────
type TabId = 'leave' | 'loan' | 'schedule' | 'swap' | 'weekend';

interface Tab { id: TabId; label: string; icon: React.ElementType; pendingCount?: number }

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const RequestsHub: React.FC = () => {
  const {
    currentUser, leaves, applyLeave, updateLeave, deleteLeave, users, units,
    loanRequests, applyLoan, reviewLoan,
    scheduleChangeRequests, requestScheduleChange, reviewScheduleChange,
    weekendWorkPermissions, requestWeekendWork, reviewWeekendWork,
  } = useHRM();
  const { getChain } = useApprovalFlow();
  const { swapRequests, visibleRequests: visibleSwaps, managerApprove, hrApprove, rejectSwapRequest, cancelSwapRequest, submitSwapRequest, isLoading: swapLoading } = useDutySwapRequests();

  const [activeTab, setActiveTab] = useState<TabId>('leave');
  const [search, setSearch] = useState('');

  const role = currentUser?.role;
  const isPrivileged = role === UserRole.DEVELOPER || role === UserRole.ADMIN || role === UserRole.CO_ADMIN;
  const isHR = role === UserRole.HR;
  const isManager = role === UserRole.MANAGER;
  const isEmployee = role === UserRole.EMPLOYEE;

  // ── Pending counts for tab badges ─────────────────────────────────────────
  const canApproveLeave = useCallback((leave: any) => {
    if (!currentUser) return false;
    if (leave.status === LeaveStatus.APPROVED || leave.status === LeaveStatus.REJECTED) return false;
    if (role === UserRole.DEVELOPER) return true;

    // Unit head approval: if requester has a unitId and the unit has a headUserId matching current user,
    // they can approve PENDING leaves from that unit before MANAGER
    const requester = users.find(u => u.id === leave.userId);
    if (requester?.unitId) {
      const unit = units.find(u => u.id === requester.unitId);
      if (unit?.headUserId === currentUser.id && leave.status === LeaveStatus.PENDING) return true;
    }

    const chain = getChain(leave.userRole);
    const myIdx = chain.findIndex((r: UserRole) => r === role);
    if (myIdx === -1) return false;
    if (myIdx === 0) return leave.status === LeaveStatus.PENDING || leave.status === LeaveStatus.UNIT_HEAD_APPROVED;
    const prevDone: Record<string, LeaveStatus> = {
      [UserRole.MANAGER]: LeaveStatus.MANAGER_APPROVED,
      [UserRole.HR]: LeaveStatus.HR_APPROVED,
      [UserRole.CO_ADMIN]: LeaveStatus.CO_ADMIN_APPROVED,
    };
    // also accept UNIT_HEAD_APPROVED as a valid prior state for the first chain member
    if (myIdx === 1 && leave.status === LeaveStatus.UNIT_HEAD_APPROVED) return true;
    return leave.status === prevDone[chain[myIdx - 1]];
  }, [currentUser, role, getChain, users, units]);

  const pendingLeave     = leaves.filter(canApproveLeave).length;
  const pendingLoan      = isPrivileged ? loanRequests.filter(l => l.status === 'PENDING').length : 0;
  const pendingSchedule  = useMemo(() => {
    if (!currentUser) return 0;
    return scheduleChangeRequests.filter(r => {
      if (r.status === 'APPROVED' || r.status === 'REJECTED') return false;
      if (role === UserRole.DEVELOPER || isPrivileged || isHR) return true;
      if (isManager) return r.status === 'PENDING' && r.department === currentUser.department && r.userId !== currentUser.id;
      return false;
    }).length;
  }, [scheduleChangeRequests, currentUser, role, isPrivileged, isHR, isManager]);
  const pendingSwap      = useMemo(() => visibleSwaps().filter(r => {
    if (r.status !== 'PENDING_MANAGER' && r.status !== 'PENDING_HR') return false;
    if (role === UserRole.DEVELOPER || isPrivileged || isHR) return true;
    if (isManager) return r.status === 'PENDING_MANAGER' && r.requesterDepartment === currentUser?.department;
    return false;
  }).length, [visibleSwaps, role, isPrivileged, isHR, isManager, currentUser]);

  const pendingWeekend = useMemo(() => {
    if (!currentUser) return 0;
    if (isEmployee) return 0;
    return weekendWorkPermissions.filter(p => p.status === 'PENDING').length;
  }, [weekendWorkPermissions, currentUser, isEmployee]);

  const tabs: Tab[] = [
    { id: 'leave',    label: 'Leave',          icon: Calendar,        pendingCount: pendingLeave    },
    { id: 'loan',     label: 'Loan & Advance',  icon: Banknote,        pendingCount: pendingLoan     },
    { id: 'schedule', label: 'Schedule Change', icon: Clock,           pendingCount: pendingSchedule },
    { id: 'swap',     label: 'Duty Swap',       icon: ArrowLeftRight,  pendingCount: pendingSwap     },
    { id: 'weekend',  label: 'Weekend Work',    icon: CalendarCheck2,  pendingCount: pendingWeekend  },
  ];

  const totalPending = pendingLeave + pendingLoan + pendingSchedule + pendingSwap + pendingWeekend;

  return (
    <div className="space-y-6 pb-20 animate-[fadeIn_0.4s_ease-out]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            Requests Hub
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-base font-medium">
            All requests, approvals and workflows in one place.
          </p>
        </div>
        {totalPending > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl">
            <Timer size={14} className="text-amber-500" />
            <span className="text-xs font-black text-amber-600 uppercase tracking-widest">
              {totalPending} pending your action
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearch(''); }}
            className={`flex-shrink-0 flex items-center gap-2.5 px-5 py-3 text-xs font-black uppercase tracking-widest transition-all border-2 rounded-2xl ${
              activeTab === tab.id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xl'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400 dark:hover:border-slate-500'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {(tab.pendingCount ?? 0) > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                activeTab === tab.id ? 'bg-[#E31E24] text-white' : 'bg-amber-400 text-white'
              }`}>
                {tab.pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()} requests...`}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all outline-none rounded-2xl"
        />
      </div>

      {/* Tab panels */}
      {activeTab === 'leave'    && <LeaveTab    search={search} canApproveLeave={canApproveLeave} getChain={getChain} />}
      {activeTab === 'loan'     && <LoanSection />}
      {activeTab === 'schedule' && <ScheduleTab search={search} />}
      {activeTab === 'swap'     && <SwapTab     search={search} visibleSwaps={visibleSwaps} managerApprove={managerApprove} hrApprove={hrApprove} rejectSwap={rejectSwapRequest} cancelSwap={cancelSwapRequest} submitSwap={submitSwapRequest} swapLoading={swapLoading} />}
      {activeTab === 'weekend'  && <WeekendWorkTab search={search} permissions={weekendWorkPermissions} reviewWeekendWork={reviewWeekendWork} requestWeekendWork={requestWeekendWork} />}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Leave Tab
// ─────────────────────────────────────────────────────────────────────────────
const LeaveTab: React.FC<{ search: string; canApproveLeave: (l: any) => boolean; getChain: (r: UserRole) => UserRole[] }> = ({ search, canApproveLeave, getChain }) => {
  const { leaves, currentUser, applyLeave, updateLeave, deleteLeave, users, units } = useHRM();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState(LEAVE_TYPES[0]);
  const [reason, setReason] = useState('');

  const role = currentUser?.role;
  const isPrivileged = role === UserRole.DEVELOPER || role === UserRole.ADMIN || role === UserRole.CO_ADMIN;
  const isHR = role === UserRole.HR;
  const isManager = role === UserRole.MANAGER;

  // Find units where current user is the unit head
  const myHeadUnitIds = units.filter(u => u.headUserId === currentUser?.id).map(u => u.id);
  const isUnitHead = myHeadUnitIds.length > 0;

  const visible = useMemo(() => {
    let list = leaves;
    if (!isPrivileged) {
      if (isHR) {
        list = list.filter(l => l.userId === currentUser?.id || l.userRole === UserRole.EMPLOYEE || l.userRole === UserRole.MANAGER);
      } else if (isManager) {
        list = list.filter(l => l.userId === currentUser?.id || (l.userRole === UserRole.EMPLOYEE && l.department === currentUser?.department));
      } else if (isUnitHead) {
        // Unit heads see their own leaves + leaves from employees in their units
        const unitEmployeeIds = users.filter(u => u.unitId && myHeadUnitIds.includes(u.unitId)).map(u => u.id);
        list = list.filter(l => l.userId === currentUser?.id || unitEmployeeIds.includes(l.userId));
      } else {
        list = list.filter(l => l.userId === currentUser?.id);
      }
    }
    if (filterStatus !== 'ALL') list = list.filter(l => l.status === filterStatus);
    if (search) list = list.filter(l => l.userName.toLowerCase().includes(search.toLowerCase()) || l.type.toLowerCase().includes(search.toLowerCase()) || l.userId.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [leaves, currentUser, isPrivileged, isHR, isManager, isUnitHead, myHeadUnitIds, users, filterStatus, search]);

  const handleApprove = async (leave: any) => {
    if (!currentUser) return;

    // Check if approver is the unit head for this leave's requester
    const requester = users.find(u => u.id === leave.userId);
    if (requester?.unitId && myHeadUnitIds.includes(requester.unitId) && leave.status === LeaveStatus.PENDING) {
      await updateLeave(leave.id, LeaveStatus.UNIT_HEAD_APPROVED);
      return;
    }

    const chain = getChain(leave.userRole);
    const STATUS_MAP: Partial<Record<UserRole, LeaveStatus>> = {
      [UserRole.MANAGER]: LeaveStatus.MANAGER_APPROVED,
      [UserRole.HR]: LeaveStatus.HR_APPROVED,
      [UserRole.CO_ADMIN]: LeaveStatus.CO_ADMIN_APPROVED,
      [UserRole.ADMIN]: LeaveStatus.APPROVED,
      [UserRole.DEVELOPER]: LeaveStatus.APPROVED,
    };
    const myIdx = chain.findIndex((r: UserRole) => r === role);
    const isLastStep = myIdx === chain.length - 1 || role === UserRole.DEVELOPER;
    const nextStatus = isLastStep ? LeaveStatus.APPROVED : (STATUS_MAP[role!] || LeaveStatus.APPROVED);
    await updateLeave(leave.id, nextStatus);
  };

  const pendingForMe = visible.filter(canApproveLeave).length;

  return (
    <div className="space-y-5">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl border-2 transition-all ${filterStatus === s ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'}`}>
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {!isPrivileged && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] transition-all shadow-lg shadow-red-900/20">
            <Plus size={14} /> New Leave Request
          </button>
        )}
      </div>

      {pendingForMe > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl">
          <Timer size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs font-black text-amber-600">{pendingForMe} leave request{pendingForMe > 1 ? 's' : ''} waiting for your approval</p>
        </div>
      )}

      {/* Request cards */}
      <div className="space-y-3">
        {visible.length === 0 && <EmptyState label="leave requests" />}
        {visible.map(leave => {
          const myTurn = canApproveLeave(leave);
          const expanded = expandedId === leave.id;
          const chain = getChain(leave.userRole);
          return (
            <div key={leave.id}
              className={`bg-white dark:bg-slate-900 rounded-[1.5rem] border-2 overflow-hidden soft-shadow transition-all ${myTurn ? 'border-amber-300 dark:border-amber-700' : 'border-slate-100 dark:border-slate-800'}`}>
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-sm text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {(leave.userName || 'U').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-slate-900 dark:text-white text-sm">{leave.userName}</p>
                      <span className="text-[9px] text-slate-400 font-bold">{leave.userId} · {leave.department}</span>
                      {myTurn && <span className="flex items-center gap-1 text-[9px] font-black text-amber-500 uppercase tracking-widest"><Timer size={9} /> Your turn</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge color={statusLeaveColor(leave.status)}>{getLeaveStatusLabel(leave.status)}</Badge>
                      <Badge color="bg-slate-100 dark:bg-slate-800 text-slate-500">{leave.type}</Badge>
                      <Badge color="bg-slate-50 dark:bg-slate-800/50 text-slate-400">{fmt(leave.startDate)} → {fmt(leave.endDate)}</Badge>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {myTurn && (
                      <>
                        <button onClick={() => handleApprove(leave)}
                          className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg" title="Approve">
                          <Check size={14} />
                        </button>
                        <button onClick={() => { setRejectingId(leave.id); setRejectionReason(''); }}
                          className="p-2.5 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all shadow-lg" title="Reject">
                          <X size={14} />
                        </button>
                      </>
                    )}
                    {leave.userId === currentUser?.id && leave.status === 'PENDING' && (
                      <button onClick={() => deleteLeave(leave.id)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all" title="Cancel">
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button onClick={() => setExpandedId(expanded ? null : leave.id)}
                      className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Approval progress bar */}
                {chain.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-4 pl-14">
                    {chain.map((r: UserRole, i: number) => {
                      const approvedBy: Record<string, string | undefined> = {
                        [UserRole.MANAGER]: leave.managerApprovedBy,
                        [UserRole.HR]: leave.hrApprovedBy,
                        [UserRole.CO_ADMIN]: leave.coAdminApprovedBy,
                        [UserRole.ADMIN]: leave.finalApprovedBy,
                        [UserRole.DEVELOPER]: leave.finalApprovedBy,
                      };
                      const done = !!approvedBy[r] || leave.status === LeaveStatus.APPROVED;
                      const rejected = leave.status === LeaveStatus.REJECTED;
                      const label = r === UserRole.CO_ADMIN ? 'Co-Admin' : r.charAt(0) + r.slice(1).toLowerCase();
                      return (
                        <React.Fragment key={r}>
                          {i > 0 && <ArrowRight size={9} className="text-slate-300 flex-shrink-0" />}
                          <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border rounded-lg flex-shrink-0 ${
                            rejected ? 'bg-rose-50 text-rose-400 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30'
                            : done ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30'
                            : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                          }`}>{label} {done && !rejected && '✓'}</span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Expanded */}
              {expanded && (
                <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed italic">"{leave.reason}"</p>
                  {leave.rejectionReason && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/30">
                      <p className="text-[9px] font-black uppercase text-rose-500 mb-1">Rejected by {leave.rejectedBy}</p>
                      <p className="text-xs text-rose-600">{leave.rejectionReason}</p>
                    </div>
                  )}
                  {(leave.managerApprovedBy || leave.hrApprovedBy || leave.coAdminApprovedBy || leave.finalApprovedBy) && (
                    <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
                      {leave.managerApprovedBy && <span>Manager: <b className="text-slate-700 dark:text-slate-300">{leave.managerApprovedBy}</b></span>}
                      {leave.hrApprovedBy && <span>HR: <b className="text-slate-700 dark:text-slate-300">{leave.hrApprovedBy}</b></span>}
                      {leave.coAdminApprovedBy && <span>Co-Admin: <b className="text-slate-700 dark:text-slate-300">{leave.coAdminApprovedBy}</b></span>}
                      {leave.finalApprovedBy && <span>Approved by: <b className="text-emerald-600">{leave.finalApprovedBy}</b></span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New leave modal */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <p className="font-black text-slate-900 dark:text-white">New Leave Request</p>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              if (!currentUser) return;
              await applyLeave({ userId: currentUser.id, startDate, endDate, type, reason });
              setShowForm(false); setStartDate(''); setEndDate(''); setReason(''); setType(LEAVE_TYPES[0]);
            }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">From</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">To</label>
                  <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className={inputCls} /></div>
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Type</label>
                <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
                  {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reason</label>
                <textarea required rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe your reason..." className={inputCls + ' resize-none'} /></div>
              <button type="submit" className="w-full py-3.5 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] transition-all">
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-2xl"><AlertTriangle size={18} className="text-rose-500" /></div>
              <p className="font-black text-slate-900 dark:text-white">Reject Leave?</p>
            </div>
            <textarea rows={3} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
              placeholder="Reason (optional)..." className={inputCls + ' resize-none'} />
            <div className="flex gap-2">
              <button onClick={() => setRejectingId(null)} className="flex-1 py-3 text-xs font-black uppercase border-2 border-slate-200 dark:border-slate-700 text-slate-500 rounded-2xl">Cancel</button>
              <button onClick={async () => { await updateLeave(rejectingId!, LeaveStatus.REJECTED, rejectionReason); setRejectingId(null); setRejectionReason(''); }}
                className="flex-1 py-3 text-xs font-black uppercase bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-all">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Loan & Advance Tab
// ─────────────────────────────────────────────────────────────────────────────
const LoanTab: React.FC<{ search: string }> = ({ search }) => {
  const { currentUser, loanRequests, applyLoan, reviewLoan } = useHRM();
  const [showForm, setShowForm] = useState(false);
  const [loanType, setLoanType] = useState<'LOAN' | 'ADVANCE_SALARY'>('LOAN');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const role = currentUser?.role;
  const isPrivileged = role === UserRole.DEVELOPER || role === UserRole.ADMIN || role === UserRole.CO_ADMIN;

  const visible = useMemo(() => {
    let list = isPrivileged ? loanRequests : loanRequests.filter(l => l.userId === currentUser?.id);
    if (search) list = list.filter(l => l.userName.toLowerCase().includes(search.toLowerCase()) || l.department.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [loanRequests, currentUser, isPrivileged, search]);

  const pending = visible.filter(l => l.status === 'PENDING');
  const myPending = loanRequests.find(l => l.userId === currentUser?.id && l.status === 'PENDING');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        {isPrivileged && pending.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl">
            <Timer size={13} className="text-amber-500" />
            <span className="text-[11px] font-black text-amber-600">{pending.length} pending review</span>
          </div>
        )}
        {!isPrivileged && !myPending && (
          <button onClick={() => { setShowForm(true); setMsg(''); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] transition-all shadow-lg shadow-red-900/20 ml-auto">
            <Plus size={14} /> Apply for Loan / Advance
          </button>
        )}
      </div>

      <div className="space-y-3">
        {visible.length === 0 && <EmptyState label="loan or advance requests" />}
        {visible.map(req => (
          <div key={req.id} className={`bg-white dark:bg-slate-900 rounded-[1.5rem] border-2 soft-shadow p-5 ${req.status === 'PENDING' && isPrivileged ? 'border-amber-200 dark:border-amber-800' : 'border-slate-100 dark:border-slate-800'}`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-sm text-slate-600 dark:text-slate-300 flex-shrink-0">
                {req.type === 'LOAN' ? '💰' : '⚡'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-slate-900 dark:text-white text-sm">{req.userName}</p>
                  <span className="text-[9px] text-slate-400 font-bold">{req.department}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge color={statusGenericColor(req.status)}>{req.status.toLowerCase()}</Badge>
                  <Badge color="bg-slate-100 dark:bg-slate-800 text-slate-500">{req.type === 'LOAN' ? 'Loan' : 'Advance Salary'}</Badge>
                  <Badge color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">৳{req.amount.toLocaleString()}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-2 italic">"{req.reason}"</p>
                {req.reviewedBy && <p className="text-[10px] text-slate-400 mt-1">Reviewed by <b className="text-slate-600 dark:text-slate-300">{req.reviewedBy}</b>{req.reviewNote && ` — ${req.reviewNote}`}</p>}
              </div>
              {isPrivileged && req.status === 'PENDING' && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={async () => { await reviewLoan(req.id, 'APPROVED', reviewNote); }}
                    className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg" title="Approve">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setReviewingId(req.id)}
                    className="p-2.5 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all shadow-lg" title="Reject">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Apply modal */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <p className="font-black text-slate-900 dark:text-white">Apply for Loan / Advance</p>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(['LOAN', 'ADVANCE_SALARY'] as const).map(t => (
                  <button key={t} onClick={() => setLoanType(t)}
                    className={`py-2.5 text-xs font-black uppercase tracking-widest border-2 rounded-xl transition-all ${loanType === t ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10 text-[#E31E24]' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                    {t === 'LOAN' ? '💰 Loan' : '⚡ Advance'}
                  </button>
                ))}
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Amount (৳)</label>
                <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={inputCls} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reason</label>
                <textarea required rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why do you need this?" className={inputCls + ' resize-none'} /></div>
              {msg && <p className={`text-xs font-bold p-3 rounded-xl ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{msg}</p>}
              <button disabled={submitting} onClick={async () => {
                setSubmitting(true); setMsg('');
                const res = await applyLoan(loanType, parseFloat(amount), reason);
                setMsg(res.success ? '✅ Request submitted.' : `❌ ${res.message}`);
                if (res.success) { setShowForm(false); setAmount(''); setReason(''); }
                setSubmitting(false);
              }} className="w-full py-3.5 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject with note modal */}
      {reviewingId && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl p-6 space-y-4">
            <p className="font-black text-slate-900 dark:text-white">Reject with Note</p>
            <textarea rows={3} value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Reason for rejection..." className={inputCls + ' resize-none'} />
            <div className="flex gap-2">
              <button onClick={() => { setReviewingId(null); setReviewNote(''); }} className="flex-1 py-3 text-xs font-black uppercase border-2 border-slate-200 dark:border-slate-700 text-slate-500 rounded-2xl">Cancel</button>
              <button onClick={async () => { await reviewLoan(reviewingId!, 'REJECTED', reviewNote); setReviewingId(null); setReviewNote(''); }}
                className="flex-1 py-3 text-xs font-black uppercase bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-all">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Schedule Change Tab
// ─────────────────────────────────────────────────────────────────────────────
const ScheduleTab: React.FC<{ search: string }> = ({ search }) => {
  const { currentUser, scheduleChangeRequests, requestScheduleChange, reviewScheduleChange } = useHRM();
  const [showForm, setShowForm] = useState(false);
  const [changeType, setChangeType] = useState<ScheduleChangeType>('PERMANENT');
  const [checkIn, setCheckIn] = useState('09:00');
  const [checkOut, setCheckOut] = useState('18:00');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const role = currentUser?.role;
  const isAdmin = role === UserRole.ADMIN || role === UserRole.DEVELOPER || role === UserRole.CO_ADMIN;
  const isHR = role === UserRole.HR;
  const isManager = role === UserRole.MANAGER;

  const visible = useMemo(() => {
    let list = scheduleChangeRequests;
    if (!isAdmin) {
      if (isHR) list = list;
      else if (isManager) list = list.filter(r => r.userId === currentUser?.id || (r.department === currentUser?.department && r.status === 'PENDING'));
      else list = list.filter(r => r.userId === currentUser?.id);
    }
    if (search) list = list.filter(r => r.userName.toLowerCase().includes(search.toLowerCase()) || r.department.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [scheduleChangeRequests, currentUser, isAdmin, isHR, isManager, search]);

  const canApprove = (r: ScheduleChangeRequest) => {
    if (r.status === 'APPROVED' || r.status === 'REJECTED') return false;
    if (role === UserRole.DEVELOPER) return true;
    if (isAdmin) return r.status === 'PENDING' || r.status === 'MANAGER_APPROVED';
    if (isHR) return r.status === 'MANAGER_APPROVED';
    if (isManager) return r.status === 'PENDING' && r.department === currentUser?.department && r.userId !== currentUser?.id;
    return false;
  };

  const handleApprove = async (r: ScheduleChangeRequest) => {
    if (isManager && r.status === 'PENDING') await reviewScheduleChange(r.id, 'MANAGER_APPROVED');
    else if ((isHR || isAdmin) && r.status === 'MANAGER_APPROVED') await reviewScheduleChange(r.id, 'APPROVED');
    else if (isAdmin && r.status === 'PENDING') await reviewScheduleChange(r.id, 'APPROVED');
  };

  const pendingForMe = visible.filter(canApprove).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        {pendingForMe > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl">
            <Timer size={13} className="text-amber-500" />
            <span className="text-[11px] font-black text-amber-600">{pendingForMe} awaiting your approval</span>
          </div>
        )}
        <button onClick={() => { setShowForm(true); setMsg(''); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] transition-all shadow-lg shadow-red-900/20 ml-auto">
          <Plus size={14} /> Request Change
        </button>
      </div>

      <div className="space-y-3">
        {visible.length === 0 && <EmptyState label="schedule change requests" />}
        {visible.map(req => (
          <div key={req.id} className={`bg-white dark:bg-slate-900 rounded-[1.5rem] border-2 soft-shadow p-5 ${canApprove(req) ? 'border-amber-200 dark:border-amber-800' : 'border-slate-100 dark:border-slate-800'}`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg flex-shrink-0">🕐</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-slate-900 dark:text-white text-sm">{req.userName}</p>
                  <span className="text-[9px] text-slate-400 font-bold">{req.department}</span>
                  {canApprove(req) && <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1"><Timer size={9}/> Your turn</span>}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge color={statusGenericColor(req.status)}>{req.status.replace('_', ' ').toLowerCase()}</Badge>
                  <Badge color={req.changeType === 'PERMANENT' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}>{req.changeType.toLowerCase()}</Badge>
                  <Badge color="bg-slate-100 dark:bg-slate-800 text-slate-600">{req.requestedCheckIn} → {req.requestedCheckOut}</Badge>
                  {req.changeType === 'TEMPORARY' && req.startDate && (
                    <Badge color="bg-slate-50 dark:bg-slate-800/50 text-slate-400">{fmt(req.startDate)} – {fmt(req.endDate!)}</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2 italic">"{req.reason}"</p>
                {req.rejectionReason && <p className="text-[10px] text-rose-500 mt-1">Rejected: {req.rejectionReason}</p>}
                {req.managerApprovedBy && <p className="text-[10px] text-blue-500 mt-0.5">✓ Manager: {req.managerApprovedBy}</p>}
                {req.hrApprovedBy && <p className="text-[10px] text-emerald-500 mt-0.5">✓ HR: {req.hrApprovedBy}</p>}
              </div>
              {canApprove(req) && rejectingId !== req.id && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApprove(req)} className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg" title="Approve"><Check size={14} /></button>
                  <button onClick={() => { setRejectingId(req.id); setRejectReason(''); }} className="p-2.5 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all shadow-lg" title="Reject"><X size={14} /></button>
                </div>
              )}
            </div>
            {rejectingId === req.id && (
              <div className="mt-4 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason..." className={inputCls} />
                <div className="flex gap-2">
                  <button onClick={async () => { await reviewScheduleChange(req.id, 'REJECTED', rejectReason); setRejectingId(null); }} className="px-4 py-2 bg-rose-500 text-white text-xs font-black uppercase rounded-xl">Confirm Reject</button>
                  <button onClick={() => setRejectingId(null)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-black uppercase rounded-xl">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Request form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <p className="font-black text-slate-900 dark:text-white">Request Schedule Change</p>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault(); if (!currentUser) return;
              setSubmitting(true); setMsg('');
              const res = await requestScheduleChange({ userId: currentUser.id, userName: currentUser.name, department: currentUser.department, changeType, requestedCheckIn: checkIn, requestedCheckOut: checkOut, startDate: changeType === 'TEMPORARY' ? startDate : undefined, endDate: changeType === 'TEMPORARY' ? endDate : undefined, reason });
              setSubmitting(false);
              if (res.success) { setMsg('✅ Request submitted.'); setShowForm(false); }
              else setMsg(`❌ ${res.message}`);
            }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(['PERMANENT', 'TEMPORARY'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setChangeType(t)}
                    className={`py-2.5 text-xs font-black uppercase tracking-widest border-2 rounded-xl transition-all ${changeType === t ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10 text-[#E31E24]' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                    {t === 'PERMANENT' ? '♾ Permanent' : '📅 Temporary'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Check-in</label>
                  <input type="time" required value={checkIn} onChange={e => setCheckIn(e.target.value)} className={inputCls} /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Check-out</label>
                  <input type="time" required value={checkOut} onChange={e => setCheckOut(e.target.value)} className={inputCls} /></div>
              </div>
              {changeType === 'TEMPORARY' && (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">From</label>
                    <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className={inputCls} /></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">To</label>
                    <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className={inputCls} /></div>
                </div>
              )}
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reason</label>
                <textarea required rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why do you need this change?" className={inputCls + ' resize-none'} /></div>
              {msg && <p className={`text-xs font-bold p-3 rounded-xl ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{msg}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3.5 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Duty Swap Tab
// ─────────────────────────────────────────────────────────────────────────────
const SwapTab: React.FC<{
  search: string;
  visibleSwaps: () => any[];
  managerApprove: (id: string) => Promise<any>;
  hrApprove: (id: string) => Promise<any>;
  rejectSwap: (id: string, reason: string) => Promise<any>;
  cancelSwap: (id: string) => Promise<any>;
  submitSwap: (input: any) => Promise<any>;
  swapLoading: boolean;
}> = ({ search, visibleSwaps, managerApprove, hrApprove, rejectSwap, cancelSwap, submitSwap, swapLoading }) => {
  const { currentUser, users } = useHRM();
  const [showForm, setShowForm] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [myCheckIn, setMyCheckIn] = useState('09:00');
  const [myCheckOut, setMyCheckOut] = useState('18:00');
  const [theirCheckIn, setTheirCheckIn] = useState('09:00');
  const [theirCheckOut, setTheirCheckOut] = useState('18:00');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const role = currentUser?.role;
  const isPrivileged = role === UserRole.DEVELOPER || role === UserRole.ADMIN;
  const isHR = role === UserRole.HR;
  const isManager = role === UserRole.MANAGER;

  const swaps = useMemo(() => {
    let list = visibleSwaps();
    if (search) list = list.filter((r: any) => r.requesterName.toLowerCase().includes(search.toLowerCase()) || r.targetName.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [visibleSwaps, search]);

  const canMgrApprove = (r: any) => r.status === 'PENDING_MANAGER' && isManager && r.requesterDepartment === currentUser?.department;
  const canHrApprove = (r: any) => r.status === 'PENDING_HR' && (isHR || isPrivileged);
  const canReject = (r: any) => (canMgrApprove(r) || canHrApprove(r) || (role === UserRole.DEVELOPER));
  const canCancel = (r: any) => r.requesterId === currentUser?.id && ['PENDING_MANAGER', 'PENDING_HR'].includes(r.status);

  const colleagues = users.filter(u => u.id !== currentUser?.id && u.department === currentUser?.department);
  const pendingForMe = swaps.filter((r: any) => canMgrApprove(r) || canHrApprove(r)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        {pendingForMe > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl">
            <Timer size={13} className="text-amber-500" />
            <span className="text-[11px] font-black text-amber-600">{pendingForMe} swap{pendingForMe > 1 ? 's' : ''} awaiting action</span>
          </div>
        )}
        <button onClick={() => { setShowForm(true); setMsg(''); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] transition-all shadow-lg shadow-red-900/20 ml-auto">
          <Plus size={14} /> Request Duty Swap
        </button>
      </div>

      {swapLoading && <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-slate-400" /></div>}

      <div className="space-y-3">
        {!swapLoading && swaps.length === 0 && <EmptyState label="duty swap requests" />}
        {swaps.map((req: any) => (
          <div key={req.id} className={`bg-white dark:bg-slate-900 rounded-[1.5rem] border-2 soft-shadow p-5 ${(canMgrApprove(req) || canHrApprove(req)) ? 'border-amber-200 dark:border-amber-800' : 'border-slate-100 dark:border-slate-800'}`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg flex-shrink-0">🔄</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-slate-900 dark:text-white text-sm">
                    {req.requesterName} <ArrowLeftRight size={12} className="inline text-slate-400 mx-1" /> {req.targetName}
                  </p>
                  {(canMgrApprove(req) || canHrApprove(req)) && <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1"><Timer size={9}/> Your turn</span>}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge color={statusGenericColor(req.status)}>
                    {req.status === 'PENDING_MANAGER' ? 'Pending Manager' : req.status === 'PENDING_HR' ? 'Pending HR' : req.status.toLowerCase()}
                  </Badge>
                  <Badge color="bg-slate-50 dark:bg-slate-800/50 text-slate-400">{fmt(req.startDate)} – {fmt(req.endDate)}</Badge>
                  {req.isHrDirect && <Badge color="bg-violet-50 dark:bg-violet-900/20 text-violet-600">HR Direct</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{req.requesterName}</p>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">{req.requesterSchedule?.checkInTime} – {req.requesterSchedule?.checkOutTime}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{req.targetName}</p>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">{req.targetSchedule?.checkInTime} – {req.targetSchedule?.checkOutTime}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2 italic">"{req.reason}"</p>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {canMgrApprove(req) && (
                  <button onClick={() => managerApprove(req.id)} className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg" title="Manager Approve"><Check size={14} /></button>
                )}
                {canHrApprove(req) && (
                  <button onClick={() => hrApprove(req.id)} className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg" title="HR Approve"><Check size={14} /></button>
                )}
                {canReject(req) && rejectingId !== req.id && (
                  <button onClick={() => { setRejectingId(req.id); setRejectReason(''); }} className="p-2.5 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all shadow-lg" title="Reject"><X size={14} /></button>
                )}
                {canCancel(req) && (
                  <button onClick={() => cancelSwap(req.id)} className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all" title="Cancel"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
            {rejectingId === req.id && (
              <div className="mt-4 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason..." className={inputCls} />
                <div className="flex gap-2">
                  <button onClick={async () => { await rejectSwap(req.id, rejectReason); setRejectingId(null); }} className="px-4 py-2 bg-rose-500 text-white text-xs font-black uppercase rounded-xl">Confirm Reject</button>
                  <button onClick={() => setRejectingId(null)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-black uppercase rounded-xl">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submit swap modal */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <p className="font-black text-slate-900 dark:text-white">Request Duty Swap</p>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault(); if (!currentUser) return;
              const target = users.find(u => u.id === targetId);
              if (!target) return;
              setSubmitting(true); setMsg('');
              const res = await submitSwap({
                targetId, targetName: target.name, targetDepartment: target.department,
                startDate, endDate,
                requesterSchedule: { checkInTime: myCheckIn, checkOutTime: myCheckOut, graceMinutes: 5, earlyCheckInMinutes: 30 },
                targetSchedule: { checkInTime: theirCheckIn, checkOutTime: theirCheckOut, graceMinutes: 5, earlyCheckInMinutes: 30 },
                reason,
              });
              setSubmitting(false);
              if (res.success) { setMsg('✅ Swap request submitted.'); setTimeout(() => { setShowForm(false); setMsg(''); }, 1500); }
              else setMsg(`❌ ${res.message}`);
            }} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Swap With</label>
                <select required value={targetId} onChange={e => setTargetId(e.target.value)} className={inputCls}>
                  <option value="">Select colleague...</option>
                  {colleagues.map(u => <option key={u.id} value={u.id}>{u.name} — {u.department}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">From</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className={inputCls} /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">To</label>
                  <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">My New Shift</p>
                  <div className="space-y-2">
                    <input type="time" value={myCheckIn} onChange={e => setMyCheckIn(e.target.value)} className={inputCls} placeholder="Check-in" />
                    <input type="time" value={myCheckOut} onChange={e => setMyCheckOut(e.target.value)} className={inputCls} placeholder="Check-out" />
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Their New Shift</p>
                  <div className="space-y-2">
                    <input type="time" value={theirCheckIn} onChange={e => setTheirCheckIn(e.target.value)} className={inputCls} placeholder="Check-in" />
                    <input type="time" value={theirCheckOut} onChange={e => setTheirCheckOut(e.target.value)} className={inputCls} placeholder="Check-out" />
                  </div>
                </div>
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reason</label>
                <textarea required rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why do you need this swap?" className={inputCls + ' resize-none'} /></div>
              {msg && <p className={`text-xs font-bold p-3 rounded-xl ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{msg}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3.5 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : 'Submit Swap Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
    <p className="text-3xl mb-3">📭</p>
    <p className="text-sm font-bold text-slate-400">No {label} found.</p>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Weekend Work Tab
// ─────────────────────────────────────────────────────────────────────────────
const WeekendWorkTab: React.FC<{
  search: string;
  permissions: any[];
  reviewWeekendWork: (id: string, status: 'APPROVED' | 'REJECTED', note?: string) => Promise<{ success: boolean; message: string }>;
  requestWeekendWork: (date: string, reason: string) => Promise<{ success: boolean; message: string }>;
}> = ({ search, permissions, reviewWeekendWork, requestWeekendWork }) => {
  const { currentUser } = useHRM();
  const role = currentUser?.role;
  const isPrivileged = role === UserRole.DEVELOPER || role === UserRole.ADMIN ||
    role === UserRole.CO_ADMIN || role === UserRole.HR;
  const isEmployee = role === UserRole.EMPLOYEE;

  const [showForm, setShowForm] = useState(false);
  const [reqDate, setReqDate] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);

  // Employees see their own; HR/Admin see all pending
  const visible = permissions.filter(p => {
    if (isEmployee) return p.userId === currentUser?.id;
    const matchSearch = !search || p.userName.toLowerCase().includes(search.toLowerCase()) || p.date.includes(search);
    return matchSearch;
  });

  const handleSubmit = async () => {
    if (!reqDate || !reqReason.trim()) return;
    setSubmitting(true);
    const res = await requestWeekendWork(reqDate, reqReason.trim());
    setSubmitting(false);
    setResult(res);
    if (res.success) { setShowForm(false); setReqDate(''); setReqReason(''); }
  };

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setReviewing(id);
    await reviewWeekendWork(id, status, reviewNote[id]);
    setReviewing(null);
  };

  return (
    <div className="space-y-5">
      {/* Info + request button */}
      <div className="flex items-start justify-between gap-4">
        <div className="p-4 flex-1 bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-900/30 rounded-2xl text-xs text-teal-700 dark:text-teal-400 font-medium">
          <p className="font-black mb-1">Weekend Work Permission</p>
          <p>Employees must get HR/Admin approval before checking in on a weekend. Approved employees receive extra pay for that day.</p>
        </div>
        {isEmployee && (
          <button onClick={() => setShowForm(v => !v)}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-900/20">
            <Plus size={14} /> Request
          </button>
        )}
      </div>

      {/* Request form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 border-2 border-[#E31E24] rounded-2xl p-6 space-y-4 animate-[fadeIn_0.2s_ease-out]">
          <p className="text-sm font-black text-slate-900 dark:text-white">Request Weekend Work Permission</p>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Date (must be your weekend)</label>
            <input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)}
              className={inputCls + ' rounded-xl'} min={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Reason</label>
            <textarea value={reqReason} onChange={e => setReqReason(e.target.value)} rows={3}
              placeholder="Explain why you need to work this weekend..."
              className={inputCls + ' rounded-xl resize-none'} />
          </div>
          {result && !result.ok && (
            <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{result.msg}</p>
          )}
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-xs uppercase rounded-2xl">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting || !reqDate || !reqReason.trim()}
              className="flex-[2] py-3 bg-[#E31E24] text-white font-black text-xs uppercase rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><RefreshCw size={12} className="animate-spin" /> Submitting...</> : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {visible.length === 0 ? (
        <EmptyState label="weekend work requests" />
      ) : (
        <div className="space-y-3">
          {visible.map(p => (
            <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900 dark:text-white">{p.userName}</p>
                  <p className="text-xs text-slate-400 font-medium">{p.department} · {p.date}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{p.reason}</p>
                </div>
                <span className={`flex-shrink-0 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-xl ${
                  p.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                  p.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' :
                  'bg-amber-50 text-amber-600'
                }`}>{p.status}</span>
              </div>
              {p.reviewNote && (
                <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl">
                  Note: {p.reviewNote}
                </p>
              )}
              {/* Review controls for HR/Admin */}
              {p.status === 'PENDING' && isPrivileged && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <input value={reviewNote[p.id] || ''} onChange={e => setReviewNote(n => ({ ...n, [p.id]: e.target.value }))}
                    placeholder="Optional note..." className={inputCls + ' rounded-xl text-xs py-2'} />
                  <div className="flex gap-2">
                    <button onClick={() => handleReview(p.id, 'REJECTED')} disabled={reviewing === p.id}
                      className="flex-1 py-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 font-black text-xs uppercase rounded-xl border-2 border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                      <XCircle size={12} /> Reject
                    </button>
                    <button onClick={() => handleReview(p.id, 'APPROVED')} disabled={reviewing === p.id}
                      className="flex-[2] py-2.5 bg-emerald-500 text-white font-black text-xs uppercase rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {reviewing === p.id ? <><RefreshCw size={12} className="animate-spin" /> Saving...</> : <><CheckCircle2 size={12} /> Approve</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RequestsHub;
