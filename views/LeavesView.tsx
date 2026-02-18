
import React, { useState } from 'react';
import { useHRM } from '../store';
import { Calendar, Plus, Search, Filter, Check, X, Clock, FileText, User } from 'lucide-react';
import { LeaveStatus } from '../types';
import { LEAVE_TYPES } from '../constants';

const LeavesView: React.FC = () => {
  const { leaves, currentUser, applyLeave, updateLeave } = useHRM();
  const isAdmin = currentUser?.role === 'ADMIN';
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState(LEAVE_TYPES[0]);
  const [reason, setReason] = useState('');

  const displayLeaves = isAdmin 
    ? leaves 
    : leaves.filter(l => l.userId === currentUser?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    applyLeave({
      userId: currentUser.id,
      startDate,
      endDate,
      type,
      reason
    });
    
    setShowForm(false);
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  return (
    <div className="space-y-10 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Request Vault</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Manage node lifecycle and temporary operational disconnects.</p>
        </div>
        {!isAdmin && (
          <button 
            onClick={() => setShowForm(true)}
            className="px-8 py-4 bg-[#E31E24] text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-xl shadow-red-900/20 hover:bg-red-700 transition-all"
          >
            <Plus size={18} /> New Request
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Initialize Leave Protocol</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-red-600 transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Sequence Start</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white focus:border-red-600 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Sequence End</label>
                  <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white focus:border-red-600 transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Category</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white focus:border-red-600 transition-all appearance-none">
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Justification Payload</label>
                <textarea required rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Provide detailed reasoning for temporal detachment..." className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white focus:border-red-600 transition-all resize-none"></textarea>
              </div>
              <button type="submit" className="w-full py-5 bg-slate-950 dark:bg-[#E31E24] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-xl">
                Submit Request Sequence
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-300 dark:border-slate-800 overflow-hidden soft-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-10 py-6">Identity</th>
                <th className="px-10 py-6">Temporal Range</th>
                <th className="px-10 py-6">Category</th>
                <th className="px-10 py-6">Status</th>
                <th className="px-10 py-6 text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayLeaves.map((leave) => (
                <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-10 py-6">
                    <div className="font-black text-slate-900 dark:text-white text-sm">{leave.userName}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{leave.userId}</div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200 dark:border-slate-700">{leave.type}</span>
                  </td>
                  <td className="px-10 py-6">
                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 w-fit ${
                      leave.status === LeaveStatus.APPROVED ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 
                      leave.status === LeaveStatus.REJECTED ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' : 
                      'bg-amber-50 text-amber-600 dark:bg-amber-900/20'
                    }`}>
                      {leave.status === LeaveStatus.APPROVED ? <Check size={12} /> : 
                       leave.status === LeaveStatus.REJECTED ? <X size={12} /> : 
                       <Clock size={12} />}
                      {leave.status}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      {isAdmin && leave.status === LeaveStatus.PENDING && (
                        <>
                          <button 
                            onClick={() => updateLeave(leave.id, LeaveStatus.APPROVED)}
                            className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-900/10"
                          >
                            <Check size={18} />
                          </button>
                          <button 
                            onClick={() => updateLeave(leave.id, LeaveStatus.REJECTED)}
                            className="p-3 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-900/10"
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}
                      <button className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                        <FileText size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayLeaves.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-10 py-20 text-center text-slate-400 italic font-medium">No leave protocols initialized in current period.</td>
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
