
import React from 'react';
import { useHRM } from '../store';
import { DollarSign, Search, Download, FileText, CheckCircle, Clock } from 'lucide-react';
import { formatCurrency } from '../utils';

const PayrollView: React.FC = () => {
  const { salaries, currentUser } = useHRM();
  const isAdmin = currentUser?.role === 'ADMIN';

  const displaySalaries = isAdmin 
    ? salaries 
    : salaries.filter(s => s.userId === currentUser?.id);

  return (
    <div className="space-y-10 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Remuneration Ledger</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Financial synchronization and payroll distribution logs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-red-500 transition-colors" />
            <input
              type="text"
              placeholder="Search payroll records..."
              className="pl-14 pr-6 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-red-500/10 focus:border-[#E31E24] transition-all w-full sm:w-80 shadow-sm"
            />
          </div>
          <button className="p-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
            <Download size={22} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 soft-shadow">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">Total Net Disbursement</p>
          <div className="text-3xl font-black text-slate-950 dark:text-white font-jakarta">
            {formatCurrency(displaySalaries.reduce((acc, s) => acc + s.net, 0))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 soft-shadow">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">Cycles Completed</p>
          <div className="text-3xl font-black text-slate-950 dark:text-white font-jakarta">
            {displaySalaries.length} Records
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 soft-shadow">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">Pending Adjustments</p>
          <div className="text-3xl font-black text-slate-950 dark:text-white font-jakarta">
            0.00
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-300 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-10 py-6">Reference ID</th>
                <th className="px-10 py-6">Entity</th>
                <th className="px-10 py-6">Period</th>
                <th className="px-10 py-6">Net Yield</th>
                <th className="px-10 py-6">Status</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displaySalaries.map((sal) => (
                <tr key={sal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-10 py-6 text-xs font-mono font-bold text-slate-400">{sal.id}</td>
                  <td className="px-10 py-6">
                    <div className="font-black text-slate-900 dark:text-white text-sm">{sal.userName}</div>
                    <div className="text-[10px] text-slate-400 font-bold">{sal.userId}</div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">{sal.month} {sal.year}</div>
                  </td>
                  <td className="px-10 py-6 font-black text-slate-900 dark:text-white text-sm">{formatCurrency(sal.net)}</td>
                  <td className="px-10 py-6">
                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 w-fit ${
                      sal.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20'
                    }`}>
                      {sal.status === 'PAID' ? <CheckCircle size={12} /> : <Clock size={12} />}
                      {sal.status}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button className="p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-400 hover:text-red-600 transition-all shadow-sm">
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PayrollView;
