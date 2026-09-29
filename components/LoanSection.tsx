/**
 * LoanSection.tsx
 *
 * Drop-in replacement for the <LoanSection /> component inside RequestsHub.tsx.
 *
 * HOW TO USE:
 *   1. Copy this file to your views/ or components/ folder.
 *   2. In RequestsHub.tsx, import this and render <LoanSection /> where the
 *      existing loan tab content is.
 *
 * Features added over the original:
 *   • Repayment plan display (progress bar, months left, amount remaining)
 *   • "Set Repayment Plan" panel for HR/Admin on approved loans
 *   • "Record Monthly Payment" shortcut (quick +1 month paid)
 *   • "Enter Existing Loan" form — for HR/Admin to record running loans
 *     that predate the system
 */

import React, { useState, useMemo } from 'react';
import {
  DollarSign, Plus, Check, X, ChevronDown, ChevronUp,
  AlertTriangle, Banknote, CalendarDays, TrendingDown,
  RotateCcw, Clock, CheckCircle2, Loader2
} from 'lucide-react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import { formatCurrency } from '../utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inputCls =
  'w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 ' +
  'dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white ' +
  'focus:border-[#E31E24] transition-all outline-none rounded-xl';

const statusColor = (s: string) => {
  if (s === 'APPROVED' || s === 'ACTIVE') return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600';
  if (s === 'REJECTED')                   return 'bg-rose-50 dark:bg-rose-900/20 text-rose-600';
  if (s === 'CLOSED')                     return 'bg-slate-100 dark:bg-slate-700 text-slate-500';
  return 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'; // PENDING
};

// ─── Repayment progress card ──────────────────────────────────────────────────
const RepaymentProgress: React.FC<{ loan: any }> = ({ loan }) => {
  if (!loan.totalMonths) return null;
  const remaining   = Math.max(0, loan.amount - loan.amountPaid);
  const pct         = Math.min(100, Math.round((loan.amountPaid / loan.amount) * 100));
  const monthsLeft  = Math.max(0, loan.totalMonths - loan.paidMonths);

  return (
    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2.5 border border-slate-100 dark:border-slate-700">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Repayment Progress</span>
          <span className="text-[9px] font-black text-slate-600 dark:text-slate-300">{pct}%</span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#E31E24] to-rose-400 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] font-black text-slate-900 dark:text-white">{formatCurrency(loan.amountPaid)}</p>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Paid</p>
        </div>
        <div>
          <p className="text-[10px] font-black text-[#E31E24]">{formatCurrency(remaining)}</p>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Remaining</p>
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-900 dark:text-white">{monthsLeft}</p>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Months left</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-400 font-medium">
          {formatCurrency(loan.monthlyInstallment)}/mo · {loan.paidMonths}/{loan.totalMonths} months paid
        </span>
        {loan.status === 'CLOSED' && (
          <span className="text-emerald-600 font-black flex items-center gap-1">
            <CheckCircle2 size={11} /> Fully repaid
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Set repayment plan panel ─────────────────────────────────────────────────
const SetPlanPanel: React.FC<{ loan: any; onSave: (months: number, installment: number, startMonth: string) => Promise<void> }> = ({ loan, onSave }) => {
  const [months, setMonths]         = useState(loan.totalMonths || 6);
  const [startMonth, setStartMonth] = useState(loan.startMonth?.slice(0, 7) || new Date().toISOString().slice(0, 7));
  const [saving, setSaving]         = useState(false);

  const remaining   = loan.amount - (loan.amountPaid || 0);
  const installment = months > 0 ? Math.ceil(remaining / months) : 0;

  const handleSave = async () => {
    setSaving(true);
    await onSave(months, installment, startMonth + '-01');
    setSaving(false);
  };

  return (
    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-2xl space-y-3">
      <p className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">Set Repayment Plan</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Months</label>
          <input
            type="number" min={1} max={60} value={months}
            onChange={e => setMonths(+e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Start Month</label>
          <input
            type="month" value={startMonth}
            onChange={e => setStartMonth(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
          Monthly instalment: <span className="text-slate-900 dark:text-white font-black">{formatCurrency(installment)}</span>
        </p>
        <button
          onClick={handleSave}
          disabled={saving || months < 1}
          className="flex items-center gap-2 px-4 py-2 bg-[#E31E24] text-white text-[10px] font-black rounded-xl disabled:opacity-50 active:scale-95 transition-all"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Save Plan
        </button>
      </div>
    </div>
  );
};

// ─── Record payment panel ─────────────────────────────────────────────────────
const RecordPaymentPanel: React.FC<{ loan: any; onRecord: (paidMonths: number, amountPaid: number) => Promise<void> }> = ({ loan, onRecord }) => {
  const [saving, setSaving] = useState(false);

  const handleQuickPay = async () => {
    setSaving(true);
    const newPaidMonths = (loan.paidMonths || 0) + 1;
    const newAmountPaid = Math.min(loan.amount, (loan.amountPaid || 0) + (loan.monthlyInstallment || 0));
    await onRecord(newPaidMonths, newAmountPaid);
    setSaving(false);
  };

  if (loan.status === 'CLOSED') return null;
  if (!loan.totalMonths) return null;

  return (
    <div className="mt-2">
      <button
        onClick={handleQuickPay}
        disabled={saving || loan.paidMonths >= loan.totalMonths}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-200 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-40 active:scale-95 transition-all"
      >
        {saving
          ? <Loader2 size={12} className="animate-spin" />
          : <CheckCircle2 size={12} />
        }
        Mark Month {(loan.paidMonths || 0) + 1} as Paid ({formatCurrency(loan.monthlyInstallment)})
      </button>
    </div>
  );
};

// ─── Enter Existing Loan form ─────────────────────────────────────────────────
const ExistingLoanForm: React.FC<{ users: any[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }> = ({ users, onSubmit, onCancel }) => {
  const [form, setForm] = useState({
    userId: '',
    type: 'LOAN' as 'LOAN' | 'ADVANCE_SALARY',
    amount: '',
    reason: '',
    totalMonths: '',
    paidMonths: '',
    amountPaid: '',
    startMonth: new Date().toISOString().slice(0, 7),
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const remaining = Math.max(0, (+form.amount || 0) - (+form.amountPaid || 0));
  const monthsLeft = Math.max(0, (+form.totalMonths || 0) - (+form.paidMonths || 0));
  const installment = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : 0;

  const handleSubmit = async () => {
    setError('');
    if (!form.userId)                 { setError('Select an employee.'); return; }
    if (!form.amount || +form.amount <= 0) { setError('Enter loan amount.'); return; }
    if (!form.reason)                 { setError('Enter a reason.'); return; }
    if (+form.paidMonths > +form.totalMonths) { setError('Paid months cannot exceed total months.'); return; }
    if (+form.amountPaid > +form.amount)      { setError('Amount paid cannot exceed loan amount.'); return; }

    setSaving(true);
    try {
      await onSubmit({
        userId:     form.userId,
        type:       form.type,
        amount:     +form.amount,
        reason:     form.reason,
        totalMonths: +form.totalMonths || 0,
        paidMonths:  +form.paidMonths  || 0,
        amountPaid:  +form.amountPaid  || 0,
        startMonth: form.startMonth + '-01',
      });
    } catch (e: any) {
      setError(e.message || 'Failed to save.');
    }
    setSaving(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-200 dark:border-slate-700 p-6 space-y-5 soft-shadow">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center flex-shrink-0">
          <RotateCcw size={15} className="text-white dark:text-slate-900" />
        </div>
        <div>
          <p className="font-black text-slate-900 dark:text-white text-sm">Enter Existing Loan</p>
          <p className="text-[10px] text-slate-400 font-medium">Record a loan that was already running before this system</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Employee */}
        <div className="sm:col-span-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Employee *</label>
          <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} className={inputCls}>
            <option value="">Select employee…</option>
            {users.filter(u => u.role !== UserRole.DEVELOPER && u.role !== UserRole.ADMIN).map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.id}) — {u.department}</option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Loan Type *</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} className={inputCls}>
            <option value="LOAN">Loan</option>
            <option value="ADVANCE_SALARY">Advance Salary</option>
          </select>
        </div>

        {/* Total amount */}
        <div>
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Total Loan Amount (৳) *</label>
          <input type="number" min={0} placeholder="e.g. 50000" value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} />
        </div>

        {/* Total months */}
        <div>
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Total Repayment Months</label>
          <input type="number" min={0} placeholder="e.g. 12" value={form.totalMonths}
            onChange={e => setForm(f => ({ ...f, totalMonths: e.target.value }))} className={inputCls} />
        </div>

        {/* Start month */}
        <div>
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Repayment Started</label>
          <input type="month" value={form.startMonth}
            onChange={e => setForm(f => ({ ...f, startMonth: e.target.value }))} className={inputCls} />
        </div>

        {/* Months already paid */}
        <div>
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Months Already Paid</label>
          <input type="number" min={0} placeholder="0" value={form.paidMonths}
            onChange={e => setForm(f => ({ ...f, paidMonths: e.target.value }))} className={inputCls} />
        </div>

        {/* Amount already paid */}
        <div>
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Amount Already Paid (৳)</label>
          <input type="number" min={0} placeholder="0" value={form.amountPaid}
            onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))} className={inputCls} />
        </div>

        {/* Reason */}
        <div className="sm:col-span-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Reason / Notes *</label>
          <textarea rows={2} placeholder="Purpose of the loan…" value={form.reason}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            className={inputCls + ' resize-none'} />
        </div>
      </div>

      {/* Live summary */}
      {form.amount && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl grid grid-cols-3 gap-2 text-center border border-slate-200 dark:border-slate-700">
          <div>
            <p className="text-[11px] font-black text-slate-900 dark:text-white">{formatCurrency(remaining)}</p>
            <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Still owed</p>
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-900 dark:text-white">{monthsLeft}</p>
            <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Months left</p>
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-900 dark:text-white">{formatCurrency(installment)}</p>
            <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Monthly</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2 border border-red-200 dark:border-red-900/30">
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 py-3 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-[2] py-3 text-xs font-black uppercase text-white bg-[#E31E24] rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Banknote size={13} />}
          Record Existing Loan
        </button>
      </div>
    </div>
  );
};

// ─── Main LoanSection ─────────────────────────────────────────────────────────
const LoanSection: React.FC = () => {
  const {
    currentUser, users, loanRequests,
    applyLoan, reviewLoan,
    // These three come from the new store functions (see PATCH_NOTES.ts):
    addExistingLoan,
    updateLoanRepayment,
    setLoanRepaymentPlan,
  } = useHRM() as any; // cast until types are updated

  const role         = currentUser?.role as UserRole;
  const isPrivileged = [UserRole.DEVELOPER, UserRole.ADMIN, UserRole.CO_ADMIN, UserRole.HR].includes(role);
  const isEmployee   = role === UserRole.EMPLOYEE || role === UserRole.MANAGER;

  const [showNewLoanForm,      setShowNewLoanForm]      = useState(false);
  const [showExistingLoanForm, setShowExistingLoanForm] = useState(false);
  const [newLoan, setNewLoan]  = useState({ type: 'LOAN' as const, amount: '', reason: '' });
  const [loanMsg, setLoanMsg]  = useState('');
  const [loanLoading, setLoanLoading] = useState(false);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [rejectId, setRejectId]       = useState<string | null>(null);
  const [rejectNote, setRejectNote]   = useState('');
  const [planLoanId, setPlanLoanId]   = useState<string | null>(null);

  // Which loans to show
  const visibleLoans = useMemo(() => {
    if (isPrivileged) return loanRequests;
    return loanRequests.filter((l: any) => l.userId === currentUser?.id);
  }, [loanRequests, currentUser, isPrivileged]);

  const pendingCount = loanRequests.filter((l: any) => l.status === 'PENDING').length;

  const handleApplyLoan = async () => {
    if (!newLoan.amount || +newLoan.amount <= 0) { setLoanMsg('Enter a valid amount.'); return; }
    if (!newLoan.reason.trim()) { setLoanMsg('Enter a reason.'); return; }
    setLoanLoading(true);
    const res = await applyLoan(newLoan.type, +newLoan.amount, newLoan.reason);
    setLoanLoading(false);
    setLoanMsg(res.message);
    if (res.success) { setShowNewLoanForm(false); setNewLoan({ type: 'LOAN', amount: '', reason: '' }); }
  };

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await reviewLoan(id, status, status === 'REJECTED' ? rejectNote : undefined);
    setRejectId(null); setRejectNote('');
  };

  return (
    <div className="space-y-6">

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Loans & Advances
          </h3>
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-black rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Employees can apply for new loans */}
          {isEmployee && (
            <button
              onClick={() => setShowNewLoanForm(s => !s)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#E31E24] text-white text-[10px] font-black uppercase rounded-2xl hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-900/20"
            >
              <Plus size={13} /> Apply
            </button>
          )}
          {/* HR / Admin can enter existing loans */}
          {isPrivileged && (
            <button
              onClick={() => setShowExistingLoanForm(s => !s)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase rounded-2xl hover:opacity-90 active:scale-95 transition-all"
            >
              <RotateCcw size={13} /> Existing Loan
            </button>
          )}
        </div>
      </div>

      {/* Apply for new loan form */}
      {showNewLoanForm && (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-200 dark:border-slate-700 p-6 space-y-4 soft-shadow">
          <p className="font-black text-slate-900 dark:text-white text-sm">New Loan / Advance Request</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Type</label>
              <select value={newLoan.type} onChange={e => setNewLoan(f => ({ ...f, type: e.target.value as any }))} className={inputCls}>
                <option value="LOAN">Loan</option>
                <option value="ADVANCE_SALARY">Advance Salary</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Amount (৳)</label>
              <input type="number" min={1} placeholder="e.g. 20000" value={newLoan.amount}
                onChange={e => setNewLoan(f => ({ ...f, amount: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Reason</label>
            <textarea rows={2} placeholder="Explain why you need this loan…" value={newLoan.reason}
              onChange={e => setNewLoan(f => ({ ...f, reason: e.target.value }))}
              className={inputCls + ' resize-none'} />
          </div>
          {loanMsg && (
            <p className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-xl">{loanMsg}</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setShowNewLoanForm(false); setLoanMsg(''); }}
              className="flex-1 py-3 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl">Cancel</button>
            <button onClick={handleApplyLoan} disabled={loanLoading}
              className="flex-[2] py-3 text-xs font-black uppercase text-white bg-[#E31E24] rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2">
              {loanLoading ? <Loader2 size={13} className="animate-spin" /> : <DollarSign size={13} />}
              Submit Request
            </button>
          </div>
        </div>
      )}

      {/* Enter existing loan form */}
      {showExistingLoanForm && (
        <ExistingLoanForm
          users={users}
          onCancel={() => setShowExistingLoanForm(false)}
          onSubmit={async (data) => {
            const res = await addExistingLoan(
              data.userId, data.type, data.amount, data.reason,
              data.totalMonths, data.paidMonths, data.amountPaid, data.startMonth
            );
            if (res.success) setShowExistingLoanForm(false);
            else throw new Error(res.message);
          }}
        />
      )}

      {/* Loan list */}
      <div className="space-y-3">
        {visibleLoans.length === 0 && (
          <div className="py-16 text-center text-slate-400 text-sm font-bold">No loan records found.</div>
        )}

        {visibleLoans.map((loan: any) => {
          const isExpanded = expandedId === loan.id;
          const canReview  = isPrivileged && loan.status === 'PENDING';
          const canManage  = isPrivileged && (loan.status === 'APPROVED' || loan.status === 'ACTIVE');
          const hasПлан    = !!loan.totalMonths;
          const showSetPlan = canManage && planLoanId === loan.id;

          return (
            <div key={loan.id}
              className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 soft-shadow overflow-hidden">

              {/* Card header */}
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : loan.id)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`p-2.5 rounded-2xl ${loan.type === 'LOAN' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    {loan.type === 'LOAN'
                      ? <Banknote size={16} className="text-slate-600 dark:text-slate-300" />
                      : <CalendarDays size={16} className="text-amber-600" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 dark:text-white text-sm leading-tight truncate">
                      {isPrivileged ? loan.userName : (loan.type === 'LOAN' ? 'Loan' : 'Advance Salary')}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <p className="text-[10px] text-slate-400 font-bold">
                        {formatCurrency(loan.amount)}
                        {loan.isExistingLoan && <span className="ml-1.5 text-[8px] uppercase tracking-widest bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md font-black">Pre-existing</span>}
                      </p>
                      {loan.totalMonths > 0 && (
                        <p className="text-[10px] text-slate-400 font-bold">
                          · {Math.max(0, loan.totalMonths - loan.paidMonths)} months left
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${statusColor(loan.status)}`}>
                    {loan.status}
                  </span>
                  {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-6 pb-6 space-y-4 border-t border-slate-50 dark:border-slate-800 pt-4">
                  {/* Info grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Type',        value: loan.type.replace('_', ' ') },
                      { label: 'Amount',      value: formatCurrency(loan.amount) },
                      { label: 'Applied',     value: new Date(loan.createdAt).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' }) },
                      ...(isPrivileged ? [{ label: 'Department', value: loan.department }] : []),
                      ...(loan.reviewedBy ? [{ label: 'Reviewed by', value: loan.reviewedBy }] : []),
                    ].map(f => (
                      <div key={f.label}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{f.label}</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{f.value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                    {loan.reason}
                  </p>
                  {loan.reviewNote && (
                    <p className="text-[11px] text-slate-400 italic">Note: {loan.reviewNote}</p>
                  )}

                  {/* Repayment progress */}
                  <RepaymentProgress loan={loan} />

                  {/* Set plan toggle (HR/Admin on approved loans with no plan yet) */}
                  {canManage && !hasПлан && !showSetPlan && (
                    <button
                      onClick={() => setPlanLoanId(loan.id)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:border-[#E31E24] hover:text-[#E31E24] transition-all"
                    >
                      <TrendingDown size={12} /> Set Repayment Plan
                    </button>
                  )}

                  {showSetPlan && (
                    <SetPlanPanel
                      loan={loan}
                      onSave={async (months, installment, startMonth) => {
                        await setLoanRepaymentPlan(loan.id, months, installment, startMonth);
                        setPlanLoanId(null);
                      }}
                    />
                  )}

                  {/* Quick payment record */}
                  {canManage && hasПлан && (
                    <RecordPaymentPanel
                      loan={loan}
                      onRecord={async (pm, ap) => updateLoanRepayment(loan.id, pm, ap)}
                    />
                  )}

                  {/* Approve / Reject */}
                  {canReview && (
                    <div className="space-y-3">
                      {rejectId === loan.id ? (
                        <div className="space-y-2">
                          <input
                            value={rejectNote}
                            onChange={e => setRejectNote(e.target.value)}
                            placeholder="Rejection reason (optional)…"
                            className={inputCls}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => setRejectId(null)}
                              className="flex-1 py-2.5 text-[10px] font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                              Cancel
                            </button>
                            <button onClick={() => handleReview(loan.id, 'REJECTED')}
                              className="flex-[2] py-2.5 text-[10px] font-black uppercase text-white bg-rose-600 rounded-2xl active:scale-95 transition-all">
                              Confirm Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleReview(loan.id, 'APPROVED')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase text-white bg-emerald-600 rounded-2xl hover:bg-emerald-700 active:scale-95 transition-all">
                            <Check size={12} /> Approve
                          </button>
                          <button onClick={() => setRejectId(loan.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-2xl hover:bg-rose-100 active:scale-95 transition-all">
                            <X size={12} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LoanSection;
