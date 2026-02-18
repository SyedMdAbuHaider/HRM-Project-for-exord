
import React, { useState, useEffect, useRef } from 'react';
import { useHRM } from '../store';
import { MapPin, Wifi, ShieldCheck, Clock, Send, AlertTriangle, Globe, ChevronRight, Fingerprint, MapPinned, Activity, Zap, Layers, DollarSign, Calendar, Navigation, ShieldAlert, Crosshair } from 'lucide-react';
import { formatDate, formatCurrency } from '../utils';

const EmployeePortal: React.FC = () => {
  const { currentUser, checkIn, checkOut, attendance, addGPSLog, isTracking, setTracking, addAuditLog } = useHRM();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [mockIp, setMockIp] = useState('192.168.1.52');
  const watchIdRef = useRef<number | null>(null);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setFeedback({ type: 'error', message: 'Geolocation is not supported by your environment.' });
      return;
    }

    setTracking(true);
    addAuditLog('SURVEILLANCE_START', 'Real-time GPS tracking initiated by worker.', 'LOW');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        addGPSLog({
          userId: currentUser?.id || '',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: pos.coords.accuracy
        });
      },
      (err) => {
        setTracking(false);
        setFeedback({ type: 'error', message: 'Surveillance link broken. Check GPS permissions.' });
        addAuditLog('SURVEILLANCE_ERROR', `GPS failure: ${err.message}`, 'MEDIUM');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
    addAuditLog('SURVEILLANCE_STOP', 'Real-time GPS tracking terminated by worker.', 'LOW');
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const handleAttendance = async (type: 'IN' | 'OUT') => {
    setLoading(true);
    setFeedback(null);
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const res = type === 'IN' 
          ? await checkIn(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, mockIp)
          : await checkOut(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, mockIp);
        
        setFeedback({ type: res.success ? 'success' : 'error', message: res.message });
        if (res.success && type === 'IN') startTracking();
        if (res.success && type === 'OUT') stopTracking();
        
        setTimeout(() => setFeedback(null), 6000);
        setLoading(false);
      }, () => {
        setFeedback({ type: 'error', message: 'GPS access denied. Required for node verification.' });
        setLoading(false);
      });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Protocol link timeout.' });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 sm:space-y-10 animate-[fadeIn_0.4s_ease-out] pb-24 px-2 sm:px-0">
      {/* Mobile Profile Card */}
      <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-white/5 transition-all">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-[80px] -mr-10 -mt-10"></div>
        
        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#E31E24] to-red-600 flex items-center justify-center font-black text-2xl sm:text-3xl shadow-xl shadow-red-900/20">
              {currentUser?.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                 <span className="px-2 py-0.5 bg-red-600 rounded text-[9px] font-black uppercase tracking-widest">{currentUser?.id}</span>
                 {isTracking && <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[9px] font-black uppercase tracking-widest animate-pulse"><Crosshair size={10} /> Live Tracking</div>}
              </div>
              <h2 className="text-2xl font-black tracking-tight mt-1">{currentUser?.name}</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{currentUser?.department}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Status</p>
                <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                   <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                   Verified Node
                </div>
             </div>
             <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Network</p>
                <div className={`flex items-center gap-2 font-black text-xs ${mockIp.startsWith('192.168.1') ? 'text-blue-400' : 'text-amber-400'}`}>
                   <Wifi size={14} /> {mockIp.startsWith('192.168.1') ? 'Office LAN' : 'External'}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {feedback && (
          <div className={`p-6 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-4 animate-[slideDown_0.3s_ease-out] border-2 ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
          }`}>
            <ShieldCheck size={20} className={feedback.type === 'success' ? 'text-emerald-500' : 'text-rose-500'} />
            {feedback.message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <button
            onClick={() => handleAttendance('IN')}
            disabled={loading}
            className="group relative flex flex-col items-center justify-center gap-4 p-10 rounded-[2.5rem] bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-red-600 transition-all active:scale-95 disabled:opacity-50"
          >
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-[#E31E24] group-hover:scale-110 transition-transform">
              <Clock size={32} />
            </div>
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">Sync Check-In</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Start Duty Sequence</p>
            </div>
          </button>

          <button
            onClick={() => handleAttendance('OUT')}
            disabled={loading}
            className="group relative flex flex-col items-center justify-center gap-4 p-10 rounded-[2.5rem] bg-slate-100 dark:bg-slate-800 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95 disabled:opacity-50"
          >
            <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-400 group-hover:scale-110 transition-transform shadow-sm">
              <Navigation size={32} className="rotate-45" />
            </div>
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">End Sequence</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Disconnect Node</p>
            </div>
          </button>
        </div>

        {/* Real-time Telemetry Control */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isTracking ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <Crosshair size={18} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Field Surveillance</h3>
            </div>
            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isTracking ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
              {isTracking ? 'Live Link' : 'Offline'}
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium">
            Real-time GPS tracking allows HQ to monitor field operations and ensure asset safety. Must be active while in high-security zones.
          </p>

          <button
            onClick={isTracking ? stopTracking : startTracking}
            className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all flex items-center justify-center gap-3 ${
              isTracking 
              ? 'bg-slate-900 text-white hover:bg-red-600 shadow-xl shadow-red-900/10' 
              : 'bg-[#E31E24] text-white hover:bg-red-700 shadow-xl shadow-red-900/20'
            }`}
          >
            {isTracking ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
            {isTracking ? 'Deactivate Surveillance' : 'Enable Real-time Tracking'}
          </button>
        </div>

        {/* Simulator Tools (Mobile Optimized) */}
        <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700">
           <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Activity size={14} /> Node Simulation Tools
           </h4>
           <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar">
              <button onClick={() => setMockIp('192.168.1.1')} className={`flex-shrink-0 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${mockIp.startsWith('192.168.1') ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 dark:bg-slate-800'}`}>Office WiFi</button>
              <button onClick={() => setMockIp('10.0.0.1')} className={`flex-shrink-0 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${!mockIp.startsWith('192.168.1') ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 dark:bg-slate-800'}`}>Public 4G</button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeePortal;
