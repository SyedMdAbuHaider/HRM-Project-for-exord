import React, { useState, useMemo } from 'react';
import { useHRM } from '../store';
import { ActivityLog } from '../types';
import { UserRole } from '../types';
import {
  Activity, Users, Clock, Calendar,
  DollarSign, Building2, Shield, Filter, Search,
  RefreshCw, Download, ChevronDown, AlertTriangle,
  CheckCircle, Info, XCircle, Database,
  ChevronLeft, ChevronRight, Trash2
} from 'lucide-react';
import { formatDate } from '../utils';

const CATEGORY_CONFIG: Record<ActivityLog['category'], { icon: any; color: string; bg: string }> = {
  AUTH:           { icon: Shield,     color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  EMPLOYEE:       { icon: Users,      color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  ATTENDANCE:     { icon: Clock,      color: 'text-emerald-600',bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  LEAVE:          { icon: Calendar,   color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
  SALARY:         { icon: DollarSign, color: 'text-teal-600',   bg: 'bg-teal-50 dark:bg-teal-900/20' },
  INFRASTRUCTURE: { icon: Building2,  color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  SYSTEM:         { icon: Database,   color: 'text-slate-600',  bg: 'bg-slate-50 dark:bg-slate-900/20' },
};

const SEVERITY_CONFIG: Record<ActivityLog['severity'], { icon: any; color: string; label: string }> = {
  LOW:      { icon: CheckCircle,   color: 'text-emerald-500', label: 'Low' },
  MEDIUM:   { icon: Info,          color: 'text-amber-500',   label: 'Medium' },
  HIGH:     { icon: AlertTriangle, color: 'text-orange-500',  label: 'High' },
  CRITICAL: { icon: XCircle,       color: 'text-red-600',     label: 'Critical' },
};

const PAGE_SIZE = 25;
const CATEGORIES: ActivityLog['category'][] = ['AUTH', 'EMPLOYEE', 'ATTENDANCE', 'LEAVE', 'SALARY', 'INFRASTRUCTURE', 'SYSTEM'];

const ActivityLogView: React.FC = () => {
  const { activityLogs, refreshData, isLoading, currentUser, deleteActivityLog, deleteAllActivityLogs } = useHRM();
  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.DEVELOPER;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filtered = useMemo(() => {
    setPage(1); // reset to page 1 on filter change — handled below
    return activityLogs.filter(log => {
      const matchCat = categoryFilter === 'ALL' || log.category === categoryFilter;
      const matchSev = severityFilter === 'ALL' || log.severity === severityFilter;
      const matchSearch = !search ||
        (log.userName || 'System').toLowerCase().includes(search.toLowerCase()) ||
        (log.action || 'UNKNOWN_ACTION').toLowerCase().includes(search.toLowerCase()) ||
        (log.details || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.userId || 'system').toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSev && matchSearch;
    });
  }, [activityLogs, categoryFilter, severityFilter, search]);

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  // ✅ Added: paginated slice
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => ({
    total: activityLogs.length,
    critical: activityLogs.filter(l => l.severity === 'CRITICAL').length,
    high: activityLogs.filter(l => l.severity === 'HIGH').length,
    today: activityLogs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length,
  }), [activityLogs]);

  const exportCSV = () => {
    const headers = ['Timestamp', 'User', 'User ID', 'Action', 'Category', 'Severity', 'Details'];
    const rows = filtered.map(l => [
      new Date(l.timestamp).toLocaleString(),
      l.userName, l.userId, l.action, l.category, l.severity,
      `"${l.details.replace(/"/g, "'")}"`,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exord-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.5s_ease-out] pb-16">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            Activity Monitor
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Complete audit trail of all system events.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:border-[#E31E24] transition-all"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-3 bg-[#E31E24] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
          >
            <Download size={16} />
            Export
          </button>
          {isAdmin && (
            confirmClearAll ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => { await deleteAllActivityLogs(); setConfirmClearAll(false); }}
                  className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all"
                >
                  <Trash2 size={14} /> Confirm Clear All
                </button>
                <button onClick={() => setConfirmClearAll(false)} className="px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClearAll(true)}
                className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-red-200 dark:border-red-900/40 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-50 transition-all"
              >
                <Trash2 size={14} /> Clear All
              </button>
            )
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: stats.total, color: 'from-blue-500 to-indigo-600', icon: Activity },
          { label: 'Today', value: stats.today, color: 'from-emerald-500 to-teal-600', icon: Clock },
          { label: 'High Severity', value: stats.high, color: 'from-amber-500 to-orange-500', icon: AlertTriangle },
          { label: 'Critical', value: stats.critical, color: 'from-red-500 to-rose-600', icon: XCircle },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 soft-shadow">
            <div className={`p-3 w-fit rounded-xl bg-gradient-to-br ${s.color} text-white shadow-lg mb-4`}>
              <s.icon size={18} />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 soft-shadow flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by user, action, or details..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={categoryFilter}
              onChange={e => handleFilterChange(setCategoryFilter, e.target.value)}
              className="bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 appearance-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2">
            <Shield size={14} className="text-slate-400" />
            <select
              value={severityFilter}
              onChange={e => handleFilterChange(setSeverityFilter, e.target.value)}
              className="bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 appearance-none cursor-pointer"
            >
              <option value="ALL">All Severity</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Result count */}
      <p className="text-xs text-slate-400 font-black uppercase tracking-widest px-1">
        Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} events
      </p>

      {/* Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden soft-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Timestamp', 'User', 'Category', 'Action', 'Severity', 'Details', ''].map(h => (
                  <th key={h} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400 font-medium text-sm italic">
                    No activity logs match your filters.
                  </td>
                </tr>
              )}
              {paginated.map(log => {
                const cat = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.SYSTEM;
                const sev = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.LOW;
                const isExpanded = expandedId === log.id;

                return (
                  <React.Fragment key={log.id}>
                    <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                      log.severity === 'CRITICAL' ? 'bg-red-50/50 dark:bg-red-900/5' :
                      log.severity === 'HIGH' ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''
                    }`}>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-slate-900 dark:text-white">{log.userName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{log.userId}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${cat.bg} ${cat.color}`}>
                          <cat.icon size={10} />
                          {log.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1.5 text-[10px] font-black ${sev.color}`}>
                          <sev.icon size={13} />
                          {sev.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                          {log.details}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                        {log.metadata && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="p-2 text-slate-400 hover:text-[#E31E24] transition-colors"
                          >
                            <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => deleteActivityLog(log.id)}
                            className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-600 transition-colors"
                            title="Delete log"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && log.metadata && (
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <td colSpan={7} className="px-10 py-4">
                          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Metadata</p>
                            <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 overflow-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ✅ Added: Pagination controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-bold">
              Page {page} of {totalPages} &nbsp;·&nbsp; {filtered.length} total events
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-4 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24] disabled:opacity-40 transition-all text-xs font-black uppercase tracking-widest"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              {/* Page numbers (show up to 5) */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${
                        p === page
                          ? 'bg-[#E31E24] text-white shadow-lg shadow-red-900/20'
                          : 'border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24]'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-4 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24] disabled:opacity-40 transition-all text-xs font-black uppercase tracking-widest"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogView;
