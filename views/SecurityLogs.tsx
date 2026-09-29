import { useLanguage } from '../i18n';
import React, { useMemo, useState } from 'react';
import { useHRM } from '../store';
import {
  ShieldAlert, RefreshCw, CheckCircle, XCircle,
  AlertTriangle, LogIn, Shield, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatDate } from '../utils';

const PAGE_SIZE = 20;

const SecurityLogs: React.FC = () => {
  const { activityLogs, refreshData, isLoading } = useHRM();
  const { t } = useLanguage();
  const [page, setPage] = useState(1);

  const securityLogs = useMemo(() => {
    return activityLogs.filter(l =>
      l.category === 'AUTH' ||
      l.severity === 'HIGH' ||
      l.severity === 'CRITICAL'
    );
  }, [activityLogs]);

  const todayStr = new Date().toDateString();

  const stats = useMemo(() => ({
    failedLogins: activityLogs.filter(l => l.action === 'FAILED_LOGIN').length,
    criticalToday: activityLogs.filter(l =>
      l.severity === 'CRITICAL' && new Date(l.timestamp).toDateString() === todayStr
    ).length,
    highToday: activityLogs.filter(l =>
      l.severity === 'HIGH' && new Date(l.timestamp).toDateString() === todayStr
    ).length,
    authEvents: activityLogs.filter(l => l.category === 'AUTH').length,
  }), [activityLogs, todayStr]);

  const severityColor: Record<string, string> = {
    LOW: 'text-emerald-600',
    MEDIUM: 'text-amber-600',
    HIGH: 'text-orange-600',
    CRITICAL: 'text-red-600',
  };
  const severityBg: Record<string, string> = {
    LOW: 'bg-emerald-50 dark:bg-emerald-900/10',
    MEDIUM: 'bg-amber-50 dark:bg-amber-900/10',
    HIGH: 'bg-orange-50 dark:bg-orange-900/10',
    CRITICAL: 'bg-red-50 dark:bg-red-900/10',
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(securityLogs.length / PAGE_SIZE));
  const paged = securityLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 sm:space-y-8 animate-[fadeIn_0.5s_ease-out] pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            Security Protocols
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Authentication events and high-severity alerts.
          </p>
        </div>
        <button
          onClick={refreshData}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl hover:border-[#E31E24] transition-all"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats — Fixed: added rounded-3xl to match app-wide card style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('failed_logins'), value: stats.failedLogins, icon: XCircle, color: 'from-red-500 to-rose-600' },
          { label: t('auth_events'), value: stats.authEvents, icon: LogIn, color: 'from-blue-500 to-indigo-600' },
          { label: t('high_today'), value: stats.highToday, icon: AlertTriangle, color: 'from-orange-500 to-amber-600' },
          { label: t('critical_today'), value: stats.criticalToday, icon: ShieldAlert, color: 'from-red-600 to-rose-700' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 soft-shadow">
            <div className={`p-3 w-fit rounded-2xl bg-gradient-to-br ${s.color} text-white shadow-lg mb-4`}>
              <s.icon size={18} />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden soft-shadow">
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-[#E31E24]" />
            <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">
              Security Events
            </h3>
          </div>
          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 text-[10px] font-black">
            {securityLogs.length} records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-8 py-5">Timestamp</th>
                <th className="px-8 py-5">Identity</th>
                <th className="px-8 py-5">Action</th>
                <th className="px-8 py-5">Severity</th>
                <th className="px-8 py-5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {paged.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400 text-sm italic">
                    No security events found.
                  </td>
                </tr>
              )}
              {paged.map(log => (
                <tr
                  key={log.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group ${
                    log.severity === 'CRITICAL' ? 'bg-red-50/40 dark:bg-red-900/5' :
                    log.severity === 'HIGH' ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''
                  }`}
                >
                  <td className="px-8 py-5 text-[11px] font-mono text-slate-400 whitespace-nowrap">
                    {formatDate(log.timestamp)}
                  </td>
                  <td className="px-8 py-5">
                    <div className="text-sm font-black text-slate-900 dark:text-white">{log.userName}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">{log.userId}</div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest group-hover:bg-red-50 dark:group-hover:bg-red-900/20 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors ${severityBg[log.severity]}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`flex items-center gap-1.5 text-[10px] font-black tracking-widest ${severityColor[log.severity]}`}>
                      {(log.severity === 'CRITICAL' || log.severity === 'HIGH') && <XCircle size={13} />}
                      {log.severity === 'MEDIUM' && <AlertTriangle size={13} />}
                      {log.severity === 'LOW' && <CheckCircle size={13} />}
                      {log.severity}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs">
                    <p className="truncate">{log.details}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-bold">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, securityLogs.length)} of {securityLogs.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24] disabled:opacity-40 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-xl text-xs font-black transition-all border-2 ${
                      page === pageNum
                        ? 'bg-[#E31E24] text-white border-[#E31E24]'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24] disabled:opacity-40 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityLogs;
