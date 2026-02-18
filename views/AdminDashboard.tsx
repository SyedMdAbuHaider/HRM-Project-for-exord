
import React from 'react';
import { useHRM } from '../store';
import { Users, Clock, CalendarCheck, ShieldCheck, TrendingUp, TrendingDown, ArrowUpRight, Activity, DollarSign, Zap, Fingerprint } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '../utils';

const AdminDashboard: React.FC = () => {
  const { users, attendance, leaves, auditLogs, salaries } = useHRM();

  const totalPayroll = salaries.reduce((acc, s) => acc + s.net, 0);

  const stats = [
    { 
      label: 'Workforce Hub', 
      value: users.length, 
      trend: '+12%', 
      isUp: true, 
      icon: Users, 
      gradient: 'from-blue-600 to-indigo-600',
      description: 'Active personnel logged'
    },
    { 
      label: 'Duty Velocity', 
      value: `${Math.round((attendance.filter(a => a.type === 'CHECK_IN' && a.status === 'SUCCESS').length / Math.max(users.length, 1)) * 100)}%`, 
      trend: '+5%', 
      isUp: true, 
      icon: Activity, 
      gradient: 'from-emerald-500 to-teal-600',
      description: 'Compliance verification'
    },
    { 
      label: 'Network Payroll', 
      value: formatCurrency(totalPayroll), 
      trend: '৳', 
      isUp: true, 
      icon: DollarSign, 
      gradient: 'from-amber-500 to-orange-600',
      description: 'Net monthly flow'
    },
    { 
      label: 'Protocol Alerts', 
      value: auditLogs.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL').length, 
      trend: '!', 
      isUp: false, 
      icon: ShieldCheck, 
      gradient: 'from-rose-500 to-red-600',
      description: 'High-risk deviations'
    },
  ];

  const trendData = [
    { name: '08:00', rate: 12 },
    { name: '09:00', rate: 45 },
    { name: '10:00', rate: 78 },
    { name: '11:00', rate: 94 },
    { name: '12:00', rate: 89 },
    { name: '13:00', rate: 82 },
    { name: '14:00', rate: 86 },
    { name: '15:00', rate: 90 },
  ];

  const deptData = [
    { name: 'NetOps', count: users.filter(u => u.department === 'Network Operations').length, color: '#ef4444' },
    { name: 'Support', count: users.filter(u => u.department === 'Customer Support').length, color: '#3b82f6' },
    { name: 'Field', count: users.filter(u => u.department === 'Field Engineering').length, color: '#10b981' },
    { name: 'Sales', count: users.filter(u => u.department === 'Sales').length, color: '#f59e0b' },
    { name: 'Admin', count: users.filter(u => u.department === 'Administration').length, color: '#6366f1' },
  ];

  return (
    <div className="space-y-12 pb-24 animate-[fadeIn_0.6s_ease-out]">
      {/* Executive Welcome Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100 flex items-center gap-2">
              <Zap size={10} fill="currentColor" /> Operational Node Active
            </div>
          </div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter font-jakarta">Network Command</h2>
          <p className="text-slate-500 font-medium text-lg">Visualizing real-time workforce synchronization & resource allocation.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-8 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-slate-600 hover:bg-slate-50 transition-all soft-shadow">
            Security Export
          </button>
          <button className="px-8 py-4 bg-slate-950 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-red-600 transition-all deep-shadow shadow-slate-200">
            Node Settings
          </button>
        </div>
      </div>

      {/* Command Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="group bg-white p-10 rounded-[2.5rem] border border-slate-100 hover:border-red-500/10 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] transition-all duration-500 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-[0.03] rounded-full -mr-12 -mt-12 transition-all duration-700 group-hover:scale-150`}></div>
            
            <div className="flex items-start justify-between mb-10 relative z-10">
              <div className={`p-5 rounded-[1.5rem] bg-gradient-to-br ${stat.gradient} text-white shadow-xl shadow-slate-200/50 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className={`flex items-center gap-1 text-[11px] font-black px-3 py-2 rounded-xl border ${stat.isUp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                {stat.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {stat.trend}
              </div>
            </div>
            
            <div className="relative z-10 space-y-2">
              <h3 className="text-4xl font-black text-slate-950 tracking-tighter font-jakarta">{stat.value}</h3>
              <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">{stat.label}</p>
              <div className="pt-4 flex items-center gap-2">
                 <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${stat.gradient} w-[80%] rounded-full opacity-60`}></div>
                 </div>
                 <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{stat.description}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Operational Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-8 bg-white p-10 lg:p-14 rounded-[3.5rem] border border-slate-100 soft-shadow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-16">
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight font-jakarta">Real-time Biometric Pulse</h3>
              <p className="text-sm text-slate-400 font-medium italic">Operational duty density and shift synchronization.</p>
            </div>
            <div className="bg-slate-100/50 p-2 rounded-2xl flex gap-1">
              {['Daily Flow', 'Projected', 'Archived'].map(tab => (
                <button key={tab} className={`px-5 py-3 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'Daily Flow' ? 'bg-white text-red-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }} dy={20} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }} unit="%" />
                <Tooltip 
                  cursor={{ stroke: '#ef4444', strokeWidth: 1, strokeDasharray: '8 8' }}
                  contentStyle={{ borderRadius: '2rem', border: 'none', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', padding: '2rem', backgroundColor: '#0f172a', color: '#fff' }}
                />
                <Area type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={6} fillOpacity={1} fill="url(#colorPulse)" animationDuration={2500} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-4 bg-white p-10 lg:p-14 rounded-[3.5rem] border border-slate-100 soft-shadow flex flex-col">
          <div className="mb-12 space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight font-jakarta">Node Distribution</h3>
            <p className="text-sm text-slate-400 font-medium">Personnel allocation by infrastructure sector.</p>
          </div>
          <div className="flex-1 flex flex-col justify-between">
             <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData} layout="vertical" margin={{ left: -15 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 900 }} width={80} />
                    <Tooltip cursor={{ fill: 'rgba(239, 68, 68, 0.03)' }} contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }} />
                    <Bar dataKey="count" radius={[0, 20, 20, 0]} barSize={34}>
                      {deptData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
             <div className="grid grid-cols-2 gap-5 pt-10 border-t border-slate-50">
               {deptData.slice(0, 4).map((dept, i) => (
                 <div key={i} className="flex flex-col gap-2 p-5 rounded-3xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-red-100 transition-all duration-300">
                   <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dept.color }}></div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{dept.name}</p>
                   <p className="text-xl font-black text-slate-950 font-jakarta">{dept.count} <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Active</span></p>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>

      {/* Operations Feed */}
      <div className="bg-white rounded-[3.5rem] border border-slate-100 p-10 lg:p-14 soft-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-16">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight font-jakarta">Infrastructure Sequence</h3>
            <p className="text-sm text-slate-400 font-medium">Latest biometric authentication events across all nodes.</p>
          </div>
          <button className="px-8 py-4 bg-slate-50 border border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all">Audit Vault</button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-10">
          {attendance.slice(-6).reverse().map((record, i) => (
            <div key={record.id} className="p-8 rounded-[2.5rem] bg-slate-50/50 border border-slate-100 flex items-center gap-6 group hover:bg-white hover:shadow-2xl hover:shadow-slate-200/40 hover:border-red-100 transition-all duration-500 animate-[fadeIn_0.5s_ease-out]" style={{ animationDelay: `${i * 100}ms` }}>
              <div className={`p-5 rounded-[1.5rem] shadow-lg transition-all duration-700 group-hover:rotate-12 ${record.type === 'CHECK_IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                 <Fingerprint size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-[0.15em] truncate">
                    {record.type.replace('_', ' ')}
                  </p>
                  <span className="text-[10px] font-bold text-slate-400">{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-[11px] font-bold text-slate-500 truncate">Node: <span className="text-slate-950 font-black">{record.userId}</span></p>
                  <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{record.ipAddress}</p>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                <ArrowUpRight size={20} className="text-red-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
