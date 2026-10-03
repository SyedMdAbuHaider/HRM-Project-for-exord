import React, { useState, useMemo } from 'react';
import { useHRM } from '../store';
import { Calendar, Plus, Check, X, Clock, FileText, ChevronDown, ChevronUp, AlertTriangle, Trash2 } from 'lucide-react';
import { LeaveStatus, UserRole, getLeaveStatusLabel } from '../types';
import { useApprovalFlow } from './ApprovalFlowView';
import { LEAVE_TYPES } from '../constants';

// ── Status badge config ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<LeaveStatus, { color: string; bg: string; icon: React.ElementType }> = {
  [LeaveStatus.PENDING]:           { color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20',   icon: Clock },
  [LeaveStatus.UNIT_HEAD_APPROVED]: { color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20', icon: Check },
  [LeaveStatus.MANAGER_APPROVED]:  { color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20',     icon: Check },
  [LeaveStatus.HR_APPROVED]:       { color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-900/20', icon: Check },
  [LeaveStatus.CO_ADMIN_APPROVED]: { color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-900/20', icon: Check },
  [LeaveStatus.APPROVED]:          { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: Check },
  [LeaveStatus.REJECTED]:          { color: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-900/20',     icon: X },
};

// ── Approval chain display (dynamic) ─────────────────────────────────────────
const ApprovalChainDisplay: React.FC<{ leave: import('../types').LeaveRequest; chain: UserRole[] }> = ({ leave, chain }) => {
  const approvedByMap: Partial<Record<UserRole, string | undefined>> = {
    [UserRole.MANAGER]:  leave.managerApprovedBy,
    [UserRole.HR]:       leave.hrApprovedBy,
    [UserRole.CO_ADMIN]: leave.coAdminApprovedBy,
    [UserRole.ADMIN]:    leave.finalApprovedBy,
    [UserRole.DEVELOPER]:leave.finalApprovedBy,
  };
  const roleLabel = (r: UserRole) => r === UserRole.CO_ADMIN ? 'Co-Admin' : r.charAt(0) + r.slice(1).toLowerCase();
  const steps = chain.map(r => ({ label: roleLabel(r), approvedBy: approvedByMap[r] }));
  const ApprovalChain: React.FC<{ leave: import('../types').LeaveRequest }> = ({ leave: _l }) => null; // compat shim

  if (steps.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mt-2">
      {steps.map((step, i) => {
        const isDone = !!step.approvedBy || leave.status === LeaveStatus.APPROVED;
        const isRejected = leave.status === LeaveStatus.REJECTED;
        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-slate-300 dark:text-slate-600 text-xs">→</span>}
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
              isRejected ? 'bg-rose-50 text-rose-400 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30' :
              isDone ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' :
              'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
            }`}>
              {step.label} {isDone && !isRejected && '✓'}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const LeavesView: React.FC = () => {
  const { leaves, currentUser, applyLeave, updateLeave, deleteLeave, users, hasPermission, sendNotification, getDelegateApprover, customRoles } = useHRM();
  const { getChain } = useApprovalFlow();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const role = currentUser?.role;
  const isAdmin     = role === UserRole.ADMIN;
  const isCoAdmin   = role === UserRole.CO_ADMIN;
  const isHR        = role === UserRole.HR;
  const isManager   = role === UserRole.MANAGER;
  const isEmployee  = role === UserRole.EMPLOYEE;

  // Form state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [type, setType]           = useState(LEAVE_TYPES[0]);
  const [reason, setReason]       = useState('');

  // Visible leaves
  const displayLeaves = useMemo(() => {
    if (isAdmin || isCoAdmin) return leaves;

    if (isHR) {
      return leaves.filter(l =>
        l.userId === currentUser?.id ||
        l.userRole === UserRole.EMPLOYEE ||
        l.userRole === UserRole.MANAGER
      );
    }

    if (isManager) {
      const myDept = currentUser?.department;
      return leaves.filter(l =>
        l.userId === currentUser?.id ||
        (l.userRole === UserRole.EMPLOYEE && l.department === myDept)
      );
    }

    // Custom-role users (Assistant Dept Manager, POP Incharge, AGM etc.)
    // Show dept leaves if they have approve_leaves permission
    if (currentUser && hasPermission(currentUser.id, 'approve_leaves')) {
      const myDept = currentUser.department;
      return leaves.filter(l =>
        l.userId === currentUser.id ||
        l.department === myDept
      );
    }

    // Employee sees only their own
    return leaves.filter(l => l.userId === currentUser?.id);
  }, [leaves, currentUser, isAdmin, isCoAdmin, isHR, isManager, hasPermission]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitError(null);
    const result = await applyLeave({ userId: currentUser.id, startDate, endDate, type, reason });
    if (result && !result.success) {
      setSubmitError(result.message);
      return;
    }
    setShowForm(false);
    setSubmitError(null);
    setStartDate(''); setEndDate(''); setReason(''); setType(LEAVE_TYPES[0]);
  };

  const handleApprove = async (leave: import('../types').LeaveRequest) => {
    if (!currentUser) return;
    const roleVal = currentUser.role as string;

    // Detect if current user is a custom-role delegate (not a built-in approver role)
    const isDelegate = !Object.values(UserRole).includes(roleVal as UserRole) ||
      (roleVal === UserRole.EMPLOYEE) ||
      (roleVal === UserRole.MANAGER && hasPermission(currentUser.id, 'approve_leaves') &&
        currentUser.id !== users.find(u => u.department === leave.department && u.role === UserRole.MANAGER)?.id);

    // Custom role delegate acting for their dept → MANAGER_APPROVED
    if (!Object.values(UserRole).includes(roleVal as UserRole)) {
      if (!canApprove(leave)) return;
      await updateLeave(leave.id, LeaveStatus.MANAGER_APPROVED);

      // Notify the real dept manager that a delegate approved on their behalf
      const realManager = users.find(u => u.department === leave.department && u.role === UserRole.MANAGER);
      if (realManager && realManager.id !== currentUser.id) {
        void sendNotification(
          realManager.id,
          '🔄 Leave Approved by Delegate',
          `${currentUser.name} approved ${leave.userName}'s leave request on your behalf (you were unavailable). Leave: ${leave.type} (${leave.startDate} – ${leave.endDate}).`,
          'LEAVE'
        );
      }
      return;
    }

    const chain = getChain(leave.userRole);
    if (chain.length === 0) return;

    const STATUS_MAP: Partial<Record<UserRole, LeaveStatus>> = {
      [UserRole.MANAGER]:  LeaveStatus.MANAGER_APPROVED,
      [UserRole.HR]:       LeaveStatus.HR_APPROVED,
      [UserRole.CO_ADMIN]: LeaveStatus.CO_ADMIN_APPROVED,
      [UserRole.ADMIN]:    LeaveStatus.APPROVED,
      [UserRole.DEVELOPER]:LeaveStatus.APPROVED,
    };

    const myIdx = chain.findIndex(r => r === currentUser.role);
    if (myIdx === -1 && currentUser.role !== UserRole.DEVELOPER) return;

    const myRole = currentUser.role;
    if (!canApproveNow(leave, chain, myRole)) return;

    const isLastStep = myIdx === chain.length - 1 || currentUser.role === UserRole.DEVELOPER;
    const nextStatus = isLastStep ? LeaveStatus.APPROVED : (STATUS_MAP[myRole] || LeaveStatus.APPROVED);
    await updateLeave(leave.id, nextStatus);

    // On final approval: notify AGM custom roles
    if (nextStatus === LeaveStatus.APPROVED) {
      const agmUsers = users.filter(u => {
        const cr = customRoles.find(r =>
          r.name.toLowerCase().includes('agm') ||
          r.name.toLowerCase().includes('assistant general manager')
        );
        return cr && hasPermission(u.id, 'requests');
      });
      for (const agm of agmUsers) {
        if (agm.id !== currentUser.id) {
          void sendNotification(
            agm.id,
            '✅ Leave Fully Approved',
            `${leave.userName}'s ${leave.type} leave (${leave.startDate} – ${leave.endDate}) has been fully approved by ${currentUser.name}.`,
            'LEAVE'
          );
        }
      }
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    await updateLeave(rejectingId, LeaveStatus.REJECTED, rejectionReason);
    setRejectingId(null);
    setRejectionReason('');
  };

  // Dynamic: check if it's this user's turn based on configured flow
  const canApproveNow = (leave: import('../types').LeaveRequest, chain: UserRole[], myRole: UserRole): boolean => {
    if (leave.status === LeaveStatus.APPROVED || leave.status === LeaveStatus.REJECTED) return false;
    if (myRole === UserRole.DEVELOPER) return true;
    const myIdx = chain.findIndex(r => r === myRole);
    if (myIdx === -1) return false;
    if (myIdx === 0) return leave.status === LeaveStatus.PENDING;
    // Previous step must be done
    const prevRole = chain[myIdx - 1];
    const prevDoneStatuses: Partial<Record<UserRole, LeaveStatus>> = {
      [UserRole.MANAGER]:  LeaveStatus.MANAGER_APPROVED,
      [UserRole.HR]:       LeaveStatus.HR_APPROVED,
      [UserRole.CO_ADMIN]: LeaveStatus.CO_ADMIN_APPROVED,
    };
    const prevDoneStatus = prevDoneStatuses[prevRole];
    if (!prevDoneStatus) return leave.status === LeaveStatus.PENDING;
    return leave.status === prevDoneStatus;
  };

  const canApprove = (leave: import('../types').LeaveRequest) => {
    if (!currentUser) return false;
    if (leave.status === LeaveStatus.APPROVED || leave.status === LeaveStatus.REJECTED) return false;

    const roleVal = currentUser.role as string;

    // Custom role users: if they've been granted 'approve_leaves' permission,
    // they act as an assistant manager / incharge for their dept when PENDING
    if (roleVal.startsWith('custom::') || (!Object.values(UserRole).includes(roleVal as UserRole) && hasPermission(currentUser.id, 'approve_leaves'))) {
      if (leave.status !== LeaveStatus.PENDING) return false;
      return leave.department === currentUser.department;
    }

    const chain = getChain(leave.userRole);
    return canApproveNow(leave, chain, currentUser.role);
  };

  const pendingForMe = displayLeaves.filter(l => canApprove(l)).length;

  return (
    <div className="space-y-10 animate-[fadeIn_0.4s_ease-out]">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Request Vault</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Multi-step leave approval workflow.</p>
        </div>
        <div className="flex items-center gap-4">
          {pendingForMe > 0 && (
            <span className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-100 dark:border-amber-900/40 text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Clock size={13} /> {pendingForMe} pending your action
            </span>
          )}
          {!isAdmin && !isCoAdmin && (
            <button onClick={() => setShowForm(true)}
              className="px-8 py-4 bg-[#E31E24] text-white font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-xl shadow-red-900/20 hover:bg-red-700 transition-all">
              <Plus size={18} /> New Request
            </button>
          )}
        </div>
      </div>

      {/* Approval chain guide */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Approval Chain Guide</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <p className="font-black text-slate-700 dark:text-slate-200 mb-1 uppercase tracking-widest">Employee</p>
            Manager → HR → Admin
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <p className="font-black text-slate-700 dark:text-slate-200 mb-1 uppercase tracking-widest">Manager</p>
            HR → Co-Admin → Admin
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <p className="font-black text-slate-700 dark:text-slate-200 mb-1 uppercase tracking-widest">HR</p>
            Co-Admin → Admin
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <p className="font-black text-slate-700 dark:text-slate-200 mb-1 uppercase tracking-widest">Co-Admin</p>
            Admin
          </div>
        </div>
      </div>

      {/* New leave form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">New Leave Request</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-red-600 transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Start Date</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-red-600 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">End Date</label>
                  <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-red-600 transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Leave Type</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-red-600 transition-all appearance-none">
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Reason</label>
                <textarea required rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Provide detailed reasoning..." className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-red-600 transition-all resize-none"></textarea>
              </div>
              {submitError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold flex gap-2">
                  <span className="flex-shrink-0">⚠️</span>
                  <span>{submitError}</span>
                </div>
              )}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 text-[10px] text-blue-600 dark:text-blue-400 font-medium space-y-1">
                <p className="font-black text-blue-700 dark:text-blue-300">Policy Reminders</p>
                <p>• 1-day leave: submit at least <b>24 hours</b> in advance (Clause 13)</p>
                <p>• Multi-day leave: submit at least <b>72 hours (3 days)</b> in advance</p>
                <p>• Only <b>1 leave per month</b> from Optional/Casual, Paid/Earned, or Sick (Clause 06)</p>
                <p>• Birthday Leave only on your <b>actual birthday</b> (Clause 24)</p>
              </div>
              <button type="submit" className="w-full py-5 bg-slate-950 dark:bg-[#E31E24] text-white font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-xl">
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rejection reason modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20"><AlertTriangle size={20} className="text-rose-500" /></div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Reject Leave Request</h3>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Rejection Reason (optional)</label>
              <textarea rows={3} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="State the reason for rejection..." className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-red-600 transition-all resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setRejectingId(null); setRejectionReason(''); }} className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
              <button onClick={handleReject} className="flex-1 py-3 bg-rose-500 text-white font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {displayLeaves.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm italic bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">No leave requests found.</div>
        )}
        {displayLeaves.map(leave => {
          const cfg = STATUS_CONFIG[leave.status] || STATUS_CONFIG[LeaveStatus.PENDING];
          const Icon = cfg.icon;
          const myTurn = canApprove(leave);
          const isExpanded = expandedId === leave.id;
          return (
            <div key={leave.id} className={`bg-white dark:bg-slate-900 rounded-2xl border-2 overflow-hidden ${myTurn ? 'border-amber-300 dark:border-amber-700' : 'border-slate-100 dark:border-slate-800'}`}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{leave.userName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{leave.userId} · {leave.department}</p>
                  </div>
                  <span className={`flex-shrink-0 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${cfg.bg} ${cfg.color}`}>
                    <Icon size={10}/>{getLeaveStatusLabel(leave.status)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-500 uppercase tracking-widest rounded-lg border border-slate-200 dark:border-slate-700">{leave.type}</span>
                  <span className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800/50 text-[9px] font-bold text-slate-500 rounded-lg border border-slate-100 dark:border-slate-700">
                    {new Date(leave.startDate).toLocaleDateString()} – {new Date(leave.endDate).toLocaleDateString()}
                  </span>
                </div>
                {myTurn && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1 mb-2"><Clock size={9}/> Your turn to review</p>
                )}
                <div className="flex items-center gap-2">
                  {myTurn && (
                    <>
                      <button onClick={() => handleApprove(leave)} className="flex-1 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all"><Check size={13}/> Approve</button>
                      <button onClick={() => setRejectingId(leave.id)} className="flex-1 py-2 bg-rose-500 text-white text-[10px] font-black uppercase rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all"><X size={13}/> Reject</button>
                    </>
                  )}
                  {leave.userId === currentUser?.id && leave.status === 'PENDING' && (
                    <button onClick={() => deleteLeave(leave.id)} className="px-3 py-2 text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-slate-700 rounded-xl transition-all"><Trash2 size={14}/></button>
                  )}
                  <button onClick={() => setExpandedId(isExpanded ? null : leave.id)}
                    className="ml-auto px-3 py-2 text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl">
                    {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  </button>
                </div>
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{leave.reason}</p>
                    <ApprovalChainDisplay leave={leave} chain={getChain(leave.userRole)} />
                    {leave.rejectionReason && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/30">
                        <p className="text-[9px] font-black uppercase text-rose-500 mb-1">Rejection Reason</p>
                        <p className="text-xs text-rose-600">{leave.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 overflow-hidden soft-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-5">Employee</th>
                <th className="px-6 py-5">Role</th>
                <th className="px-6 py-5">Period</th>
                <th className="px-6 py-5">Type</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5 text-right">Actions</th>
                <th className="px-6 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayLeaves.map((leave) => {
                const cfg = STATUS_CONFIG[leave.status] || STATUS_CONFIG[LeaveStatus.PENDING];
                const Icon = cfg.icon;
                const isExpanded = expandedId === leave.id;
                const myTurn = canApprove(leave);

                return (
                  <React.Fragment key={leave.id}>
                    <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${myTurn ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-900 dark:text-white text-sm">{leave.userName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{leave.userId}</div>
                        {leave.department && <div className="text-[10px] text-slate-300 dark:text-slate-600">{leave.department}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
                          leave.userRole === UserRole.ADMIN    ? 'bg-red-50 text-red-600 border-red-100' :
                          leave.userRole === UserRole.CO_ADMIN ? 'bg-orange-50 text-orange-600 border-orange-100' :
                          leave.userRole === UserRole.HR       ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          leave.userRole === UserRole.MANAGER  ? 'bg-purple-50 text-purple-600 border-purple-100' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {leave.userRole?.replace('_', ' ') || 'Employee'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {new Date(leave.startDate).toLocaleDateString()} – {new Date(leave.endDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                          {leave.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 w-fit ${cfg.bg} ${cfg.color}`}>
                          <Icon size={11} /> {getLeaveStatusLabel(leave.status)}
                        </span>
                        {myTurn && (
                          <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1">
                            <Clock size={9} /> Your turn
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {myTurn && (
                            <>
                              <button onClick={() => handleApprove(leave)}
                                className="p-2.5 bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-900/10" title="Approve">
                                <Check size={16} />
                              </button>
                              <button onClick={() => setRejectingId(leave.id)}
                                className="p-2.5 bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-lg shadow-rose-900/10" title="Reject">
                                <X size={16} />
                              </button>
                            </>
                          )}
                          {leave.userId === currentUser?.id && leave.status === 'PENDING' && (
                            <button onClick={() => deleteLeave(leave.id)}
                              className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all" title="Cancel request">
                              <Trash2 size={16} />
                            </button>
                          )}
                          <button onClick={() => setExpandedId(isExpanded ? null : leave.id)}
                            className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"><FileText size={18} /></button>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr className="bg-slate-50 dark:bg-slate-800/30">
                        <td colSpan={7} className="px-8 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Reason</p>
                              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{leave.reason}</p>
                              {leave.rejectionReason && (
                                <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Rejection Reason</p>
                                  <p className="text-sm text-rose-600">{leave.rejectionReason}</p>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Approval Progress</p>
                              <ApprovalChainDisplay leave={leave} chain={getChain(leave.userRole)} />
                              <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                {leave.managerApprovedBy  && <p>Manager: <span className="font-black text-slate-700 dark:text-slate-300">{leave.managerApprovedBy}</span></p>}
                                {leave.hrApprovedBy       && <p>HR: <span className="font-black text-slate-700 dark:text-slate-300">{leave.hrApprovedBy}</span></p>}
                                {leave.coAdminApprovedBy  && <p>Co-Admin: <span className="font-black text-slate-700 dark:text-slate-300">{leave.coAdminApprovedBy}</span></p>}
                                {leave.finalApprovedBy    && <p>Final: <span className="font-black text-emerald-600">{leave.finalApprovedBy}</span></p>}
                                {leave.rejectedBy         && <p>Rejected by: <span className="font-black text-rose-600">{leave.rejectedBy}</span></p>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {displayLeaves.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-10 py-20 text-center text-slate-400 italic font-medium">No leave requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeavesView;
