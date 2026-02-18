
import React, { useState, useEffect } from 'react';
import { useHRM } from '../store';
import { MapPin, Wifi, ShieldCheck, Clock, Send, AlertTriangle, Globe, ChevronRight, Fingerprint, MapPinned, Activity, Zap, Layers, DollarSign, Calendar } from 'lucide-react';
import { formatDate, formatCurrency } from '../utils';

const EmployeePortal: React.FC = () => {
  const { currentUser, checkIn, checkOut, attendance, addGPSLog } = useHRM();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [mockIp, setMockIp] = useState('192.168.1.52');
  const [mockLoc, setMockLoc] = useState({ lat: 40.7128, lng: -74.0060 });

  // Simulate background tracking
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      addGPSLog({
        userId: currentUser.id,
        lat: mockLoc.lat + (Math.random() - 0.5) * 0.001,
        lng: mockLoc.lng + (Math.random() - 0.5) * 0.001,
        timestamp: new Date().toISOString(),
        accuracy: 10
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [currentUser, mockLoc, addGPSLog]);

  const handleAttendance = async (type: 'IN' | 'OUT') => {
    setLoading(true);
    setFeedback(null);
    try {
      await new Promise(r => setTimeout(r, 1500)); 
      const res = type === 'IN' 
        ? await checkIn(mockLoc.lat, mockLoc.lng, 10, mockIp)
        : await checkOut(mockLoc.lat, mockLoc.lng, 10, mockIp);
      
      setFeedback({ type: res.success ? 'success' : 'error', message: res.message });
      setTimeout(() => setFeedback(null), 6000);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Protocol link timeout. Retrying authentication handshake...' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-[fadeIn_0.6s_ease-out] pb-20">
      {/* Dynamic Profile Header */}
      <div className="bg-slate-950 text-white rounded-[3rem] p-10 lg:p-14 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[100px] -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-[80px] -ml-20 -mb-20"></div>
        
        <div className="relative z-10 space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center font-black text-4xl shadow-2xl shadow-red-900/40 relative group cursor-pointer transition-transform duration-500 hover:rotate-6">
                {currentUser?.name.charAt(0)}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full border-4 border-slate-950 flex items-center justify-center shadow-lg">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-red-500 text-[11px] font-black uppercase tracking-[0.4em]">Node Verified: {currentUser?.id}</p>
                <h2 className="text-4xl font-black tracking-tighter font-jakarta leading-none">{currentUser?.name}</h2>
                <div className="flex items-center gap-3 mt-3">
                  <span className="px-3 py-1 bg-white/5 border border-white/10 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-[0.2em]">{currentUser?.department}</span>
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold bg-white/5 px-2 py-1 rounded-lg">
                    <MapPin size={12} className="text-red-500" /> Sector Cluster 04
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              <div className="bg-white/5 backdrop-blur-xl rounded-[1.5rem] p-5 border border-white/10 text-right min-w-[180px] soft-shadow">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">Network Topology</p>
                <div className="flex items-center justify-end gap-3">
                  <p className={`text-sm font-black font-jakarta ${mockIp.startsWith('192.168.1') ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {mockIp}
                  </p>
                  {mockIp.startsWith('192.168.1') ? <Wifi size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-rose-500 animate-pulse" />}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-white/5">
            {[
              { label: 'Base Pay', value: formatCurrency(currentUser?.baseSalary || 0), icon: DollarSign },
              { label: 'Duty Cycle', value: '08:00 - 17:00', icon: Clock },
              { label: 'Leaves', value: '14 Available', icon: Calendar },
              { label: 'Status', value: 'Duty Ready', icon: ShieldCheck },
            ].map((stat, i) => (
              <div key={i} className="space-y-1 group cursor-pointer">
                <div className="flex items-center gap-2 text-slate-500 group-hover:text-red-500 transition-colors">
                  <stat.icon size={12} />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em]">{stat.label}</p>
                </div>
                <p className="text-sm font-black text-white group-hover:translate-x-1 transition-transform">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operation Center */}
      <div className="bg-white rounded-[3rem] border border-slate-100 p-10 lg:p-14 soft-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-950 font-jakarta tracking-tight">Operation Console</h3>
            <p className="text-sm text-slate-400 font-medium">Biometric synchronization with geo-perimeter lock.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Fingerprint size={14} className="text-red-500" /> ID ACTIVE
             </div>
             <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <MapPinned size={14} className="text-red-500" /> GPS SECURED
             </div>
          </div>
        </div>

        {feedback && (
          <div className={`mb-10 p-6 rounded-[2rem] text-xs font-black uppercase tracking-widest flex items-center gap-5 animate-[slideDown_0.4s_ease-out] border-2 ${
            feedback.type === 'success' 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-xl shadow-emerald-200/20' 
            : 'bg-rose-50 text-rose-700 border-rose-100 shadow-xl shadow-rose-200/20'
          }`}>
            <div className={`p-3 rounded-2xl ${feedback.type === 'success' ? 'bg-emerald-200' : 'bg-rose-200'}`}>
              {feedback.type === 'success' ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
            </div>
            <p className="leading-relaxed">{feedback.message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <button
            onClick={() => handleAttendance('IN')}
            disabled={loading}
            className="group relative flex flex-col items-center justify-center gap-6 p-12 rounded-[2.5rem] bg-gradient-to-br from-red-50 to-rose-50 text-red-700 transition-all duration-500 border border-red-100/50 hover:border-red-500 active:scale-[0.97] disabled:opacity-50 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-red-200"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-100 rounded-full blur-[40px] opacity-0 group-hover:opacity-40 transition-opacity"></div>
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 border border-red-50">
               <Clock size={40} className="group-hover:rotate-12 transition-transform" />
            </div>
            <div className="text-center relative z-10">
              <span className="font-black text-sm uppercase tracking-[0.3em] block mb-2">Sync Check-In</span>
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Initialize Shift Sequence</span>
            </div>
            {loading && <div className="absolute inset-0 bg-red-600/5 flex items-center justify-center backdrop-blur-sm animate-pulse"></div>}
          </button>
          
          <button
            onClick={() => handleAttendance('OUT')}
            disabled={loading}
            className="group relative flex flex-col items-center justify-center gap-6 p-12 rounded-[2.5rem] bg-slate-900 text-white transition-all duration-500 border border-slate-800 hover:bg-slate-950 active:scale-[0.97] disabled:opacity-50 shadow-sm hover:shadow-2xl hover:shadow-slate-300"
          >
            <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 border border-slate-700">
               <Send size={40} className="rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </div>
            <div className="text-center">
              <span className="font-black text-sm uppercase tracking-[0.3em] block mb-2">Sync Check-Out</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Terminate Active Duty</span>
            </div>
          </button>
        </div>

        {/* Node Simulator Console */}
        <div className="mt-12 p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-red-600"></div>
          <div className="flex items-center gap-4 mb-8">
            <Activity size={20} className="text-red-500" />
            <h4 className="text-[11px] text-slate-950 uppercase font-black tracking-[0.2em] font-jakarta">Node Simulator Console</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Office Node', active: mockIp === '192.168.1.52', icon: Wifi, onClick: () => setMockIp('192.168.1.52') },
              { label: 'Public Net', active: mockIp === '10.0.0.1', icon: Globe, onClick: () => setMockIp('10.0.0.1') },
              { label: 'HQ Perimeter', active: mockLoc.lat === 40.7128, icon: MapPinned, onClick: () => setMockLoc({ lat: 40.7128, lng: -74.0060 }) },
              { label: 'Field Sector', active: mockLoc.lat === 41, icon: MapPin, onClick: () => setMockLoc({ lat: 41, lng: -75 }) },
            ].map((tool, i) => (
              <button 
                key={i}
                onClick={tool.onClick} 
                className={`flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 border-2 font-black uppercase text-[10px] tracking-widest ${
                  tool.active 
                  ? 'bg-slate-950 text-white border-slate-950 shadow-xl scale-[1.02]' 
                  : 'bg-white text-slate-400 border-transparent hover:border-slate-200'
                }`}
              >
                <tool.icon size={14} className={tool.active ? 'text-red-500' : 'text-slate-300'} />
                {tool.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Audit History Timeline */}
      <div className="bg-white rounded-[3rem] border border-slate-100 p-10 lg:p-14 soft-shadow">
        <div className="flex items-center justify-between mb-12">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-950 font-jakarta tracking-tight">Sequence Archive</h3>
            <p className="text-sm text-slate-400 font-medium italic">Latest shift authentication audit logs.</p>
          </div>
          <button className="p-4 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all soft-shadow">
            <Layers size={22} />
          </button>
        </div>
        
        <div className="space-y-6">
          {attendance.filter(a => a.userId === currentUser?.id).slice(-4).reverse().map((record, i) => (
            <div 
              key={record.id} 
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-7 bg-slate-50/50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 hover:border-red-200 transition-all duration-500 group cursor-default animate-[fadeIn_0.5s_ease-out]"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-6">
                <div className={`p-4 rounded-2xl transition-all duration-700 group-hover:scale-110 group-hover:rotate-12 shadow-md ${
                  record.type === 'CHECK_IN' ? 'bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50' : 'bg-rose-50 text-rose-600 ring-4 ring-rose-50/50'
                }`}>
                  <Zap size={22} />
                </div>
                <div className="space-y-1">
                  <p className="text-[13px] font-black text-slate-950 uppercase tracking-[0.1em] flex items-center gap-3">
                    {record.type === 'CHECK_IN' ? 'Node Connected' : 'Node Disconnected'}
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    <span className="text-[11px] text-slate-400 font-bold lowercase tracking-normal">{record.ipAddress}</span>
                  </p>
                  <p className="text-xs text-slate-500 font-medium">{formatDate(record.timestamp)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-100 soft-shadow group-hover:border-red-100 transition-colors self-start sm:self-center">
                <ShieldCheck size={18} className="text-emerald-500" />
                <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Protocol Verified</span>
                <ChevronRight size={16} className="text-slate-200 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
          
          {attendance.filter(a => a.userId === currentUser?.id).length === 0 && (
            <div className="py-20 text-center text-slate-400 font-medium italic border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
              No authenticated sequence records detected for this node.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeePortal;
