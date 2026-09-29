/**
 * PermissionsView.tsx — Exord Online HRM v3
 *
 * Accessible by: DEVELOPER + ADMIN
 *
 * Three tabs:
 *  1. By Employee  — grant extra features to a specific person
 *  2. By Role      — grant features to everyone with a built-in role
 *  3. Custom Roles — create named role-groups, assign members + features
 *
 * Supabase tables used (create if missing):
 *   user_permissions        { user_id, permission }          — existing
 *   role_feature_grants     { role, feature_key }            — new (built-in role level)
 *   custom_roles            { id, name, description, color } — new
 *   custom_role_members     { role_id, user_id }             — new
 *   custom_role_permissions { role_id, feature_key }         — new
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useHRM, FEATURES } from '../store';
import { NATIVE_ACCESS, FEATURES_BY_GROUP, FEATURE_GROUPS } from '../featureRegistry';
import { supabase } from '../supabaseClient';
import { UserRole } from '../types';
import {
  ShieldCheck, Search, X, Check, Package, DollarSign,
  Calendar, Clock, Map, Users, ShieldAlert, BarChart2,
  Loader2, Info, Trash2, Plus, Edit2, Lock, RefreshCw,
  UserPlus, ChevronDown, ChevronUp, Tag, Palette,
  Building2, Sliders, Save, CheckCircle, AlertCircle,
  Radio, GitBranch, Settings, Eye,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.FC<any>> = {
  Package, DollarSign, Calendar, Clock, Map,
  Users, ShieldAlert, BarChart2,
};

// Roles that already have native access to a feature
// NATIVE_ACCESS is now imported from featureRegistry.ts

const ROLE_COLORS: Record<string, string> = {
  DEVELOPER: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  ADMIN:     'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  CO_ADMIN:  'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  HR:        'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  MANAGER:   'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  EMPLOYEE:  'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const BUILT_IN_ROLES = [
  UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE,
];

const PALETTE_COLORS = [
  '#E31E24','#8B5CF6','#3B82F6','#10B981','#F59E0B',
  '#EC4899','#14B8A6','#F97316','#6366F1','#84CC16',
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface CustomRole {
  id: string;
  name: string;
  description: string;
  color: string;
  memberIds: string[];
  featureKeys: string[];
}

// ── Small helpers ──────────────────────────────────────────────────────────────
const FeatureToggle: React.FC<{
  featureKey: string;
  label: string;
  desc: string;
  icon: string;
  granted: boolean;
  native?: boolean;
  loading?: boolean;
  onToggle: () => void;
}> = ({ featureKey, label, desc, icon, granted, native, loading, onToggle }) => {
  const IconComp = ICON_MAP[icon] || Package;
  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
      native
        ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 opacity-60'
        : granted
        ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
    }`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
        native || granted ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-slate-800'
      }`}>
        <IconComp size={14} className={native || granted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-slate-900 dark:text-white">{label}</p>
        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{desc}</p>
        {native && <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5">✓ Native access</p>}
      </div>
      {native ? (
        <div className="w-11 h-6 bg-emerald-400 rounded-full flex items-center px-1 flex-shrink-0">
          <div className="w-4 h-4 bg-white rounded-full ml-auto shadow" />
        </div>
      ) : (
        <button
          onClick={onToggle} disabled={!!loading}
          className={`w-11 h-6 rounded-full flex-shrink-0 flex items-center px-1 transition-all ${
            granted ? 'bg-[#E31E24]' : 'bg-slate-200 dark:bg-slate-700'
          } ${loading ? 'opacity-50' : 'hover:opacity-90 active:scale-95'}`}
        >
          {loading
            ? <Loader2 size={12} className="animate-spin text-white mx-auto" />
            : <div className={`w-4 h-4 bg-white rounded-full shadow transition-all ${granted ? 'ml-auto' : ''}`} />
          }
        </button>
      )}
    </div>
  );
};

// ── Main View ──────────────────────────────────────────────────────────────────
const PermissionsView: React.FC = () => {
  const { users, userPermissions, grantPermission, revokePermission, currentUser, addActivityLog, refreshCustomRolePerms } = useHRM();

  const canAccess =
    currentUser?.role === UserRole.DEVELOPER ||
    currentUser?.role === UserRole.ADMIN;

  const isDev = currentUser?.role === UserRole.DEVELOPER;

  const [activeTab, setActiveTab] = useState<'employee' | 'role' | 'custom' | 'capabilities'>('employee');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Capabilities tab state (merged from RoleCapabilitiesView) ──────────────
  const [roleCaps, setRoleCaps]         = useState<Record<string, string[]>>({});
  const [capsLoading, setCapsLoading]   = useState(false);
  const [capsSaving, setCapsSaving]     = useState(false);
  const [selectedCapRole, setSelectedCapRole] = useState<string>(UserRole.ADMIN);
  const [customCapsData, setCustomCapsData]   = useState<{key:string;label:string;desc:string;category:string}[]>([]);
  const [customRolesForCaps, setCustomRolesForCaps] = useState<{id:string;name:string}[]>([]);
  const [showManageCaps, setShowManageCaps]   = useState(false);
  const [newCapKey, setNewCapKey]   = useState('');
  const [newCapLabel, setNewCapLabel] = useState('');
  const [newCapDesc, setNewCapDesc]   = useState('');
  const [newCapCategory, setNewCapCategory] = useState('Custom');
  const [capItemSaving, setCapItemSaving] = useState(false);
  const [editingCap, setEditingCap]   = useState<string | null>(null);
  const [editLabel, setEditLabel]     = useState('');
  const [capEditDesc, setCapEditDesc] = useState('');
  const [capEditCategory, setCapEditCategory] = useState('');

  const DEFAULT_CAPS: Record<string, string[]> = {
    ADMIN: ['view_workforce','create_employee','edit_employee','delete_employee','view_sensitive_data','view_payroll','manage_payroll','view_attendance','manage_attendance','view_leaves','approve_leaves','manage_leave_policy','view_security_logs','view_activity_log','clear_activity_log','view_assets','manage_assets','manage_infrastructure','view_tracking','broadcast','manage_approval_flow'],
    CO_ADMIN: ['view_workforce','create_employee','edit_employee','view_sensitive_data','view_payroll','manage_payroll','view_attendance','view_leaves','approve_leaves','view_activity_log','view_assets','manage_assets','view_tracking','broadcast'],
    HR: ['view_workforce','create_employee','edit_employee','view_sensitive_data','view_payroll','view_attendance','view_leaves','approve_leaves','manage_leave_policy','view_security_logs','view_activity_log','broadcast'],
    MANAGER: ['view_workforce','view_attendance','view_leaves','approve_leaves'],
    EMPLOYEE: ['view_workforce'],
  };

  const ALL_CAPS_LIST = [
    { key: 'view_workforce', label: 'View Workforce', desc: 'See employee list and profiles', category: 'Workforce' },
    { key: 'create_employee', label: 'Create Employee', desc: 'Add new employees', category: 'Workforce' },
    { key: 'edit_employee', label: 'Edit Employee', desc: 'Edit employee profile', category: 'Workforce' },
    { key: 'delete_employee', label: 'Delete Employee', desc: 'Permanently remove an employee', category: 'Workforce' },
    { key: 'view_sensitive_data', label: 'View Sensitive Data', desc: 'See salary, NID, personal details', category: 'Workforce' },
    { key: 'view_payroll', label: 'View Payroll', desc: 'See payroll records', category: 'Payroll' },
    { key: 'manage_payroll', label: 'Manage Payroll', desc: 'Add, edit and delete salary records', category: 'Payroll' },
    { key: 'view_attendance', label: 'View Attendance', desc: 'See attendance logs', category: 'Attendance' },
    { key: 'manage_attendance', label: 'Manage Attendance', desc: 'Edit attendance records', category: 'Attendance' },
    { key: 'view_leaves', label: 'View All Leaves', desc: 'See leave requests', category: 'Leaves' },
    { key: 'approve_leaves', label: 'Approve Leaves', desc: 'Approve / reject leave requests', category: 'Leaves' },
    { key: 'manage_leave_policy', label: 'Manage Leave Policies', desc: 'Create and edit leave policies', category: 'Leaves' },
    { key: 'view_security_logs', label: 'View Security Logs', desc: 'See login and security events', category: 'Security' },
    { key: 'view_activity_log', label: 'View Activity Log', desc: 'Full audit trail', category: 'Security' },
    { key: 'clear_activity_log', label: 'Clear Activity Log', desc: 'Delete activity log entries', category: 'Security' },
    { key: 'view_assets', label: 'View Assets', desc: 'See company assets', category: 'Assets' },
    { key: 'manage_assets', label: 'Manage Assets', desc: 'Add, edit, transfer assets', category: 'Assets' },
    { key: 'manage_infrastructure', label: 'Manage Infrastructure', desc: 'Add/edit units and departments', category: 'Infrastructure' },
    { key: 'view_tracking', label: 'Live Tracking', desc: 'View GPS tracking map', category: 'Tracking' },
    { key: 'broadcast', label: 'Broadcast', desc: 'Send notifications to employees', category: 'Communication' },
    { key: 'manage_approval_flow', label: 'Manage Approval Flow', desc: 'Configure leave approval chains', category: 'Leaves' },
  ];

  const CAP_CAT_COLORS: Record<string, string> = {
    Workforce: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    Payroll: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    Attendance: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
    Leaves: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    Security: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400',
    Assets: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    Infrastructure: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    Tracking: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400',
    Communication: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
    Custom: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };

  const loadCapsData = useCallback(async () => {
    setCapsLoading(true);
    const map: Record<string, string[]> = { ...DEFAULT_CAPS };
    try {
      const { data } = await supabase.from('role_capabilities').select('role,capabilities');
      if (data && data.length > 0) {
        data.forEach((r: any) => {
          try { map[r.role] = typeof r.capabilities === 'string' ? JSON.parse(r.capabilities) : r.capabilities; } catch {}
        });
      }
    } catch {}
    try {
      const { data: ccData } = await supabase.from('custom_capabilities').select('*').order('created_at', { ascending: true });
      if (ccData) setCustomCapsData(ccData.map((r: any) => ({ key: r.key, label: r.label, desc: r.description || '', category: r.category || 'Custom' })));
    } catch {}
    try {
      const { data: crData } = await supabase.from('custom_roles').select('id,name').order('created_at', { ascending: true });
      if (crData) {
        setCustomRolesForCaps(crData);
        crData.forEach((r: any) => { if (!map[r.id]) map[r.id] = []; });
      }
    } catch {}
    setRoleCaps(map);
    setCapsLoading(false);
  }, []);

  useEffect(() => { if (activeTab === 'capabilities') loadCapsData(); }, [activeTab, loadCapsData]);

  const toggleCap = (role: string, capKey: string) => {
    setRoleCaps(prev => {
      const cur = prev[role] || [];
      return { ...prev, [role]: cur.includes(capKey) ? cur.filter(k => k !== capKey) : [...cur, capKey] };
    });
  };

  const handleSaveCaps = async () => {
    if (!isDev) return;
    setCapsSaving(true);
    try {
      const allCapRoles = [UserRole.ADMIN, UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE, ...customRolesForCaps.map(r => r.id)];
      for (const role of allCapRoles) {
        await supabase.from('role_capabilities').upsert({ role, capabilities: JSON.stringify(roleCaps[role] || []) }, { onConflict: 'role' });
      }
      await addActivityLog('ROLE_CAPS_UPDATE', 'SYSTEM' as any, `Role capabilities updated by ${currentUser?.name}.`, 'HIGH');
      showToast('Role capabilities saved successfully.', true);
    } catch (e: any) { showToast(e.message || 'Failed to save capabilities.', false); }
    setCapsSaving(false);
  };

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Role-level grants (built-in roles) ─────────────────────────────────────
  // Map of role -> Set of feature keys granted to the whole role
  const [roleGrants, setRoleGrants] = useState<Record<string, string[]>>({});
  const [roleGrantsLoading, setRoleGrantsLoading] = useState(false);
  const [roleGrantsSaving, setRoleGrantsSaving] = useState<string | null>(null);

  const loadRoleGrants = useCallback(async () => {
    setRoleGrantsLoading(true);
    try {
      const { data } = await supabase
        .from('role_feature_grants')
        .select('role, feature_key');
      const map: Record<string, string[]> = {};
      (data || []).forEach((row: any) => {
        if (!map[row.role]) map[row.role] = [];
        map[row.role].push(row.feature_key);
      });
      setRoleGrants(map);
    } catch { /* table not yet created — silent */ }
    setRoleGrantsLoading(false);
  }, []);

  const toggleRoleGrant = useCallback(async (role: string, featureKey: string) => {
    const key = `${role}:${featureKey}`;
    setRoleGrantsSaving(key);
    const current = roleGrants[role] || [];
    const hasGrant = current.includes(featureKey);
    try {
      if (hasGrant) {
        await supabase
          .from('role_feature_grants')
          .delete()
          .eq('role', role)
          .eq('feature_key', featureKey);
        setRoleGrants(prev => ({ ...prev, [role]: (prev[role] || []).filter(k => k !== featureKey) }));
        showToast(`Revoked "${FEATURES[featureKey]?.label}" from all ${role.replace('_', ' ')} users`);
      } else {
        await supabase
          .from('role_feature_grants')
          .upsert({ role, feature_key: featureKey }, { onConflict: 'role,feature_key' });
        setRoleGrants(prev => ({ ...prev, [role]: [...(prev[role] || []), featureKey] }));
        showToast(`Granted "${FEATURES[featureKey]?.label}" to all ${role.replace('_', ' ')} users`);
      }
      await addActivityLog('ROLE_GRANT_UPDATE', 'SYSTEM' as any,
        `${hasGrant ? 'Revoked' : 'Granted'} feature "${featureKey}" ${hasGrant ? 'from' : 'to'} role ${role}.`,
        'MEDIUM');
    } catch {
      showToast('Failed — ensure role_feature_grants table exists in Supabase', false);
    }
    setRoleGrantsSaving(null);
  }, [roleGrants, showToast, addActivityLog]);

  // ── Custom roles ───────────────────────────────────────────────────────────
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [customRolesLoading, setCustomRolesLoading] = useState(false);

  const loadCustomRoles = useCallback(async () => {
    setCustomRolesLoading(true);
    try {
      const [{ data: rolesData }, { data: membersData }, { data: permsData }] = await Promise.all([
        supabase.from('custom_roles').select('*').order('created_at'),
        supabase.from('custom_role_members').select('role_id, user_id'),
        supabase.from('custom_role_permissions').select('role_id, feature_key'),
      ]);
      const memberMap: Record<string, string[]> = {};
      (membersData || []).forEach((r: any) => {
        if (!memberMap[r.role_id]) memberMap[r.role_id] = [];
        memberMap[r.role_id].push(r.user_id);
      });
      const permMap: Record<string, string[]> = {};
      (permsData || []).forEach((r: any) => {
        if (!permMap[r.role_id]) permMap[r.role_id] = [];
        permMap[r.role_id].push(r.feature_key);
      });
      setCustomRoles((rolesData || []).map((r: any) => ({
        id: r.id, name: r.name,
        description: r.description || '',
        color: r.color || '#E31E24',
        memberIds: memberMap[r.id] || [],
        featureKeys: permMap[r.id] || [],
      })));
    } catch { /* tables not yet created */ }
    setCustomRolesLoading(false);
  }, []);

  useEffect(() => {
    if (canAccess) {
      loadRoleGrants();
      loadCustomRoles();
    }
  }, [canAccess, loadRoleGrants, loadCustomRoles]);

  // ── Tab: By Employee ───────────────────────────────────────────────────────
  const [search, setSearch]         = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [empPermLoading, setEmpPermLoading] = useState<string | null>(null);

  const eligibleUsers = useMemo(() => users.filter(u =>
    u.id !== currentUser?.id &&
    (currentUser?.role === UserRole.DEVELOPER || u.role !== UserRole.DEVELOPER) &&
    u.role !== UserRole.ADMIN
  ), [users, currentUser]);

  const filteredUsers = useMemo(() => eligibleUsers.filter(u => {
    const q = search.toLowerCase();
    return (
      (!search || u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q)) &&
      (filterDept === 'ALL' || u.department === filterDept) &&
      (filterRole === 'ALL' || u.role === filterRole)
    );
  }), [eligibleUsers, search, filterDept, filterRole]);

  const selectedUser = users.find(u => u.id === selectedUserId);
  const selectedPerms = selectedUserId ? (userPermissions[selectedUserId] || []) : [];

  const handleEmpToggle = async (userId: string, featureKey: string, hasIt: boolean) => {
    const key = `${userId}:${featureKey}`;
    setEmpPermLoading(key);
    try {
      if (hasIt) { await revokePermission(userId, featureKey); showToast('Permission revoked'); }
      else        { await grantPermission(userId, featureKey);  showToast('Permission granted'); }
    } catch { showToast('Failed to update permission', false); }
    setEmpPermLoading(null);
  };

  const deptOptions = [...new Set(users.map(u => u.department).filter(Boolean))];

  // ── Tab: By Role ───────────────────────────────────────────────────────────
  const [selectedBuiltinRole, setSelectedBuiltinRole] = useState<UserRole>(UserRole.CO_ADMIN);
  // null = a builtin role is selected; a string = custom role ID is selected
  const [selectedCustomRoleInByRole, setSelectedCustomRoleInByRole] = useState<string | null>(null);
  const [customRolePermSaving, setCustomRolePermSaving] = useState<string | null>(null);

  const toggleCustomRolePerm = useCallback(async (roleId: string, featureKey: string) => {
    const key = `${roleId}:${featureKey}`;
    setCustomRolePermSaving(key);
    const role = customRoles.find(r => r.id === roleId);
    const hasIt = role?.featureKeys.includes(featureKey) ?? false;
    try {
      if (hasIt) {
        await supabase.from('custom_role_permissions').delete().eq('role_id', roleId).eq('feature_key', featureKey);
      } else {
        await supabase.from('custom_role_permissions').upsert({ role_id: roleId, feature_key: featureKey }, { onConflict: 'role_id,feature_key' });
      }
      await loadCustomRoles();
      await refreshCustomRolePerms(); // keep store's hasPermission in sync immediately
      showToast(`${hasIt ? 'Revoked' : 'Granted'} "${FEATURES[featureKey]?.label}" ${hasIt ? 'from' : 'to'} ${role?.name}`);
      await addActivityLog('ROLE_GRANT_UPDATE', 'SYSTEM' as any,
        `${hasIt ? 'Revoked' : 'Granted'} feature "${featureKey}" ${hasIt ? 'from' : 'to'} custom role ${role?.name}.`, 'MEDIUM');
    } catch {
      showToast('Failed to update permission', false);
    }
    setCustomRolePermSaving(null);
  }, [customRoles, loadCustomRoles, showToast, addActivityLog]);

  // ── Tab: Custom Roles ──────────────────────────────────────────────────────
  const [showCreateForm, setShowCreateForm]       = useState(false);
  const [newRoleName, setNewRoleName]             = useState('');
  const [newRoleDesc, setNewRoleDesc]             = useState('');
  const [newRoleColor, setNewRoleColor]           = useState(PALETTE_COLORS[0]);
  const [creatingRole, setCreatingRole]           = useState(false);
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId]         = useState<string | null>(null);
  const [editName, setEditName]                   = useState('');
  const [editDesc, setEditDesc]                   = useState('');
  const [editColor, setEditColor]                 = useState('');
  const [memberSearch, setMemberSearch]           = useState('');
  const [customPermLoading, setCustomPermLoading] = useState<string | null>(null);
  const [memberLoading, setMemberLoading]         = useState<string | null>(null);

  const selectedCustomRole = customRoles.find(r => r.id === selectedCustomRoleId) || null;

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .insert({ name: newRoleName.trim(), description: newRoleDesc.trim(), color: newRoleColor })
        .select().single();
      if (error) throw error;
      const newRole: CustomRole = { id: data.id, name: data.name, description: data.description || '', color: data.color, memberIds: [], featureKeys: [] };
      setCustomRoles(prev => [...prev, newRole]);
      setSelectedCustomRoleId(data.id);
      setNewRoleName(''); setNewRoleDesc(''); setNewRoleColor(PALETTE_COLORS[0]);
      setShowCreateForm(false);
      await addActivityLog('CUSTOM_ROLE_CREATED', 'SYSTEM' as any, `Custom role "${data.name}" created.`, 'MEDIUM');
      showToast(`Role "${data.name}" created`);
    } catch (e: any) {
      showToast(e.message || 'Failed — ensure custom_roles table exists', false);
    }
    setCreatingRole(false);
  };

  const handleDeleteRole = async (role: CustomRole) => {
    if (!confirm(`Delete role "${role.name}"? This removes all member assignments and feature grants for this role.`)) return;
    try {
      await Promise.all([
        supabase.from('custom_roles').delete().eq('id', role.id),
        supabase.from('custom_role_members').delete().eq('role_id', role.id),
        supabase.from('custom_role_permissions').delete().eq('role_id', role.id),
      ]);
      setCustomRoles(prev => prev.filter(r => r.id !== role.id));
      if (selectedCustomRoleId === role.id) setSelectedCustomRoleId(null);
      await addActivityLog('CUSTOM_ROLE_DELETED', 'SYSTEM' as any, `Custom role "${role.name}" deleted.`, 'HIGH');
      showToast(`Role "${role.name}" deleted`);
    } catch (e: any) { showToast(e.message, false); }
  };

  const handleSaveRoleEdit = async (role: CustomRole) => {
    try {
      await supabase.from('custom_roles').update({ name: editName, description: editDesc, color: editColor }).eq('id', role.id);
      setCustomRoles(prev => prev.map(r => r.id === role.id ? { ...r, name: editName, description: editDesc, color: editColor } : r));
      setEditingRoleId(null);
      showToast('Role updated');
    } catch (e: any) { showToast(e.message, false); }
  };

  const toggleCustomMember = async (roleId: string, userId: string, isMember: boolean) => {
    setMemberLoading(`${roleId}:${userId}`);
    try {
      if (isMember) {
        await supabase.from('custom_role_members').delete().eq('role_id', roleId).eq('user_id', userId);
        setCustomRoles(prev => prev.map(r => r.id === roleId ? { ...r, memberIds: r.memberIds.filter(id => id !== userId) } : r));
        showToast('Member removed');
      } else {
        await supabase.from('custom_role_members').upsert({ role_id: roleId, user_id: userId }, { onConflict: 'role_id,user_id' });
        setCustomRoles(prev => prev.map(r => r.id === roleId ? { ...r, memberIds: [...r.memberIds, userId] } : r));
        showToast('Member added');
      }
    } catch (e: any) { showToast(e.message, false); }
    setMemberLoading(null);
  };

  const toggleCustomFeature = async (roleId: string, featureKey: string, hasIt: boolean) => {
    setCustomPermLoading(`${roleId}:${featureKey}`);
    try {
      if (hasIt) {
        await supabase.from('custom_role_permissions').delete().eq('role_id', roleId).eq('feature_key', featureKey);
        setCustomRoles(prev => prev.map(r => r.id === roleId ? { ...r, featureKeys: r.featureKeys.filter(k => k !== featureKey) } : r));
        showToast(`Feature revoked from role`);
      } else {
        await supabase.from('custom_role_permissions').upsert({ role_id: roleId, feature_key: featureKey }, { onConflict: 'role_id,feature_key' });
        setCustomRoles(prev => prev.map(r => r.id === roleId ? { ...r, featureKeys: [...r.featureKeys, featureKey] } : r));
        showToast(`Feature granted to role`);
      }
    } catch (e: any) { showToast(e.message, false); }
    setCustomPermLoading(null);
  };

  // ── Access guard ───────────────────────────────────────────────────────────
  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
          <Lock size={24} className="text-[#E31E24]" />
        </div>
        <p className="text-slate-400 font-bold">Developer or Admin access only.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-[fadeIn_0.5s_ease-out] pb-20">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[600] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-black animate-[slideDown_0.2s_ease-out] ${toast.ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.ok ? <Check size={16} /> : <X size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
          Access & Permissions
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
          Control who can access what — per employee, per role, or via custom groups.
        </p>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
        <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300 font-bold leading-relaxed">
          <span className="text-blue-900 dark:text-blue-100">By Employee</span> grants extras to one person.&nbsp;
          <span className="text-blue-900 dark:text-blue-100">By Role</span> grants a feature to every user with that built-in role.&nbsp;
          <span className="text-blue-900 dark:text-blue-100">Custom Roles</span> lets you create named groups with their own members and features.&nbsp;
          All three stack — a user receives the union of all grants.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit flex-wrap">
        {([
          { id: 'employee',     label: 'By Employee',   icon: Users },
          { id: 'role',         label: 'By Role',        icon: ShieldCheck },
          { id: 'custom',       label: 'Custom Roles',   icon: Tag },
          { id: 'capabilities', label: 'Capabilities',   icon: Sliders },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase rounded-xl transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─────────────────── TAB: BY EMPLOYEE ─────────────────────────────── */}
      {activeTab === 'employee' && (
        <div className="flex gap-5 flex-col lg:flex-row">

          {/* User list */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text" placeholder="Search name, email, department…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#E31E24] outline-none"
                />
              </div>
              <div className="flex gap-2">
                <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:border-[#E31E24] outline-none">
                  <option value="ALL">All Roles</option>
                  {[UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE].map(r =>
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:border-[#E31E24] outline-none">
                  <option value="ALL">All Depts</option>
                  {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="divide-y divide-slate-50 dark:divide-slate-800 overflow-y-auto custom-scrollbar" style={{ maxHeight: 560 }}>
              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users size={32} className="mx-auto text-slate-200 dark:text-slate-700 mb-2" />
                  <p className="text-sm font-black text-slate-400">No employees found</p>
                </div>
              )}
              {filteredUsers.map(user => {
                const perms = userPermissions[user.id] || [];
                const isSelected = selectedUserId === user.id;
                return (
                  <button key={user.id} onClick={() => setSelectedUserId(isSelected ? null : user.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${isSelected ? 'bg-red-50/60 dark:bg-red-900/10 border-r-4 border-[#E31E24]' : ''}`}>
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {user.avatar
                        ? <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                        : <span className="text-sm font-black text-slate-500 dark:text-slate-300">{user.name[0]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{user.name}</p>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_COLORS[user.role]}`}>
                          {user.role.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-bold truncate">{user.department}</span>
                        {perms.length > 0 && (
                          <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full flex-shrink-0">
                            +{perms.length} extra
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Permission panel */}
          {selectedUser ? (
            <div className="w-full lg:w-96 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {selectedUser.avatar
                      ? <img src={selectedUser.avatar} className="w-full h-full object-cover" alt="" />
                      : <span className="text-base font-black text-slate-500 dark:text-slate-300">{selectedUser.name[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 dark:text-white truncate">{selectedUser.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${ROLE_COLORS[selectedUser.role]}`}>
                        {selectedUser.role.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">{selectedUser.department}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedUserId(null)} className="p-1.5 text-slate-400 hover:text-red-500 flex-shrink-0">
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {FEATURE_GROUPS.map(group => {
                  const groupFeatures = (FEATURES_BY_GROUP[group] || []);
                  if (groupFeatures.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">{group}</p>
                      <div className="space-y-1.5">
                        {groupFeatures.map(feat => {
                          const nativeRoles = NATIVE_ACCESS[feat.key] || [];
                          const roleGranted = (roleGrants[selectedUser.role] || []).includes(feat.key);
                          const hasNative = nativeRoles.includes(selectedUser.role) || roleGranted;
                          const hasExtra  = selectedPerms.includes(feat.key);
                          return (
                            <FeatureToggle
                              key={feat.key}
                              featureKey={feat.key}
                              label={feat.label}
                              desc={feat.desc}
                              icon={feat.icon}
                              granted={hasExtra}
                              native={hasNative}
                              loading={empPermLoading === `${selectedUser.id}:${feat.key}`}
                              onToggle={() => handleEmpToggle(selectedUser.id, feat.key, hasExtra)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedPerms.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    {selectedPerms.length} extra {selectedPerms.length === 1 ? 'permission' : 'permissions'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPerms.map(p => (
                      <span key={p} className="text-[9px] font-black uppercase px-2 py-0.5 bg-[#E31E24]/10 text-[#E31E24] rounded-full">
                        {FEATURES[p]?.label || p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden lg:flex w-96 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 items-center justify-center">
              <div className="text-center p-8">
                <ShieldCheck size={40} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
                <p className="text-sm font-black text-slate-400">Select an employee</p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">to view and manage their permissions</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────── TAB: BY ROLE ─────────────────────────────────── */}
      {activeTab === 'role' && (
        <div className="flex gap-6 flex-col xl:flex-row">

          {/* Role selector */}
          <div className="xl:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Role</p>
              </div>
              <div className="p-2 space-y-1">
                {BUILT_IN_ROLES.map(role => {
                  const grants = roleGrants[role] || [];
                  const isSelected = selectedCustomRoleInByRole === null && selectedBuiltinRole === role;
                  return (
                    <button key={role} onClick={() => { setSelectedBuiltinRole(role); setSelectedCustomRoleInByRole(null); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left ${isSelected ? 'bg-slate-900 dark:bg-[#E31E24] text-white shadow-lg' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                          {role.replace('_', ' ')}
                        </p>
                        <p className={`text-[9px] font-bold mt-0.5 ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                          {grants.length} extra feature{grants.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className={`text-[9px] font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'} px-2 py-0.5 rounded-lg`}>
                        {roleGrants[role]?.length || 0}
                      </span>
                    </button>
                  );
                })}

                {/* Custom roles section */}
                {customRoles.length > 0 && (
                  <>
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Custom Roles</p>
                    </div>
                    {customRoles.map(cr => {
                      const isSelected = selectedCustomRoleInByRole === cr.id;
                      return (
                        <button key={cr.id} onClick={() => setSelectedCustomRoleInByRole(cr.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left ${isSelected ? 'text-white shadow-lg' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                          style={isSelected ? { backgroundColor: cr.color } : {}}>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.6)' : cr.color }} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-black ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                              {cr.name}
                            </p>
                            <p className={`text-[9px] font-bold mt-0.5 ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                              {cr.featureKeys.length} feature{cr.featureKeys.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <span className={`text-[9px] font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'} px-2 py-0.5 rounded-lg`}>
                            {cr.featureKeys.length}
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                  Grants here apply to <strong>every user</strong> with this role, on top of their native access.
                </p>
              </div>
            </div>
          </div>

          {/* Feature toggles for selected role */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedCustomRoleInByRole ? (() => {
                  const cr = customRoles.find(r => r.id === selectedCustomRoleInByRole);
                  return (
                    <>
                      <span className="text-xs font-black uppercase px-3 py-1 rounded-xl text-white" style={{ backgroundColor: cr?.color || '#E31E24' }}>
                        {cr?.name || 'Custom Role'}
                      </span>
                      <p className="text-[10px] text-slate-400 font-bold">Custom role feature access</p>
                    </>
                  );
                })() : (
                  <>
                    <span className={`text-xs font-black uppercase px-3 py-1 rounded-xl ${ROLE_COLORS[selectedBuiltinRole]}`}>
                      {selectedBuiltinRole.replace('_', ' ')}
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold">Role-level feature grants</p>
                  </>
                )}
              </div>
              {(roleGrantsLoading || customRolesLoading) && <Loader2 size={16} className="animate-spin text-slate-400" />}
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
              {FEATURE_GROUPS.map(group => {
                const groupFeatures = (FEATURES_BY_GROUP[group] || []);
                if (groupFeatures.length === 0) return null;
                return (
                  <div key={group}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">{group}</p>
                    <div className="space-y-1.5">
                      {groupFeatures.map(feat => {
                        if (selectedCustomRoleInByRole) {
                          const cr = customRoles.find(r => r.id === selectedCustomRoleInByRole);
                          const hasIt = cr?.featureKeys.includes(feat.key) ?? false;
                          const isLoading = customRolePermSaving === `${selectedCustomRoleInByRole}:${feat.key}`;
                          return (
                            <FeatureToggle
                              key={feat.key}
                              featureKey={feat.key}
                              label={feat.label}
                              desc={feat.desc}
                              icon={feat.icon}
                              granted={hasIt}
                              native={false}
                              loading={isLoading}
                              onToggle={() => toggleCustomRolePerm(selectedCustomRoleInByRole, feat.key)}
                            />
                          );
                        }
                        const nativeRoles = NATIVE_ACCESS[feat.key] || [];
                        const hasNative   = nativeRoles.includes(selectedBuiltinRole);
                        const hasGrant    = (roleGrants[selectedBuiltinRole] || []).includes(feat.key);
                        const isLoading   = roleGrantsSaving === `${selectedBuiltinRole}:${feat.key}`;
                        return (
                          <FeatureToggle
                            key={feat.key}
                            featureKey={feat.key}
                            label={feat.label}
                            desc={feat.desc}
                            icon={feat.icon}
                            granted={hasGrant}
                            native={hasNative}
                            loading={isLoading}
                            onToggle={() => toggleRoleGrant(selectedBuiltinRole, feat.key)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── TAB: CUSTOM ROLES ────────────────────────────── */}
      {activeTab === 'custom' && (
        <div className="flex gap-6 flex-col xl:flex-row">

          {/* Left: Role list + create form */}
          <div className="xl:w-72 flex-shrink-0 space-y-4">

            {/* Create button */}
            <button
              onClick={() => setShowCreateForm(v => !v)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-[#E31E24] hover:text-[#E31E24] transition-all font-black text-xs uppercase tracking-widest"
            >
              <Plus size={14} />
              New Custom Role
            </button>

            {/* Create form */}
            {showCreateForm && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 shadow-sm animate-[slideDown_0.2s_ease-out]">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">New Role</p>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Name *</label>
                  <input
                    type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                    placeholder="e.g. Field Engineer, Intern…"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] outline-none transition-all rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description</label>
                  <input
                    type="text" value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)}
                    placeholder="What is this role for?"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] outline-none transition-all rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Colour</label>
                  <div className="flex flex-wrap gap-2">
                    {PALETTE_COLORS.map(c => (
                      <button
                        key={c} onClick={() => setNewRoleColor(c)}
                        className={`w-7 h-7 rounded-full transition-all ${newRoleColor === c ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowCreateForm(false)}
                    className="flex-1 py-2.5 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateRole}
                    disabled={creatingRole || !newRoleName.trim()}
                    className="flex-[2] py-2.5 text-xs font-black uppercase text-white rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: newRoleColor }}
                  >
                    {creatingRole ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Create
                  </button>
                </div>
              </div>
            )}

            {/* Role list */}
            {customRolesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-slate-300" />
              </div>
            ) : customRoles.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                <Tag size={28} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-sm font-black text-slate-400">No custom roles yet</p>
                <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">Create one above to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customRoles.map(role => {
                  const isSelected = selectedCustomRoleId === role.id;
                  const isEditing  = editingRoleId === role.id;
                  return (
                    <div key={role.id}
                      className={`bg-white dark:bg-slate-900 rounded-2xl border-2 transition-all overflow-hidden ${isSelected ? 'shadow-lg' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
                      style={isSelected ? { borderColor: role.color } : {}}
                    >
                      {isEditing ? (
                        <div className="p-3 space-y-2.5">
                          <input value={editName} onChange={e => setEditName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] outline-none rounded-xl" />
                          <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                            placeholder="Description"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium dark:text-white focus:border-[#E31E24] outline-none rounded-xl" />
                          <div className="flex flex-wrap gap-1.5">
                            {PALETTE_COLORS.map(c => (
                              <button key={c} onClick={() => setEditColor(c)}
                                className={`w-6 h-6 rounded-full ${editColor === c ? 'ring-2 ring-offset-1 ring-slate-700 dark:ring-white scale-110' : 'hover:scale-105'} transition-all`}
                                style={{ backgroundColor: c }} />
                            ))}
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => setEditingRoleId(null)}
                              className="flex-1 py-2 text-[10px] font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl">Cancel</button>
                            <button onClick={() => handleSaveRoleEdit(role)}
                              className="flex-[2] py-2 text-[10px] font-black uppercase text-white rounded-xl flex items-center justify-center gap-1"
                              style={{ backgroundColor: editColor }}>
                              <Check size={11} /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                          onClick={() => setSelectedCustomRoleId(isSelected ? null : role.id)}>
                          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black text-sm"
                            style={{ backgroundColor: role.color }}>
                            {role.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{role.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                              {role.memberIds.length} member{role.memberIds.length !== 1 ? 's' : ''} · {role.featureKeys.length} feature{role.featureKeys.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={e => { e.stopPropagation(); setEditingRoleId(role.id); setEditName(role.name); setEditDesc(role.description); setEditColor(role.color); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all"
                            ><Edit2 size={13} /></button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteRole(role); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                            ><Trash2 size={13} /></button>
                          </div>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Selected role detail */}
          {selectedCustomRole ? (
            <div className="flex-1 space-y-5 min-w-0">

              {/* Role header */}
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 p-5 flex items-center gap-4"
                style={{ borderColor: `${selectedCustomRole.color}40` }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black text-xl shadow-lg"
                  style={{ backgroundColor: selectedCustomRole.color }}>
                  {selectedCustomRole.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{selectedCustomRole.name}</h3>
                  {selectedCustomRole.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">{selectedCustomRole.description}</p>
                  )}
                  <div className="flex gap-3 mt-2">
                    <span className="text-[10px] font-black text-slate-400">
                      <span className="text-slate-700 dark:text-slate-200">{selectedCustomRole.memberIds.length}</span> members
                    </span>
                    <span className="text-[10px] font-black text-slate-400">
                      <span className="text-slate-700 dark:text-slate-200">{selectedCustomRole.featureKeys.length}</span> features
                    </span>
                  </div>
                </div>
              </div>

              {/* Two-column: Members + Features */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Members */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <Users size={15} style={{ color: selectedCustomRole.color }} />
                    <p className="text-sm font-black text-slate-900 dark:text-white">Members</p>
                    <span className="ml-auto text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                      {selectedCustomRole.memberIds.length}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input type="text" placeholder="Search employees…" value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white focus:border-[#E31E24] outline-none" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-50 dark:divide-slate-800" style={{ maxHeight: 320 }}>
                    {users
                      .filter(u => !memberSearch || u.name.toLowerCase().includes(memberSearch.toLowerCase()))
                      .filter(u => u.id !== currentUser?.id)
                      .map(user => {
                        const isMember = selectedCustomRole.memberIds.includes(user.id);
                        const isLoad   = memberLoading === `${selectedCustomRole.id}:${user.id}`;
                        return (
                          <div key={user.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${isMember ? 'bg-emerald-50/50 dark:bg-emerald-900/5' : ''}`}>
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {user.avatar
                                ? <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                                : <span className="text-xs font-black text-slate-500">{user.name[0]}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-slate-900 dark:text-white truncate">{user.name}</p>
                              <p className="text-[9px] text-slate-400 font-medium">{user.role.replace('_', ' ')} · {user.department}</p>
                            </div>
                            <button
                              onClick={() => toggleCustomMember(selectedCustomRole.id, user.id, isMember)}
                              disabled={!!isLoad}
                              className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-all flex-shrink-0 ${isMember ? 'justify-end' : 'justify-start bg-slate-200 dark:bg-slate-700'} ${isLoad ? 'opacity-50' : ''}`}
                              style={isMember ? { backgroundColor: selectedCustomRole.color } : {}}
                            >
                              {isLoad
                                ? <Loader2 size={10} className="animate-spin text-white mx-auto" />
                                : <div className="w-4 h-4 bg-white rounded-full shadow" />}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Features */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <ShieldCheck size={15} style={{ color: selectedCustomRole.color }} />
                    <p className="text-sm font-black text-slate-900 dark:text-white">Feature Access</p>
                    <span className="ml-auto text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                      {selectedCustomRole.featureKeys.length}/{Object.keys(FEATURES).length}
                    </span>
                  </div>
                  <div className="flex-1 p-3 space-y-4 overflow-y-auto custom-scrollbar" style={{ maxHeight: 370 }}>
                    {FEATURE_GROUPS.map(group => {
                      const groupFeatures = (FEATURES_BY_GROUP[group] || []);
                      if (groupFeatures.length === 0) return null;
                      return (
                        <div key={group}>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">{group}</p>
                          <div className="space-y-1.5">
                            {groupFeatures.map(feat => {
                              const hasIt   = selectedCustomRole.featureKeys.includes(feat.key);
                              const isLoad  = customPermLoading === `${selectedCustomRole.id}:${feat.key}`;
                              const IconComp = ICON_MAP[feat.icon] || Package;
                              return (
                                <div key={feat.key} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${hasIt ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}>
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${hasIt ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                    <IconComp size={13} className={hasIt ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-900 dark:text-white">{feat.label}</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">{feat.desc}</p>
                                  </div>
                                  <button
                                    onClick={() => toggleCustomFeature(selectedCustomRole.id, feat.key, hasIt)}
                                    disabled={!!isLoad}
                                    className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-all flex-shrink-0 ${hasIt ? 'justify-end' : 'justify-start bg-slate-200 dark:bg-slate-700'} ${isLoad ? 'opacity-50' : 'hover:opacity-90 active:scale-95'}`}
                                    style={hasIt ? { backgroundColor: selectedCustomRole.color } : {}}
                                  >
                                    {isLoad
                                      ? <Loader2 size={10} className="animate-spin text-white mx-auto" />
                                      : <div className="w-4 h-4 bg-white rounded-full shadow" />}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            customRoles.length > 0 && (
              <div className="flex-1 hidden xl:flex items-center justify-center bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800" style={{ minHeight: 300 }}>
                <div className="text-center p-8">
                  <Tag size={40} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
                  <p className="text-sm font-black text-slate-400">Select a custom role</p>
                  <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">to manage its members and features</p>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* ─────────────────── TAB: CAPABILITIES ──────────────────────────── */}
      {activeTab === 'capabilities' && (
        <div className="space-y-6">
          {/* Info */}
          <div className="p-4 bg-violet-50 dark:bg-violet-900/10 rounded-2xl border border-violet-100 dark:border-violet-900/30 flex items-start gap-3">
            <Info size={15} className="text-violet-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-violet-700 dark:text-violet-400 font-bold leading-relaxed">
              <strong>Role Capabilities</strong> control what each role can <em>do</em> within the app — independent of the feature access above. Changes take effect on next page load for active users. Developer always has full access.
            </p>
          </div>

          <div className="flex flex-col xl:flex-row gap-5">
            {/* Left: Role selector */}
            <div className="xl:w-64 flex-shrink-0">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Role</p>
                </div>
                <div className="p-2 space-y-1">
                  {[
                    { key: UserRole.ADMIN, label: 'Admin' },
                    { key: UserRole.CO_ADMIN, label: 'Co-Admin' },
                    { key: UserRole.HR, label: 'HR' },
                    { key: UserRole.MANAGER, label: 'Manager' },
                    { key: UserRole.EMPLOYEE, label: 'Employee' },
                    ...customRolesForCaps.map(r => ({ key: r.id, label: r.name })),
                  ].map(({ key, label }) => {
                    const caps = roleCaps[key] || [];
                    const totalCount = ALL_CAPS_LIST.length + customCapsData.length;
                    const pct = totalCount > 0 ? Math.round((caps.length / totalCount) * 100) : 0;
                    return (
                      <button key={key} onClick={() => setSelectedCapRole(key)}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left ${
                          selectedCapRole === key ? 'bg-slate-900 dark:bg-[#E31E24] text-white shadow-lg' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-black ${selectedCapRole === key ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{label}</p>
                          <p className={`text-[9px] font-bold mt-0.5 ${selectedCapRole === key ? 'text-white/60' : 'text-slate-400'}`}>{caps.length}/{totalCount} caps</p>
                        </div>
                        <div className="w-10 flex-shrink-0">
                          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${selectedCapRole === key ? 'bg-white' : 'bg-[#E31E24]'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className={`text-[8px] font-black text-center mt-0.5 ${selectedCapRole === key ? 'text-white/60' : 'text-slate-400'}`}>{pct}%</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: capability toggles */}
            <div className="flex-1 space-y-4">
              {/* Bulk actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => setRoleCaps(prev => ({ ...prev, [selectedCapRole]: [...ALL_CAPS_LIST.map(c => c.key), ...customCapsData.map(c => c.key)] }))}
                  className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all active:scale-95">
                  Grant All
                </button>
                <button onClick={() => setRoleCaps(prev => ({ ...prev, [selectedCapRole]: [] }))}
                  className="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95">
                  Revoke All
                </button>
                <button onClick={() => setRoleCaps(prev => ({ ...prev, [selectedCapRole]: [...(({ADMIN:['view_workforce','create_employee','edit_employee','delete_employee','view_sensitive_data','view_payroll','manage_payroll','view_attendance','manage_attendance','view_leaves','approve_leaves','manage_leave_policy','view_security_logs','view_activity_log','clear_activity_log','view_assets','manage_assets','manage_infrastructure','view_tracking','broadcast','manage_approval_flow'],CO_ADMIN:['view_workforce','create_employee','edit_employee','view_sensitive_data','view_payroll','manage_payroll','view_attendance','view_leaves','approve_leaves','view_activity_log','view_assets','manage_assets','view_tracking','broadcast'],HR:['view_workforce','create_employee','edit_employee','view_sensitive_data','view_payroll','view_attendance','view_leaves','approve_leaves','manage_leave_policy','view_security_logs','view_activity_log','broadcast'],MANAGER:['view_workforce','view_attendance','view_leaves','approve_leaves'],EMPLOYEE:['view_workforce']} as any)[selectedCapRole] || [])] }))}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">
                  Reset Default
                </button>
                <div className="ml-auto">
                  {isDev && (
                    <button onClick={handleSaveCaps} disabled={capsSaving || capsLoading}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#E31E24] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 active:scale-95">
                      {capsSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      Save All
                    </button>
                  )}
                </div>
              </div>

              {capsLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#E31E24]" /></div>
              ) : (
                <div className="space-y-4">
                  {/* Group capability toggles by category */}
                  {Object.entries(
                    [...ALL_CAPS_LIST, ...customCapsData].reduce((acc, cap) => {
                      const cat = cap.category || 'Custom';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(cap);
                      return acc;
                    }, {} as Record<string, typeof ALL_CAPS_LIST>)
                  ).map(([category, caps]) => (
                    <div key={category} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
                      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${CAP_CAT_COLORS[category] || 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{category}</span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {caps.filter(c => (roleCaps[selectedCapRole] || []).includes(c.key)).length}/{caps.length}
                        </span>
                      </div>
                      <div className="p-3 space-y-2">
                        {caps.map(cap => {
                          const enabled = (roleCaps[selectedCapRole] || []).includes(cap.key);
                          return (
                            <button key={cap.key} onClick={() => isDev && toggleCap(selectedCapRole, cap.key)} disabled={!isDev}
                              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                                enabled
                                  ? 'border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                              } ${!isDev ? 'cursor-default' : 'active:scale-[0.99]'}`}>
                              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                enabled ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'
                              }`}>
                                {enabled && <Check size={11} className="text-white" strokeWidth={3} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-black ${enabled ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{cap.label}</p>
                                <p className="text-[10px] text-slate-400 font-medium">{cap.desc}</p>
                              </div>
                              <code className="text-[9px] font-mono text-slate-300 dark:text-slate-600 flex-shrink-0 hidden sm:block">{cap.key}</code>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add custom capability — dev only */}
              {isDev && (
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 p-5">
                  <button onClick={() => setShowManageCaps(v => !v)}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all w-full">
                    <Plus size={13} /> {showManageCaps ? 'Hide' : 'Add Custom Capability'}
                  </button>
                  {showManageCaps && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Key <span className="text-red-500">*</span></label>
                        <input value={newCapKey} onChange={e => setNewCapKey(e.target.value.toLowerCase().replace(/\s+/g,'_'))}
                          placeholder="e.g. manage_reports"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] outline-none transition-all rounded-xl font-mono" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Label <span className="text-red-500">*</span></label>
                        <input value={newCapLabel} onChange={e => setNewCapLabel(e.target.value)}
                          placeholder="e.g. Manage Reports"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] outline-none transition-all rounded-xl" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Category</label>
                        <input value={newCapCategory} onChange={e => setNewCapCategory(e.target.value)}
                          list="cap-cat-list" placeholder="Custom"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] outline-none transition-all rounded-xl" />
                        <datalist id="cap-cat-list">
                          {['Workforce','Payroll','Attendance','Leaves','Security','Assets','Infrastructure','Tracking','Communication','Custom'].map(c => <option key={c} value={c} />)}
                        </datalist>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description</label>
                        <input value={newCapDesc} onChange={e => setNewCapDesc(e.target.value)}
                          placeholder="One-line description"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-[#E31E24] outline-none transition-all rounded-xl" />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                        <button
                          disabled={!newCapKey || !newCapLabel || capItemSaving}
                          onClick={async () => {
                            if (!newCapKey || !newCapLabel) return;
                            setCapItemSaving(true);
                            try {
                              await supabase.from('custom_capabilities').insert({ key: newCapKey, label: newCapLabel, description: newCapDesc, category: newCapCategory || 'Custom' });
                              setCustomCapsData(prev => [...prev, { key: newCapKey, label: newCapLabel, desc: newCapDesc, category: newCapCategory || 'Custom' }]);
                              setNewCapKey(''); setNewCapLabel(''); setNewCapDesc(''); setNewCapCategory('Custom');
                              showToast(`Capability "${newCapLabel}" added.`);
                            } catch (e: any) { showToast(e.message, false); }
                            setCapItemSaving(false);
                          }}
                          className="flex items-center gap-2 px-5 py-2.5 bg-[#E31E24] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-40 active:scale-95"
                        >
                          {capItemSaving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List existing custom capabilities */}
                  {customCapsData.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Custom Capabilities ({customCapsData.length})</p>
                      {customCapsData.map(cap => (
                        <div key={cap.key} className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                          <Tag size={13} className="text-violet-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-900 dark:text-white">{cap.label}</p>
                            <p className="text-[9px] font-mono text-slate-400">{cap.key}</p>
                          </div>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${CAP_CAT_COLORS[cap.category] || 'bg-slate-100 text-slate-500'}`}>{cap.category}</span>
                          <button onClick={async () => {
                            if (!confirm(`Delete "${cap.label}"?`)) return;
                            try {
                              await supabase.from('custom_capabilities').delete().eq('key', cap.key);
                              setCustomCapsData(prev => prev.filter(c => c.key !== cap.key));
                              setRoleCaps(prev => { const u = {...prev}; Object.keys(u).forEach(r => { u[r] = (u[r]||[]).filter(k => k !== cap.key); }); return u; });
                              showToast(`Deleted "${cap.label}".`);
                            } catch (e: any) { showToast(e.message, false); }
                          }} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SQL hint */}
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 flex items-start gap-3">
                <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400 font-bold leading-relaxed">
                  Requires <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded font-mono text-[10px]">role_capabilities</code> and <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded font-mono text-[10px]">custom_capabilities</code> tables. Check via <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded font-mono text-[10px]">useRoleCap().can('key')</code> in components.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SQL setup hint for missing tables */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Required Supabase Tables</p>
        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
          The <span className="font-mono bg-white dark:bg-slate-700 px-1 rounded">role_feature_grants</span>,{' '}
          <span className="font-mono bg-white dark:bg-slate-700 px-1 rounded">custom_roles</span>,{' '}
          <span className="font-mono bg-white dark:bg-slate-700 px-1 rounded">custom_role_members</span>, and{' '}
          <span className="font-mono bg-white dark:bg-slate-700 px-1 rounded">custom_role_permissions</span> tables
          must exist. See migration SQL below — run once in Supabase SQL editor.
        </p>
        <details className="mt-3">
          <summary className="text-[10px] font-black uppercase tracking-widest text-[#E31E24] cursor-pointer select-none">
            Show migration SQL ↓
          </summary>
          <pre className="mt-3 p-3 bg-slate-900 text-emerald-400 text-[10px] rounded-xl overflow-x-auto leading-relaxed font-mono whitespace-pre">{`-- Role-level feature grants (built-in roles)
create table if not exists role_feature_grants (
  id          uuid primary key default gen_random_uuid(),
  role        text not null,
  feature_key text not null,
  created_at  timestamptz default now(),
  unique (role, feature_key)
);

-- Custom role definitions
create table if not exists custom_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  color       text default '#E31E24',
  created_at  timestamptz default now()
);

-- Custom role members
create table if not exists custom_role_members (
  id      uuid primary key default gen_random_uuid(),
  role_id uuid references custom_roles(id) on delete cascade,
  user_id text not null,
  unique (role_id, user_id)
);

-- Custom role feature permissions
create table if not exists custom_role_permissions (
  id          uuid primary key default gen_random_uuid(),
  role_id     uuid references custom_roles(id) on delete cascade,
  feature_key text not null,
  unique (role_id, feature_key)
);`}</pre>
        </details>
      </div>
    </div>
  );
};

export default PermissionsView;
