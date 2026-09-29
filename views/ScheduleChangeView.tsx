/**
 * ScheduleChangeView.tsx
 * Employees can request permanent or temporary duty schedule changes.
 * Manager approves first → HR gives final approval → schedule is applied.
 */

import React, { useState, useMemo } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import { Clock, Plus, X, Check, ChevronRight, AlertTriangle, Calendar } from 'lucide-react';
import { ScheduleChangeRequest, ScheduleChangeType } from '../types';

const inputCls = 'w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all rounded-none';

const ScheduleChangeView: React.FC = () => {
  const { currentUser, scheduleChangeRequests, requestScheduleChange, reviewScheduleChange, users } = useHRM();

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

  const isEmployee = currentUser?.role === UserRole.EMPLOYEE || currentUser?.role === UserRole.MANAGER;
  const isManager = currentUser?.role === UserRole.MANAGER;
  const isHR = currentUser?.role === UserRole.HR;
  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.CO_ADMIN;

  // What the current user can see
  const visibleRequests = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin || isHR) return scheduleChangeRequests;
    if (isManager) {
      // Manager sees their own + their dept employees' pending manager approval
      return scheduleChangeRequests.filter(r =>
        r.userId === currentUser.id ||
        (r.department === currentUser.department && r.status === 'PENDING')
      );
    }
    return scheduleChangeRequests.filter(r => r.userId === currentUser.id);
  }, [scheduleChangeRequests, currentUser, isAdmin, isHR, isManager]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);
    setMsg('');
    const res = await requestScheduleChange({
      userId: currentUser.id,
      userName: currentUser.name,
      department: currentUser.department,
      changeType,
      requestedCheckIn: checkIn,
      requestedCheckOut: checkOut,
      startDate: changeType === 'TEMPORARY' ? startDate : undefined,
      endDate: changeType === 'TEMPORARY' ? endDate : undefined,
      reason,
    });
    setSubmitting(false);
    if (res.success) {
      setMsg('✅ Request submitted successfully.');
      setShowForm(false);
      setReason(''); setStartDate(''); setEndDate('');
    } else {
      setMsg(`❌ ${res.message}`);
    }
  };

  const handleApprove = async (req: ScheduleChangeRequest) => {
    if (!currentUser) return;
    if (isManager && req.status === 'PENDING') {
      await reviewScheduleChange(req.id, 'MANAGER_APPROVED');
    } else if ((isHR || isAdmin) && req.status === 'MANAGER_APPROVED') {
      await reviewScheduleChange(req.id, 'APPROVED');
    } else if (isAdmin && req.status === 'PENDING') {
      // Admin can approve directly
      await reviewScheduleChange(req.id, 'APPROVED');
    }
  };

  const handleReject = async (id: string) => {
    await reviewScheduleChange(id, 'REJECTED', rejectReason);
    setRejectingId(null);
    setRejectReason('');
  };

  const canApprove = (req: ScheduleChangeRequest) => {
    if (!currentUser) return false;
    if (isManager && req.status === 'PENDING' && req.department === currentUser.department && req.userId !== currentUser.id) return true;
    if (isHR && req.status === 'MANAGER_APPROVED') return true;
    if (isAdmin) return req.status === 'PENDING' || req.status === 'MANAGER_APPROVED';
    return false;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400';
      case 'MANAGER_APPROVED': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400';
      case 'APPROVED': return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400';
      case 'REJECTED': return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pending Manager';
      case 'MANAGER_APPROVED': return 'Pending HR';
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      default: return status;
    }
  };

  // Current user's schedule
  const mySchedule = currentUser?.dutySchedule;

  return (
    <div className="space-y-8 pb-20 animate-[fadeIn_0.5s_ease-out]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            Duty Schedule
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Your current schedule and change requests.
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] transition-all shadow-lg">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Request Change'}
        </button>
      </div>

      {/* Current schedule card */}
      {mySchedule && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 soft-shadow">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Your Current Schedule</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { label: 'Check-In', value: mySchedule.checkInTime },
              { label: 'Check-Out', value: mySchedule.checkOutTime },
              { label: 'Grace Period', value: `${mySchedule.graceMinutes} min` },
              { label: 'Early Check-In', value: `${mySchedule.earlyCheckInMinutes} min before` },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-black text-slate-900 dark:text-white">{item.value}</p>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{item.label}</p>
              </div>
            ))}
          </div>
          {(currentUser?.lateCount || 0) > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 text-amber-600">
              <AlertTriangle size={16} />
              <p className="text-sm font-black">Late check-ins this month: <span className="text-xl">{currentUser?.lateCount}</span></p>
            </div>
          )}
        </div>
      )}

      {msg && (
        <div className={`p-4 rounded-2xl text-sm font-bold border-2 ${msg.startsWith('✅') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 border-emerald-200' : 'bg-red-50 dark:bg-red-900/20 text-red-600 border-red-200'}`}>
          {msg}
        </div>
      )}

      {/* Request form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 border-[#E31E24]/20 soft-shadow">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-6">New Schedule Change Request</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Permanent vs Temporary */}
            <div className="flex gap-3">
              {(['PERMANENT', 'TEMPORARY'] as ScheduleChangeType[]).map(t => (
                <button key={t} type="button" onClick={() => setChangeType(t)}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest border-2 transition-all ${changeType === t ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10 text-[#E31E24]' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                  {t === 'PERMANENT' ? '♾ Permanent' : '📅 Temporary'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Requested Check-In</label>
                <input type="time" required value={checkIn} onChange={e => setCheckIn(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Requested Check-Out</label>
                <input type="time" required value={checkOut} onChange={e => setCheckOut(e.target.value)} className={inputCls} />
              </div>
            </div>

            {changeType === 'TEMPORARY' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">From Date</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">To Date</label>
                  <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || new Date().toISOString().split('T')[0]} className={inputCls} />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Reason</label>
              <textarea required value={reason} onChange={e => setReason(e.target.value)} rows={3}
                placeholder="Explain why you need this schedule change..."
                className={inputCls + ' resize-none'} />
            </div>

            <button type="submit" disabled={submitting}
              className="w-full py-4 bg-slate-900 dark:bg-[#E31E24] text-white font-black uppercase tracking-widest text-xs hover:bg-[#E31E24] dark:hover:bg-[#C41217] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? 'Submitting...' : <><ChevronRight size={14} /> Submit Request</>}
            </button>
          </form>
        </div>
      )}

      {/* Request list */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 soft-shadow overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest flex items-center gap-2">
            <Clock size={16} className="text-[#E31E24]" /> Schedule Requests
          </h3>
          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 text-[10px] font-black">{visibleRequests.length}</span>
        </div>

        {visibleRequests.length === 0 ? (
          <div className="py-20 text-center">
            <Calendar size={32} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
            <p className="text-sm text-slate-400 font-bold">No schedule change requests yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {visibleRequests.map(req => {
              const employee = users.find(u => u.id === req.userId);
              return (
                <div key={req.id} className="px-8 py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-sm font-black text-slate-900 dark:text-white">{req.userName}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${statusBadge(req.status)}`}>
                          {statusLabel(req.status)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${req.changeType === 'PERMANENT' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                          {req.changeType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {req.department} · {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                      <div className="mt-3 flex items-center gap-4 flex-wrap">
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Requested</p>
                          <p className="text-sm font-black text-slate-900 dark:text-white">{req.requestedCheckIn} – {req.requestedCheckOut}</p>
                        </div>
                        {req.changeType === 'TEMPORARY' && req.startDate && (
                          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Period</p>
                            <p className="text-sm font-black text-slate-900 dark:text-white">{req.startDate} → {req.endDate}</p>
                          </div>
                        )}
                        {employee?.dutySchedule && (
                          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Current</p>
                            <p className="text-sm font-bold text-slate-500">{employee.dutySchedule.checkInTime} – {employee.dutySchedule.checkOutTime}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-2 italic">"{req.reason}"</p>
                      {req.status === 'REJECTED' && req.rejectionReason && (
                        <p className="text-xs text-red-500 mt-1 font-bold">Rejected: {req.rejectionReason}</p>
                      )}
                      {req.managerApprovedBy && (
                        <p className="text-[10px] text-blue-500 mt-1 font-bold">✓ Manager: {req.managerApprovedBy}</p>
                      )}
                      {req.hrApprovedBy && (
                        <p className="text-[10px] text-emerald-500 mt-1 font-bold">✓ HR: {req.hrApprovedBy}</p>
                      )}
                    </div>

                    {/* Actions */}
                    {canApprove(req) && rejectingId !== req.id && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleApprove(req)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-black uppercase rounded-2xl hover:bg-emerald-700 transition-all">
                          <Check size={13} /> Approve
                        </button>
                        <button onClick={() => { setRejectingId(req.id); setRejectReason(''); }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-[#E31E24] text-xs font-black uppercase rounded-2xl hover:bg-red-100 transition-all border border-red-200">
                          <X size={13} /> Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Rejection reason input */}
                  {rejectingId === req.id && (
                    <div className="mt-4 space-y-2">
                      <input type="text" placeholder="Rejection reason (optional)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border-2 border-red-200 dark:border-red-900 rounded-2xl text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
                      <div className="flex gap-2">
                        <button onClick={() => handleReject(req.id)}
                          className="px-4 py-2 bg-[#E31E24] text-white text-xs font-black uppercase rounded-xl hover:bg-[#C41217] transition-all">
                          Confirm Reject
                        </button>
                        <button onClick={() => setRejectingId(null)}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-black uppercase rounded-xl transition-all">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleChangeView;
