/**
 * ManagerDeptDashboard.tsx — Exord Online HRM
 *
 * Department-specific dashboard shown to MANAGERs.
 * Replaces the full AdminDashboard when role === MANAGER.
 *
 * HOW TO USE in AdminDashboard.tsx (or App.tsx renderView):
 *   import ManagerDeptDashboard from './ManagerDeptDashboard';
 *   // Then at the top of AdminDashboard render:
 *   if (currentUser?.role === UserRole.MANAGER) return <ManagerDeptDashboard />;
 */

import React, { useMemo, useState } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import { formatCurrency } from '../utils';
import {
  Users, Clock, TrendingUp, DollarSign, CheckCircle2,
  XCircle, AlertTriangle, Activity, BarChart2, Calendar,
  UserCheck, UserX, RefreshCw, ChevronRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

type Range = '7d' | '30d' | '90d';

// ─── Custom chart tooltip ─────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl p-3 shadow-2xl min-w-[150px]">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-[10px] text-slate-300">{p.name}</span>
          </div>
          <span className="text-[10px] font-black text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  gradient: string;
}> = ({ label, value, sub, icon: Icon, gradient }) => (
  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 soft-shadow p-6 flex flex-col gap-4">
    <div className={`p-3 w-fit rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
      <Icon size={18} />
    </div>
    <div>
      <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{label}</p>
      <p className="text-xs text-slate-400 font-medium mt-0.5">{sub}</p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const ManagerDeptDashboard: React.FC = () => {
  const { currentUser, users, attendance, salaries, leaves, loanRequests, refreshData, isLoading } = useHRM();
  const [range, setRange] = useState<Range>('30d');

  const myDept = currentUser?.department || '';

  // ── Filter everything to this manager's department ───────────────────────
  const deptUsers = useMemo(
    () => users.filter(u => u.department === myDept && u.role !== UserRole.MANAGER && u.role !== UserRole.ADMIN && u.role !== UserRole.DEVELOPER),
    [users, myDept]
  );

  const deptUserIds = useMemo(() => new Set(deptUsers.map(u => u.id)), [deptUsers]);

  const deptAttendance = useMemo(
    () => attendance.filter(a => deptUserIds.has(a.userId)),
    [attendance, deptUserIds]
  );

  const deptSalaries = useMemo(
    () => salaries.filter(s => deptUserIds.has(s.userId)),
    [salaries, deptUserIds]
  );

  const deptLeaves = useMemo(
    () => leaves.filter(l => deptUserIds.has(l.userId)),
    [leaves, deptUserIds]
  );

  const deptLoans = useMemo(
    () => (loanRequests || []).filter((l: any) => deptUserIds.has(l.userId)),
    [loanRequests, deptUserIds]
  );

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const todayStr = new Date().toDateString();

  const todayCheckIns = useMemo(
    () => deptAttendance.filter(a =>
      a.type === 'CHECK_IN' && a.status === 'SUCCESS' &&
      new Date(a.timestamp).toDateString() === todayStr
    ),
    [deptAttendance, todayStr]
  );

  const presentToday   = new Set(todayCheckIns.map(a => a.userId)).size;
  const absentToday    = deptUsers.length - presentToday;
  const lateToday      = todayCheckIns.filter(a => a.isLate).length;
  const attendanceRate = deptUsers.length > 0 ? Math.round((presentToday / deptUsers.length) * 100) : 0;

  const totalSalary    = deptSalaries.reduce((s, r) => s + r.net, 0);
  const paidSalary     = deptSalaries.filter(r => r.status === 'PAID').reduce((s, r) => s + r.net, 0);
  const pendingLeaves  = deptLeaves.filter(l => l.status === 'PENDING').length;
  const activeLoans    = deptLoans.filter((l: any) => l.status === 'ACTIVE' || l.status === 'APPROVED').length;

  // ── Trend chart data ────────────────────────────────────────────────────────
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;

  const trendData = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const dStr = d.toDateString();

      const dayCheckIns = deptAttendance.filter(a =>
        a.type === 'CHECK_IN' && a.status === 'SUCCESS' &&
        new Date(a.timestamp).toDateString() === dStr
      );
      const uniqueIn  = new Set(dayCheckIns.map(a => a.userId)).size;
      const lateCount = dayCheckIns.filter(a => a.isLate).length;

      const label = days <= 7
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : days <= 30
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : i % 7 === 0 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

      return { name: label, present: uniqueIn, late: lateCount };
    });
  }, [deptAttendance, days]);

  // ── Monthly salary breakdown (last 6 months) ──────────────────────────────
  const salaryTrend = useMemo(() => {
    const months: Record<string, number> = {};
    deptSalaries.forEach(s => {
      const key = `${s.month} ${s.year}`;
      months[key] = (months[key] || 0) + s.net;
    });
    return Object.entries(months)
      .slice(-6)
      .map(([name, total]) => ({ name: name.slice(0, 7), total }));
  }, [deptSalaries]);

  // ── Per-employee attendance summary ──────────────────────────────────────────
  const employeeSummary = useMemo(() => {
    return deptUsers.map(u => {
      const userAtt = deptAttendance.filter(a => a.userId === u.id && a.type === 'CHECK_IN' && a.status === 'SUCCESS');
      const presentDays = new Set(userAtt.map(a => new Date(a.timestamp).toDateString())).size;
      const lateDays    = userAtt.filter(a => a.isLate).length;
      const isPresent   = todayCheckIns.some(a => a.userId === u.id);
      const pendingL    = deptLeaves.filter(l => l.userId === u.id && l.status === 'PENDING').length;
      return {
        id: u.id, name: u.name, avatar: u.avatar,
        presentDays, lateDays, isPresent, pendingLeaves: pendingL,
        salary: deptSalaries.filter(s => s.userId === u.id).reduce((sum, s) => sum + s.net, 0),
      };
    }).sort((a, b) => (b.isPresent ? 1 : 0) - (a.isPresent ? 1 : 0));
  }, [deptUsers, deptAttendance, todayCheckIns, deptLeaves, deptSalaries]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-[fadeIn_0.5s_ease-out] pb-20">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#E31E24] mb-2">Department Overview</p>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            {myDept}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium mt-1">
            {deptUsers.length} team members
          </p>
        </div>
        <button
          onClick={refreshData}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl hover:border-[#E31E24] transition-all self-start sm:self-auto"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Present Today"
          value={presentToday}
          sub={`${attendanceRate}% attendance rate`}
          icon={UserCheck}
          gradient="from-emerald-500 to-teal-600"
        />
        <StatCard
          label="Absent Today"
          value={absentToday}
          sub={`${lateToday} late check-in${lateToday !== 1 ? 's' : ''}`}
          icon={UserX}
          gradient={absentToday > 0 ? 'from-rose-500 to-red-600' : 'from-slate-400 to-slate-500'}
        />
        <StatCard
          label="Dept Payroll"
          value={formatCurrency(totalSalary)}
          sub={`${formatCurrency(paidSalary)} paid this month`}
          icon={DollarSign}
          gradient="from-amber-500 to-orange-500"
        />
        <StatCard
          label="Pending Actions"
          value={pendingLeaves + activeLoans}
          sub={`${pendingLeaves} leave · ${activeLoans} active loan`}
          icon={AlertTriangle}
          gradient={pendingLeaves + activeLoans > 0 ? 'from-purple-500 to-violet-600' : 'from-slate-400 to-slate-500'}
        />
      </div>

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Attendance trend */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 soft-shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Activity size={16} className="text-[#E31E24]" />
              <p className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">Attendance Trend</p>
            </div>
            <div className="flex gap-1">
              {(['7d', '30d', '90d'] as Range[]).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-xl transition-all ${
                    range === r ? 'bg-[#E31E24] text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="mgr-present" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="mgr-late" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#E31E24" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#E31E24" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="present" name="Present" stroke="#10b981" strokeWidth={2} fill="url(#mgr-present)" />
              <Area type="monotone" dataKey="late"    name="Late"    stroke="#E31E24" strokeWidth={1.5} fill="url(#mgr-late)" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Salary breakdown by month */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 soft-shadow p-6">
          <div className="flex items-center gap-3 mb-6">
            <DollarSign size={16} className="text-amber-500" />
            <p className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">Salary Trend</p>
          </div>
          {salaryTrend.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs font-bold">No salary data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={salaryTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  formatter={(v: any) => [formatCurrency(v), 'Net Payroll']}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem' }}
                  labelStyle={{ color: '#94a3b8', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}
                  itemStyle={{ color: '#fff', fontSize: 11, fontWeight: 900 }}
                />
                <Bar dataKey="total" name="Payroll" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Employee Roster ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 soft-shadow overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={16} className="text-[#E31E24]" />
            <p className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">Team Status Today</p>
          </div>
          <span className="text-[10px] font-black text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {deptUsers.length} members
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[9px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-8 py-4">Employee</th>
                <th className="px-8 py-4">Today</th>
                <th className="px-8 py-4">Present Days</th>
                <th className="px-8 py-4">Late Days</th>
                <th className="px-8 py-4">Dept Salary</th>
                <th className="px-8 py-4">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {employeeSummary.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 text-sm italic">No team members found.</td>
                </tr>
              )}
              {employeeSummary.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-slate-900 dark:bg-[#E31E24] text-white flex items-center justify-center text-sm font-black flex-shrink-0 overflow-hidden">
                        {emp.avatar
                          ? <img src={emp.avatar} alt="" className="w-full h-full object-cover" />
                          : emp.name.charAt(0)
                        }
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{emp.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono">{emp.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    {emp.isPresent
                      ? <span className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-black"><CheckCircle2 size={13} /> Present</span>
                      : <span className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black"><XCircle size={13} /> Absent</span>
                    }
                  </td>
                  <td className="px-8 py-4 font-black text-slate-900 dark:text-white text-sm">{emp.presentDays}</td>
                  <td className="px-8 py-4">
                    <span className={`text-sm font-black ${emp.lateDays > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                      {emp.lateDays}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-sm font-black text-slate-900 dark:text-white">
                    {emp.salary > 0 ? formatCurrency(emp.salary) : '—'}
                  </td>
                  <td className="px-8 py-4">
                    {emp.pendingLeaves > 0
                      ? <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-[9px] font-black rounded-lg">
                          {emp.pendingLeaves} leave
                        </span>
                      : <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Quick Stats Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Leaves This Month', value: deptLeaves.filter(l => l.status === 'APPROVED').length, icon: Calendar, color: 'text-blue-500' },
          { label: 'Avg Late Days / Employee', value: deptUsers.length > 0 ? (deptAttendance.filter(a => a.isLate).length / deptUsers.length).toFixed(1) : '0', icon: Clock, color: 'text-amber-500' },
          { label: 'Active Loans', value: activeLoans, icon: TrendingUp, color: 'text-purple-500' },
          { label: 'Unpaid Salaries', value: deptSalaries.filter(s => s.status === 'UNPAID').length, icon: BarChart2, color: 'text-rose-500' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 soft-shadow">
            <s.icon size={16} className={`${s.color} mb-3`} />
            <p className="text-xl font-black text-slate-900 dark:text-white">{s.value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

    </div>
  );
};

export default ManagerDeptDashboard;
