/**
 * BroadcastView.tsx
 * Send in-app notifications (and optionally email) to all employees or a
 * filtered group. Accessible by DEVELOPER, ADMIN, CO_ADMIN, HR.
 */

import React, { useState, useMemo } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import {
  Radio, Send, Users, User as UserIcon, Filter,
  CheckCircle, AlertCircle, X, ChevronDown, Building2,
  Bell, Zap, Banknote, Calendar, Loader2, Search, Mail
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const inputCls = "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5";

type BroadcastTarget = 'ALL' | 'DEPARTMENT' | 'ROLE' | 'INDIVIDUAL';
type NotifType = 'GENERAL' | 'SALARY' | 'LEAVE' | 'SYSTEM';

const TYPE_CONFIG: Record<NotifType, { label: string; icon: any; color: string; bg: string }> = {
  GENERAL: { label: 'General',  icon: Bell,    color: 'text-slate-600',   bg: 'bg-slate-100 dark:bg-slate-800' },
  SALARY:  { label: 'Salary',   icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  LEAVE:   { label: 'Leave',    icon: Calendar, color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
  SYSTEM:  { label: 'System',   icon: Zap,      color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20' },
};

const BroadcastView: React.FC = () => {
  const { currentUser, users, departments, sendNotification, activityLogs, hasPermission } = useHRM();

  const [target, setTarget]         = useState<BroadcastTarget>('ALL');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [title, setTitle]           = useState('');
  const [message, setMessage]       = useState('');
  const [notifType, setNotifType]   = useState<NotifType>('GENERAL');
  const [sending, setSending]       = useState(false);
  const [result, setResult]         = useState<{ ok: boolean; msg: string } | null>(null);
  const [alsoEmail, setAlsoEmail]   = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  // Who can use this view
  const canBroadcast = [UserRole.DEVELOPER, UserRole.ADMIN, UserRole.CO_ADMIN, UserRole.HR]
    .includes(currentUser?.role as UserRole)
    || (currentUser ? hasPermission(currentUser.id, 'broadcast') : false);

  // Resolve recipients based on target settings
  const recipients = useMemo(() => {
    const base = users.filter(u =>
      u.id !== currentUser?.id &&
      u.role !== UserRole.DEVELOPER
    );
    if (target === 'ALL')         return base;
    if (target === 'DEPARTMENT')  return deptFilter ? base.filter(u => u.department === deptFilter) : base;
    if (target === 'ROLE')        return roleFilter ? base.filter(u => u.role === roleFilter) : base;
    if (target === 'INDIVIDUAL')  return base.filter(u => selectedIds.includes(u.id));
    return base;
  }, [users, target, deptFilter, roleFilter, selectedIds, currentUser]);

  const filteredForPicker = useMemo(() => {
    const base = users.filter(u => u.id !== currentUser?.id && u.role !== UserRole.DEVELOPER);
    if (!searchTerm) return base;
    return base.filter(u =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm, currentUser]);

  const toggleIndividual = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { setResult({ ok: false, msg: 'Title and message are required.' }); return; }
    if (recipients.length === 0) { setResult({ ok: false, msg: 'No recipients selected.' }); return; }

    setSending(true);
    setResult(null);
    let successCount = 0;
    let failCount = 0;

    // Send in-app notifications in parallel for speed
    const notifResults = await Promise.allSettled(
      recipients.map(user => sendNotification(user.id, title.trim(), message.trim(), notifType as any))
    );
    notifResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value.success) successCount++;
      else failCount++;
    });

    // Also send email if toggled — via local email server
    let emailResult = '';
    if (alsoEmail) {
      setEmailSending(true);
      const emailList = recipients
        .filter(u => u.email)
        .map(u => ({ email: u.email, name: u.name }));
      if (emailList.length > 0) {
        try {
          const res = await fetch('/email/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipients: emailList,
              subject: title.trim(),
              message: message.trim(),
              type: notifType,
              senderName: currentUser?.name || 'Exord HRM',
            }),
          });
          const data = await res.json();
          emailResult = data.error
            ? ` Email: failed (${data.error}).`
            : ` Email sent to ${data.sent} address${data.sent !== 1 ? 'es' : ''}.${data.failed > 0 ? ` (${data.failed} failed)` : ''}`;
        } catch (e: any) {
          emailResult = ` Email: failed (${e?.message || 'network error'}).`;
        }
      } else {
        emailResult = ' No email addresses found for recipients.';
      }
      setEmailSending(false);
    }

    setSending(false);
    if (failCount === 0) {
      setResult({ ok: true, msg: `✅ Sent to ${successCount} recipient${successCount !== 1 ? 's' : ''} successfully.${emailResult}` });
      setTitle(''); setMessage('');
    } else {
      setResult({ ok: false, msg: `Sent to ${successCount}, failed for ${failCount}.${emailResult}` });
    }
  };

  // Recent broadcasts from activity logs
  const recentBroadcasts = useMemo(() =>
    activityLogs.filter(l => l.action === 'NOTIFICATION_SENT').slice(0, 10),
    [activityLogs]
  );

  if (!canBroadcast) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
          <Radio size={24} className="text-[#E31E24]" />
        </div>
        <p className="text-slate-400 font-bold">Access restricted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-[fadeIn_0.5s_ease-out] pb-20">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            Broadcast Center
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Send notifications to employees individually or in bulk.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-violet-50 dark:bg-violet-900/20 rounded-2xl border border-violet-100 dark:border-violet-900/30">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-400">
            {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} selected
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* ── Left: Compose ── */}
        <div className="xl:col-span-2 space-y-6">

          {/* Target selector */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 space-y-5">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <Filter size={14} className="text-[#E31E24]" /> Target Audience
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { id: 'ALL',        label: 'Everyone',   icon: Users },
                { id: 'DEPARTMENT', label: 'Department', icon: Building2 },
                { id: 'ROLE',       label: 'By Role',    icon: Filter },
                { id: 'INDIVIDUAL', label: 'Specific',   icon: UserIcon },
              ] as { id: BroadcastTarget; label: string; icon: any }[]).map(t => (
                <button key={t.id} onClick={() => setTarget(t.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    target === t.id
                      ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10 text-[#E31E24]'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                  }`}>
                  <t.icon size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Sub-filter */}
            {target === 'DEPARTMENT' && (
              <div>
                <label className={labelCls}>Select Department</label>
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className={inputCls}>
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
            )}

            {target === 'ROLE' && (
              <div>
                <label className={labelCls}>Select Role</label>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as UserRole)} className={inputCls}>
                  <option value="">All Roles</option>
                  {[UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.HR, UserRole.CO_ADMIN, UserRole.ADMIN].map(r => (
                    <option key={r} value={r}>{r === UserRole.CO_ADMIN ? 'Co-Admin' : r}</option>
                  ))}
                </select>
              </div>
            )}

            {target === 'INDIVIDUAL' && (
              <div className="space-y-3">
                <label className={labelCls}>Search & Select Employees</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search by name, ID, department..."
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className={inputCls + " pl-9"} />
                </div>
                <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-1 border border-slate-200 dark:border-slate-700 rounded-2xl p-2">
                  {filteredForPicker.map(u => (
                    <label key={u.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      selectedIds.includes(u.id) ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}>
                      <input type="checkbox" checked={selectedIds.includes(u.id)}
                        onChange={() => toggleIndividual(u.id)}
                        className="w-4 h-4 accent-[#E31E24] flex-shrink-0" />
                      <div className="w-8 h-8 rounded-xl overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0">
                        {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-black text-slate-600 dark:text-slate-300">{u.name.charAt(0)}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">{u.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{u.department} · {u.id}</p>
                      </div>
                    </label>
                  ))}
                  {filteredForPicker.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No employees found.</p>}
                </div>
                {selectedIds.length > 0 && (
                  <p className="text-[10px] font-black text-[#E31E24]">{selectedIds.length} selected
                    <button onClick={() => setSelectedIds([])} className="ml-2 text-slate-400 hover:text-slate-600 transition-colors">Clear</button>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Compose message */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 space-y-5">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <Send size={14} className="text-[#E31E24]" /> Compose Message
            </h3>

            {/* Notification type */}
            <div>
              <label className={labelCls}>Message Type</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(TYPE_CONFIG) as NotifType[]).map(t => {
                  const cfg = TYPE_CONFIG[t];
                  const Icon = cfg.icon;
                  return (
                    <button key={t} onClick={() => setNotifType(t)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                        notifType === t
                          ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}>
                      <div className={`p-2 rounded-xl ${cfg.bg}`}>
                        <Icon size={14} className={cfg.color} />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={labelCls}>Subject / Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Office Closure on Friday" className={inputCls} maxLength={120} />
              <p className="text-[9px] text-slate-400 mt-1 text-right">{title.length}/120</p>
            </div>

            <div>
              <label className={labelCls}>Message Body *</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Write your message here..."
                className={inputCls + " min-h-[140px] resize-none"} maxLength={1000} />
              <p className="text-[9px] text-slate-400 mt-1 text-right">{message.length}/1000</p>
            </div>

            {/* Result banner */}
            {result && (
              <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-sm font-bold ${
                result.ok
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/30'
                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-900/30'
              }`}>
                {result.ok ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                {result.msg}
                <button onClick={() => setResult(null)} className="ml-auto"><X size={14} /></button>
              </div>
            )}

            {/* Also send email toggle */}
            <div
              onClick={() => setAlsoEmail(v => !v)}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                alsoEmail
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10'
                  : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                alsoEmail ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600'
              }`}>
                {alsoEmail && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              </div>
              <Mail size={15} className={alsoEmail ? 'text-blue-500' : 'text-slate-400'} />
              <div className="flex-1">
                <p className={`text-xs font-black ${alsoEmail ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}>
                  Also send via Email
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  Delivers to each recipient's registered email address
                </p>
              </div>
              {emailSending && <Loader2 size={14} className="animate-spin text-blue-500" />}
            </div>

            {/* Send button */}
            <button onClick={handleSend} disabled={sending || !title.trim() || !message.trim() || recipients.length === 0}
              className="w-full py-4 bg-gradient-to-r from-[#E31E24] to-red-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-lg shadow-red-900/20">
              {sending
                ? <><Loader2 size={18} className="animate-spin" /> Sending to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}...</>
                : <><Send size={18} /> Send to {recipients.length} Recipient{recipients.length !== 1 ? 's' : ''}</>
              }
            </button>
          </div>
        </div>

        {/* ── Right: Preview + History ── */}
        <div className="space-y-6">

          {/* Live preview */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <Bell size={14} className="text-[#E31E24]" /> Preview
            </h3>
            <div className={`rounded-2xl border-2 p-4 space-y-2 ${TYPE_CONFIG[notifType].bg} border-slate-100 dark:border-slate-800`}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm flex-shrink-0">
                  {React.createElement(TYPE_CONFIG[notifType].icon, { size: 16, className: TYPE_CONFIG[notifType].color })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                    {title || <span className="text-slate-300 dark:text-slate-600 font-medium italic">Subject line...</span>}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    From {currentUser?.name} · Just now
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed line-clamp-3">
                    {message || <span className="text-slate-300 dark:text-slate-600 italic">Message body...</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Recipients summary */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Recipients</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">{recipients.length}</p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-hidden">
                {recipients.slice(0, 6).map(u => (
                  <span key={u.id} className="flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-700 rounded-lg text-[9px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {u.name.split(' ')[0]}
                  </span>
                ))}
                {recipients.length > 6 && (
                  <span className="px-2 py-0.5 bg-[#E31E24] rounded-lg text-[9px] font-bold text-white">
                    +{recipients.length - 6} more
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Broadcast history */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <Radio size={14} className="text-[#E31E24]" /> Recent Broadcasts
            </h3>
            {recentBroadcasts.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">No broadcasts yet.</p>
            )}
            <div className="space-y-3">
              {recentBroadcasts.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E31E24] mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 truncate">{log.details}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {log.userName} · {new Date(log.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastView;
