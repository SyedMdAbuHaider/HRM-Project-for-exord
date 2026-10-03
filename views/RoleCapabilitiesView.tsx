/**
 * RoleCapabilitiesView.tsx
 * Developer-only tool to expand or restrict what each role can do.
 * Changes are stored in Supabase `role_capabilities` table and
 * take effect immediately via the useRoleCapabilities hook.
 *
 * Accessible by: DEVELOPER only
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { UserRole } from '../types';
import { supabase } from '../serverOwnedClient';
import { useHRM } from '../store';
import {
  ShieldCheck, Save, RefreshCw, CheckCircle,
  AlertCircle, X, Info, Loader2, Lock,
  Users, DollarSign, Clock, Calendar, Map,
  ShieldAlert, Package, BarChart2, Trash2,
  Edit2, UserPlus, Eye, Settings, GitBranch, Radio,
  Plus, Sliders, Tag, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Capability definitions ────────────────────────────────────────────────────
export interface Capability {
  key: string;
  label: string;
  desc: string;
  icon: any;
  category: string;
}

export const ALL_CAPABILITIES: Capability[] = [
  // Workforce
  { key: 'view_workforce',      label: 'View Workforce',       desc: 'See employee list and profiles',                icon: Users,      category: 'Workforce' },
  { key: 'create_employee',     label: 'Create Employee',       desc: 'Add new employees to the system',               icon: UserPlus,   category: 'Workforce' },
  { key: 'edit_employee',       label: 'Edit Employee',         desc: 'Edit employee profile and details',             icon: Edit2,      category: 'Workforce' },
  { key: 'delete_employee',     label: 'Delete Employee',       desc: 'Permanently remove an employee',                icon: Trash2,     category: 'Workforce' },
  { key: 'view_sensitive_data', label: 'View Sensitive Data',   desc: 'See salary, NID, personal details',             icon: Eye,        category: 'Workforce' },
  // Payroll
  { key: 'view_payroll',        label: 'View Payroll',          desc: 'See payroll records (all employees)',           icon: DollarSign, category: 'Payroll' },
  { key: 'manage_payroll',      label: 'Manage Payroll',        desc: 'Add, edit and delete salary records',           icon: DollarSign, category: 'Payroll' },
  // Attendance
  { key: 'view_attendance',     label: 'View Attendance',       desc: 'See attendance logs for all employees',         icon: Clock,      category: 'Attendance' },
  { key: 'manage_attendance',   label: 'Manage Attendance',     desc: 'Edit attendance records',                       icon: Clock,      category: 'Attendance' },
  // Leaves
  { key: 'view_leaves',         label: 'View All Leaves',       desc: 'See leave requests from all employees',         icon: Calendar,   category: 'Leaves' },
  { key: 'approve_leaves',      label: 'Approve Leaves',        desc: 'Approve / reject leave requests',              icon: Calendar,   category: 'Leaves' },
  { key: 'manage_leave_policy', label: 'Manage Leave Policies', desc: 'Create and edit leave policies',               icon: Calendar,   category: 'Leaves' },
  // Security & Logs
  { key: 'view_security_logs',  label: 'View Security Logs',    desc: 'See login and security event logs',            icon: ShieldAlert,category: 'Security' },
  { key: 'view_activity_log',   label: 'View Activity Log',     desc: 'See the full system audit trail',               icon: BarChart2,  category: 'Security' },
  { key: 'clear_activity_log',  label: 'Clear Activity Log',    desc: 'Delete activity log entries',                  icon: Trash2,     category: 'Security' },
  // Assets
  { key: 'view_assets',         label: 'View Assets',           desc: 'See company asset inventory',                  icon: Package,    category: 'Assets' },
  { key: 'manage_assets',       label: 'Manage Assets',         desc: 'Add, edit, transfer and delete assets',        icon: Package,    category: 'Assets' },
  // Infrastructure
  { key: 'manage_infrastructure',label:'Manage Infrastructure', desc: 'Add/edit units and departments',               icon: Settings,   category: 'Infrastructure' },
  // Tracking
  { key: 'view_tracking',       label: 'Live Tracking',         desc: 'View GPS live tracking map',                   icon: Map,        category: 'Tracking' },
  // Broadcast
  { key: 'broadcast',           label: 'Broadcast',             desc: 'Send notifications to employees',              icon: Radio,      category: 'Communication' },
  // Approval Flow
  { key: 'manage_approval_flow',label: 'Manage Approval Flow',  desc: 'Configure leave approval chains',              icon: GitBranch,  category: 'Leaves' },
];

// ── Default capabilities per role ─────────────────────────────────────────────
export const DEFAULT_ROLE_CAPABILITIES: Record<UserRole, string[]> = {
  [UserRole.DEVELOPER]: ALL_CAPABILITIES.map(c => c.key), // all
  [UserRole.ADMIN]: [
    'view_workforce','create_employee','edit_employee','delete_employee','view_sensitive_data',
    'view_payroll','manage_payroll',
    'view_attendance','manage_attendance',
    'view_leaves','approve_leaves','manage_leave_policy',
    'view_security_logs','view_activity_log','clear_activity_log',
    'view_assets','manage_assets',
    'manage_infrastructure',
    'view_tracking',
    'broadcast',
    'manage_approval_flow',
  ],
  [UserRole.CO_ADMIN]: [
    'view_workforce','create_employee','edit_employee','view_sensitive_data',
    'view_payroll','manage_payroll',
    'view_attendance',
    'view_leaves','approve_leaves',
    'view_activity_log',
    'view_assets','manage_assets',
    'view_tracking',
    'broadcast',
  ],
  [UserRole.HR]: [
    'view_workforce','create_employee','edit_employee','view_sensitive_data',
    'view_payroll',
    'view_attendance',
    'view_leaves','approve_leaves','manage_leave_policy',
    'view_security_logs','view_activity_log',
    'broadcast',
  ],
  [UserRole.MANAGER]: [
    'view_workforce',
    'view_attendance',
    'view_leaves','approve_leaves',
  ],
  [UserRole.EMPLOYEE]: [
    'view_workforce',
  ],
};

// ── Context + Hook ─────────────────────────────────────────────────────────────
interface RoleCapCtx {
  capabilities: Record<string, string[]>; // role -> capability keys
  can: (capability: string) => boolean;
  canRole: (role: UserRole, capability: string) => boolean;
  loaded: boolean;
}

const RoleCapContext = createContext<RoleCapCtx>({
  capabilities: DEFAULT_ROLE_CAPABILITIES as any,
  can: () => true,
  canRole: () => true,
  loaded: false,
});

export const RoleCapabilitiesProvider: React.FC<{ children: React.ReactNode; currentRole?: UserRole }> = ({ children, currentRole }) => {
  const [capabilities, setCapabilities] = useState<Record<string, string[]>>(DEFAULT_ROLE_CAPABILITIES as any);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('role_capabilities').select('role,capabilities')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map: Record<string, string[]> = { ...(DEFAULT_ROLE_CAPABILITIES as any) };
          data.forEach((r: any) => {
            try { map[r.role] = typeof r.capabilities === 'string' ? JSON.parse(r.capabilities) : r.capabilities; }
            catch {}
          });
          setCapabilities(map);
        }
        setLoaded(true);
      });
  }, []);

  const can = useCallback((capability: string): boolean => {
    if (!currentRole) return false;
    if (currentRole === UserRole.DEVELOPER) return true;
    const roleCaps = capabilities[currentRole] || (DEFAULT_ROLE_CAPABILITIES as any)[currentRole] || [];
    return roleCaps.includes(capability);
  }, [capabilities, currentRole]);

  const canRole = useCallback((role: UserRole, capability: string): boolean => {
    if (role === UserRole.DEVELOPER) return true;
    const roleCaps = capabilities[role] || (DEFAULT_ROLE_CAPABILITIES as any)[role] || [];
    return roleCaps.includes(capability);
  }, [capabilities]);

  return (
    <RoleCapContext.Provider value={{ capabilities, can, canRole, loaded }}>
      {children}
    </RoleCapContext.Provider>
  );
};

export const useRoleCap = () => useContext(RoleCapContext);

// ── Category colour map ────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  Workforce:      'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  Payroll:        'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  Attendance:     'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
  Leaves:         'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  Security:       'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400',
  Assets:         'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  Infrastructure: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  Tracking:       'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400',
  Communication:  'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
};

const ROLE_COLORS: Record<string, { badge: string; header: string }> = {
  ADMIN:    { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',       header: 'border-red-200 dark:border-red-900/30' },
  CO_ADMIN: { badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', header: 'border-orange-200 dark:border-orange-900/30' },
  HR:       { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',   header: 'border-blue-200 dark:border-blue-900/30' },
  MANAGER:  { badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', header: 'border-purple-200 dark:border-purple-900/30' },
  EMPLOYEE: { badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',  header: 'border-slate-200 dark:border-slate-700' },
};

const roleLabel = (r: UserRole) => r === UserRole.CO_ADMIN ? 'Co-Admin' : r.charAt(0) + r.slice(1).toLowerCase();

// Roles the Developer can configure (not DEVELOPER itself)
const CONFIGURABLE_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE];

// ── Main view ─────────────────────────────────────────────────────────────────
const RoleCapabilitiesView: React.FC = () => {
  const { currentUser, addActivityLog } = useHRM();
  const isDev = currentUser?.role === UserRole.DEVELOPER;

  const [roleCaps, setRoleCaps]       = useState<Record<string, string[]>>({ ...(DEFAULT_ROLE_CAPABILITIES as any) });
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<{ ok: boolean; msg: string } | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>(UserRole.ADMIN);

  // ── Custom roles from custom_roles table ─────────────────────────────────
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string; key: string }[]>([]);

  // ── Custom capabilities state ────────────────────────────────────────────────
  const [customCaps, setCustomCaps]       = useState<Capability[]>([]);
  const [showManageCaps, setShowManageCaps] = useState(false);
  const [newCapKey, setNewCapKey]         = useState('');
  const [newCapLabel, setNewCapLabel]     = useState('');
  const [newCapDesc, setNewCapDesc]       = useState('');
  const [newCapCategory, setNewCapCategory] = useState('Custom');
  const [capSaving, setCapSaving]         = useState(false);
  const [editingCap, setEditingCap]       = useState<string | null>(null); // key being edited
  const [editLabel, setEditLabel]         = useState('');
  const [editDesc, setEditDesc]           = useState('');
  const [editCategory, setEditCategory]   = useState('');

  const showToast = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 4000); };

  const loadCaps = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('role_capabilities').select('role,capabilities');
    const map: Record<string, string[]> = { ...(DEFAULT_ROLE_CAPABILITIES as any) };
    if (data && data.length > 0) {
      data.forEach((r: any) => {
        try { map[r.role] = typeof r.capabilities === 'string' ? JSON.parse(r.capabilities) : r.capabilities; }
        catch {}
      });
    }
    setRoleCaps(map);

    // Load custom capabilities
    try {
      const { data: ccData } = await supabase
        .from('custom_capabilities')
        .select('*')
        .order('created_at', { ascending: true });
      if (ccData) {
        setCustomCaps(ccData.map((r: any) => ({
          key: r.key, label: r.label, desc: r.description || '',
          icon: Tag, category: r.category || 'Custom',
        })));
      }
    } catch { /* table not yet created — silent */ }

    // Load custom roles
    try {
      const { data: crData } = await supabase
        .from('custom_roles')
        .select('id,name,key')
        .order('created_at', { ascending: true });
      if (crData) {
        setCustomRoles(crData.map((r: any) => ({ id: r.id, name: r.name, key: r.id })));
        // Ensure roleCaps has an entry for each custom role
        setRoleCaps(prev => {
          const updated = { ...prev };
          crData.forEach((r: any) => {
            if (!updated[r.id]) updated[r.id] = [];
          });
          return updated;
        });
      }
    } catch { /* custom_roles table not available — silent */ }

    setLoading(false);
  }, []);

  useEffect(() => { loadCaps(); }, [loadCaps]);

  const toggle = (role: string, capKey: string) => {
    setRoleCaps(prev => {
      const current = prev[role] || [];
      const updated = current.includes(capKey) ? current.filter(k => k !== capKey) : [...current, capKey];
      return { ...prev, [role]: updated };
    });
  };

  const grantAll = (role: string) => {
    setRoleCaps(prev => ({ ...prev, [role]: [...ALL_CAPABILITIES.map(c => c.key), ...customCaps.map(c => c.key)] }));
  };

  const revokeAll = (role: string) => {
    setRoleCaps(prev => ({ ...prev, [role]: [] }));
  };

  const resetRole = (role: string) => {
    setRoleCaps(prev => ({ ...prev, [role]: [...((DEFAULT_ROLE_CAPABILITIES as any)[role] || [])] }));
  };

  const handleSave = async () => {
    if (!isDev) return;
    setSaving(true);
    try {
      // Save built-in roles
      for (const role of CONFIGURABLE_ROLES) {
        const caps = roleCaps[role] || [];
        await supabase.from('role_capabilities').upsert(
          { role, capabilities: JSON.stringify(caps) },
          { onConflict: 'role' }
        );
      }
      // Save custom roles
      for (const cr of customRoles) {
        const caps = roleCaps[cr.key] || [];
        await supabase.from('role_capabilities').upsert(
          { role: cr.key, capabilities: JSON.stringify(caps) },
          { onConflict: 'role' }
        );
      }
      await addActivityLog('ROLE_CAPS_UPDATE', 'SYSTEM' as any, `Role capabilities updated by ${currentUser?.name}.`, 'HIGH');
      showToast(true, 'Role capabilities saved. Takes effect on next page load for active users.');
    } catch (e: any) {
      showToast(false, e.message || 'Failed to save. Check role_capabilities table exists.');
    }
    setSaving(false);
  };

  if (!isDev) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
          <Lock size={24} className="text-[#E31E24]" />
        </div>
        <p className="text-slate-400 font-bold">Developer access only.</p>
      </div>
    );
  }

  // Merge built-in + custom capabilities
  const allCaps = [...ALL_CAPABILITIES, ...customCaps];

  // Group capabilities by category
  const byCategory = allCaps.reduce((acc, cap) => {
    if (!acc[cap.category]) acc[cap.category] = [];
    acc[cap.category].push(cap);
    return acc;
  }, {} as Record<string, Capability[]>);

  // All roles to display in the selector (built-in + custom)
  const allSelectableRoles: { key: string; label: string; isCustom: boolean }[] = [
    ...CONFIGURABLE_ROLES.map(r => ({ key: r as string, label: roleLabel(r), isCustom: false })),
    ...customRoles.map(r => ({ key: r.key, label: r.name, isCustom: true })),
  ];

  const selectedCaps = roleCaps[selectedRole] || [];
  const totalCaps = allCaps.length;
  const grantedCount = selectedCaps.length;

  return (
    <div className="space-y-8 animate-[fadeIn_0.5s_ease-out] pb-20">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">
            Role Capabilities
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Expand or restrict what each role can do system-wide.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadCaps} disabled={loading || saving}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-[#E31E24] transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save All Roles
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
      <div className="p-5 bg-violet-50 dark:bg-violet-900/10 rounded-2xl border border-violet-100 dark:border-violet-900/30 flex items-start gap-3">
        <Info size={16} className="text-violet-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-violet-700 dark:text-violet-400 font-bold leading-relaxed">
          These are <strong>native role capabilities</strong> — what each role can do by default. Changes apply to everyone with that role. The individual permissions panel (in Permissions view) can still grant extra access on top of this. Developer always has full access and cannot be restricted.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-[#E31E24]" /></div>
      ) : (
        <div className="flex gap-6 flex-col xl:flex-row">

          {/* Left: Role selector */}
          <div className="xl:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Role</p>
              </div>
              <div className="p-2 space-y-1">
                {allSelectableRoles.map(({ key, label, isCustom }) => {
                  const caps = roleCaps[key] || [];
                  const pct = Math.round((caps.length / totalCaps) * 100);
                  const colors = ROLE_COLORS[key];
                  const isSelected = selectedRole === key;
                  return (
                    <button key={key} onClick={() => setSelectedRole(key)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left ${
                        isSelected ? 'bg-slate-900 dark:bg-[#E31E24] text-white shadow-lg' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-black ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                            {label}
                          </p>
                          {isCustom && (
                            <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'}`}>
                              Custom
                            </span>
                          )}
                        </div>
                        <p className={`text-[9px] font-bold mt-0.5 ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                          {caps.length}/{totalCaps} capabilities
                        </p>
                      </div>
                      {/* Mini progress bar */}
                      <div className="w-10 flex-shrink-0">
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isSelected ? 'bg-white' : 'bg-[#E31E24]'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <p className={`text-[8px] font-black text-center mt-0.5 ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>{pct}%</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Capabilities for selected role */}
          <div className="flex-1 space-y-5">
            {/* Role header + quick actions */}
            <div className={`bg-white dark:bg-slate-900 rounded-[2rem] border-2 ${ROLE_COLORS[selectedRole]?.header || 'border-violet-200 dark:border-violet-900/30'} p-5 flex items-center justify-between gap-4 flex-wrap`}>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1.5 rounded-xl border text-sm font-black uppercase tracking-widest ${ROLE_COLORS[selectedRole]?.badge || 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-900/30'}`}>
                  {allSelectableRoles.find(r => r.key === selectedRole)?.label || selectedRole}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400 font-bold">
                  {grantedCount} of {totalCaps} capabilities enabled
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => grantAll(selectedRole)}
                  className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all active:scale-95">
                  Grant All
                </button>
                <button onClick={() => revokeAll(selectedRole)}
                  className="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95">
                  Revoke All
                </button>
                <button onClick={() => resetRole(selectedRole)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">
                  Reset Default
                </button>
              </div>
            </div>

            {/* Capabilities grouped by category */}
            {Object.entries(byCategory).map(([category, caps]) => (
              <div key={category} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50">
                  <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${CAT_COLORS[category] || 'bg-slate-100 text-slate-600'}`}>
                    {category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold ml-auto">
                    {caps.filter(c => selectedCaps.includes(c.key)).length}/{caps.length}
                  </span>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {caps.map(cap => {
                    const enabled = selectedCaps.includes(cap.key);
                    const Icon = cap.icon;
                    const isCustom = customCaps.some(c => c.key === cap.key);
                    return (
                      <div key={cap.key} className={`flex items-center gap-4 px-5 py-4 transition-colors ${enabled ? '' : 'opacity-60'}`}>
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                          enabled ? (CAT_COLORS[category] || 'bg-slate-100 text-slate-600') : 'bg-slate-100 dark:bg-slate-800'
                        }`}>
                          <Icon size={15} className={enabled ? '' : 'text-slate-400'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-slate-900 dark:text-white">{cap.label}</p>
                            {isCustom && <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[8px] font-black uppercase tracking-widest rounded-lg">Custom</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{cap.desc}</p>
                        </div>
                        <button onClick={() => toggle(selectedRole, cap.key)}
                          className={`w-12 h-6 rounded-full flex items-center transition-all flex-shrink-0 px-0.5 ${
                            enabled ? 'bg-[#E31E24] justify-end' : 'bg-slate-200 dark:bg-slate-700 justify-start'
                          }`}>
                          <div className="w-5 h-5 bg-white rounded-full shadow-sm" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Manage Capabilities Panel ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-violet-200 dark:border-violet-900/40 overflow-hidden shadow-sm">
        <button
          onClick={() => setShowManageCaps(p => !p)}
          className="w-full flex items-center justify-between px-6 py-5 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-100 dark:bg-violet-900/30 rounded-2xl">
              <Sliders size={18} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-slate-900 dark:text-white">Manage Capabilities</p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">Add, edit or delete custom capability definitions — Developer only</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[9px] font-black uppercase tracking-widest rounded-xl">
              {customCaps.length} custom
            </span>
            {showManageCaps ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </div>
        </button>

        {showManageCaps && (
          <div className="border-t border-violet-100 dark:border-violet-900/30 p-6 space-y-6">

            {/* Add new */}
            <div className="p-5 bg-violet-50 dark:bg-violet-900/10 rounded-2xl border border-violet-100 dark:border-violet-900/20 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400 flex items-center gap-2">
                <Plus size={12} /> Add New Capability
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Key (snake_case, unique) *</label>
                  <input type="text" value={newCapKey}
                    onChange={e => setNewCapKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    placeholder="e.g. manage_duty_swap"
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-mono font-bold dark:text-white focus:border-violet-500 outline-none transition-all rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Label (display name) *</label>
                  <input type="text" value={newCapLabel} onChange={e => setNewCapLabel(e.target.value)}
                    placeholder="e.g. Manage Duty Swap"
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-violet-500 outline-none transition-all rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Category</label>
                  <input type="text" value={newCapCategory} onChange={e => setNewCapCategory(e.target.value)}
                    placeholder="e.g. Attendance, Leaves, Custom…" list="cap-categories-list"
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-violet-500 outline-none transition-all rounded-xl" />
                  <datalist id="cap-categories-list">
                    {[...new Set([...Object.keys(CAT_COLORS), ...customCaps.map(c => c.category)])].map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description</label>
                  <input type="text" value={newCapDesc} onChange={e => setNewCapDesc(e.target.value)}
                    placeholder="Brief description of what this controls"
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-violet-500 outline-none transition-all rounded-xl" />
                </div>
              </div>
              <button
                disabled={capSaving || !newCapKey.trim() || !newCapLabel.trim()}
                onClick={async () => {
                  const key   = newCapKey.trim();
                  const label = newCapLabel.trim();
                  if (!key || !label) return;
                  const allKeys = [...ALL_CAPABILITIES.map(c => c.key), ...customCaps.map(c => c.key)];
                  if (allKeys.includes(key)) { showToast(false, `Key "${key}" already exists.`); return; }
                  setCapSaving(true);
                  try {
                    const { error } = await supabase.from('custom_capabilities').insert({
                      key, label, description: newCapDesc.trim(), category: newCapCategory.trim() || 'Custom',
                      created_at: new Date().toISOString(),
                    });
                    if (error) throw error;
                    setCustomCaps(prev => [...prev, { key, label, desc: newCapDesc.trim(), icon: Tag, category: newCapCategory.trim() || 'Custom' }]);
                    setNewCapKey(''); setNewCapLabel(''); setNewCapDesc(''); setNewCapCategory('Custom');
                    await addActivityLog('CAPABILITY_CREATED', 'SYSTEM' as any, `Developer added capability "${key}" (${label}).`, 'HIGH');
                    showToast(true, `Capability "${label}" added. Toggle it on for roles and save.`);
                  } catch (e: any) {
                    showToast(false, e.message || 'Failed to add capability. Check custom_capabilities table exists.');
                  }
                  setCapSaving(false);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-violet-700 disabled:opacity-50 transition-all active:scale-95"
              >
                {capSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Add Capability
              </button>
            </div>

            {/* Existing custom caps */}
            {customCaps.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                <Tag size={24} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm text-slate-400 font-medium">No custom capabilities yet.</p>
                <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">Add one above to extend the capability system.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Custom Capabilities ({customCaps.length})</p>
                {customCaps.map(cap => (
                  <div key={cap.key} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {editingCap === cap.key ? (
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Label</label>
                            <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-violet-500 outline-none transition-all rounded-xl" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Category</label>
                            <input type="text" value={editCategory} onChange={e => setEditCategory(e.target.value)} list="cap-categories-list"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-violet-500 outline-none transition-all rounded-xl" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description</label>
                            <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold dark:text-white focus:border-violet-500 outline-none transition-all rounded-xl" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              setCapSaving(true);
                              try {
                                await supabase.from('custom_capabilities').update({ label: editLabel, description: editDesc, category: editCategory }).eq('key', cap.key);
                                setCustomCaps(prev => prev.map(c => c.key === cap.key ? { ...c, label: editLabel, desc: editDesc, category: editCategory } : c));
                                setEditingCap(null);
                                showToast(true, `Capability "${editLabel}" updated.`);
                              } catch (e: any) { showToast(false, e.message); }
                              setCapSaving(false);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95"
                          >
                            <CheckCircle size={12} /> Save
                          </button>
                          <button onClick={() => setEditingCap(null)}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 px-4 py-3">
                        <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Tag size={13} className="text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-black text-slate-900 dark:text-white">{cap.label}</p>
                            <span className="text-[9px] font-mono text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-lg">{cap.key}</span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${CAT_COLORS[cap.category] || 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{cap.category}</span>
                          </div>
                          {cap.desc && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{cap.desc}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => { setEditingCap(cap.key); setEditLabel(cap.label); setEditDesc(cap.desc); setEditCategory(cap.category); }}
                            className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-all"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete capability "${cap.label}"? This removes it from all role configs.`)) return;
                              try {
                                await supabase.from('custom_capabilities').delete().eq('key', cap.key);
                                setRoleCaps(prev => {
                                  const updated = { ...prev };
                                  Object.keys(updated).forEach(role => { updated[role] = (updated[role] || []).filter(k => k !== cap.key); });
                                  return updated;
                                });
                                setCustomCaps(prev => prev.filter(c => c.key !== cap.key));
                                await addActivityLog('CAPABILITY_DELETED', 'SYSTEM' as any, `Developer deleted capability "${cap.key}".`, 'HIGH');
                                showToast(true, `Capability "${cap.label}" deleted.`);
                              } catch (e: any) { showToast(false, e.message); }
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Usage note */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 flex items-start gap-3">
              <Info size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 font-bold leading-relaxed">
                Custom capabilities appear in the role toggles above automatically. After adding, toggle them on for the desired roles and click <strong>Save All Roles</strong>. In your code, check them with{' '}
                <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded font-mono text-[10px]">useRoleCap().can('your_key')</code> or{' '}
                <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded font-mono text-[10px]">canRole(role, 'your_key')</code>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleCapabilitiesView;
