/**
 * CustomRolesView.tsx
 * Create and manage custom roles with feature permissions and pay scale.
 * Accessible by DEVELOPER + ADMIN only.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useHRM } from '../store';
import { supabase } from '../supabaseClient';
import { UserRole } from '../types';
import { formatCurrency } from '../utils';
import { EMPLOYEE_DESIGNATIONS, TECHNICIAN_DESIGNATIONS } from '../constants';
import {
  Plus, Edit2, Trash2, Users, Shield, DollarSign,
  X, Check, Search, Loader2, ChevronDown, AlertTriangle,
  Briefcase, Sliders, RefreshCw, UserPlus, UserMinus, ArrowRight, Download
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface CustomRole {
  id: string;
  name: string;
  description?: string;
  color: string;
  native_role?: string | null; // maps to a built-in UserRole for approval chain
  pay_scale_type: 'existing' | 'custom';
  pay_scale_id?: string | null;
  min_salary: number;
  max_salary: number;
  created_at: string;
  // derived
  memberIds?: string[];
  featureKeys?: string[];
}

// ── Feature list ─────────────────────────────────────────────────────────────

const ALL_FEATURES = [
  { id: 'dashboard',      label: 'Control Center',    emoji: '📊', group: 'Core' },
  { id: 'portal',         label: 'Employee Portal',   emoji: '👤', group: 'Core' },
  { id: 'employees',      label: 'Workforce Hub',     emoji: '👥', group: 'Core' },
  { id: 'chat',           label: 'Messages',          emoji: '💬', group: 'Core' },
  { id: 'attendance',     label: 'Attendance',        emoji: '🕐', group: 'Operations' },
  { id: 'requests',       label: 'Requests Hub',      emoji: '📝', group: 'Operations' },
  { id: 'payroll',        label: 'Payroll',           emoji: '💵', group: 'Operations' },
  { id: 'leave_policy',   label: 'Leave Policies',    emoji: '📅', group: 'Operations' },
  { id: 'assets',         label: 'Asset Manager',     emoji: '📦', group: 'Operations' },
  { id: 'broadcast',      label: 'Broadcast',         emoji: '📡', group: 'Operations' },
  { id: 'tracking',       label: 'Field Mapping',     emoji: '📍', group: 'Admin' },
  { id: 'infrastructure', label: 'Infrastructure',    emoji: '🌐', group: 'Admin' },
  { id: 'security',       label: 'Security Protocols',emoji: '🛡️', group: 'Admin' },
  { id: 'activity',       label: 'Activity Log',      emoji: '📋', group: 'Admin' },
  { id: 'permissions',    label: 'Permissions',       emoji: '✅', group: 'Admin' },
  { id: 'approval_flow',  label: 'Approval Flow',     emoji: '🔀', group: 'Admin' },
  { id: 'role_caps',      label: 'Role Capabilities', emoji: '⚙️', group: 'Admin' },
  { id: 'settings',       label: 'System Settings',   emoji: '🔧', group: 'Admin' },
];

const FEATURE_GROUPS = ['Core', 'Operations', 'Admin'];

// ── Color presets ─────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  '#E31E24', '#C41217', '#7C3AED', '#2563EB', '#0891B2',
  '#059669', '#D97706', '#DB2777', '#EA580C', '#4F46E5',
  '#0F172A', '#475569', '#6B7280', '#16A34A', '#9333EA',
];

// ── Empty form state ──────────────────────────────────────────────────────────

const emptyForm = (): Omit<CustomRole, 'id' | 'created_at' | 'memberIds' | 'featureKeys'> => ({
  name: '',
  description: '',
  color: '#E31E24',
  native_role: null,
  pay_scale_type: 'custom',
  pay_scale_id: null,
  min_salary: 0,
  max_salary: 0,
});

// ─────────────────────────────────────────────────────────────────────────────

const CustomRolesView: React.FC = () => {
  const { currentUser, users, payScales } = useHRM();

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null);
  const [membersRoleId, setMembersRoleId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState(emptyForm());
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState('');
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Access guard
  const canAccess = currentUser?.role === UserRole.DEVELOPER || currentUser?.role === UserRole.ADMIN;

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rolesData } = await supabase
        .from('custom_roles').select('*').order('created_at', { ascending: false });
      if (!rolesData) return;

      const { data: membersData } = await supabase.from('custom_role_members').select('*');
      const { data: permsData }   = await supabase.from('custom_role_permissions').select('*');

      const enriched: CustomRole[] = rolesData.map(r => ({
        ...r,
        pay_scale_type: r.pay_scale_type || 'custom',
        min_salary: r.min_salary ?? 0,
        max_salary: r.max_salary ?? 0,
        memberIds:  membersData?.filter(m => m.role_id === r.id).map(m => m.user_id) ?? [],
        featureKeys: permsData?.filter(p => p.role_id === r.id).map(p => p.feature_key) ?? [],
      }));
      setRoles(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  // ── Open create/edit modal ─────────────────────────────────────────────────

  const openCreate = () => {
    setEditingRole(null);
    setForm(emptyForm());
    setSelectedFeatures(new Set());
    setSelectedMembers(new Set());
    setMemberSearch('');
    setSaveMsg(null);
    setModalOpen(true);
  };

  const openEdit = (role: CustomRole) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description ?? '',
      color: role.color,
      native_role: role.native_role ?? null,
      pay_scale_type: role.pay_scale_type,
      pay_scale_id: role.pay_scale_id ?? null,
      min_salary: role.min_salary,
      max_salary: role.max_salary,
    });
    setSelectedFeatures(new Set(role.featureKeys ?? []));
    setSelectedMembers(new Set(role.memberIds ?? []));
    setMemberSearch('');
    setSaveMsg(null);
    setModalOpen(true);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) {
      setSaveMsg({ type: 'err', text: 'Role name is required.' });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      let roleId: string;

      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || null,
        color: form.color,
        native_role: form.native_role || null,
        pay_scale_type: form.pay_scale_type,
        pay_scale_id: form.pay_scale_type === 'existing' ? form.pay_scale_id : null,
        min_salary: form.pay_scale_type === 'custom' ? Number(form.min_salary) : 0,
        max_salary: form.pay_scale_type === 'custom' ? Number(form.max_salary) : 0,
      };

      if (editingRole) {
        await supabase.from('custom_roles').update(payload).eq('id', editingRole.id);
        roleId = editingRole.id;
      } else {
        const { data } = await supabase.from('custom_roles').insert(payload).select().single();
        roleId = data.id;
      }

      // Sync permissions
      await supabase.from('custom_role_permissions').delete().eq('role_id', roleId);
      if (selectedFeatures.size > 0) {
        await supabase.from('custom_role_permissions').insert(
          Array.from(selectedFeatures).map(fk => ({ role_id: roleId, feature_key: fk }))
        );
      }

      // Sync members
      await supabase.from('custom_role_members').delete().eq('role_id', roleId);
      if (selectedMembers.size > 0) {
        await supabase.from('custom_role_members').insert(
          Array.from(selectedMembers).map(uid => ({ role_id: roleId, user_id: uid }))
        );
      }

      setSaveMsg({ type: 'ok', text: 'Role saved successfully.' });
      await fetchRoles();
      setTimeout(() => setModalOpen(false), 800);
    } catch (e: any) {
      setSaveMsg({ type: 'err', text: e.message || 'Failed to save role.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await supabase.from('custom_roles').delete().eq('id', deleteTarget.id);
      setDeleteTarget(null);
      await fetchRoles();
    } finally {
      setSaving(false);
    }
  };

  // ── Migrate custom role members → built-in designation ───────────────────
  // For each member of the selected custom role:
  //   1. Sets their `designation` in the DB to the custom role name
  //   2. If native_role is set, updates their `role` to that UserRole
  //   3. Optionally removes them from the custom role after migration
  const [migratingRole, setMigratingRole] = useState<CustomRole | null>(null);
  const [migrateDesignation, setMigrateDesignation] = useState('');
  const [migrateRemoveFromCustom, setMigrateRemoveFromCustom] = useState(true);
  const [migrateResult, setMigrateResult] = useState<{ ok: string[]; err: string[] } | null>(null);
  const [migrating, setMigrating] = useState(false);

  const ALL_DESIGNATIONS = [...EMPLOYEE_DESIGNATIONS, ...TECHNICIAN_DESIGNATIONS];

  const openMigrate = (role: CustomRole) => {
    setMigratingRole(role);
    // Pre-fill with the role name if it matches a known designation, else empty
    const match = ALL_DESIGNATIONS.find(d => d.toLowerCase() === role.name.toLowerCase());
    setMigrateDesignation(match || role.name);
    setMigrateRemoveFromCustom(true);
    setMigrateResult(null);
  };

  const handleMigrate = async () => {
    if (!migratingRole || !migrateDesignation.trim()) return;
    setMigrating(true);
    setMigrateResult(null);

    const ok: string[] = [];
    const err: string[] = [];
    const memberIds = migratingRole.memberIds ?? [];

    for (const uid of memberIds) {
      const user = users.find(u => u.id === uid);
      if (!user) { err.push(`Unknown user ${uid}`); continue; }

      try {
        const updatePayload: Record<string, any> = { designation: migrateDesignation.trim() };
        if (migratingRole.native_role && Object.values(UserRole).includes(migratingRole.native_role as UserRole)) {
          updatePayload.role = migratingRole.native_role;
        }
        const { error } = await supabase.from('users').update(updatePayload).eq('id', uid);
        if (error) throw error;
        ok.push(user.name);
      } catch (e: any) {
        err.push(`${user.name}: ${e.message}`);
      }
    }

    if (migrateRemoveFromCustom && ok.length > 0) {
      // Remove successfully migrated users from the custom role
      const migratedIds = ok.map(name => users.find(u => u.name === name)?.id).filter(Boolean);
      await supabase.from('custom_role_members')
        .delete()
        .eq('role_id', migratingRole.id)
        .in('user_id', migratedIds as string[]);
    }

    setMigrateResult({ ok, err });
    setMigrating(false);
    await fetchRoles();
    // Refresh global user state
    window.location.reload();
  };

  // ── Feature toggle ────────────────────────────────────────────────────────

  const toggleFeature = (id: string) => {
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    const groupFeatures = ALL_FEATURES.filter(f => f.group === group).map(f => f.id);
    const allSelected = groupFeatures.every(f => selectedFeatures.has(f));
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      groupFeatures.forEach(f => allSelected ? next.delete(f) : next.add(f));
      return next;
    });
  };

  // ── Member search ──────────────────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    const q = memberSearch.toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(q) || u.department.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [users, memberSearch]);

  // ── Pay scale display helper ───────────────────────────────────────────────

  const getPayScaleLabel = (role: CustomRole): string => {
    if (role.pay_scale_type === 'existing' && role.pay_scale_id) {
      const ps = payScales.find(p => p.id === role.pay_scale_id);
      return ps ? `${ps.name} (${formatCurrency(ps.minSalary)}–${formatCurrency(ps.maxSalary)})` : 'Pay Scale';
    }
    if (role.min_salary > 0 || role.max_salary > 0) {
      return `${formatCurrency(role.min_salary)} – ${formatCurrency(role.max_salary)}`;
    }
    return 'Not set';
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-[2rem] flex items-center justify-center">
          <Shield size={28} className="text-[#E31E24]" />
        </div>
        <p className="text-lg font-black text-slate-900 dark:text-white">Access Restricted</p>
        <p className="text-sm text-slate-400">Custom Roles management requires DEVELOPER or ADMIN access.</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-[fadeIn_0.5s_ease-out] pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            Custom Roles
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Define roles beyond the built-ins — assign features and pay scales.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchRoles}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl hover:border-[#E31E24] transition-all"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] shadow-lg shadow-red-900/20 transition-all active:scale-95"
          >
            <Plus size={15} />
            New Role
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Custom Roles', value: roles.length, icon: Briefcase, color: 'from-violet-500 to-purple-600' },
          { label: 'Total Members', value: roles.reduce((a, r) => a + (r.memberIds?.length ?? 0), 0), icon: Users, color: 'from-blue-500 to-indigo-600' },
          { label: 'Feature Grants', value: roles.reduce((a, r) => a + (r.featureKeys?.length ?? 0), 0), icon: Sliders, color: 'from-emerald-500 to-teal-600' },
          { label: 'With Pay Scale', value: roles.filter(r => r.pay_scale_type === 'existing' ? r.pay_scale_id : (r.min_salary > 0 || r.max_salary > 0)).length, icon: DollarSign, color: 'from-amber-500 to-orange-600' },
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

      {/* Role cards */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-[#E31E24]" />
        </div>
      ) : roles.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 p-16 text-center soft-shadow">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
            <Briefcase size={28} className="text-slate-400" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white mb-2">No custom roles yet</p>
          <p className="text-sm text-slate-400 mb-6">Create your first role to get started.</p>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] transition-all">
            <Plus size={14} /> Create First Role
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {roles.map(role => (
            <div
              key={role.id}
              className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 soft-shadow overflow-hidden group transition-all hover:shadow-xl hover:-translate-y-0.5"
            >
              {/* Color bar */}
              <div className="h-1.5 w-full" style={{ backgroundColor: role.color }} />

              <div className="p-6">
                {/* Role header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md font-black text-white text-sm" style={{ backgroundColor: role.color }}>
                      {role.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 dark:text-white text-sm leading-tight">{role.name}</p>
                      {role.description && (
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-snug line-clamp-1">{role.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openMigrate(role)}
                      title="Migrate members to built-in designation"
                      className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => openEdit(role)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(role)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Pay scale */}
                <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <DollarSign size={12} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{getPayScaleLabel(role)}</p>
                </div>

                {/* Chips row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    <Users size={10} />
                    {role.memberIds?.length ?? 0} members
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    <Sliders size={10} />
                    {role.featureKeys?.length ?? 0} features
                  </span>
                </div>

                {/* Feature keys preview */}
                {(role.featureKeys?.length ?? 0) > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {role.featureKeys!.slice(0, 5).map(fk => {
                      const f = ALL_FEATURES.find(x => x.id === fk);
                      return (
                        <span key={fk} className="px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg text-white" style={{ backgroundColor: role.color + 'CC' }}>
                          {f?.emoji} {f?.label ?? fk}
                        </span>
                      );
                    })}
                    {role.featureKeys!.length > 5 && (
                      <span className="px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500">
                        +{role.featureKeys!.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[800] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-6 animate-[fadeIn_0.25s_ease-out]">
          <div className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: form.color }}>
                  <Briefcase size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-white text-base">
                    {editingRole ? 'Edit Role' : 'Create Custom Role'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Define features, pay scale, and members</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-8">

              {/* ── Section 1: Basic Info ── */}
              <div className="space-y-4">
                <SectionLabel>Role Identity</SectionLabel>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Role Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Field Supervisor, Accounts Officer"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-[#E31E24] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description of this role's responsibilities"
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-[#E31E24] transition-colors resize-none"
                  />
                </div>

                {/* Native Role Mapping */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    Maps to Native Role
                  </label>
                  <select
                    value={form.native_role || ''}
                    onChange={e => setForm(p => ({ ...p, native_role: e.target.value || null }))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-colors"
                  >
                    <option value="">— No mapping (custom only) —</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="HR">HR</option>
                    <option value="CO_ADMIN">Co-Admin</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <p className="text-[9px] text-slate-400 font-medium mt-1.5 leading-relaxed">
                    Members of this role will be treated as the selected native role for approval chains, geofencing, and permissions.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Role Color</label>
                  <div className="flex flex-wrap gap-2.5">
                    {COLOR_PRESETS.map(c => (
                      <button
                        key={c}
                        onClick={() => setForm(p => ({ ...p, color: c }))}
                        className={`w-8 h-8 rounded-xl transition-all active:scale-90 ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-slate-900 dark:ring-white scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={form.color}
                      onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                      className="w-8 h-8 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 cursor-pointer"
                      title="Custom color"
                    />
                  </div>
                </div>
              </div>

              {/* ── Section 2: Pay Scale ── */}
              <div className="space-y-4">
                <SectionLabel>Pay Scale</SectionLabel>

                {/* Toggle */}
                <div className="flex gap-2">
                  {(['custom', 'existing'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(p => ({ ...p, pay_scale_type: t }))}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        form.pay_scale_type === t
                          ? 'text-white shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      style={form.pay_scale_type === t ? { backgroundColor: form.color } : {}}
                    >
                      {t === 'custom' ? '💵 Set Salary Range' : '📋 Use Existing Scale'}
                    </button>
                  ))}
                </div>

                {form.pay_scale_type === 'custom' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Min Salary (৳)</label>
                      <input
                        type="number"
                        value={form.min_salary}
                        onChange={e => setForm(p => ({ ...p, min_salary: Number(e.target.value) }))}
                        placeholder="0"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Max Salary (৳)</label>
                      <input
                        type="number"
                        value={form.max_salary}
                        onChange={e => setForm(p => ({ ...p, max_salary: Number(e.target.value) }))}
                        placeholder="0"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-colors"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Select Pay Scale</label>
                    <div className="relative">
                      <select
                        value={form.pay_scale_id ?? ''}
                        onChange={e => setForm(p => ({ ...p, pay_scale_id: e.target.value || null }))}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-colors appearance-none pr-10"
                      >
                        <option value="">-- Select a pay scale --</option>
                        {payScales.map(ps => (
                          <option key={ps.id} value={ps.id}>
                            {ps.name} · {ps.role} Lvl {ps.level} · {formatCurrency(ps.minSalary)}–{formatCurrency(ps.maxSalary)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    {payScales.length === 0 && (
                      <p className="text-[10px] text-amber-500 font-bold mt-2">⚠ No pay scales defined yet. Go to Payroll → Pay Scale to create some.</p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Section 3: Feature Permissions ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <SectionLabel>Feature Access</SectionLabel>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {selectedFeatures.size} / {ALL_FEATURES.length} selected
                  </span>
                </div>

                {FEATURE_GROUPS.map(group => {
                  const groupFeatures = ALL_FEATURES.filter(f => f.group === group);
                  const allSelected = groupFeatures.every(f => selectedFeatures.has(f.id));
                  const someSelected = groupFeatures.some(f => selectedFeatures.has(f.id));
                  return (
                    <div key={group}>
                      <button
                        onClick={() => toggleGroup(group)}
                        className="flex items-center gap-2 mb-3 group"
                      >
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border-2 transition-all ${allSelected ? 'border-[#E31E24] bg-[#E31E24]' : someSelected ? 'border-[#E31E24] bg-red-100 dark:bg-red-900/20' : 'border-slate-300 dark:border-slate-600'}`}>
                          {allSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                          {someSelected && !allSelected && <div className="w-1.5 h-1.5 bg-[#E31E24] rounded-sm" />}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                          {group}
                        </span>
                      </button>
                      <div className="grid grid-cols-2 gap-2 ml-2">
                        {groupFeatures.map(f => {
                          const active = selectedFeatures.has(f.id);
                          return (
                            <button
                              key={f.id}
                              onClick={() => toggleFeature(f.id)}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all active:scale-95 ${
                                active
                                  ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-all ${active ? 'bg-[#E31E24] border-[#E31E24]' : 'border-slate-300 dark:border-slate-600'}`}>
                                {active && <Check size={9} className="text-white" strokeWidth={3} />}
                              </div>
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                                {f.emoji} {f.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Section 4: Members ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <SectionLabel>Members</SectionLabel>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {selectedMembers.size} selected
                  </span>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search employees by name or department…"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-[#E31E24] transition-colors"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                  {filteredUsers.map(u => {
                    const active = selectedMembers.has(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSelectedMembers(prev => {
                          const next = new Set(prev);
                          active ? next.delete(u.id) : next.add(u.id);
                          return next;
                        })}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                          active
                            ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 overflow-hidden ${active ? 'bg-[#E31E24] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                          {u.avatar
                            ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                            : u.name.charAt(0)
                          }
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-900 dark:text-white truncate">{u.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{u.department} · {u.role}</p>
                        </div>
                        {active
                          ? <UserMinus size={13} className="text-[#E31E24] flex-shrink-0" />
                          : <UserPlus size={13} className="text-slate-400 flex-shrink-0" />
                        }
                      </button>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <p className="text-center py-6 text-xs text-slate-400 font-bold">No matching employees found.</p>
                  )}
                </div>
              </div>

            </div>

            {/* Modal footer */}
            <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 space-y-3">
              {saveMsg && (
                <div className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${saveMsg.type === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
                  {saveMsg.type === 'ok' ? <Check size={14} /> : <AlertTriangle size={14} />}
                  {saveMsg.text}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: form.color }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 backdrop-blur-md p-6 animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl p-8 text-center space-y-5">
            <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-[1.5rem] flex items-center justify-center mx-auto">
              <Trash2 size={24} className="text-[#E31E24]" />
            </div>
            <div>
              <p className="text-lg font-black text-slate-900 dark:text-white mb-1">Delete "{deleteTarget.name}"?</p>
              <p className="text-sm text-slate-400 font-medium">
                This will remove the role, its {deleteTarget.memberIds?.length ?? 0} member(s), and all feature permissions. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-3 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#C41217] transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Migration Modal ── */}
      {migratingRole && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center">
                  <Download size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-white">Migrate to Built-in Designation</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Move members of "{migratingRole.name}" to a coded designation</p>
                </div>
              </div>
              <button onClick={() => { setMigratingRole(null); setMigrateResult(null); }} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-7 py-6 space-y-5">

              {/* Affected members preview */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                  {migratingRole.memberIds?.length ?? 0} member(s) will be updated
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {(migratingRole.memberIds ?? []).length === 0 && (
                    <p className="text-sm text-slate-400 italic">No members in this role.</p>
                  )}
                  {(migratingRole.memberIds ?? []).map(uid => {
                    const u = users.find(x => x.id === uid);
                    if (!u) return null;
                    return (
                      <div key={uid} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500 flex-shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">{u.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{u.role} · {u.department}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="truncate max-w-[80px]">{u.designation || 'No designation'}</span>
                          <ArrowRight size={10} />
                          <span className="text-emerald-600 font-black truncate max-w-[80px]">{migrateDesignation || '…'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Designation picker */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Target Designation
                </label>
                <select
                  value={migrateDesignation}
                  onChange={e => setMigrateDesignation(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-emerald-500 transition-all"
                >
                  <option value="">— Select designation —</option>
                  <optgroup label="Employee Track">
                    {EMPLOYEE_DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </optgroup>
                  <optgroup label="Technician Track">
                    {TECHNICIAN_DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </optgroup>
                  <option value={migratingRole.name}>{migratingRole.name} (custom role name)</option>
                </select>
              </div>

              {/* Native role info */}
              {migratingRole.native_role && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <Shield size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
                    Members' system role will also be updated to <span className="font-black">{migratingRole.native_role}</span> (the native role set on this custom role).
                  </p>
                </div>
              )}

              {/* Remove from custom role toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setMigrateRemoveFromCustom(p => !p)}
                  className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${migrateRemoveFromCustom ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${migrateRemoveFromCustom ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Remove members from this custom role after migration
                </span>
              </label>

              {/* Result */}
              {migrateResult && (
                <div className="space-y-2">
                  {migrateResult.ok.length > 0 && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-900/30">
                      <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 mb-1">✅ Migrated {migrateResult.ok.length} user(s)</p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-500">{migrateResult.ok.join(', ')}</p>
                    </div>
                  )}
                  {migrateResult.err.length > 0 && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-900/30">
                      <p className="text-xs font-black text-red-700 dark:text-red-400 mb-1">❌ {migrateResult.err.length} error(s)</p>
                      <p className="text-[11px] text-red-600 dark:text-red-500">{migrateResult.err.join('; ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-7 pb-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => { setMigratingRole(null); setMigrateResult(null); }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all"
              >
                {migrateResult ? 'Close' : 'Cancel'}
              </button>
              {!migrateResult && (
                <button
                  onClick={handleMigrate}
                  disabled={migrating || !migrateDesignation.trim() || (migratingRole.memberIds?.length ?? 0) === 0}
                  className="flex-1 py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {migrating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Migrate {migratingRole.memberIds?.length ?? 0} Member(s)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Small helper ──────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
    <span className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
    {children}
    <span className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
  </p>
);

export default CustomRolesView;
