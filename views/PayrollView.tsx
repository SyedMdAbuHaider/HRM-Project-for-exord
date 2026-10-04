import React, { useState, useMemo } from 'react';
import { useHRM } from '../store';
import { UserRole, SalaryRecord, PayScale } from '../types';
import {
  DollarSign, Search, CheckCircle, Clock,
  Calculator, ChevronDown, ChevronUp,
  TrendingDown, TrendingUp, Plus, X, Calendar, Banknote,
  BadgePercent, ShieldCheck, RefreshCw, Edit2, Trash2, AlertTriangle, Save, Send,
  Layers, FileText, Printer
} from 'lucide-react';
import { formatCurrency } from '../utils';
import { api } from '../apiClient';

// ─── Salary Calculation Engine ─────────────────────────────────────────────
interface SalaryCalcInput {
  mainSalary: number; monthDays: number; presentDays: number;
  absentDays: number; lateDays: number; extraDays: number;
  bonus: number; loanDeduction: number; otherAdditions: number;
  otherDeductions: number; joinDate: string; forMonth: string;
  pfRate: number; // Provident Fund rate as a decimal e.g. 0.05 for 5%
}
interface SalaryBreakdown {
  dailySalary: number; extraPay: number; subtotal: number;
  absentDeduction: number; lateDeduction: number;
  pfDeduction: number; isEligiblePF: boolean;
  otherDeductions: number; totalDeductions: number; payableSalary: number;
  bonus: number; loanDeduction: number; finalPayable: number;
  lateRounded: number;
  serviceYears: number;
}

function calcSalary(input: SalaryCalcInput): SalaryBreakdown {
  const { mainSalary, monthDays, absentDays, lateDays, extraDays, bonus, loanDeduction, otherAdditions, otherDeductions, joinDate, forMonth, pfRate } = input;
  const dailySalary = mainSalary / monthDays;
  const extraPay = dailySalary * extraDays;
  const subtotal = mainSalary + extraPay + otherAdditions;
  const absentDeduction = dailySalary * absentDays;
  const lateRounded = Math.floor(lateDays / 3);
  const lateDeduction = dailySalary * lateRounded;
  let pfDeduction = 0; let isEligiblePF = false;
  let serviceYears = 0;
  if (joinDate) {
    const join = new Date(joinDate);
    const [yr, mo] = forMonth.split('-').map(Number);
    const payMonth = new Date(yr, mo - 1, 1);
    const monthsDiff = (payMonth.getFullYear() - join.getFullYear()) * 12 + (payMonth.getMonth() - join.getMonth());
    serviceYears = monthsDiff / 12;
    // PF: eligible after 1 year of service
    if (monthsDiff >= 12 && pfRate > 0) { isEligiblePF = true; pfDeduction = mainSalary * pfRate; }
  }
  const totalDeductions = absentDeduction + lateDeduction + pfDeduction + otherDeductions;
  const payableSalary = subtotal - totalDeductions;
  const finalPayable = Math.max(0, payableSalary + bonus - loanDeduction);
  return { dailySalary, extraPay, subtotal, absentDeduction, lateDeduction, pfDeduction, isEligiblePF, otherDeductions, totalDeductions, payableSalary, bonus, loanDeduction, finalPayable, lateRounded, serviceYears };
}

function getDaysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Component ─────────────────────────────────────────────────────────────
const PayrollView: React.FC = () => {
  const { salaries, users, attendance, currentUser, addSalary, updateSalary, deleteSalary, sendNotification, payScales, addPayScale, updatePayScale, deletePayScale, customRoles } = useHRM();
  const isAdmin = currentUser?.role === UserRole.DEVELOPER || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR;
  const isDeveloper = currentUser?.role === UserRole.DEVELOPER;

  // ── Provident Fund rate — loaded from system_settings, editable by Developer ─
  const [pfRate, setPfRate] = useState(0.05); // default 5%
  const [pfRateInput, setPfRateInput] = useState('5');
  const [pfRateSaving, setPfRateSaving] = useState(false);
  const [showPfSettings, setShowPfSettings] = useState(false);

  // Load PF rate from server-owned settings.
  React.useEffect(() => {
    (async () => {
      try {
        const result = await api.get<{settings:any[]}>('/api/v1/system-settings?keys=provident_fund_rate');
        const raw = result.settings?.[0]?.value;
        const rate = Number(typeof raw === 'string' ? JSON.parse(raw) : raw);
        if (Number.isFinite(rate)) { setPfRate(rate / 100); setPfRateInput(String(rate)); }
      } catch {}
    })();
  }, []);

  const [search, setSearch] = useState('');
  const [showCalc, setShowCalc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Pay Scale state
  const [showPayScales, setShowPayScales] = useState(false);
  const [editingScale, setEditingScale] = useState<PayScale | null>(null);
  const [scaleForm, setScaleForm] = useState({ role: UserRole.EMPLOYEE as string, name: '', minSalary: 0, maxSalary: 0, level: 1 });
  const [scaleSaving, setScaleSaving] = useState(false);
  const [deletingScale, setDeletingScale] = useState<PayScale | null>(null);

  // Salary PDF state
  const [pdfSlip, setPdfSlip] = useState<SalaryRecord | null>(null);
  const [printAll, setPrintAll] = useState(false);
  const [summarySheet, setSummarySheet] = useState(false);
  const [filterMonth, setFilterMonth] = useState(MONTHS[new Date().getMonth()]);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  // Bulk email send
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  // Email salary slip
  const [emailingSlip, setEmailingSlip] = useState<SalaryRecord | null>(null);
  const [emailSlipResult, setEmailSlipResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [emailSlipSending, setEmailSlipSending] = useState(false);

  // Edit state
  const [editingRecord, setEditingRecord] = useState<SalaryRecord | null>(null);
  const [editForm, setEditForm] = useState({ base: 0, bonus: 0, deductions: 0, net: 0, month: '', year: 0, status: 'UNPAID' as 'PAID' | 'UNPAID' });
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deletingRecord, setDeletingRecord] = useState<SalaryRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Send notification state
  const [sendingSlip, setSendingSlip] = useState<SalaryRecord | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const now = new Date();
  const [calcForm, setCalcForm] = useState({
    userId: '', month: MONTHS[now.getMonth()], year: now.getFullYear(),
    extraDays: 0, absentDays: 0, lateDays: 0, bonus: 0,
    loanDeduction: 0, otherAdditions: 0, otherDeductions: 0,
  });
  const [calcEmpSearch, setCalcEmpSearch] = useState('');
  const [calcDropdownOpen, setCalcDropdownOpen] = useState(false);

  const selectedUser = users.find(u => u.id === calcForm.userId);
  const forMonthStr = `${calcForm.year}-${String(MONTHS.indexOf(calcForm.month) + 1).padStart(2, '0')}`;
  const monthDays = getDaysInMonth(calcForm.year, MONTHS.indexOf(calcForm.month) + 1);

  const autoAttendance = useMemo(() => {
    if (!calcForm.userId) return { present: 0, absent: 0, late: 0 };
    const monthIdx = MONTHS.indexOf(calcForm.month);
    const monthCheckins = attendance.filter(a => {
      const d = new Date(a.timestamp);
      return a.userId === calcForm.userId && d.getFullYear() === calcForm.year
        && d.getMonth() === monthIdx && a.type === 'CHECK_IN' && a.status === 'SUCCESS';
    });
    // Count late arrivals from actual attendance records
    const lateCount = monthCheckins.filter(a => a.isLate === true).length;
    return {
      present: monthCheckins.length,
      absent: Math.max(0, monthDays - monthCheckins.length - calcForm.extraDays),
      late: lateCount,
    };
  }, [calcForm.userId, calcForm.month, calcForm.year, attendance, monthDays, calcForm.extraDays]);

  // Auto-fill lateDays when employee or month changes
  React.useEffect(() => {
    if (autoAttendance.late > 0) {
      setCalcForm(f => ({ ...f, lateDays: autoAttendance.late }));
    }
  }, [autoAttendance.late]);

  const breakdown: SalaryBreakdown | null = useMemo(() => {
    if (!selectedUser) return null;
    return calcSalary({
      mainSalary: selectedUser.baseSalary, monthDays,
      presentDays: autoAttendance.present, absentDays: calcForm.absentDays,
      lateDays: calcForm.lateDays, extraDays: calcForm.extraDays,
      bonus: calcForm.bonus, loanDeduction: calcForm.loanDeduction,
      otherAdditions: calcForm.otherAdditions, otherDeductions: calcForm.otherDeductions,
      joinDate: (selectedUser as any).joinDate || '', forMonth: forMonthStr,
      pfRate,
    });
  }, [selectedUser, calcForm, monthDays, autoAttendance, forMonthStr, pfRate]);

  // ── Late breakdown for the Send Slip modal ────────────────────────────────
  // Derived from the employee's current lateCount and the salary record's base.
  const slipLateBreakdown = useMemo(() => {
    if (!sendingSlip) return null;
    const slipUser = users.find(u => u.id === sendingSlip.userId);
    const lateCount = slipUser?.lateCount || 0;
    const slipMonthDays = getDaysInMonth(sendingSlip.year, MONTHS.indexOf(sendingSlip.month) + 1);
    const dailySalary = sendingSlip.base / slipMonthDays;
    const lateRounded = Math.floor(lateCount / 3);
    const lateDeduction = Math.round(dailySalary * lateRounded);
    return { lateCount, lateRounded, lateDeduction };
  }, [sendingSlip, users]);


  // ── Save PF rate to system_settings (Developer only) ─────────────────────
  const handleSavePfRate = async () => {
    const rate = parseFloat(pfRateInput);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return;
    setPfRateSaving(true);
    try {
      await api.put('/api/v1/system-settings/provident_fund_rate', { value: rate });
      setPfRate(rate / 100);
    } catch {}
    setPfRateSaving(false);
    setShowPfSettings(false);
  };


  // ── Resolve custom::uuid role to a display designation ───────────────────
  const resolveDesignation = (user: typeof users[0]): string => {
    if (!user) return '';
    if (user.designation) return user.designation;
    if ((user.role as string).startsWith('custom::')) {
      const roleId = (user.role as string).replace('custom::', '');
      return customRoles.find(r => r.id === roleId)?.name || '';
    }
    return '';
  };

  // ── Pay Scale Handlers ─────────────────────────────────────────────────────
  const handleAddScale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scaleForm.name.trim()) return;
    setScaleSaving(true);
    if (editingScale) {
      await updatePayScale(editingScale.id, { name: scaleForm.name, level: scaleForm.level, minSalary: scaleForm.minSalary, maxSalary: scaleForm.maxSalary });
      setEditingScale(null);
    } else {
      await addPayScale({ role: scaleForm.role as UserRole, name: scaleForm.name, level: scaleForm.level, minSalary: scaleForm.minSalary, maxSalary: scaleForm.maxSalary });
    }
    setScaleForm({ role: UserRole.EMPLOYEE, name: '', minSalary: 0, maxSalary: 0, level: 1 });
    setScaleSaving(false);
  };

  const handlePrintPDF = (sal: SalaryRecord) => {
    setPdfSlip(sal);
    setTimeout(() => {
      window.print();
      window.onafterprint = () => { setPdfSlip(null); setPrintAll(false); setSummarySheet(false); };
    }, 300);
  };

  const handleSave = async () => {
    if (!breakdown || !selectedUser) return;
    setSaving(true);
    await addSalary({
      userId: selectedUser.id, userName: selectedUser.name,
      month: calcForm.month, year: calcForm.year, base: selectedUser.baseSalary,
      bonus: calcForm.bonus, deductions: Math.round(breakdown.totalDeductions),
      net: Math.round(breakdown.finalPayable), status: 'UNPAID',
    });
    setSaving(false); setShowCalc(false);
    setCalcForm(f => ({ ...f, userId: '', bonus: 0, loanDeduction: 0, absentDays: 0, lateDays: 0, extraDays: 0, otherAdditions: 0, otherDeductions: 0 }));
    setCalcEmpSearch('');
  };

  const openEdit = (sal: SalaryRecord) => {
    setEditingRecord(sal);
    setEditForm({ base: sal.base, bonus: sal.bonus, deductions: sal.deductions, net: sal.net, month: sal.month, year: sal.year, status: sal.status });
  };

  const handleEditField = (field: string, value: any) => {
    setEditForm(prev => {
      const updated = { ...prev, [field]: value };
      if (['base', 'bonus', 'deductions'].includes(field)) {
        updated.net = Math.max(0, Number(updated.base) + Number(updated.bonus) - Number(updated.deductions));
      }
      return updated;
    });
  };

  const handleEditSave = async () => {
    if (!editingRecord) return;
    setEditSaving(true);
    await updateSalary(editingRecord.id, { base: Number(editForm.base), bonus: Number(editForm.bonus), deductions: Number(editForm.deductions), net: Number(editForm.net), month: editForm.month, year: Number(editForm.year), status: editForm.status });
    setEditSaving(false); setEditingRecord(null);
  };

  const handleDelete = async () => {
    if (!deletingRecord) return;
    setDeleteLoading(true);
    await deleteSalary(deletingRecord.id);
    setDeleteLoading(false); setDeletingRecord(null);
  };

  // Send salary slip notification to employee
  const handleSendSlip = async () => {
    if (!sendingSlip) return;
    setSendLoading(true); setSendResult(null);
    const late = slipLateBreakdown;
    const lateLineOccurrences = late && late.lateCount > 0
      ? `\n  Late arrivals:  ${late.lateCount} occurrence(s) → ${late.lateRounded} day(s) = ${formatCurrency(late.lateDeduction)}`
      : `\n  Late arrivals:  None`;
    const msg = `Your salary slip for ${sendingSlip.month} ${sendingSlip.year} is ready.\n\nBasic Salary:     ${formatCurrency(sendingSlip.base)}\nBonus:            ${formatCurrency(sendingSlip.bonus)}\n───────────────────────────────\nDeductions:${lateLineOccurrences}\n  Total:          ${formatCurrency(sendingSlip.deductions)}\n───────────────────────────────\nNet Payable:      ${formatCurrency(sendingSlip.net)}\nStatus:           ${sendingSlip.status}`;

    // Send in-app notification
    const res = await sendNotification(
      sendingSlip.userId,
      `Salary Slip — ${sendingSlip.month} ${sendingSlip.year}`,
      msg, 'SALARY',
      { salaryId: sendingSlip.id, net: sendingSlip.net, status: sendingSlip.status }
    );

    // Also send email via local email server
    const recipientUser = users.find(u => u.id === sendingSlip.userId);
    let emailNote = '';
    if (recipientUser?.email) {
      try {
        const res = await fetch('/api/v1/email/salary-slip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: recipientUser.email,
            recipientName: sendingSlip.userName,
            period: `${sendingSlip.month} ${sendingSlip.year}`,
            base: sendingSlip.base,
            bonus: sendingSlip.bonus,
            deductions: sendingSlip.deductions,
            net: sendingSlip.net,
            status: sendingSlip.status,
            lateCount: late?.lateCount || 0,
            lateDeduction: late?.lateDeduction || 0,
          }),
        });
        const data = await res.json();
        emailNote = data.error ? ` (Email failed: ${data.error})` : ' + Email delivered.';
      } catch (e: any) {
        emailNote = ` (Email failed: ${e?.message || 'network error'})`;
      }
    } else {
      emailNote = ' (No email address on file.)';
    }

    const finalResult = {
      success: res.success,
      message: res.success
        ? `Slip sent to ${sendingSlip.userName}'s inbox.${emailNote}`
        : res.message,
    };
    setSendResult(finalResult); setSendLoading(false);
    if (res.success) setTimeout(() => { setSendingSlip(null); setSendResult(null); }, 2500);
  };
  // ── Bulk send salary slips to all employees for a month ──────────────────
  const handleBulkSend = async () => {
    const targets = displaySalaries.filter(s =>
      s.month === filterMonth && s.year === filterYear
    );
    if (targets.length === 0) return;
    setBulkSending(true);
    setBulkResult(null);
    let sent = 0; let failed = 0; const errors: string[] = [];
    for (const sal of targets) {
      const emp = users.find(u => u.id === sal.userId);
      if (!emp?.email) { errors.push(`${sal.userName}: no email`); failed++; continue; }
      const lateCount = emp.lateCount || 0;
      const slipMonthDays = getDaysInMonth(sal.year, MONTHS.indexOf(sal.month) + 1);
      const dailySalary = sal.base / slipMonthDays;
      const lateRounded = Math.floor(lateCount / 3);
      const lateDeduction = Math.round(dailySalary * lateRounded);
      try {
        const res = await fetch('/api/v1/email/salary-slip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: emp.email, recipientName: sal.userName,
            period: `${sal.month} ${sal.year}`,
            base: sal.base, bonus: sal.bonus, deductions: sal.deductions,
            net: sal.net, status: sal.status,
            lateCount, lateDeduction,
          }),
        });
        const data = await res.json();
        if (data.error) { errors.push(`${sal.userName}: ${data.error}`); failed++; }
        else { sent++; }
      } catch (e: any) { errors.push(`${sal.userName}: ${e.message}`); failed++; }
    }
    setBulkSending(false);
    setBulkResult({ sent, failed, errors });
  };

  const displaySalaries = (isAdmin ? salaries : salaries.filter(s => s.userId === currentUser?.id))
    .filter(s => !search || s.userName.toLowerCase().includes(search.toLowerCase()) || s.userId.toLowerCase().includes(search.toLowerCase()));

  const totalNet = displaySalaries.reduce((a, s) => a + s.net, 0);
  const totalUnpaid = displaySalaries.filter(s => s.status === 'UNPAID').reduce((a, s) => a + s.net, 0);
  const paidCount = displaySalaries.filter(s => s.status === 'PAID').length;

  const row = (label: string, value: string, color = 'text-slate-700 dark:text-slate-300', sub?: string) => (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-200 dark:border-slate-700 last:border-0">
      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}{sub && <span className="ml-1 text-[10px] text-slate-400">({sub})</span>}</span>
      <span className={`text-sm font-black ${color}`}>{value}</span>
    </div>
  );

  const inputCls = "w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] focus:outline-none transition-all";
  const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5";

  return (
    <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] pb-20">

      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Payroll</h2>
          <p className="text-slate-500 dark:text-slate-400 text-base font-medium">Process salaries and send slips to employees.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#E31E24] transition-all w-60" />
          </div>
          {isAdmin && (
            <>
              <button onClick={() => setShowPayScales(true)} className="flex items-center gap-2 px-5 py-3 bg-slate-900 dark:bg-slate-700 text-white font-black text-xs uppercase tracking-widest hover:bg-[#E31E24] transition-all">
                <Layers size={15} /> Pay Scales
              </button>
              {displaySalaries.length > 0 && (
                <button onClick={() => { setPrintAll(true); setTimeout(() => { window.print(); window.onafterprint = () => setPrintAll(false); }, 300); }}
                  className="flex items-center gap-2 px-5 py-3 bg-slate-700 dark:bg-slate-600 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all">
                  <Printer size={15} /> Print All
                </button>
              )}
              {displaySalaries.length > 0 && (
                <button onClick={() => { setSummarySheet(true); setTimeout(() => { window.print(); window.onafterprint = () => setSummarySheet(false); }, 300); }}
                  className="flex items-center gap-2 px-5 py-3 bg-indigo-700 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-800 transition-all">
                  <FileText size={15} /> Summary PDF
              </button>
            )}
            {displaySalaries.length > 0 && (
              <button onClick={() => { setBulkResult(null); setShowBulkModal(true); }}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg">
                <Send size={15} /> Bulk Email Slips
                </button>
              )}
              <button onClick={() => setShowCalc(true)} className="flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/20">
                <Calculator size={15} /> Calculate Salary
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Net Disbursement', value: formatCurrency(totalNet), icon: Banknote, color: 'from-blue-500 to-indigo-600' },
          { label: 'Pending Payment', value: formatCurrency(totalUnpaid), icon: Clock, color: 'from-amber-500 to-orange-500' },
          { label: 'Paid Records', value: `${paidCount} / ${displaySalaries.length}`, icon: CheckCircle, color: 'from-emerald-500 to-teal-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className={`p-3 w-fit bg-gradient-to-br ${s.color} text-white shadow mb-4`}><s.icon size={18} /></div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {displaySalaries.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm italic bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">No payroll records found.</div>
        )}
        {displaySalaries.map(sal => (
          <div key={sal.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{sal.userName}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{sal.userId} · {sal.month} {sal.year}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {isAdmin ? (
                    <button onClick={() => updateSalary(sal.id, { status: sal.status === 'PAID' ? 'UNPAID' : 'PAID' })}
                      className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 border rounded-lg ${sal.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/40' : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/40'}`}>
                      {sal.status === 'PAID' ? <CheckCircle size={10}/> : <Clock size={10}/>} {sal.status}
                    </button>
                  ) : (
                    <span className={`px-2.5 py-1 text-[9px] font-black uppercase border rounded-lg ${sal.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{sal.status}</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                  <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Base</p>
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300">{formatCurrency(sal.base)}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-2.5 text-center">
                  <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Bonus</p>
                  <p className="text-xs font-black text-emerald-600">+{formatCurrency(sal.bonus)}</p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-900/10 rounded-xl p-2.5 text-center">
                  <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Deducted</p>
                  <p className="text-xs font-black text-rose-500">-{formatCurrency(sal.deductions)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Net Payable</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(sal.net)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && <button onClick={() => { setSendingSlip(sal); setSendResult(null); }} className="p-2 text-slate-400 hover:text-emerald-500 transition-all"><Send size={15}/></button>}
                  {isAdmin && <button onClick={() => openEdit(sal)} className="p-2 text-slate-400 hover:text-blue-500 transition-all"><Edit2 size={15}/></button>}
                  {isAdmin && <button onClick={() => setDeletingRecord(sal)} className="p-2 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={15}/></button>}
                  <button onClick={() => handlePrintPDF(sal)} className="p-2 text-slate-400 hover:text-[#E31E24] transition-all"><FileText size={15}/></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Employee', 'UID', 'Period', 'Base', 'Deductions', 'Bonus', 'Net Payable', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displaySalaries.length === 0 && (
                <tr><td colSpan={9} className="py-20 text-center text-slate-400 text-sm italic">No payroll records found.</td></tr>
              )}
              {displaySalaries.map((sal, i) => (
                <React.Fragment key={sal.id}>
                  <tr className={`hover:bg-gray-50 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-slate-800/10'}`}>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{sal.userName}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{sal.userId}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 tracking-wider border border-slate-200 dark:border-slate-700 select-all">{sal.userId}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-bold text-slate-600 dark:text-slate-300">{sal.month} {sal.year}</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-slate-600 dark:text-slate-300">{formatCurrency(sal.base)}</td>
                    <td className="px-4 py-3.5 text-sm font-black text-rose-500">-{formatCurrency(sal.deductions)}</td>
                    <td className="px-4 py-3.5 text-sm font-black text-emerald-500">+{formatCurrency(sal.bonus)}</td>
                    <td className="px-4 py-3.5 text-sm font-black text-slate-900 dark:text-white">{formatCurrency(sal.net)}</td>
                    <td className="px-4 py-3.5">
                      {isAdmin ? (
                        <button
                          onClick={() => updateSalary(sal.id, { status: sal.status === 'PAID' ? 'UNPAID' : 'PAID' })}
                          className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit transition-all border ${sal.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/40 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/40 hover:bg-amber-100'}`}
                        >
                          {sal.status === 'PAID' ? <CheckCircle size={10} /> : <Clock size={10} />} {sal.status}
                        </button>
                      ) : (
                        <span className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit border ${sal.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                          {sal.status === 'PAID' ? <CheckCircle size={10} /> : <Clock size={10} />} {sal.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {/* Send slip to employee — admin only */}
                        {isAdmin && (
                          <button onClick={() => { setSendingSlip(sal); setSendResult(null); }} title="Send salary slip to employee" className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all" >
                            <Send size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => openEdit(sal)} title="Edit record" className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                            <Edit2 size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => setDeletingRecord(sal)} title="Delete record" className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button onClick={() => handlePrintPDF(sal)} title="Print salary slip" className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                          <Printer size={14} />
                        </button>
                        <button onClick={() => setExpandedId(expandedId === sal.id ? null : sal.id)} className="p-2 text-slate-400 hover:text-[#E31E24] transition-colors">
                          {expandedId === sal.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === sal.id && (
                    <tr className="bg-gray-50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                      <td colSpan={9} className="px-8 py-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          {[
                            { label: 'Base Salary', value: formatCurrency(sal.base), color: 'text-slate-900 dark:text-white' },
                            { label: 'Bonus', value: `+${formatCurrency(sal.bonus)}`, color: 'text-emerald-500' },
                            { label: 'Total Deductions', value: `-${formatCurrency(sal.deductions)}`, color: 'text-rose-500' },
                            { label: 'Net Payable', value: formatCurrency(sal.net), color: 'text-slate-900 dark:text-white' },
                          ].map((item, j) => (
                            <div key={j} className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-700">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                              <p className={`font-black ${item.color}`}>{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>


      {/* ─── Pay Scale Management Modal ───────────────────────────────────── */}
      {showPayScales && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#E31E24] text-white"><Layers size={18} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Pay Scale Bands</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Define salary bands by role</p>
                </div>
              </div>
              <button onClick={() => { setShowPayScales(false); setEditingScale(null); }} className="p-2 text-slate-400 hover:text-red-600 transition-all"><X size={20} /></button>
            </div>
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {/* Add/Edit form */}
              <div className="p-6 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 lg:w-80 flex-shrink-0 overflow-y-auto">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">{editingScale ? 'Edit Band' : 'Add New Band'}</p>
                <form onSubmit={handleAddScale} className="space-y-3">
                  <div>
                    <label className={labelCls}>Role</label>
                    <select value={scaleForm.role} onChange={e => setScaleForm(f => ({ ...f, role: e.target.value }))} className={inputCls} disabled={!!editingScale}>
                      {[UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.HR, UserRole.CO_ADMIN, UserRole.ADMIN].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Band Name</label>
                    <input type="text" required placeholder="e.g. Junior, Mid, Senior" value={scaleForm.name} onChange={e => setScaleForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Level (sort order)</label>
                    <input type="number" min={1} value={scaleForm.level} onChange={e => setScaleForm(f => ({ ...f, level: +e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls + " text-emerald-500"}>Min Salary (৳)</label>
                    <input type="number" min={0} required value={scaleForm.minSalary} onChange={e => setScaleForm(f => ({ ...f, minSalary: +e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls + " text-rose-400"}>Max Salary (৳, 0 = uncapped)</label>
                    <input type="number" min={0} value={scaleForm.maxSalary} onChange={e => setScaleForm(f => ({ ...f, maxSalary: +e.target.value }))} className={inputCls} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    {editingScale && (
                      <button type="button" onClick={() => { setEditingScale(null); setScaleForm({ role: UserRole.EMPLOYEE, name: '', minSalary: 0, maxSalary: 0, level: 1 }); }} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase transition-all hover:bg-gray-50 dark:hover:bg-slate-800">Cancel</button>
                    )}
                    <button type="submit" disabled={scaleSaving} className="flex-[2] py-3 bg-slate-900 dark:bg-[#E31E24] text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#E31E24] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                      {scaleSaving ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                      {scaleSaving ? 'Saving...' : editingScale ? 'Update Band' : 'Add Band'}
                    </button>
                  </div>
                </form>
              </div>
              {/* Existing bands list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {payScales.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm italic">No pay scale bands defined yet.</div>
                )}
                {/* Group by role */}
                {([...new Set(payScales.map(ps => ps.role))] as string[]).map(role => (
                  <div key={role} className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 pt-1">{role}</p>
                    {payScales.filter(ps => ps.role === role).sort((a, b) => a.level - b.level).map(ps => (
                      <div key={ps.id} className="p-4 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-slate-900 dark:text-white">{ps.name}</p>
                            <span className="text-[9px] font-black text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5">L{ps.level}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                            {formatCurrency(ps.minSalary)} – {ps.maxSalary > 0 ? formatCurrency(ps.maxSalary) : 'Uncapped'}
                          </p>
                        </div>
                        <button onClick={() => { setEditingScale(ps); setScaleForm({ role: ps.role, name: ps.name, minSalary: ps.minSalary, maxSalary: ps.maxSalary, level: ps.level }); }} className="p-2 text-slate-400 hover:text-[#E31E24] transition-all"><Edit2 size={14} /></button>
                        {deletingScale?.id !== ps.id ? (
                          <button onClick={() => setDeletingScale(ps)} className="p-2 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={14} /></button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button onClick={async () => { await deletePayScale(ps.id); setDeletingScale(null); }} className="px-2 py-1 bg-rose-500 text-white text-[9px] font-black uppercase hover:bg-rose-600 transition-all">Delete</button>
                            <button onClick={() => setDeletingScale(null)} className="px-2 py-1 border border-slate-200 text-slate-500 text-[9px] font-black uppercase hover:bg-gray-50 dark:hover:bg-slate-700 transition-all">Cancel</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Salary PDF Print Modal ────────────────────────────────────────── */}
      {pdfSlip && (
        <>
          {/* Screen overlay */}
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] print:hidden">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500"><FileText size={18} /></div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Salary Slip PDF</h3>
                </div>
                <button onClick={() => setPdfSlip(null)} className="p-2 text-slate-400 hover:text-slate-700 transition-all"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">Ready to print/save as PDF for <span className="font-black text-slate-900 dark:text-white">{pdfSlip.userName}</span> — {pdfSlip.month} {pdfSlip.year}.</p>
                <p className="text-xs text-slate-400">Use your browser's print dialog and select "Save as PDF" as the destination.</p>
                <div className="flex gap-3">
                  <button onClick={() => setPdfSlip(null)} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                  <button onClick={() => window.print()} className="flex-[2] py-3 bg-blue-500 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2">
                    <Printer size={14} /> Print / Save PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Print-only salary slip */}
          <div className="hidden print:block fixed inset-0 bg-white z-[200] p-10 font-sans">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between pb-5 mb-6" style={{ borderBottom: '3px solid #E31E24' }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 44, height: 44, background: '#E31E24', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                    <span style={{ color: '#fff', fontWeight: 900, fontSize: 22, fontFamily: 'Inter, sans-serif' }}>E</span>
                  </div>
                  <div>
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-1px', lineHeight: 1, margin: 0 }}><span style={{ color: '#E31E24' }}>Exord</span> Online</h1>
                    <p style={{ fontSize: 11, color: '#64748b', marginTop: 3, fontWeight: 600 }}>Human Resources Management</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#E31E24', margin: 0 }}>SALARY SLIP</p>
                  <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{pdfSlip.month} {pdfSlip.year}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
                {[{ label: 'Employee Name', value: pdfSlip.userName }, { label: 'Employee ID', value: pdfSlip.userId }, { label: 'Pay Period', value: `${pdfSlip.month} ${pdfSlip.year}` }, { label: 'Payment Status', value: pdfSlip.status, color: pdfSlip.status === 'PAID' ? '#10b981' : '#f59e0b' }].map((item, i) => (
                  <div key={i}>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8', marginBottom: 3 }}>{item.label}</p>
                    <p style={{ fontSize: 15, fontWeight: 900, color: (item as any).color || '#0f172a', margin: 0 }}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 16px', marginBottom: 8 }}>
                <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#16a34a', margin: '0 0 8px' }}>Earnings</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #dcfce7', padding: '5px 0' }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>Basic Salary</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>৳ {pdfSlip.base.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #dcfce7', padding: '5px 0' }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>Bonus / Allowances</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>+ ৳ {pdfSlip.bonus.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>Gross Earnings</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>৳ {(pdfSlip.base + pdfSlip.bonus).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 16px', marginBottom: 8 }}>
                <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#dc2626', margin: '0 0 8px' }}>Deductions</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>Total Deductions</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>- ৳ {pdfSlip.deductions.toLocaleString()}</span>
                </div>
              </div>
              <div style={{ background: '#0f172a', borderRadius: 10, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>Net Payable</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#E31E24' }}>৳ {pdfSlip.net.toLocaleString()}</span>
              </div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span style={{ display: 'inline-block', padding: '8px 24px', borderRadius: 100, background: pdfSlip.status === 'PAID' ? '#f0fdf4' : '#fffbeb', border: `2px solid ${pdfSlip.status === 'PAID' ? '#10b981' : '#f59e0b'}`, color: pdfSlip.status === 'PAID' ? '#065f46' : '#92400e', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px' }}>
                  Payment Status: {pdfSlip.status}
                </span>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>This is a computer-generated salary slip. No signature required.</p>
                <p style={{ fontSize: 10, color: '#94a3b8', margin: '3px 0 0' }}>Generated: {new Date().toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
          </div>
        </>

      )}
      {/* ─── Send Salary Slip Modal ────────────────────────────────────────── */}
      {sendingSlip && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500 text-white"><Send size={16} /></div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Send Salary Slip</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Deliver directly to employee inbox</p>
                </div>
              </div>
              <button onClick={() => { setSendingSlip(null); setSendResult(null); }} className="p-2 text-slate-400 hover:text-slate-700 transition-all"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Slip preview */}
              <div className="bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Recipient</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{sendingSlip.userName}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Period</p>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{sendingSlip.month} {sendingSlip.year}</p>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Base</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(sendingSlip.base)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Bonus</span>
                    <span className="font-bold text-emerald-500">+{formatCurrency(sendingSlip.bonus)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Deductions</span>
                    <span className="font-bold text-rose-500">-{formatCurrency(sendingSlip.deductions)}</span>
                  </div>
                  {slipLateBreakdown && slipLateBreakdown.lateCount > 0 && (
                    <div className="flex justify-between text-xs pl-3 text-slate-400">
                      <span>↳ Late ({slipLateBreakdown.lateCount} occurrence{slipLateBreakdown.lateCount !== 1 ? 's' : ''} → {slipLateBreakdown.lateRounded} day{slipLateBreakdown.lateRounded !== 1 ? 's' : ''})</span>
                      <span className="font-bold text-rose-400">-{formatCurrency(slipLateBreakdown.lateDeduction)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="font-black text-slate-900 dark:text-white">Net Payable</span>
                    <span className="font-black text-[#E31E24] text-base">{formatCurrency(sendingSlip.net)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-slate-500">Payment Status</span>
                  <span className={`font-black uppercase ${sendingSlip.status === 'PAID' ? 'text-emerald-500' : 'text-amber-500'}`}>{sendingSlip.status}</span>
                </div>
              </div>

              {sendResult && (
                <div className={`p-3 text-xs font-black uppercase tracking-widest border ${sendResult.success ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                  {sendResult.message}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setSendingSlip(null); setSendResult(null); }} disabled={sendLoading}
                  className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">
                  Cancel
                </button>
                <button onClick={handleSendSlip} disabled={sendLoading}
                  className="flex-[2] py-3 bg-emerald-500 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {sendLoading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  {sendLoading ? 'Sending...' : 'Send to Employee Inbox'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Modal ────────────────────────────────────────────────────── */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10"><Edit2 size={18} className="text-blue-500" /></div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Edit Salary Record</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">{editingRecord.userName} — {editingRecord.month} {editingRecord.year}</p>
                </div>
              </div>
              <button onClick={() => setEditingRecord(null)} className="p-2 text-slate-400 hover:text-slate-700 transition-all"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Month</label><select value={editForm.month} onChange={e => setEditForm(f => ({ ...f, month: e.target.value }))} className={inputCls}>{MONTHS.map(m => <option key={m}>{m}</option>)}</select></div>
                <div><label className={labelCls}>Year</label><input type="number" value={editForm.year} onChange={e => setEditForm(f => ({ ...f, year: +e.target.value }))} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Base Salary (৳)</label><input type="number" min={0} value={editForm.base} onChange={e => handleEditField('base', +e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls + ' text-emerald-500'}>Bonus (৳)</label><input type="number" min={0} value={editForm.bonus} onChange={e => handleEditField('bonus', +e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls + ' text-rose-500'}>Deductions (৳)</label><input type="number" min={0} value={editForm.deductions} onChange={e => handleEditField('deductions', +e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Net Payable (৳)</label><input type="number" min={0} value={editForm.net} onChange={e => setEditForm(f => ({ ...f, net: +e.target.value }))} className={inputCls} /><p className="text-[10px] text-slate-400 mt-1">Auto-calculated or override</p></div>
              </div>
              <div>
                <label className={labelCls}>Payment Status</label>
                <div className="flex border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <button type="button" onClick={() => setEditForm(f => ({ ...f, status: 'UNPAID' }))} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${editForm.status === 'UNPAID' ? 'bg-amber-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Unpaid</button>
                  <button type="button" onClick={() => setEditForm(f => ({ ...f, status: 'PAID' }))} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${editForm.status === 'PAID' ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Paid</button>
                </div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
                <span className="text-sm font-black text-slate-900 dark:text-white">Final Net Payable</span>
                <span className="text-xl font-black text-[#E31E24]">{formatCurrency(editForm.net)}</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditingRecord(null)} className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Cancel</button>
                <button onClick={handleEditSave} disabled={editSaving} className="flex-[2] py-3 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {editSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Modal ──────────────────────────────────────────────────── */}
      {deletingRecord && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm border border-slate-200 dark:border-slate-800 shadow-2xl p-8 text-center space-y-5">
            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 w-fit mx-auto"><AlertTriangle size={26} className="text-rose-500" /></div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Delete Salary Record?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Permanently delete the salary record for <span className="font-black text-slate-900 dark:text-white">{deletingRecord.userName}</span> ({deletingRecord.month} {deletingRecord.year} — {formatCurrency(deletingRecord.net)}). This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingRecord(null)} disabled={deleteLoading} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 py-3 bg-rose-500 text-white font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteLoading ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Salary Calculator Modal ───────────────────────────────────────── */}
      {showCalc && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl my-8 shadow-2xl animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#E31E24]/10"><Calculator size={20} className="text-[#E31E24]" /></div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Salary Calculator</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Auto-calculated breakdown with deductions</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isDeveloper && (
                  <button onClick={() => setShowPfSettings(true)} title="Configure Provident Fund rate"
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-all">
                    <BadgePercent size={13} /> PF Rate: {(pfRate * 100).toFixed(1)}%
                  </button>
                )}
                <button onClick={() => setShowCalc(false)} className="p-2 text-slate-400 hover:text-slate-700 transition-all"><X size={18} /></button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Inputs */}
              <div className="space-y-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employee & Period</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Employee</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search by name, ID or department..."
                        value={calcEmpSearch}
                        onChange={e => { setCalcEmpSearch(e.target.value); setCalcDropdownOpen(true); }}
                        onFocus={() => setCalcDropdownOpen(true)}
                        className={inputCls + ' pl-9'}
                      />
                      {calcDropdownOpen && (
                        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                          {(() => {
                            const q = calcEmpSearch.toLowerCase().trim();
                            const filtered = users.filter(u =>
                              !q ||
                              u.name.toLowerCase().includes(q) ||
                              u.id.toLowerCase().includes(q) ||
                              (u.department || '').toLowerCase().includes(q)
                            );
                            if (filtered.length === 0) return (
                              <div className="px-4 py-6 text-center text-xs text-slate-400 font-medium">No employees found</div>
                            );
                            return filtered.map(u => (
                              <button
                                key={u.id}
                                type="button"
                                onMouseDown={() => {
                                  setCalcForm(f => ({ ...f, userId: u.id }));
                                  setCalcEmpSearch(u.name);
                                  setCalcDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${calcForm.userId === u.id ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                              >
                                <div>
                                  <p className="text-xs font-black text-slate-900 dark:text-white">{u.name}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">{u.department} · {u.id}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-[#E31E24]">{formatCurrency(u.baseSalary)}</p>
                                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">{(u as any).designation || ''}</p>
                                </div>
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                      {calcDropdownOpen && (
                        <div className="fixed inset-0 z-40" onMouseDown={() => setCalcDropdownOpen(false)} />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Month</label>
                    <select value={calcForm.month} onChange={e => setCalcForm(f => ({ ...f, month: e.target.value }))} className={inputCls}>
                      {MONTHS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Year</label>
                    <input type="number" value={calcForm.year} onChange={e => setCalcForm(f => ({ ...f, year: +e.target.value }))} className={inputCls} />
                  </div>
                </div>

                {selectedUser && (
                  <div className="p-4 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">{selectedUser.name}</p>
                      <p className="text-[10px] text-slate-400">{selectedUser.department}
                        {resolveDesignation(selectedUser) && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase tracking-wide">
                            {resolveDesignation(selectedUser)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right"><p className="text-xs font-black text-[#E31E24]">{formatCurrency(selectedUser.baseSalary)}</p><p className="text-[10px] text-slate-400">Base / Month</p></div>
                  </div>
                )}

                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1">Attendance</p>
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: 'Extra Days', key: 'extraDays', hint: '+ pay' }, { label: 'Absent Days', key: 'absentDays', hint: '- deduct' }, { label: 'Late Count', key: 'lateDays', hint: '3=1 day' }].map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">{f.label} <span className="text-slate-300">{f.hint}</span></label>
                      <input type="number" min={0} value={(calcForm as any)[f.key]} onChange={e => setCalcForm(p => ({ ...p, [f.key]: +e.target.value }))} className={inputCls} />
                      {f.key === 'lateDays' && autoAttendance.late > 0 && (
                        <p className="text-[9px] text-indigo-500 font-black mt-1 flex items-center gap-1">
                          <Clock size={9} /> Auto-detected: {autoAttendance.late} late(s) from attendance
                        </p>
                      )}
                      {f.key === 'lateDays' && autoAttendance.late === 0 && calcForm.userId && (
                        <p className="text-[9px] text-slate-400 font-bold mt-1">No late arrivals found</p>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1">Additions & Deductions</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Bonus (৳)', key: 'bonus', color: 'text-emerald-500' },
                    { label: 'Loan Deduction (৳)', key: 'loanDeduction', color: 'text-rose-500' },
                    { label: 'Other Additions (৳)', key: 'otherAdditions', color: 'text-emerald-500' },
                    { label: 'Other Deductions (৳)', key: 'otherDeductions', color: 'text-rose-500' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className={`text-[10px] font-black uppercase tracking-widest block mb-1.5 ${f.color}`}>{f.label}</label>
                      <input type="number" min={0} value={(calcForm as any)[f.key]} onChange={e => setCalcForm(p => ({ ...p, [f.key]: +e.target.value }))} className={inputCls} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Breakdown */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Breakdown</p>
                {!breakdown ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm italic py-20">Select an employee to see breakdown</div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] font-black border border-blue-100">{monthDays} days in {calcForm.month}</span>
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-black border border-emerald-100">Daily: {formatCurrency(Math.round(breakdown.dailySalary))}</span>
  
                      {breakdown.isEligiblePF && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black border border-indigo-100 flex items-center gap-1"><BadgePercent size={10} /> PF {(pfRate*100).toFixed(1)}% Active</span>}
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-4 space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-3">Earnings</p>
                      {row('Main Salary', formatCurrency(selectedUser!.baseSalary), 'text-slate-900 dark:text-white')}
                      {row('Extra Pay', `+${formatCurrency(Math.round(breakdown.extraPay))}`, 'text-emerald-600', `${calcForm.extraDays} days`)}
                      {row('Other Additions', `+${formatCurrency(calcForm.otherAdditions)}`, 'text-emerald-600')}
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200">Subtotal</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(Math.round(breakdown.subtotal))}</span>
                      </div>
                    </div>

                    <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 p-4 space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-rose-500 mb-3">Deductions</p>
                      {row('Absent', `-${formatCurrency(Math.round(breakdown.absentDeduction))}`, 'text-rose-500', `${calcForm.absentDays} days`)}
                      {row('Late', `-${formatCurrency(Math.round(breakdown.lateDeduction))}`, 'text-rose-500', `${calcForm.lateDays} lates = ${breakdown.lateRounded} day`)}
  
                      {breakdown.isEligiblePF && row(`Provident Fund (${(pfRate * 100).toFixed(1)}%)`, `-${formatCurrency(Math.round(breakdown.pfDeduction))}`, 'text-indigo-500', '>1yr · paid 5th')}
                      {row('Other Deductions', `-${formatCurrency(calcForm.otherDeductions)}`, 'text-rose-500')}
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xs font-black text-rose-600">Total Deductions</span>
                        <span className="text-sm font-black text-rose-600">-{formatCurrency(Math.round(breakdown.totalDeductions))}</span>
                      </div>
                    </div>

                    <div className="bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-4 space-y-1">
                      {row('Payable Salary', formatCurrency(Math.round(breakdown.payableSalary)), 'text-slate-900 dark:text-slate-100')}
                      {row('Bonus', `+${formatCurrency(calcForm.bonus)}`, 'text-emerald-600 dark:text-emerald-400')}
                      {row('Loan Deduction', `-${formatCurrency(calcForm.loanDeduction)}`, 'text-rose-600 dark:text-rose-400')}
                      <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-300 dark:border-slate-600">
                        <span className="text-sm font-black text-slate-900 dark:text-white">Final Payable</span>
                        <span className="text-2xl font-black text-[#E31E24]">{formatCurrency(Math.round(breakdown.finalPayable))}</span>
                      </div>
                    </div>

                    <button onClick={handleSave} disabled={saving || !calcForm.userId}
                      className="w-full py-4 bg-[#E31E24] text-white font-black text-sm uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                      {saving ? 'Saving...' : 'Save Salary Record'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ─── Bulk Print — all slips on one print job ──────────────────────── */}
      {printAll && (
        <div className="hidden print:block fixed inset-0 bg-white z-[300] p-0">
          {displaySalaries.map((sal, idx) => {
            const isEven = idx % 2 === 0;
            return (
              <div key={sal.id} className={`relative p-10 ${!isEven ? 'border-t-4 border-dashed border-gray-300' : ''}`}
                style={{ pageBreakAfter: isEven ? 'avoid' : 'always', minHeight: '50vh' }}>
                <div className="flex items-center justify-between border-b-2 border-gray-900 pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <div style={{ width: 30, height: 30, background: '#E31E24', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontWeight: 900, fontSize: 16, fontFamily: 'Inter,sans-serif' }}>E</span>
                    </div>
                    <div>
                      <h1 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                        <span style={{ color: '#E31E24' }}>Exord</span> Online
                      </h1>
                      <p className="text-gray-500 text-xs mt-0.5">Salary Slip · {sal.month} {sal.year}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-gray-900">{sal.userName}</p>
                    <p className="text-xs text-gray-500">{sal.userId}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                  <div className="bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Base</p>
                    <p className="font-black text-gray-900">{sal.base.toLocaleString()} ৳</p>
                  </div>
                  <div className="bg-green-50 border border-green-100 p-3">
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Bonus</p>
                    <p className="font-black text-green-700">+{sal.bonus.toLocaleString()} ৳</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 p-3">
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Deductions</p>
                    <p className="font-black text-red-700">-{sal.deductions.toLocaleString()} ৳</p>
                  </div>
                  <div className="bg-gray-900 p-3">
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Net Payable</p>
                    <p className="font-black text-white text-base">{sal.net.toLocaleString()} ৳</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-200 pt-3">
                  <span>Status: <span className={sal.status === 'PAID' ? 'text-green-600 font-black' : 'text-amber-600 font-black'}>{sal.status}</span></span>
                  <span>Generated: {new Date().toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                {isEven && idx < displaySalaries.length - 1 && (
                  <div className="absolute bottom-0 left-8 right-8 border-b-2 border-dashed border-gray-300 flex items-center justify-center">
                    <span className="bg-white px-3 text-[9px] text-gray-400 font-black uppercase tracking-widest">✂ Cut here</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* ─── Summary Sheet — all employees, simple table ───────────────── */}
      {summarySheet && (
        <div className="hidden print:block fixed inset-0 bg-white z-[310] p-10 font-sans">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b-4 border-[#E31E24] pb-5 mb-8">
              <div className="flex items-center gap-3">
                <div style={{ width: 40, height: 40, background: '#E31E24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: 20, fontFamily: 'Inter,sans-serif' }}>E</span>
                </div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-1px' }}>
                    <span style={{ color: '#E31E24' }}>Exord</span> Online
                  </h1>
                  <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Human Resources Management</p>
                </div>
              </div>
              <div className="text-right">
                <p style={{ fontSize: 18, fontWeight: 900, color: '#E31E24' }}>SALARY SUMMARY</p>
                <p style={{ fontSize: 12, color: '#64748b' }}>
                  {filterMonth} {filterYear} · Generated {new Date().toLocaleDateString('en-BD', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#fff' }}>
                  {['#', 'Employee Name', 'Employee ID', 'Bank Account', 'Bank Name', 'Base Salary (৳)', 'Net Payable (৳)', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 900, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displaySalaries.map((sal, i) => {
                  const emp = users.find(u => u.id === sal.userId);
                  return (
                    <tr key={sal.id} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '9px 12px', color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#0f172a' }}>{sal.userName}</td>
                      <td style={{ padding: '9px 12px', color: '#475569', fontFamily: 'monospace' }}>{sal.userId}</td>
                      <td style={{ padding: '9px 12px', color: '#475569', fontFamily: 'monospace' }}>{emp?.bankAccountNumber || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#475569' }}>{emp?.bankName || '—'}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>{sal.base.toLocaleString()}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 900, color: '#E31E24', textAlign: 'right' }}>{sal.net.toLocaleString()}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontWeight: 900, fontSize: 10, padding: '2px 8px', borderRadius: 4, background: sal.status === 'PAID' ? '#d1fae5' : '#fef3c7', color: sal.status === 'PAID' ? '#065f46' : '#92400e' }}>
                          {sal.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#E31E24', color: '#fff' }}>
                  <td colSpan={5} style={{ padding: '12px', fontWeight: 900, fontSize: 13 }}>TOTAL PAYABLE</td>
                  <td style={{ padding: '12px', fontWeight: 900, textAlign: 'right' }}>{displaySalaries.reduce((s, r) => s + r.base, 0).toLocaleString()}</td>
                  <td style={{ padding: '12px', fontWeight: 900, textAlign: 'right', fontSize: 14 }}>{displaySalaries.reduce((s, r) => s + r.net, 0).toLocaleString()}</td>
                  <td style={{ padding: '12px', fontWeight: 900 }}>{displaySalaries.length} employees</td>
                </tr>
              </tfoot>
            </table>
            <p style={{ marginTop: 24, fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
              This is a computer-generated salary summary. Confidential — for HR/Finance use only.
            </p>
          </div>
        </div>
      )}

      {/* ─── Bulk Email Slips Modal ───────────────────────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"><Send size={18} /></div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">Bulk Email Salary Slips</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Send slips to all employees for a period</p>
                </div>
              </div>
              <button onClick={() => { setShowBulkModal(false); setBulkResult(null); }} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Month</label>
                  <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {MONTHS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Year</label>
                  <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                <span className="font-black text-slate-900 dark:text-white">
                  {displaySalaries.filter(s => s.month === filterMonth && s.year === filterYear).length}
                </span> salary record(s) found for {filterMonth} {filterYear}
              </div>
              {bulkResult && (
                <div className={`px-4 py-3 border text-sm ${bulkResult.failed === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <p className="font-black">Done — {bulkResult.sent} sent, {bulkResult.failed} failed</p>
                  {bulkResult.errors.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs">
                      {bulkResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => { setShowBulkModal(false); setBulkResult(null); }}
                className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
                Close
              </button>
              <button onClick={handleBulkSend} disabled={bulkSending || displaySalaries.filter(s => s.month === filterMonth && s.year === filterYear).length === 0}
                className="flex-[2] py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {bulkSending ? <><RefreshCw size={13} className="animate-spin" /> Sending...</> : <><Send size={13} /> Send All Slips</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── PF Rate Settings Modal (Developer only) ──────────────────────── */}
      {showPfSettings && isDeveloper && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10"><BadgePercent size={18} className="text-indigo-500" /></div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Provident Fund Rate</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Deducted from employees with ≥1 year service</p>
                </div>
              </div>
              <button onClick={() => setShowPfSettings(false)} className="p-2 text-slate-400 hover:text-slate-700 transition-all"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 space-y-1 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                <p>• Applies to all employees with <span className="font-black">≥1 year</span> of service.</p>
                <p>• Deducted from gross salary each month.</p>
                <p>• Disbursed on the <span className="font-black">5th of the following month</span>.</p>
              </div>
              <div>
                <label className={labelCls}>PF Rate (%)</label>
                <div className="flex gap-2">
                  <input
                    type="number" min={0} max={100} step={0.5}
                    value={pfRateInput}
                    onChange={e => setPfRateInput(e.target.value)}
                    className={inputCls + ' flex-1'}
                    placeholder="e.g. 5"
                  />
                  <span className="flex items-center px-4 bg-gray-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-500">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">Currently active: <span className="font-black text-indigo-600">{(pfRate * 100).toFixed(1)}%</span></p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowPfSettings(false)} className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Cancel</button>
                <button onClick={handleSavePfRate} disabled={pfRateSaving}
                  className="flex-[2] py-3 bg-indigo-500 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {pfRateSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  {pfRateSaving ? 'Saving...' : 'Save Rate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollView;
