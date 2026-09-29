/**
 * LeavePolicyView.tsx
 * Admin panel for configuring per-service-year leave entitlements.
 * - Admin can add / edit / delete leave policies keyed by leaveType + service years range
 * - Employees see their applicable entitlements in EmployeePortal (leave tab)
 * - Responsive for all screen sizes
 *
 * Supabase table required (run once):
 *   CREATE TABLE leave_policies (
 *     id text primary key,
 *     name text not null,
 *     leave_type text not null,
 *     min_service_years numeric not null default 0,
 *     max_service_years numeric not null default 99,
 *     days_allowed integer not null,
 *     description text,
 *     created_at timestamptz default now(),
 *     updated_at timestamptz default now()
 *   );
 */

import React, { useState, useMemo } from 'react';
import { useHRM } from '../store';
import { UserRole, LeavePolicy, getServiceYears, getApplicableLeaveDays } from '../types';
import { LEAVE_TYPES } from '../constants';
import {
  Calendar, Plus, Edit2, Trash2, Save, X,
  ChevronDown, ChevronUp, Info, Users, AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '../utils';

const LeavePolicyView: React.FC = () => {
  const { currentUser, leavePolicies, addLeavePolicy, updateLeavePolicy, deleteLeavePolicy, users } = useHRM();

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'policies' | 'reference'>('policies');

  const emptyForm = {
    name: '', leaveType: LEAVE_TYPES[0],
    minServiceYears: 0, maxServiceYears: 99,
    daysAllowed: 14, description: '',
  };
  const [form, setForm] = useState(emptyForm);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (p: LeavePolicy) => {
    setEditingId(p.id);
    setForm({
      name: p.name, leaveType: p.leaveType,
      minServiceYears: p.minServiceYears, maxServiceYears: p.maxServiceYears,
      daysAllowed: p.daysAllowed, description: p.description || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (form.minServiceYears > form.maxServiceYears) return;
    setSaving(true);
    if (editingId) {
      await updateLeavePolicy(editingId, form);
    } else {
      await addLeavePolicy(form);
    }
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleDelete = async (id: string) => {
    await deleteLeavePolicy(id);
    setDeletingId(null);
  };

  // Group policies by leaveType
  const grouped = useMemo(() => {
    const filtered = filterType === 'ALL' ? leavePolicies : leavePolicies.filter(p => p.leaveType === filterType);
    const map: Record<string, LeavePolicy[]> = {};
    filtered.forEach(p => {
      if (!map[p.leaveType]) map[p.leaveType] = [];
      map[p.leaveType].push(p);
    });
    // Sort each group by min service years
    Object.values(map).forEach(arr => arr.sort((a, b) => a.minServiceYears - b.minServiceYears));
    return map;
  }, [leavePolicies, filterType]);

  // Preview: show each employee's entitlement
  const employeeEntitlements = useMemo(() => {
    return users
      .filter(u => u.role === UserRole.EMPLOYEE || u.role === UserRole.MANAGER)
      .map(u => {
        const years = getServiceYears(u.joinDate);
        const entitlements: { type: string; days: number }[] = LEAVE_TYPES.map(lt => ({
          type: lt,
          days: getApplicableLeaveDays(leavePolicies, lt, u.joinDate),
        })).filter(e => e.days > 0);
        return { user: u, years, entitlements };
      });
  }, [users, leavePolicies]);

  const inputCls = "w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:border-[#E31E24] focus:outline-none transition-all rounded";
  const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5";

  return (
    <div className="space-y-8 animate-[fadeIn_0.4s_ease-out] pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Leave Policies</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Configure leave entitlements per leave type and service age.</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd}
            className="flex items-center gap-2 px-6 py-3 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 self-start sm:self-auto">
            <Plus size={16} /> Add Policy
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 p-4 flex gap-3">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-400 font-medium space-y-1">
          <p className="font-black">How it works</p>
          <p>Define leave day entitlements for each leave type. Set service year ranges so junior employees get fewer days than senior ones. Employees and HR can see their applicable entitlements in the portal.</p>
          <p className="font-black text-blue-600 dark:text-blue-300">Supabase table: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">leave_policies</code> (see SQL comment at top of this file)</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {(['policies', 'reference'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-[#E31E24] text-[#E31E24]' : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
            {tab === 'policies' ? '⚙️ Configured Policies' : '📋 Policy Reference (EO/HLPF/16022026-01)'}
          </button>
        ))}
      </div>

      {/* Policy Reference Tab */}
      {activeTab === 'reference' && (
        <div className="space-y-6">
          {/* Leave Entitlement Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">Annual Leave Entitlements</h3>
              <p className="text-[10px] text-slate-400 mt-1">Reference: EO/HLPF/16022026-01</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['Sl.', 'Leave Type', 'Days', 'Effective From'].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {[
                    ['01','Optional/Casual Leave','6 Days','After 1 year of service'],
                    ['02','Paid/Earned Leave','3 Days','After 1 year of service'],
                    ['03','Sick Leave','3 Days','After 1 year of service'],
                    ['04','Religious Leave (per religion)','2 Days','From joining'],
                    ['05','Festival Leave 1 (per religion)','4 Days','From joining'],
                    ['06','Festival Leave 2 (per religion)','4 Days','From joining'],
                    ['07','21st February (Mother Language Day)','1 Day','From joining'],
                    ['08','26th March (Independence Day)','1 Day','From joining'],
                    ['09','14th April (Pohela Boishakh)','1 Day','From joining'],
                    ['10','1st May (Labour Day)','1 Day','From joining'],
                    ['11','16th December (Victory Day)','1 Day','From joining'],
                    ['12','Birthday Leave','1 Day','From joining'],
                  ].map(([sl, type, days, effective]) => (
                    <tr key={sl} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-400 font-bold">{sl}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{type}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-black border border-emerald-100 dark:border-emerald-900/30">{days}</span></td>
                      <td className="px-4 py-3 text-slate-500">{effective}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-6 text-xs font-bold text-slate-600 dark:text-slate-300">
              <span>📅 <b>Total Annual General Leave: 28 Days</b></span>
              <span>📅 <b>Weekly Leave: 52 Days</b> (1 day/week, from joining)</span>
            </div>
          </div>

          {/* Key Clauses */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">Policy Clauses</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                ['02', 'Attendance Minimum', '85% monthly duty attendance required. Fraction ≥0.5 = 1 day; <0.5 = 0. Two consecutive months below 85% → penalty applicable.'],
                ['06', 'Monthly Leave Cap', 'Only ONE leave per month from Optional/Casual, Paid/Earned, or Sick Leave. Additional days beyond one = Non-Paid Leave.'],
                ['07', 'Festival Declaration', 'At joining, each employee must declare in writing to HR which two festival leave periods they will observe.'],
                ['08', 'Festival Work Obligation', 'Every employee must work during one of their two festival leave periods. The other period’s leave may be taken within 30 days after the festival ends (with approval). Unused after 30 days = cancelled.'],
                ['13', 'Advance Notice', '1-day leave: apply ≥24 hours in advance. Multi-day leave: apply ≥72 hours (3 days) in advance. Submission does not equal approval (Clause 14).'],
                ['15', 'Unauthorized Leave', 'Unauthorized leave = 1.5× attendance deduction per day. 5 consecutive days unauthorized = termination without notice. No experience certificate issued.'],
                ['18–19', 'Late Rules', 'Up to 30 min late = "Late" only. 30 min–4 hrs late = Late + half attendance. >4 hrs late = no attendance for that day. Every 3 lates = 1 day attendance deducted.'],
                ['24', 'Birthday Leave', 'Must be taken on actual birthday. In special circumstances, may be taken on another day in the same month with approval. Cannot claim attendance by working on birthday.'],
                ['26', 'Maternity Leave', '3 months. Requires 1 continuous year of service. Not granted if employee has 2+ living children. Apply with medical certificate ≥1 month before expected delivery.'],
                ['27', 'Late Recovery', 'If attendance was deducted for lateness, and the following month has zero lates and zero unauthorized leave, the previous deduction is restored with that month’s salary. Once per year.'],
                ['28', 'Discipline Reward', '6 consecutive months with no late and no unauthorized leave = reward of 2 days’ attendance equivalent. Once per year upon application.'],
              ].map(([num, title, text]) => (
                <div key={num} className="p-4 sm:p-5 flex gap-4">
                  <div className="flex-shrink-0 w-14 text-center">
                    <span className="text-[10px] font-black text-[#E31E24] bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 px-2 py-1">§{num}</span>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-white mb-1">{title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'policies' && <>
      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterType('ALL')}
          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all border ${filterType === 'ALL' ? 'bg-slate-900 dark:bg-[#E31E24] text-white border-transparent' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'}`}>
          All Types
        </button>
        {LEAVE_TYPES.map(lt => (
          <button key={lt} onClick={() => setFilterType(lt)}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all border ${filterType === lt ? 'bg-slate-900 dark:bg-[#E31E24] text-white border-transparent' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'}`}>
            {lt}
          </button>
        ))}
      </div>

      {/* Policies grid */}
      {Object.keys(grouped).length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-16 text-center">
          <Calendar size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <p className="text-slate-400 font-bold">No leave policies defined yet.</p>
          {isAdmin && <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-1">Click "Add Policy" to create your first rule.</p>}
        </div>
      )}

      {Object.entries(grouped).map(([leaveType, policies]) => (
        <div key={leaveType} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-[#E31E24]/10 text-[#E31E24]"><Calendar size={15} /></div>
            <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">{leaveType}</h3>
            <span className="ml-auto text-[10px] font-black text-slate-400">{policies.length} tier{policies.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {policies.map(p => (
              <div key={p.id} className="p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  {/* Service range badge */}
                  <div className="flex-shrink-0 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 min-w-[80px]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Service</p>
                    <p className="text-xs font-black text-slate-900 dark:text-white">
                      {p.minServiceYears}y {p.maxServiceYears >= 99 ? '+' : `– ${p.maxServiceYears}y`}
                    </p>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-black text-slate-900 dark:text-white text-sm">{p.name}</p>
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-100 dark:border-emerald-900/40">
                        {p.daysAllowed} days / year
                      </span>
                    </div>
                    {p.description && <p className="text-[11px] text-slate-400 mt-1">{p.description}</p>}
                    <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#E31E24] font-bold mt-1.5 transition-colors">
                      <Users size={11} /> See affected employees
                      {expandedId === p.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  </div>
                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(p)}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all rounded">
                        <Edit2 size={14} />
                      </button>
                      {deletingId === p.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(p.id)}
                            className="px-2 py-1 bg-rose-500 text-white text-[9px] font-black uppercase hover:bg-rose-600 transition-all rounded">
                            Delete
                          </button>
                          <button onClick={() => setDeletingId(null)}
                            className="px-2 py-1 border border-slate-200 text-slate-500 text-[9px] font-black uppercase hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingId(p.id)}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all rounded">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded: affected employees */}
                {expandedId === p.id && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Employees in this tier</p>
                    <div className="flex flex-wrap gap-2">
                      {employeeEntitlements
                        .filter(e => {
                          const years = e.years;
                          return years >= p.minServiceYears && years <= p.maxServiceYears;
                        })
                        .map(e => (
                          <div key={e.user.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-black overflow-hidden">
                              {e.user.avatar ? <img src={e.user.avatar} alt="" className="w-full h-full object-cover" /> : e.user.name.charAt(0)}
                            </div>
                            <p className="text-[10px] font-bold text-slate-900 dark:text-white">{e.user.name}</p>
                            <p className="text-[9px] text-slate-400">{e.years.toFixed(1)}y</p>
                          </div>
                        ))}
                      {employeeEntitlements.filter(e => e.years >= p.minServiceYears && e.years <= p.maxServiceYears).length === 0 && (
                        <p className="text-[11px] text-slate-400 italic">No employees in this service range currently.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Employee entitlement summary table */}
      {leavePolicies.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500"><Users size={15} /></div>
            <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">Employee Entitlement Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Employee</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Service</th>
                  {LEAVE_TYPES.map(lt => (
                    <th key={lt} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{lt}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {employeeEntitlements.map(({ user, years }) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{user.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{user.id}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{years.toFixed(1)}y</span>
                    </td>
                    {LEAVE_TYPES.map(lt => {
                      const days = getApplicableLeaveDays(leavePolicies, lt, user.joinDate);
                      return (
                        <td key={lt} className="px-5 py-3">
                          {days > 0 ? (
                            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-100 dark:border-emerald-900/30">
                              {days}d
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 text-[10px] font-bold">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {employeeEntitlements.length === 0 && (
                  <tr>
                    <td colSpan={2 + LEAVE_TYPES.length} className="px-5 py-10 text-center text-slate-400 text-sm italic">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </> /* end activeTab === 'policies' */}
      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#E31E24] text-white"><Calendar size={16} /></div>
                <h3 className="font-black text-slate-900 dark:text-white text-lg">
                  {editingId ? 'Edit Leave Policy' : 'New Leave Policy'}
                </h3>
              </div>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-2 text-slate-400 hover:text-red-600 transition-all">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Policy Name</label>
                <input type="text" required placeholder="e.g. Annual Leave – Senior Staff" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Leave Type</label>
                <select value={form.leaveType} onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))} className={inputCls}>
                  {LEAVE_TYPES.map(lt => <option key={lt} value={lt}>{lt}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Min Service Years</label>
                  <input type="number" min={0} max={50} step={0.5} required value={form.minServiceYears}
                    onChange={e => setForm(f => ({ ...f, minServiceYears: +e.target.value }))} className={inputCls} />
                  <p className="text-[10px] text-slate-400 mt-1">0 = from day one</p>
                </div>
                <div>
                  <label className={labelCls}>Max Service Years</label>
                  <input type="number" min={0} max={99} step={0.5} required value={form.maxServiceYears}
                    onChange={e => setForm(f => ({ ...f, maxServiceYears: +e.target.value }))} className={inputCls} />
                  <p className="text-[10px] text-slate-400 mt-1">99 = no upper limit</p>
                </div>
              </div>
              {form.minServiceYears > form.maxServiceYears && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 text-rose-600 text-xs font-bold">
                  <AlertTriangle size={13} /> Min years cannot exceed max years.
                </div>
              )}
              <div>
                <label className={labelCls}>Days Allowed Per Year</label>
                <input type="number" min={1} max={365} required value={form.daysAllowed}
                  onChange={e => setForm(f => ({ ...f, daysAllowed: +e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description (optional)</label>
                <textarea rows={2} placeholder="Brief description..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={inputCls + ' resize-none'} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving || form.minServiceYears > form.maxServiceYears}
                  className="flex-[2] py-3 bg-[#E31E24] text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  <Save size={13} />
                  {saving ? 'Saving...' : editingId ? 'Update Policy' : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeavePolicyView;
