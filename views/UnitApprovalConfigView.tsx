/**
 * UnitApprovalConfigView.tsx
 * Developer/Admin panel to configure per-unit request approvers.
 * - Shows every unit with auto-suggested senior (highest baseSalary in that unit)
 * - Allows manual override via dropdown
 * - Department-level fallback also configurable
 * - All changes saved to `unit_approvers` / `dept_approvers` Supabase tables
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import { supabase } from '../serverOwnedClient';
import {
  Building2, Users, TrendingUp, Save, RefreshCw,
  CheckCircle, AlertCircle, X, Loader2, Lock,
  Crown, Info, Zap, UserCheck,
} from 'lucide-react';

const fmtSalary = (n: number) => `৳${n.toLocaleString()}`;

const UnitApprovalConfigView: React.FC = () => {
  const { currentUser, users, units, departments, hasPermission } = useHRM();

  const canEdit = currentUser?.role === UserRole.ADMIN ||
    currentUser?.role === UserRole.DEVELOPER ||
    (currentUser ? hasPermission(currentUser.id, 'manage_approval_flow') : false);

  const [unitApprovers, setUnitApprovers] = useState<Record<string, string>>({});
  const [deptApprovers, setDeptApprovers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'unit' | 'department'>('unit');

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ua }, { data: da }] = await Promise.all([
      supabase.from('unit_approvers').select('unit_id, approver_user_id'),
      supabase.from('dept_approvers').select('department, approver_user_id'),
    ]);
    const uMap: Record<string, string> = {};
    (ua || []).forEach((r: any) => { uMap[r.unit_id] = r.approver_user_id; });
    setUnitApprovers(uMap);
    const dMap: Record<string, string> = {};
    (da || []).forEach((r: any) => { dMap[r.department] = r.approver_user_id; });
    setDeptApprovers(dMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const usersInUnit = useCallback((unitId: string) =>
    users.filter(u => (u as any).unitId === unitId), [users]);

  const suggestedForUnit = useCallback((unitId: string) => {
    const members = usersInUnit(unitId);
    if (!members.length) return null;
    return members.reduce((best, u) => (u.baseSalary > best.baseSalary ? u : best), members[0]);
  }, [usersInUnit]);

  const usersInDept = useCallback((deptName: string) =>
    users.filter(u => u.department === deptName), [users]);

  const suggestedForDept = useCallback((deptName: string) => {
    const members = usersInDept(deptName);
    if (!members.length) return null;
    return members.reduce((best, u) => (u.baseSalary > best.baseSalary ? u : best), members[0]);
  }, [usersInDept]);

  const saveUnitApprover = async (unitId: string, userId: string) => {
    if (!currentUser || !userId) return;
    setSaving(unitId);
    const { error } = await supabase.from('unit_approvers').upsert(
      { unit_id: unitId, approver_user_id: userId, set_by: currentUser.name, updated_at: new Date().toISOString() },
      { onConflict: 'unit_id' }
    );
    setSaving(null);
    if (error) { showToast(false, error.message); return; }
    setUnitApprovers(prev => ({ ...prev, [unitId]: userId }));
    const approver = users.find(u => u.id === userId);
    showToast(true, `Unit approver set to ${approver?.name} (${approver?.id})`);
  };

  const saveDeptApprover = async (dept: string, userId: string) => {
    if (!currentUser || !userId) return;
    setSaving(`dept-${dept}`);
    const { error } = await supabase.from('dept_approvers').upsert(
      { department: dept, approver_user_id: userId, set_by: currentUser.name, updated_at: new Date().toISOString() },
      { onConflict: 'department' }
    );
    setSaving(null);
    if (error) { showToast(false, error.message); return; }
    setDeptApprovers(prev => ({ ...prev, [dept]: userId }));
    const approver = users.find(u => u.id === userId);
    showToast(true, `Dept approver set to ${approver?.name} (${approver?.id})`);
  };

  const totalConfigured = Object.keys(unitApprovers).length + Object.keys(deptApprovers).length;

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
          <Lock size={24} className="text-[#E31E24]" />
        </div>
        <p className="text-slate-400 font-bold">Access restricted to Admin and Developer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-[fadeIn_0.5s_ease-out] pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            Unit Approval Config
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Set who approves requests from each unit or department.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl">
            <span className="text-xs font-black text-emerald-600">{totalConfigured} configured</span>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-[#E31E24] hover:text-[#E31E24] transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {toast && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-sm font-bold ${
          toast.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/30'
                   : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-900/30'
        }`}>
          {toast.ok ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <div className="p-5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-400 font-bold leading-relaxed space-y-1">
          <p>When an employee submits a request, it routes to their <strong>unit's configured senior</strong> first, then HR.</p>
          <p>The system auto-suggests the employee with the <strong>highest pay scale</strong> in each unit. You can override anytime.</p>
          <p>The requester is notified with the approver's <strong>name and ID</strong> immediately after submitting.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {([['unit', 'By Unit', Building2], ['department', 'By Department', Users]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest border-2 rounded-2xl transition-all ${
              activeTab === id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#E31E24]" />
        </div>
      ) : activeTab === 'unit' ? (
        <div className="grid gap-5">
          {units.length === 0 && (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-3xl mb-3">🏢</p>
              <p className="text-sm font-bold text-slate-400">No units configured yet.</p>
            </div>
          )}
          {units.map(unit => {
            const members = usersInUnit(unit.id);
            const suggested = suggestedForUnit(unit.id);
            const currentApproverId = unitApprovers[unit.id] || '';
            const currentApprover = users.find(u => u.id === currentApproverId);
            const isSuggested = currentApproverId === suggested?.id;
            const isSaving = saving === unit.id;

            return (
              <div key={unit.id} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#E31E24]/10 flex items-center justify-center">
                      <Building2 size={18} className="text-[#E31E24]" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white">{unit.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {members.length} employee{members.length !== 1 ? 's' : ''} · {unit.unitType}
                      </p>
                    </div>
                  </div>
                  {currentApprover ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-xl">
                      <UserCheck size={12} className="text-emerald-500" />
                      <span className="text-[10px] font-black text-emerald-600">{currentApprover.name} · {currentApprover.id}</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                      <span className="text-[10px] font-black text-amber-600">⚠ No approver set</span>
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-5">
                  {suggested ? (
                    <div className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${
                      isSuggested
                        ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30'
                        : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
                    }`}>
                      <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center font-black text-sm text-slate-600 dark:text-slate-300 overflow-hidden flex-shrink-0 border border-slate-100 dark:border-slate-700">
                        {(suggested as any).avatar
                          ? <img src={(suggested as any).avatar} alt="" className="w-full h-full object-cover" />
                          : suggested.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-slate-900 dark:text-white text-sm">{suggested.name}</p>
                          <span className="text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">{suggested.id}</span>
                          <span className="flex items-center gap-1 text-[9px] font-black text-violet-600">
                            <TrendingUp size={9} /> {fmtSalary(suggested.baseSalary)}/mo
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{suggested.department} · {(suggested as any).designation || suggested.role}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isSuggested ? '✓ Active' : 'Suggested'}</span>
                        {!isSuggested && (
                          <button onClick={() => saveUnitApprover(unit.id, suggested.id)} disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#E31E24] text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-sm disabled:opacity-50">
                            {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />} Use This
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-2">No employees in this unit to suggest.</p>
                  )}

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Override Approver</label>
                    <div className="flex gap-2">
                      <select value={currentApproverId}
                        onChange={e => setUnitApprovers(prev => ({ ...prev, [unit.id]: e.target.value }))}
                        className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all">
                        <option value="">— No approver set —</option>
                        <optgroup label="Unit Members (ranked by pay)">
                          {members.sort((a, b) => b.baseSalary - a.baseSalary).map(u => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.id}) — {fmtSalary(u.baseSalary)}{u.id === suggested?.id ? ' ★' : ''}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="HR / Admin">
                          {users.filter(u => [UserRole.HR, UserRole.ADMIN, UserRole.CO_ADMIN].includes(u.role as UserRole)).map(u => (
                            <option key={`x-${u.id}`} value={u.id}>{u.name} ({u.id}) — {u.role}</option>
                          ))}
                        </optgroup>
                      </select>
                      <button onClick={() => saveUnitApprover(unit.id, unitApprovers[unit.id] || '')}
                        disabled={isSaving || !unitApprovers[unit.id]}
                        className="flex items-center gap-2 px-4 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 dark:hover:bg-slate-100 transition-all disabled:opacity-40 flex-shrink-0">
                        {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                      </button>
                    </div>
                  </div>

                  {members.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Pay Scale Ranking</p>
                      <div className="flex flex-wrap gap-2">
                        {members.sort((a, b) => b.baseSalary - a.baseSalary).map((u, i) => (
                          <div key={u.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
                            i === 0
                              ? 'bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-900/30 text-violet-700 dark:text-violet-400'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                            {i === 0 && <Crown size={10} className="text-violet-500" />}
                            <span className="font-black">{u.name}</span>
                            <span className="text-[9px] opacity-60">{u.id}</span>
                            <span className="text-[9px] font-bold">{fmtSalary(u.baseSalary)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-5">
          {departments.length === 0 && (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-3xl mb-3">🏬</p>
              <p className="text-sm font-bold text-slate-400">No departments configured yet.</p>
            </div>
          )}
          {departments.map(dept => {
            const members = usersInDept(dept.name);
            const suggested = suggestedForDept(dept.name);
            const currentApproverId = deptApprovers[dept.name] || '';
            const currentApprover = users.find(u => u.id === currentApproverId);
            const isSuggested = currentApproverId === suggested?.id;
            const isSaving = saving === `dept-${dept.name}`;

            return (
              <div key={dept.id} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <Users size={18} className="text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white">{dept.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{members.length} employees · Department</p>
                    </div>
                  </div>
                  {currentApprover ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-xl">
                      <UserCheck size={12} className="text-emerald-500" />
                      <span className="text-[10px] font-black text-emerald-600">{currentApprover.name} · {currentApprover.id}</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                      <span className="text-[10px] font-black text-amber-600">⚠ No approver set</span>
                    </div>
                  )}
                </div>
                <div className="p-6 space-y-5">
                  {suggested && (
                    <div className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${isSuggested ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'}`}>
                      <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center font-black text-sm text-slate-600 dark:text-slate-300 overflow-hidden flex-shrink-0 border border-slate-100 dark:border-slate-700">
                        {(suggested as any).avatar ? <img src={(suggested as any).avatar} alt="" className="w-full h-full object-cover" /> : suggested.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-slate-900 dark:text-white text-sm">{suggested.name}</p>
                          <span className="text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">{suggested.id}</span>
                          <span className="flex items-center gap-1 text-[9px] font-black text-violet-600"><TrendingUp size={9} /> {fmtSalary(suggested.baseSalary)}/mo</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{suggested.department} · {(suggested as any).designation || suggested.role}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isSuggested ? '✓ Active' : 'Suggested'}</span>
                        {!isSuggested && (
                          <button onClick={() => saveDeptApprover(dept.name, suggested.id)} disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#E31E24] text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-sm disabled:opacity-50">
                            {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />} Use This
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Override Approver</label>
                    <div className="flex gap-2">
                      <select value={currentApproverId}
                        onChange={e => setDeptApprovers(prev => ({ ...prev, [dept.name]: e.target.value }))}
                        className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all">
                        <option value="">— No approver set —</option>
                        {members.sort((a, b) => b.baseSalary - a.baseSalary).map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.id}) — {fmtSalary(u.baseSalary)}{u.id === suggested?.id ? ' ★' : ''}</option>
                        ))}
                      </select>
                      <button onClick={() => saveDeptApprover(dept.name, deptApprovers[dept.name] || '')}
                        disabled={isSaving || !deptApprovers[dept.name]}
                        className="flex items-center gap-2 px-4 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 dark:hover:bg-slate-100 transition-all disabled:opacity-40 flex-shrink-0">
                        {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                      </button>
                    </div>
                  </div>
                  {members.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Pay Scale Ranking</p>
                      <div className="flex flex-wrap gap-2">
                        {members.sort((a, b) => b.baseSalary - a.baseSalary).slice(0, 8).map((u, i) => (
                          <div key={u.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${i === 0 ? 'bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-900/30 text-violet-700 dark:text-violet-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
                            {i === 0 && <Crown size={10} className="text-violet-500" />}
                            <span className="font-black">{u.name}</span>
                            <span className="text-[9px] opacity-60">{u.id}</span>
                            <span className="text-[9px] font-bold">{fmtSalary(u.baseSalary)}</span>
                          </div>
                        ))}
                        {members.length > 8 && <span className="text-[10px] text-slate-400 font-bold self-center">+{members.length - 8} more</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UnitApprovalConfigView;
