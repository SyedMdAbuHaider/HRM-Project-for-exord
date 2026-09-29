import { useLanguage } from '../i18n';
import React, { useMemo, useState } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import {
  Users, Clock, ShieldCheck, TrendingUp, Activity, DollarSign,
  Zap, ChevronDown, BarChart2, AlertTriangle, UserCheck, UserX
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend, ComposedChart, Line,
} from 'recharts';
import { formatCurrency } from '../utils';
import ManagerDeptDashboard from './ManagerDeptDashboard';

type Range = '7d' | '30d' | '90d';

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const AttendanceTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl min-w-[180px]">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{d?.fullDate || label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-[11px] font-bold text-slate-300">{p.name}</span>
          </div>
          <span className="text-[11px] font-black text-white">{p.value}</span>
        </div>
      ))}
      {d?.rate !== undefined && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-[10px] text-slate-400 font-bold">Attendance Rate: <span className="text-white font-black">{d.rate}%</span></p>
        </div>
      )}
    </div>
  );
};

const DeptTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl min-w-[160px]">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 truncate max-w-[140px]">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-[11px] text-slate-300 font-bold">{p.name}</span>
          </div>
          <span className="text-[11px] font-black text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
  const { currentUser, users, attendance, activityLogs, salaries, leaves, loanRequests, departments } = useHRM();
  // Managers get their department-scoped dashboard instead
  if (currentUser?.role === UserRole.MANAGER) return <ManagerDeptDashboard />;
  const { t } = useLanguage();
  const [range, setRange] = useState<Range>('30d');
  const [chartView, setChartView] = useState<'trend' | 'dept'>('trend');

  // ── Stat calculations ─────────────────────────────────────────────────────
  const todayStr = new Date().toDateString();
  const todayCheckIns = attendance.filter(a =>
    a.type === 'CHECK_IN' && a.status === 'SUCCESS' &&
    new Date(a.timestamp).toDateString() === todayStr
  );
  const uniqueTodayUsers = new Set(todayCheckIns.map(a => a.userId)).size;
  const employeeCount = users.filter(u => u.role !== 'ADMIN' && u.role !== 'DEVELOPER').length;
  const dutyVelocity = employeeCount > 0 ? Math.round((uniqueTodayUsers / employeeCount) * 100) : 0;
  const totalPayroll = (salaries || []).reduce((acc, s) => acc + s.net, 0);
  const pendingLeaves = leaves.filter(l => l.status === 'PENDING').length;
  const pendingLoans = (loanRequests || []).filter(l => l.status === 'PENDING').length;
  const totalAlerts = (activityLogs || []).filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL').length;

  // Late arrivals today
  const lateToday = todayCheckIns.filter(a => a.isLate).length;

  const stats = [
    {
      label: t('total_workforce'),
      value: users.length,
      sub: `${uniqueTodayUsers} ${t('present_today')}`,
      icon: Users,
      gradient: 'from-blue-600 to-indigo-600',
    },
    {
      label: t('duty_velocity'),
      value: `${dutyVelocity}%`,
      sub: t('checked_in_today'),
      icon: Activity,
      gradient: dutyVelocity >= 80 ? 'from-emerald-500 to-teal-600' : dutyVelocity >= 50 ? 'from-amber-500 to-orange-500' : 'from-rose-500 to-red-600',
    },
    {
      label: t('monthly_payroll'),
      value: formatCurrency(totalPayroll),
      sub: t('total_disbursed'),
      icon: DollarSign,
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      label: t('protocol_alerts'),
      value: totalAlerts,
      sub: `${pendingLeaves} leave · ${pendingLoans} loan pending`,
      icon: ShieldCheck,
      gradient: 'from-rose-500 to-red-600',
    },
  ];

  // ── Trend data (configurable range) ──────────────────────────────────────
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;

  const trendData = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const dStr = d.toDateString();

      const dayCheckIns = attendance.filter(a =>
        a.type === 'CHECK_IN' && a.status === 'SUCCESS' &&
        new Date(a.timestamp).toDateString() === dStr
      );
      const uniqueIn  = new Set(dayCheckIns.map(a => a.userId)).size;
      const lateCount = dayCheckIns.filter(a => a.isLate).length;
      const absentCount = Math.max(0, employeeCount - uniqueIn);
      const rate = employeeCount > 0 ? Math.round((uniqueIn / employeeCount) * 100) : 0;

      // Label: show fewer ticks for long ranges
      const label = days <= 7
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : days <= 30
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : i % 7 === 0
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

      return {
        name: label,
        fullDate: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        present: uniqueIn,
        late: lateCount,
        absent: absentCount,
        rate,
      };
    });
  }, [attendance, days, employeeCount]);

  // Average attendance rate over range
  const avgRate = trendData.length > 0
    ? Math.round(trendData.reduce((s, d) => s + d.rate, 0) / trendData.length)
    : 0;
  const maxPresent = Math.max(...trendData.map(d => d.present), 1);

  // ── Department breakdown ──────────────────────────────────────────────────
  const deptData = useMemo(() => {
    const todayDateStr = new Date().toISOString().split('T')[0];
    return departments.map(dept => {
      const deptUsers = users.filter(u => u.department === dept.name);
      const total = deptUsers.length;
      if (total === 0) return null;
      const present = deptUsers.filter(u =>
        attendance.some(a =>
          a.userId === u.id && a.type === 'CHECK_IN' &&
          a.status === 'SUCCESS' && new Date(a.timestamp).toDateString() === todayStr
        )
      ).length;
      const absent = total - present;
      return {
        name: dept.name.length > 12 ? dept.name.slice(0, 11) + '…' : dept.name,
        fullName: dept.name,
        present,
        absent,
        total,
        rate: Math.round((present / total) * 100),
      };
    }).filter(Boolean).sort((a: any, b: any) => b!.total - a!.total).slice(0, 12) as any[];
  }, [departments, users, attendance, todayStr]);

  // ── Peak hour heatmap (today's check-ins by hour) ─────────────────────────
  const peakHours = useMemo(() => {
    const hours = Array.from({ length: 13 }, (_, i) => ({ hour: i + 6, count: 0 })); // 6am–6pm
    todayCheckIns.forEach(a => {
      const h = new Date(a.timestamp).getHours();
      const slot = hours.find(x => x.hour === h);
      if (slot) slot.count++;
    });
    const max = Math.max(...hours.map(h => h.count), 1);
    return hours.map(h => ({ ...h, pct: Math.round((h.count / max) * 100) }));
  }, [todayCheckIns]);

  // ── Activity feed ─────────────────────────────────────────────────────────
  const recentEvents = useMemo(() =>
    activityLogs.filter(l => new Date(l.timestamp).toDateString() === todayStr).slice(0, 6),
    [activityLogs, todayStr]
  );

  const severityDot: Record<string, string> = {
    LOW: 'bg-emerald-400', MEDIUM: 'bg-amber-400',
    HIGH: 'bg-orange-500', CRITICAL: 'bg-red-600',
  };

  const rangeLabels: Record<Range, string> = { '7d': '7 Days', '30d': '30 Days', '90d': '90 Days' };

  return (
    <div className="space-y-8 sm:space-y-10 pb-20 sm:pb-24 animate-[fadeIn_0.6s_ease-out]">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-[#E31E24] rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-900/40 inline-flex items-center gap-2">
            <Zap size={10} fill="currentColor" /> {t('operational_node_active')}
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            {t('network_command')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-base sm:text-lg">
            {t('real_time_sync')}
          </p>
        </div>
        {/* Quick stats */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl flex items-center gap-2">
            <UserCheck size={14} className="text-emerald-600" />
            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">{uniqueTodayUsers} present</span>
          </div>
          <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-xs font-black text-amber-700 dark:text-amber-400">{lateToday} late</span>
          </div>
          <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex items-center gap-2">
            <UserX size={14} className="text-rose-600" />
            <span className="text-xs font-black text-rose-700 dark:text-rose-400">{Math.max(0, employeeCount - uniqueTodayUsers)} absent</span>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 p-5 sm:p-7 rounded-[2rem] border border-slate-100 dark:border-slate-800 transition-all duration-300 soft-shadow">
            <div className={`p-3 w-fit rounded-[1.2rem] bg-gradient-to-br ${stat.gradient} text-white shadow-xl mb-4`}>
              <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tighter font-jakarta mb-1">
              {stat.value}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.2em]">
              {stat.label}
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-1 leading-snug">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Main analytics section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Advanced Chart ─────────────────────────────────────────────── */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 soft-shadow overflow-hidden">

          {/* Chart header */}
          <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {t('seven_day_trend').replace('7-Day', `${rangeLabels[range]}`)}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  {t('unique_employees')} · Avg rate: <span className="font-black text-slate-600 dark:text-slate-300">{avgRate}%</span>
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Chart type toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setChartView('trend')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chartView === 'trend' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <TrendingUp size={11} /> Trend
                  </button>
                  <button
                    onClick={() => setChartView('dept')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chartView === 'dept' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <BarChart2 size={11} /> Dept
                  </button>
                </div>

                {/* Range picker — only for trend view */}
                {chartView === 'trend' && (
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                    {(['7d', '30d', '90d'] as Range[]).map(r => (
                      <button key={r} onClick={() => setRange(r)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${range === r ? 'bg-[#E31E24] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        {rangeLabels[r]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Trend Chart ─────────────────────────────────────────────── */}
          {chartView === 'trend' && (
            <div className="px-2 sm:px-4 pb-6">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E31E24" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#E31E24" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148,163,184,0.12)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false} tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                      interval={days <= 7 ? 0 : days <= 30 ? 2 : 6}
                    />
                    {/* Left Y: headcount */}
                    <YAxis
                      yAxisId="count"
                      axisLine={false} tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      allowDecimals={false}
                      domain={[0, Math.max(Math.ceil(maxPresent * 1.2), 10)]}
                      width={38}
                    />
                    {/* Right Y: percentage */}
                    <YAxis
                      yAxisId="pct"
                      orientation="right"
                      axisLine={false} tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      domain={[0, 100]}
                      tickFormatter={v => `${v}%`}
                      width={38}
                    />
                    {/* 80% attendance reference line */}
                    <ReferenceLine
                      yAxisId="pct" y={80} stroke="#10b981"
                      strokeDasharray="6 4" strokeWidth={1.5}
                      label={{ value: '80% target', fill: '#10b981', fontSize: 9, fontWeight: 700, position: 'insideTopRight' }}
                    />
                    <Tooltip content={<AttendanceTooltip />} />
                    <Legend
                      iconType="circle" iconSize={8}
                      wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 12, paddingLeft: 16 }}
                    />
                    {/* Present area */}
                    <Area
                      yAxisId="count"
                      type="monotone" dataKey="present" name="Present"
                      stroke="#E31E24" strokeWidth={2.5}
                      fill="url(#gradPresent)"
                      dot={days <= 7 ? { fill: '#E31E24', r: 4, strokeWidth: 0 } : false}
                      activeDot={{ r: 6, fill: '#E31E24', strokeWidth: 0 }}
                    />
                    {/* Late bars */}
                    <Bar
                      yAxisId="count"
                      dataKey="late" name="Late"
                      fill="#f59e0b" opacity={0.7}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={days <= 7 ? 20 : days <= 30 ? 10 : 5}
                    />
                    {/* Attendance rate line */}
                    <Line
                      yAxisId="pct"
                      type="monotone" dataKey="rate" name="Rate %"
                      stroke="#6366f1" strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 0 }}
                      strokeDasharray="5 3"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Legend explanation */}
              <div className="flex flex-wrap gap-4 px-4 pt-2">
                {[
                  { color: '#E31E24', label: 'Present (headcount)', solid: true },
                  { color: '#f59e0b', label: 'Late arrivals', solid: true },
                  { color: '#6366f1', label: 'Attendance rate %', solid: false },
                  { color: '#10b981', label: '80% target', solid: false },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-5 h-0.5 flex-shrink-0" style={{ background: item.color, borderBottom: item.solid ? 'none' : `2px dashed ${item.color}`, height: item.solid ? 2 : 0 }} />
                    {!item.solid && <div className="w-5 h-0" style={{ borderBottom: `2px dashed ${item.color}` }} />}
                    {item.solid && <div className="w-5 h-0.5 flex-shrink-0" style={{ background: item.color }} />}
                    <span className="text-[9px] font-bold text-slate-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Department breakdown ────────────────────────────────────── */}
          {chartView === 'dept' && (
            <div className="px-2 sm:px-4 pb-6">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={deptData}
                    layout="vertical"
                    margin={{ top: 5, right: 60, left: 8, bottom: 5 }}
                    barSize={12}
                  >
                    <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="rgba(148,163,184,0.12)" />
                    <XAxis
                      type="number"
                      axisLine={false} tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category" dataKey="name"
                      axisLine={false} tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                      width={90}
                    />
                    <Tooltip content={<DeptTooltip />} />
                    <Legend
                      iconType="circle" iconSize={8}
                      wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 8 }}
                    />
                    <Bar dataKey="present" name="Present" fill="#E31E24" radius={[0, 3, 3, 0]} stackId="a" />
                    <Bar dataKey="absent" name="Absent" fill="#e2e8f0" radius={[0, 3, 3, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Dept rate pills */}
              <div className="flex flex-wrap gap-2 px-4 pt-2">
                {deptData.slice(0, 6).map((d: any) => (
                  <div key={d.name} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.rate >= 80 ? 'bg-emerald-500' : d.rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    <span className="text-[9px] font-black text-slate-600 dark:text-slate-300">{d.name}</span>
                    <span className="text-[9px] font-black text-slate-400">{d.rate}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Peak Hour Heatmap (always shown) ──────────────────────── */}
          <div className="border-t border-slate-100 dark:border-slate-800 px-6 sm:px-8 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <Clock size={10} /> Today's Peak Check-In Hours
            </p>
            <div className="flex items-end gap-1 h-12">
              {peakHours.map(h => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: `${Math.max(h.pct, 4)}%`,
                      background: h.pct > 60 ? '#E31E24' : h.pct > 30 ? '#f59e0b' : '#e2e8f0',
                      minHeight: 2,
                    }}
                    title={`${h.hour}:00 — ${h.count} check-ins`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[8px] text-slate-400 font-bold">6am</span>
              <span className="text-[8px] text-slate-400 font-bold">12pm</span>
              <span className="text-[8px] text-slate-400 font-bold">6pm</span>
            </div>
          </div>
        </div>

        {/* ── Today's Activity Feed ──────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 soft-shadow flex flex-col overflow-hidden">
          <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 dark:text-white">{t('todays_events')}</h3>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-black">
              {recentEvents.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-50 dark:divide-slate-800/50">
            {recentEvents.length === 0 && (
              <p className="text-sm text-slate-400 italic text-center py-12">{t('no_events_today')}</p>
            )}
            {recentEvents.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${severityDot[ev.severity] || 'bg-slate-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-slate-900 dark:text-white truncate">{ev.action}</p>
                  <p className="text-[10px] text-slate-400 font-medium truncate">{ev.details}</p>
                  <p className="text-[9px] text-slate-300 dark:text-slate-600 mt-0.5">
                    {new Date(ev.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                  ev.severity === 'CRITICAL' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                  ev.severity === 'HIGH' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' :
                  ev.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                  'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                }`}>{ev.severity}</span>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>{t('total_today')}</span>
              <span>{activityLogs.filter(l => new Date(l.timestamp).toDateString() === todayStr).length} {t('events')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
