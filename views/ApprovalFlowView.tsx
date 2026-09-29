/**
 * ApprovalFlowView.tsx
 * Allows ADMIN and DEVELOPER to configure the leave approval chain
 * for each requester role. Stored in Supabase `approval_flows` table.
 *
 * Each row: { requester_role, step_order, approver_role }
 * The chain for a requester is the ordered list of approver_roles they need.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import { supabase } from '../supabaseClient';
import {
  GitBranch, Plus, Trash2, Save, RefreshCw,
  CheckCircle, AlertCircle, X, ArrowRight,
  Info, Loader2, Lock, GripVertical, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FlowStep {
  id?: string;
  requester_role: string;  // UserRole or custom::<id>
  step_order: number;
  approver_role: string;   // UserRole or custom::<id>
}

// Built-in approver roles
const BUILTIN_APPROVER_ROLES: UserRole[] = [
  UserRole.MANAGER,
  UserRole.HR,
  UserRole.CO_ADMIN,
  UserRole.ADMIN,
  UserRole.DEVELOPER,
];

// Built-in requester roles
const BUILTIN_REQUESTER_ROLES: UserRole[] = [
  UserRole.EMPLOYEE,
  UserRole.MANAGER,
  UserRole.HR,
  UserRole.CO_ADMIN,
];

const CUSTOM_ROLE_COLOR = 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400 border-teal-100 dark:border-teal-900/30';

const ROLE_COLORS: Record<string, string> = {
  EMPLOYEE:  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  MANAGER:   'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-purple-100 dark:border-purple-900/30',
  HR:        'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',
  CO_ADMIN:  'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-100 dark:border-orange-900/30',
  ADMIN:     'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900/30',
  DEVELOPER: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border-violet-100 dark:border-violet-900/30',
};

const getRoleColor = (r: string) => ROLE_COLORS[r] ?? CUSTOM_ROLE_COLOR;

// ── Default flow (fallback if no DB config) ───────────────────────────────────
export const DEFAULT_FLOWS: FlowStep[] = [
  { requester_role: UserRole.EMPLOYEE,  step_order: 1, approver_role: UserRole.MANAGER },
  { requester_role: UserRole.EMPLOYEE,  step_order: 2, approver_role: UserRole.HR },
  { requester_role: UserRole.EMPLOYEE,  step_order: 3, approver_role: UserRole.ADMIN },
  { requester_role: UserRole.MANAGER,   step_order: 1, approver_role: UserRole.HR },
  { requester_role: UserRole.MANAGER,   step_order: 2, approver_role: UserRole.CO_ADMIN },
  { requester_role: UserRole.MANAGER,   step_order: 3, approver_role: UserRole.ADMIN },
  { requester_role: UserRole.HR,        step_order: 1, approver_role: UserRole.CO_ADMIN },
  { requester_role: UserRole.HR,        step_order: 2, approver_role: UserRole.ADMIN },
  { requester_role: UserRole.CO_ADMIN,  step_order: 1, approver_role: UserRole.ADMIN },
];

// ── Hook: load flow from Supabase, export for use in LeavesView ───────────────
export const useApprovalFlow = () => {
  const [flows, setFlows] = useState<FlowStep[]>(DEFAULT_FLOWS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('approval_flows').select('*').order('requester_role').order('step_order')
      .then(({ data }) => {
        if (data && data.length > 0) setFlows(data as FlowStep[]);
        setLoaded(true);
      });
  }, []);

  /** Get ordered approver chain for a given requester role */
  const getChain = useCallback((requesterRole: string): string[] => {
    return flows
      .filter(f => f.requester_role === requesterRole)
      .sort((a, b) => a.step_order - b.step_order)
      .map(f => f.approver_role);
  }, [flows]);

  return { flows, getChain, loaded };
};

// ── Main view ─────────────────────────────────────────────────────────────────
const ApprovalFlowView: React.FC = () => {
  const { currentUser, addActivityLog, customRoles, hasPermission } = useHRM();

  const canEdit = currentUser?.role === UserRole.ADMIN ||
                  currentUser?.role === UserRole.DEVELOPER ||
                  (currentUser ? hasPermission(currentUser.id, 'manage_approval_flow') : false);

  // Build dynamic role lists that include custom roles
  const APPROVER_ROLES: string[] = [
    ...BUILTIN_APPROVER_ROLES,
    ...customRoles.map((cr: any) => `custom::${cr.id}`),
  ];
  const REQUESTER_ROLES: string[] = [
    ...BUILTIN_REQUESTER_ROLES,
    ...customRoles.map((cr: any) => `custom::${cr.id}`),
  ];

  // Label resolver — handles both built-in and custom roles
  const roleLabel = (r: string): string => {
    if (r.startsWith('custom::')) {
      const id = r.replace('custom::', '');
      return customRoles.find((cr: any) => cr.id === id)?.name ?? r;
    }
    if (r === UserRole.CO_ADMIN) return 'Co-Admin';
    if (r === UserRole.DEVELOPER) return 'Developer';
    if (r === UserRole.HR) return 'HR';
    return r.charAt(0) + r.slice(1).toLowerCase();
  };

  const [flows, setFlows]     = useState<FlowStep[]>(DEFAULT_FLOWS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ ok: boolean; msg: string } | null>(null);

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const loadFlows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('approval_flows').select('*')
      .order('requester_role').order('step_order');
    if (data && data.length > 0) setFlows(data as FlowStep[]);
    else setFlows(DEFAULT_FLOWS);
    setLoading(false);
  }, []);

  useEffect(() => { loadFlows(); }, [loadFlows]);

  // Get steps for a specific requester role
  const stepsFor = (role: string) =>
    flows.filter(f => f.requester_role === role).sort((a, b) => a.step_order - b.step_order);

  // Add a step to a requester's chain
  const addStep = (requesterRole: string) => {
    const existing = stepsFor(requesterRole);
    const usedApprovers = existing.map(s => s.approver_role);
    const nextApprover = APPROVER_ROLES.find(r => !usedApprovers.includes(r));
    if (!nextApprover) { showToast(false, 'All approver roles already used in this chain.'); return; }
    const newStep: FlowStep = {
      requester_role: requesterRole,
      step_order: existing.length + 1,
      approver_role: nextApprover,
    };
    setFlows(prev => [...prev, newStep]);
  };

  // Remove a step
  const removeStep = (requesterRole: string, stepOrder: number) => {
    setFlows(prev => {
      const remaining = prev.filter(f => !(f.requester_role === requesterRole && f.step_order === stepOrder));
      // Re-number steps for this requester
      const renumbered = remaining.map(f => {
        if (f.requester_role !== requesterRole) return f;
        const steps = remaining.filter(x => x.requester_role === requesterRole).sort((a, b) => a.step_order - b.step_order);
        const idx = steps.findIndex(x => x.step_order === f.step_order);
        return { ...f, step_order: idx + 1 };
      });
      return renumbered;
    });
  };

  // Change approver role for a step
  const changeApprover = (requesterRole: string, stepOrder: number, newApprover: string) => {
    setFlows(prev => prev.map(f =>
      f.requester_role === requesterRole && f.step_order === stepOrder
        ? { ...f, approver_role: newApprover }
        : f
    ));
  };

  // Move step up
  const moveUp = (requesterRole: string, stepOrder: number) => {
    if (stepOrder <= 1) return;
    setFlows(prev => prev.map(f => {
      if (f.requester_role !== requesterRole) return f;
      if (f.step_order === stepOrder)     return { ...f, step_order: stepOrder - 1 };
      if (f.step_order === stepOrder - 1) return { ...f, step_order: stepOrder };
      return f;
    }));
  };

  // Move step down
  const moveDown = (requesterRole: string, stepOrder: number) => {
    const maxOrder = stepsFor(requesterRole).length;
    if (stepOrder >= maxOrder) return;
    setFlows(prev => prev.map(f => {
      if (f.requester_role !== requesterRole) return f;
      if (f.step_order === stepOrder)     return { ...f, step_order: stepOrder + 1 };
      if (f.step_order === stepOrder + 1) return { ...f, step_order: stepOrder };
      return f;
    }));
  };

  // Reset to defaults
  const resetToDefault = () => {
    setFlows(DEFAULT_FLOWS);
    showToast(true, 'Reset to default flow. Click Save to apply.');
  };

  // Save all
  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);

    // Only check for duplicate approvers in the same chain — no other restrictions for Developer
    for (const role of REQUESTER_ROLES) {
      const steps = stepsFor(role);
      const approvers = steps.map(s => s.approver_role);
      if (new Set(approvers).size !== approvers.length) {
        showToast(false, `${roleLabel(role)} chain has duplicate approvers.`);
        setSaving(false); return;
      }
    }

    try {
      // Delete existing rows per requester role, then insert new ones
      for (const role of REQUESTER_ROLES) {
        await supabase.from('approval_flows').delete().eq('requester_role', role);
      }
      const rows = flows.map(f => ({
        requester_role: f.requester_role,
        step_order: f.step_order,
        approver_role: f.approver_role,
      }));
      const { error } = await supabase.from('approval_flows').insert(rows);
      if (error) throw error;

      await addActivityLog('APPROVAL_FLOW_UPDATE', 'SYSTEM' as any, `Leave approval flow updated by ${currentUser?.name}.`, 'HIGH');
      showToast(true, 'Approval flow saved. Takes effect immediately for new leave requests.');
      await loadFlows();
    } catch (e: any) {
      showToast(false, e.message || 'Failed to save. Check Supabase approval_flows table.');
    }
    setSaving(false);
  };

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

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            Approval Flow
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Configure who approves leave requests for each role.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={resetToDefault} disabled={loading || saving}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-amber-400 hover:text-amber-600 transition-all">
            <RefreshCw size={14} /> Reset Default
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Flow
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-sm font-bold ${
          toast.ok
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/30'
            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-900/30'
        }`}>
          {toast.ok ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Info */}
      <div className="p-5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-400 font-bold leading-relaxed space-y-1">
          <p>Each row shows the approval chain for a requester role — the sequence of approvers who must sign off before the leave is fully approved.</p>
          <p>As Developer, you can design any chain with any roles in any order. Changes take effect immediately for all new requests. Existing pending requests continue with the old flow.</p>
          <p className="mt-1">Profile data change requests (from employees) currently go directly to HR/Admin. A configurable flow for profile changes will be added here in a future update.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#E31E24]" />
        </div>
      ) : (
        <div className="space-y-6">
          {REQUESTER_ROLES.map(requesterRole => {
            const steps = stepsFor(requesterRole);
            return (
              <div key={requesterRole} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                {/* Header row */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-widest ${getRoleColor(requesterRole)}`}>
                      {roleLabel(requesterRole)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">submits leave →</span>
                    {/* Visual chain preview */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {steps.map((step, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <ArrowRight size={10} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />}
                          <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${getRoleColor(step.approver_role)}`}>
                            {roleLabel(step.approver_role)}
                          </span>
                        </React.Fragment>
                      ))}
                      {steps.length === 0 && <span className="text-[10px] text-rose-500 font-bold">⚠ No chain defined</span>}
                    </div>
                  </div>
                  <button onClick={() => addStep(requesterRole)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#E31E24] text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-sm flex-shrink-0">
                    <Plus size={12} /> Add Step
                  </button>
                </div>

                {/* Steps */}
                <div className="p-5 space-y-3">
                  {steps.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4">No approval steps. Add at least one step ending with Admin.</p>
                  )}
                  {steps.map((step, idx) => (
                    <div key={`${requesterRole}-${step.step_order}`}
                      className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">

                      {/* Step number */}
                      <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">{step.step_order}</span>
                      </div>

                      {/* Approver role selector */}
                      <div className="flex-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Approver</label>
                        <select
                          value={step.approver_role}
                          onChange={e => changeApprover(requesterRole, step.step_order, e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all">
                          <optgroup label="Built-in Roles">
                            {BUILTIN_APPROVER_ROLES.map(r => (
                              <option key={r} value={r}>{roleLabel(r)}</option>
                            ))}
                          </optgroup>
                          {customRoles.length > 0 && (
                            <optgroup label="Custom Roles">
                              {customRoles.map((cr: any) => (
                                <option key={cr.id} value={`custom::${cr.id}`}>{cr.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Final step badge */}
                      {idx === steps.length - 1 && (
                        <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg flex-shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                          Final Step
                        </span>
                      )}

                      {/* Move up/down */}
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button onClick={() => moveUp(requesterRole, step.step_order)} disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
                          <ChevronUp size={14} />
                        </button>
                        <button onClick={() => moveDown(requesterRole, step.step_order)} disabled={idx === steps.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
                          <ChevronDown size={14} />
                        </button>
                      </div>

                      {/* Delete */}
                      <button onClick={() => removeStep(requesterRole, step.step_order)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApprovalFlowView;
