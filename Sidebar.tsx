import { useLanguage } from '../i18n';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import { FEATURE_REGISTRY } from '../featureRegistry';
import { supabase } from '../supabaseClient';
import {
  LayoutDashboard, Users, Clock, Map, DollarSign,
  Calendar, ShieldAlert, LogOut, UserCircle, X,
  ChevronRight, Activity, Network, MessageSquare, Package, ShieldCheck,
  Radio, Settings, GitBranch, Sliders, FileText, Briefcase,
  AlignLeft, AlignCenter, AlignRight, RotateCcw, Save, Loader2, SlidersHorizontal,
  Tag, ClipboardCheck, UserCheck
} from 'lucide-react';

// ── Logo Config ────────────────────────────────────────────────────────────────
export interface LogoConfig {
  height: number;         // logo image height in px (40–160)
  paddingTop: number;     // top padding of logo area in px (8–64)
  paddingBottom: number;  // bottom padding of logo area in px (8–64)
  paddingX: number;       // horizontal padding of logo area in px (8–48)
  alignment: 'left' | 'center' | 'right';
}

export const DEFAULT_LOGO_CONFIG: LogoConfig = {
  height: 64,
  paddingTop: 24,
  paddingBottom: 32,
  paddingX: 16,
  alignment: 'left',
};

const LOGO_CACHE_KEY = 'exord-logo-config';
const LOGO_DB_KEY    = 'sidebar_logo_config';

export const readLogoConfig = (): LogoConfig => {
  try {
    const raw = localStorage.getItem(LOGO_CACHE_KEY);
    if (!raw) return { ...DEFAULT_LOGO_CONFIG };
    return { ...DEFAULT_LOGO_CONFIG, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_LOGO_CONFIG }; }
};

export const writeLogoConfig = (cfg: LogoConfig): void => {
  try { localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(cfg)); } catch {}
};

// ── ExordLogo ──────────────────────────────────────────────────────────────────
const ExordLogo: React.FC<{ config: LogoConfig; className?: string }> = ({ config, className }) => (
  <img
    src="/logo.png"
    alt="Exord Online"
    className={`exord-logo-img block ${className ?? ''}`}
    style={{
      height: config.height,
      width: 'auto',
      maxWidth: '100%',
      objectFit: 'contain',
      marginLeft:  config.alignment === 'center' ? 'auto' : config.alignment === 'right' ? 'auto' : 0,
      marginRight: config.alignment === 'center' ? 'auto' : config.alignment === 'right' ? 0    : 'auto',
    }}
  />
);

// ── Logo Editor (Developer only) ───────────────────────────────────────────────
interface LogoEditorProps {
  config: LogoConfig;
  onPreview: (cfg: LogoConfig) => void;
  onSave: (cfg: LogoConfig) => Promise<void>;
  onClose: () => void;
}

const LogoEditor: React.FC<LogoEditorProps> = ({ config, onPreview, onSave, onClose }) => {
  const [local, setLocal] = useState<LogoConfig>(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = useCallback(<K extends keyof LogoConfig>(key: K, value: LogoConfig[K]) => {
    setLocal(prev => {
      const next = { ...prev, [key]: value };
      onPreview(next);
      return next;
    });
  }, [onPreview]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(local);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setLocal({ ...DEFAULT_LOGO_CONFIG });
    onPreview({ ...DEFAULT_LOGO_CONFIG });
  };

  return (
    <div className="absolute left-[calc(100%+12px)] top-0 z-[200] w-72 animate-[fadeIn_0.2s_ease-out]">
      {/* Connector arrow */}
      <div className="absolute -left-2 top-6 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-white dark:border-r-slate-800" />

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-[#E31E24]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
              Logo Settings
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <X size={13} />
          </button>
        </div>

        <div className="p-4 space-y-5">

          {/* Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Size
              </label>
              <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 tabular-nums">
                {local.height}px
              </span>
            </div>
            <div className="relative">
              <input
                type="range" min={40} max={160} step={4}
                value={local.height}
                onChange={e => update('height', Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#E31E24]"
                style={{ background: `linear-gradient(to right, #E31E24 ${((local.height - 40) / 120) * 100}%, #e2e8f0 ${((local.height - 40) / 120) * 100}%)` }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-slate-400 font-bold">Sm</span>
                <span className="text-[8px] text-slate-400 font-bold">Lg</span>
              </div>
            </div>
          </div>

          {/* Alignment */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Alignment
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['left', 'center', 'right'] as const).map(align => {
                const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
                const isActive = local.alignment === align;
                return (
                  <button
                    key={align}
                    onClick={() => update('alignment', align)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                      isActive
                        ? 'bg-[#E31E24] border-[#E31E24] text-white shadow-md'
                        : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    <Icon size={11} />
                    {align.charAt(0).toUpperCase() + align.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spacing */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Spacing
            </label>

            {/* Top padding */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Top</span>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 tabular-nums">{local.paddingTop}px</span>
              </div>
              <input
                type="range" min={8} max={64} step={4}
                value={local.paddingTop}
                onChange={e => update('paddingTop', Number(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer accent-[#E31E24]"
                style={{ background: `linear-gradient(to right, #E31E24 ${((local.paddingTop - 8) / 56) * 100}%, #e2e8f0 ${((local.paddingTop - 8) / 56) * 100}%)` }}
              />
            </div>

            {/* Bottom padding */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bottom</span>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 tabular-nums">{local.paddingBottom}px</span>
              </div>
              <input
                type="range" min={8} max={64} step={4}
                value={local.paddingBottom}
                onChange={e => update('paddingBottom', Number(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer accent-[#E31E24]"
                style={{ background: `linear-gradient(to right, #E31E24 ${((local.paddingBottom - 8) / 56) * 100}%, #e2e8f0 ${((local.paddingBottom - 8) / 56) * 100}%)` }}
              />
            </div>

            {/* Horizontal padding */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Horizontal</span>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 tabular-nums">{local.paddingX}px</span>
              </div>
              <input
                type="range" min={8} max={48} step={4}
                value={local.paddingX}
                onChange={e => update('paddingX', Number(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer accent-[#E31E24]"
                style={{ background: `linear-gradient(to right, #E31E24 ${((local.paddingX - 8) / 40) * 100}%, #e2e8f0 ${((local.paddingX - 8) / 40) * 100}%)` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl hover:border-slate-300 dark:hover:border-slate-500 transition-all"
              title="Reset to defaults"
            >
              <RotateCcw size={11} /> Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                saved
                  ? 'bg-emerald-500 text-white border-2 border-emerald-500'
                  : 'bg-[#E31E24] hover:bg-[#C41217] text-white border-2 border-[#E31E24] shadow-md active:scale-95'
              } disabled:opacity-60`}
            >
              {saving
                ? <><Loader2 size={11} className="animate-spin" /> Saving…</>
                : saved
                ? <>✓ Saved!</>
                : <><Save size={11} /> Save Globally</>
              }
            </button>
          </div>

          <p className="text-[8px] text-slate-400 text-center font-medium leading-relaxed">
            Saved to database · applies to all users immediately
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Sidebar ────────────────────────────────────────────────────────────────────
interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, isOpen, onClose }) => {
  const { currentUser, logout, hasPermission } = useHRM();
  const { t, lang, toggleLang } = useLanguage();

  // ── Logo config state ──────────────────────────────────────────────────────
  const [logoConfig, setLogoConfig] = useState<LogoConfig>(readLogoConfig);
  const [showLogoEditor, setShowLogoEditor] = useState(false);
  const isDeveloper = currentUser?.role === UserRole.DEVELOPER;
  const logoAreaRef = useRef<HTMLDivElement>(null);

  // Load from Supabase on mount; cache in localStorage for instant paint
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', LOGO_DB_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          try {
            const parsed = JSON.parse(data.value);
            const merged = { ...DEFAULT_LOGO_CONFIG, ...parsed };
            writeLogoConfig(merged);
            setLogoConfig(merged);
          } catch {}
        }
      })
      .catch(() => {/* keep cache */});
  }, []);

  // Close editor when clicking outside
  useEffect(() => {
    if (!showLogoEditor) return;
    const handler = (e: MouseEvent) => {
      if (logoAreaRef.current && !logoAreaRef.current.contains(e.target as Node)) {
        setShowLogoEditor(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLogoEditor]);

  const handlePreview = useCallback((cfg: LogoConfig) => {
    setLogoConfig(cfg);
  }, []);

  const handleSave = useCallback(async (cfg: LogoConfig) => {
    writeLogoConfig(cfg);
    setLogoConfig(cfg);
    await supabase
      .from('system_settings')
      .upsert({ key: LOGO_DB_KEY, value: JSON.stringify(cfg) }, { onConflict: 'key' });
  }, []);

  // ── Nav link definitions ──────────────────────────────────────────────────
  const developerLinks = [
    { id: 'dashboard',        icon: LayoutDashboard, label: t('control_center') },
    { id: 'employees',        icon: Users,           label: t('workforce_hub') },
    { id: 'infrastructure',   icon: Network,         label: t('infrastructure') },
    { id: 'attendance',       icon: Clock,           label: t('shift_logs') },
    { id: 'portal',           icon: UserCircle,      label: t('team_portal') },
    { id: 'chat',             icon: MessageSquare,   label: t('messages') },
    { id: 'tracking',         icon: Map,             label: t('field_mapping') },
    { id: 'payroll',          icon: DollarSign,      label: t('remuneration') },
    { id: 'requests',         icon: FileText,        label: t('requests_hub') },
    { id: 'leave_policy',     icon: Calendar,        label: t('leave_policies') },
    { id: 'security',         icon: ShieldAlert,     label: t('security_protocols') },
    { id: 'activity',         icon: Activity,        label: t('activity_log') },
    { id: 'assets',           icon: Package,         label: t('asset_manager') },
    { id: 'permissions',      icon: ShieldCheck,     label: t('permissions') },
    { id: 'broadcast',        icon: Radio,           label: t('broadcast') },
    { id: 'approval_flow',    icon: GitBranch,       label: t('approval_flow') },
    { id: 'role_caps',        icon: Sliders,         label: t('role_capabilities') },
    { id: 'settings',         icon: Settings,        label: t('system_settings') },
    { id: 'custom_roles',     icon: Briefcase,       label: t('custom_roles') },
  ];

  const adminLinks = [
    { id: 'dashboard',        icon: LayoutDashboard, label: t('control_center') },
    { id: 'employees',        icon: Users,           label: t('workforce_hub') },
    { id: 'infrastructure',   icon: Network,         label: t('infrastructure') },
    { id: 'attendance',       icon: Clock,           label: t('shift_logs') },
    { id: 'portal',           icon: UserCircle,      label: t('team_portal') },
    { id: 'chat',             icon: MessageSquare,   label: t('messages') },
    { id: 'tracking',         icon: Map,             label: t('field_mapping') },
    { id: 'payroll',          icon: DollarSign,      label: t('remuneration') },
    { id: 'requests',         icon: FileText,        label: t('requests_hub') },
    { id: 'leave_policy',     icon: Calendar,        label: t('leave_policies') },
    { id: 'security',         icon: ShieldAlert,     label: t('security_protocols') },
    { id: 'activity',         icon: Activity,        label: t('activity_log') },
    { id: 'assets',           icon: Package,         label: t('asset_manager') },
    { id: 'permissions',      icon: ShieldCheck,     label: t('permissions') },
    { id: 'broadcast',        icon: Radio,           label: t('broadcast') },
    { id: 'approval_flow',    icon: GitBranch,       label: t('approval_flow') },
    { id: 'custom_roles',     icon: Briefcase,       label: t('custom_roles') },
  ];

  const coAdminLinks = [
    { id: 'dashboard',  icon: LayoutDashboard, label: t('control_center') },
    { id: 'employees',  icon: Users,           label: t('workforce_hub') },
    { id: 'attendance', icon: Clock,           label: t('shift_logs') },
    { id: 'portal',     icon: UserCircle,      label: t('team_portal') },
    { id: 'chat',       icon: MessageSquare,   label: t('messages') },
    { id: 'payroll',    icon: DollarSign,      label: t('remuneration') },
    { id: 'requests',   icon: FileText,        label: t('requests_hub') },
    { id: 'activity',   icon: Activity,        label: t('activity_log') },
    { id: 'assets',     icon: Package,         label: t('asset_manager') },
    { id: 'broadcast',  icon: Radio,           label: t('broadcast') },
  ];

  const hrLinks = [
    { id: 'dashboard',        icon: LayoutDashboard, label: t('control_center') },
    { id: 'employees',        icon: Users,           label: t('workforce_hub') },
    { id: 'infrastructure',   icon: Network,         label: t('infrastructure') },
    { id: 'attendance',       icon: Clock,           label: t('shift_logs') },
    { id: 'portal',           icon: UserCircle,      label: t('team_portal') },
    { id: 'chat',             icon: MessageSquare,   label: t('messages') },
    { id: 'payroll',          icon: DollarSign,      label: t('remuneration') },
    { id: 'requests',         icon: FileText,        label: t('requests_hub') },
    { id: 'leave_policy',     icon: Calendar,        label: t('leave_policies') },
    { id: 'broadcast',        icon: Radio,           label: t('broadcast') },
  ];

  const managerLinks = [
    { id: 'dashboard',  icon: LayoutDashboard, label: t('overview') },
    { id: 'employees',  icon: Users,           label: t('personnel_directory') },
    { id: 'attendance', icon: Clock,           label: t('shift_logs') },
    { id: 'portal',     icon: UserCircle,      label: t('team_portal') },
    { id: 'chat',       icon: MessageSquare,   label: t('messages') },
    { id: 'requests',   icon: FileText,        label: t('requests_hub') },
  ];

  const employeeLinks = [
    { id: 'portal',     icon: UserCircle,    label: t('service_portal') },
    { id: 'employees',  icon: Users,         label: t('personnel_directory') },
    { id: 'chat',       icon: MessageSquare, label: t('messages') },
    { id: 'attendance', icon: Clock,         label: t('biometric_clock') },
    { id: 'payroll',    icon: DollarSign,    label: t('pay_stubs') },
    { id: 'requests',   icon: FileText,      label: t('requests_hub') },
  ];

  const baseLinks =
    currentUser?.role === UserRole.DEVELOPER ? developerLinks :
    currentUser?.role === UserRole.ADMIN     ? adminLinks     :
    currentUser?.role === UserRole.CO_ADMIN  ? coAdminLinks   :
    currentUser?.role === UserRole.HR        ? hrLinks        :
    currentUser?.role === UserRole.MANAGER   ? managerLinks   :
    employeeLinks;

  const uid = currentUser?.id || '';

  // ✅ Fixed: inject ALL permission-granted links, not just assets.
  // For each feature in the registry, if the user has been explicitly granted
  // that permission AND it's not already in their base role links, add it.
  const ICON_MAP: Record<string, React.ElementType> = {
    dashboard: LayoutDashboard, employees: Users, attendance: Clock,
    tracking: Map, payroll: DollarSign, leave_policy: Calendar,
    security: ShieldAlert, portal: UserCircle, chat: MessageSquare,
    assets: Package, permissions: ShieldCheck, broadcast: Radio,
    settings: Settings, approval_flow: GitBranch, role_caps: Sliders,
    infrastructure: Network, activity: Activity, requests: FileText,
    duty_replacement: UserCheck, schedule_change: Clock,
    custom_roles: Tag, doc_deadline: ClipboardCheck,
  };

  const LABEL_MAP: Record<string, string> = {
    dashboard: t('control_center'), employees: t('workforce_hub'),
    attendance: t('shift_logs'), tracking: t('field_mapping'),
    payroll: t('remuneration'), leave_policy: t('leave_policies'),
    security: t('security_protocols'), portal: t('team_portal'),
    chat: t('messages'), assets: t('asset_manager'),
    permissions: t('permissions'), broadcast: t('broadcast'),
    settings: t('system_settings'), approval_flow: t('approval_flow'),
    role_caps: t('role_capabilities'), infrastructure: t('infrastructure'),
    activity: t('activity_log'), requests: t('requests_hub'),
    duty_replacement: t('duty_replacement'), schedule_change: t('schedule_change'),
    custom_roles: t('custom_roles'), doc_deadline: 'Doc Deadline',
  };

  const finalLinks = [...baseLinks];

  // Legacy: dept-based asset access
  const deptCanAssets = ['Marketing', 'Inventory'].includes(currentUser?.department || '');
  if (deptCanAssets && !finalLinks.find(l => l.id === 'assets')) {
    finalLinks.push({ id: 'assets', icon: Package, label: t('asset_manager') });
  }

  // Generic: any explicitly granted permission
  if (uid) {
    for (const feature of FEATURE_REGISTRY) {
      if (!finalLinks.find(l => l.id === feature.key) && hasPermission(uid, feature.key)) {
        const icon = ICON_MAP[feature.key];
        const label = LABEL_MAP[feature.key] || feature.label;
        if (icon) finalLinks.push({ id: feature.key, icon, label });
      }
    }
  }

  const roleBadgeColor =
    currentUser?.role === UserRole.DEVELOPER ? 'bg-violet-700 text-white' :
    currentUser?.role === UserRole.ADMIN     ? 'bg-red-600 text-white'    :
    currentUser?.role === UserRole.CO_ADMIN  ? 'bg-orange-500 text-white' :
    currentUser?.role === UserRole.HR        ? 'bg-blue-600 text-white'   :
    currentUser?.role === UserRole.MANAGER   ? 'bg-purple-600 text-white' :
    'bg-slate-600 text-white';

  return (
    <>
      <style>{`
        .exord-logo-img { mix-blend-mode: multiply; }
        .dark .exord-logo-img { mix-blend-mode: multiply; }

        :root:not(.dark) .exord-sidebar { background-color: #f8f9fb; border-right: 1px solid #e2e8f0; }
        :root:not(.dark) .sidebar-nav-label { color: #1e293b; }
        :root:not(.dark) .sidebar-section-label { color: #94a3b8; }
        :root:not(.dark) .sidebar-divider { background: rgba(0,0,0,0.07); }
        :root:not(.dark) .sidebar-link-inactive { color: #475569; }
        :root:not(.dark) .sidebar-link-inactive:hover { background-color: #f1f5f9; color: #1e293b; }
        :root:not(.dark) .sidebar-footer { background-color: #f1f5f9; border-top-color: #e2e8f0; }
        :root:not(.dark) .sidebar-user-name { color: #0f172a; }
        :root:not(.dark) .sidebar-avatar { background: #e2e8f0; color: #475569; }

        .dark .exord-sidebar { background-color: #0f172a; border-right: 1px solid rgba(255,255,255,0.06); }
        .dark .sidebar-nav-label { color: #e2e8f0; }
        .dark .sidebar-section-label { color: #475569; }
        .dark .sidebar-divider { background: rgba(255,255,255,0.07); }
        .dark .sidebar-link-inactive { color: #cbd5e1; }
        .dark .sidebar-link-inactive:hover { background-color: rgba(255,255,255,0.06); color: #f1f5f9; }
        .dark .sidebar-footer { background-color: rgba(255,255,255,0.03); border-top-color: rgba(255,255,255,0.06); }
        .dark .sidebar-user-name { color: #f1f5f9; }
        .dark .sidebar-avatar { background: #1e293b; color: #94a3b8; }

        /* Slider thumb */
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #E31E24;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          cursor: pointer;
        }
        input[type=range]::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #E31E24;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          cursor: pointer;
        }
      `}</style>

      <div className={`
        exord-sidebar fixed inset-y-0 left-0 z-50 w-72 flex flex-col
        transition-all duration-500 ease-in-out
        md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* ── Logo area ── */}
        <div
          ref={logoAreaRef}
          className="relative flex items-center justify-between"
          style={{
            paddingTop:    logoConfig.paddingTop,
            paddingBottom: logoConfig.paddingBottom,
            paddingLeft:   logoConfig.paddingX,
            paddingRight:  logoConfig.paddingX,
          }}
        >
          {/* Logo + developer edit overlay */}
          <div className={`relative flex-1 min-w-0 group ${isDeveloper ? 'cursor-pointer' : ''}`}>
            <ExordLogo config={logoConfig} />

            {/* Developer-only edit button — appears on hover */}
            {isDeveloper && (
              <button
                onClick={() => setShowLogoEditor(v => !v)}
                className={`absolute bottom-0 right-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all duration-200 ${
                  showLogoEditor
                    ? 'opacity-100 bg-[#E31E24] text-white shadow-lg'
                    : 'opacity-0 group-hover:opacity-100 bg-slate-900/80 dark:bg-white/10 text-white backdrop-blur-sm'
                }`}
                title="Adjust logo size & position"
              >
                <SlidersHorizontal size={9} />
                Edit
              </button>
            )}
          </div>

          {/* Mobile close */}
          <button onClick={onClose} className="p-2 sidebar-link-inactive md:hidden transition-colors flex-shrink-0 ml-2">
            <X size={22} />
          </button>

          {/* Editor popover — floats to the right of the sidebar */}
          {isDeveloper && showLogoEditor && (
            <LogoEditor
              config={logoConfig}
              onPreview={handlePreview}
              onSave={handleSave}
              onClose={() => setShowLogoEditor(false)}
            />
          )}
        </div>

        {/* Divider + section label */}
        <div className="px-8 mb-5">
          <div className="h-px w-full sidebar-divider" />
          <p className="sidebar-section-label text-[9px] uppercase font-black tracking-[0.3em] mt-5 px-1">
            Secure Core
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          {finalLinks.map((link) => {
            const isActive = activeView === link.id;
            return (
              <button
                key={link.id}
                onClick={() => { setActiveView(link.id); if (window.innerWidth < 768) onClose(); }}
                className={`w-full flex items-center gap-4 px-5 py-3.5 transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-[#E31E24] to-[#C41217] text-white shadow-lg shadow-red-900/20 translate-x-1'
                    : 'sidebar-link-inactive translate-x-0 hover:translate-x-1'
                }`}
              >
                <link.icon className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${isActive ? '' : 'group-hover:scale-110'}`} />
                <span className={`font-bold text-[13px] tracking-tight ${isActive ? 'text-white' : 'sidebar-nav-label'}`}>
                  {link.label}
                </span>
                {isActive && <ChevronRight size={13} className="ml-auto text-white/60" />}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="mt-auto p-4 sidebar-footer border-t m-4">
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center font-black text-base sidebar-avatar overflow-hidden">
              {currentUser?.avatar
                ? <img src={currentUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                : currentUser?.name.charAt(0)
              }
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-black truncate sidebar-user-name tracking-tight">{currentUser?.name}</p>
              <span className={`inline-block mt-0.5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${roleBadgeColor}`}>
                {currentUser?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 py-3 text-slate-400 dark:text-slate-500 hover:text-white hover:bg-red-600 transition-all duration-300 text-[10px] font-black uppercase tracking-[0.2em]"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('exit_session')}</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
