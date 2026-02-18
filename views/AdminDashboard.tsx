
import React from 'react';
import { useHRM } from '../store';
import { Users, Clock, CalendarCheck, ShieldCheck, TrendingUp, TrendingDown, ArrowUpRight, Activity, DollarSign, Zap, Fingerprint } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '../utils';

const AdminDashboard: React.FC = () => {
  const { users, attendance, auditLogs, salaries } = useHRM();
  const totalPayroll = salaries.reduce((acc, s) => acc + s.net, 0);

  const stats = [
    { label: 'Workforce Hub', value: users.length, trend: '+12%', isUp: true, icon: Users, gradient: 'from-blue-600 to-indigo-600' },
    { label: 'Duty Velocity', value: `${Math.round((attendance.filter(a => a.type === 'CHECK_IN' && a.status === 'SUCCESS').length / Math.max(users.length, 1)) * 100)}%`, trend: '+5%', isUp: true, icon: Activity, gradient: 'from-emerald-500 to-teal-600' },
    { label: 'Network Payroll', value: formatCurrency(totalPayroll), trend: '৳', isUp: true, icon: DollarSign, gradient: 'from-amber-500 to-orange-600' },
    { label: 'Protocol Alerts', value: auditLogs.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL').length, trend: '!', isUp: false, icon: ShieldCheck, gradient: 'from-rose-500 to-red-600' },
  ];

  const trendData = [
    { name: '08:00', rate: 12 }, { name: '09:00', rate: 45 }, { name: '10:00', rate: 78 }, { name: '11:00', rate: 94 },
    { name: '12:00', rate: 89 }, { name: '13:00', rate: 82 }, { name: '14:00', rate: 86 }, { name: '15:00', rate: 90 },
  ];

  return (
    <div className="space-y-12 pb-24 animate-[fadeIn_0.6s_ease-out]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-3">
          <div className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-[#E31E24] rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-900/40 inline-flex items-center gap-2">
            <Zap size={10} fill="currentColor" /> Operational Node Active
          </div>
          <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta transition-colors">Network Command</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">Real-time workforce synchronization.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 transition-all duration-300 soft-shadow">
            <div className={`p-5 w-fit rounded-[1.5rem] bg-gradient-to-br ${stat.gradient} text-white shadow-xl mb-10`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <h3 className="text-4xl font-black text-slate-950 dark:text-white tracking-tighter font-jakarta mb-2">{stat.value}</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.2em]">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-1 gap-10">
        <div className="bg-white dark:bg-slate-900 p-10 lg:p-14 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 transition-colors soft-shadow">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-16">Duty Velocity Analytics</h3>
          <div className="h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E31E24" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#E31E24" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="rate" stroke="#E31E24" strokeWidth={6} fill="url(#colorPulse)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
