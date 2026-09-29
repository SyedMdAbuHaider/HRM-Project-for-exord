import ErrorBoundary from './components/ErrorBoundary';
import { DesignationTrackModal } from './components/DesignationTrackModal';
import { PromotionCertModal } from './components/PromotionCertModal';
const AdminDashboard      = React.lazy(() => import('./views/AdminDashboard'));
const EmployeePortal      = React.lazy(() => import('./views/EmployeePortal'));
const LiveTracking        = React.lazy(() => import('./views/LiveTracking'));
const SecurityLogs        = React.lazy(() => import('./views/SecurityLogs'));
const WorkforceView       = React.lazy(() => import('./views/WorkforceView'));
const PayrollView         = React.lazy(() => import('./views/PayrollView'));
const LeavesView          = React.lazy(() => import('./views/LeavesView'));
const RequestsHub         = React.lazy(() => import('./views/RequestsHub'));
const InfrastructureView  = React.lazy(() => import('./views/InfrastructureView'));
const ActivityLogView     = React.lazy(() => import('./views/ActivityLog'));
const AttendanceView      = React.lazy(() => import('./views/AttendanceView'));
const ChatView            = React.lazy(() => import('./components/ChatView'));
const AssetView           = React.lazy(() => import('./views/AssetView'));
const PermissionsView     = React.lazy(() => import('./views/PermissionsView'));
const LeavePolicyView     = React.lazy(() => import('./views/LeavePolicyView'));
const BroadcastView       = React.lazy(() => import('./views/BroadcastView'));
const ApprovalFlowView    = React.lazy(() => import('./views/ApprovalFlowView'));
const UnitApprovalConfigView = React.lazy(() => import('./views/UnitApprovalConfigView'));
const RoleCapabilitiesView = React.lazy(() => import('./views/RoleCapabilitiesView'));
import { RoleCapabilitiesProvider } from './views/RoleCapabilitiesView';
const SystemSettingsView  = React.lazy(() => import('./views/SystemSettingsView'));
const DutyReplacementView = React.lazy(() => import('./views/DutyReplacementView'));
const CustomRolesView     = React.lazy(() => import('./views/CustomRolesView'));
const ScheduleChangeView  = React.lazy(() => import('./views/ScheduleChangeView'));
const RosterView          = React.lazy(() => import('./views/RosterView'));
const DesignationAdminView = React.lazy(() => import('./views/DesignationAdminView'));
const ThemePicker         = React.lazy(() => import('./components/ThemePicker'));
const LayoutPicker        = React.lazy(() => import('./components/LayoutPicker'));
import React, { useState, useEffect } from 'react';
import { HRMProvider, useHRM } from './store';
import { supabase } from './supabaseClient';
import { UserRole } from './types';
import Sidebar from './components/Sidebar';
import {
  ShieldAlert, KeyRound, Menu, Bell,
  User as UserIcon, CheckCircle2, ArrowRight,
  Sun, Moon, Palette, LogOut, ChevronRight,
  Upload, FileText, CalendarClock, Clock, AlertTriangle,
  Eye, EyeOff,
  LayoutDashboard, Users, MessageSquare, DollarSign, UserCircle, X
} from 'lucide-react';
import { getThemeById, applyTheme, resetTheme, DEFAULT_THEME_ID, FESTIVAL_THEMES, type AppTheme } from './themes';
import { readLayoutSettings, writeLayoutSettings, applyLayoutSettings, resetLayoutSettings, DEFAULT_LAYOUT, type LayoutSettings } from './layoutSettings';
import { useLanguage, saveUserLang, loadUserLang, getGreetingKey, getGreetingEmoji, getFirstName, type TranslationKey } from './i18n';

const ViewSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="flex items-center justify-between gap-4">
      <div className="h-6 w-40 rounded-lg skeleton-shimmer" />
      <div className="h-9 w-28 rounded-xl skeleton-shimmer" />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl skeleton-shimmer" />
      ))}
    </div>
    <div className="h-64 rounded-2xl skeleton-shimmer" />
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl skeleton-shimmer" />
      ))}
    </div>
  </div>
);

const ExordLogo: React.FC<{ className?: string }> = ({ className }) => (
  <span className={`${className} inline-flex items-center justify-center`}>
    <img
      src="/logo.png"
      alt="Exord Online"
      className="w-full h-full object-contain"
      style={{ display: 'block' }}
    />
  </span>
);

// Role is auto-detected from DB — no role selector needed

// ── Festival Greeting Banner ──────────────────────────────────────────────────
// Shown at the top of the main content area when a global festival theme is active.
const FestivalBanner: React.FC<{ theme: AppTheme; userName: string }> = ({ theme, userName }) => {
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(`exord-banner-dismissed-${theme.id}`) === '1'; } catch { return false; }
  });

  if (!visible || dismissed || !theme.wishText) return null;

  const handleDismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(`exord-banner-dismissed-${theme.id}`, '1'); } catch {}
  };

  return (
    <div
      className="relative overflow-hidden mx-4 sm:mx-10 mt-4 sm:mt-6 rounded-[1.5rem] animate-[slideDown_0.5s_ease-out]"
      style={{
        background: `linear-gradient(135deg, ${theme.primary}22 0%, ${theme.primary}11 50%, ${theme.primaryDark}18 100%)`,
        border: `1.5px solid ${theme.primary}40`,
      }}
    >
      {/* Shimmer line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${theme.primary}80, transparent)` }} />

      <div className="flex items-center gap-4 px-5 py-3.5 sm:px-7 sm:py-5">
        {/* Emoji */}
        <span className="text-3xl sm:text-4xl flex-shrink-0 animate-[bounce_2s_infinite]">
          {theme.emoji}
        </span>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] mb-1" style={{ color: theme.primary }}>
            {theme.name}
          </p>
          {/* Full name prominently */}
          <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight mb-0.5 truncate">
            {userName}
          </p>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-snug">
            {theme.wishText}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          style={{ background: `${theme.primary}15` }}
          title="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Bottom shimmer */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${theme.primary}40, transparent)` }} />
    </div>
  );
};

// ── Personalised Welcome Banner ────────────────────────────────────────────────
// Shown at the top of the main content area on first load of each session.
// Displays a time-aware greeting + the user's first name + a role-based message.
const WelcomeBanner: React.FC<{ name: string; role: string; lang: 'en' | 'bn' }> = ({ name, role, lang }) => {
  const DISMISS_KEY = `exord-welcome-dismissed-${new Date().toDateString()}`;
  const [visible, setVisible] = React.useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) !== '1'; } catch { return true; }
  });

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  const greetingKey = getGreetingKey();
  const emoji = getGreetingEmoji();
  const firstName = getFirstName(name);

  // Greeting text per period per language
  const greetingText: Record<string, { en: string; bn: string }> = {
    good_morning:   { en: 'Good Morning',   bn: 'শুভ সকাল' },
    good_afternoon: { en: 'Good Afternoon', bn: 'শুভ অপরাহ্ন' },
    good_evening:   { en: 'Good Evening',   bn: 'শুভ সন্ধ্যা' },
    good_night:     { en: 'Good Night',     bn: 'শুভ রাত্রি' },
  };

  // Role-based motivational sub-message
  const subMessages: Record<string, { en: string; bn: string }> = {
    DEVELOPER: {
      en: 'The system is in your hands. Build something great today.',
      bn: 'সিস্টেম আপনার হাতে। আজ কিছু দুর্দান্ত তৈরি করুন।',
    },
    ADMIN: {
      en: 'A strong team is built one decision at a time. Lead well.',
      bn: 'একটি শক্তিশালী দল গড়া হয় একটি একটি সিদ্ধান্তে। সুন্দরভাবে নেতৃত্ব দিন।',
    },
    CO_ADMIN: {
      en: 'Your support keeps the engine running. Have a productive day.',
      bn: 'আপনার সহায়তায় দল এগিয়ে যায়। উৎপাদনশীল দিন হোক।',
    },
    HR: {
      en: 'People are the heart of every organisation. Thank you for yours.',
      bn: 'মানুষই প্রতিটি প্রতিষ্ঠানের হৃদয়। আপনার অবদানের জন্য ধন্যবাক।',
    },
    MANAGER: {
      en: 'Your team looks up to you. Make today count.',
      bn: 'আপনার দল আপনার দিকে তাকিয়ে আছে। আজকের দিনটি সার্থক করুন।',
    },
    EMPLOYEE: {
      en: 'Every great day starts with showing up. Welcome!',
      bn: 'প্রতিটি সুন্দর দিন শুরু হয় উপস্থিতি দিয়ে। স্বাগতম!',
    },
  };

  const greeting = greetingText[greetingKey]?.[lang] ?? greetingText[greetingKey]?.en;
  const sub = subMessages[role]?.[lang] ?? subMessages['EMPLOYEE']?.[lang];

  // Date display
  const dateStr = new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="relative overflow-hidden mx-4 sm:mx-10 mt-4 sm:mt-6 rounded-[1.5rem] animate-[slideDown_0.5s_ease-out] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-white/10 shadow-2xl">
      {/* Red accent line top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#E31E24] to-transparent" />

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #E31E24 0%, transparent 60%)' }} />

      <div className="relative flex items-center gap-4 sm:gap-6 px-5 py-4 sm:px-8 sm:py-5">
        {/* Emoji */}
        <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl sm:text-3xl select-none">
          {emoji}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          {/* Greeting line */}
          <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] text-[#E31E24] mb-0.5">
            {greeting}
          </p>
          {/* Name — the star of the show */}
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none font-jakarta truncate">
            {firstName}
            <span className="text-white/30 ml-2 text-base font-medium">✦</span>
          </h2>
          {/* Sub-message */}
          <p className="text-[11px] sm:text-xs text-white/50 font-medium mt-1 leading-snug hidden sm:block">
            {sub}
          </p>
        </div>

        {/* Date + dismiss */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <button
            onClick={dismiss}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition-all"
            title="Dismiss"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <p className="text-[9px] text-white/25 font-bold uppercase tracking-widest text-right hidden md:block whitespace-nowrap">
            {dateStr}
          </p>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
};

// ── Mobile Bottom Navigation Bar ─────────────────────────────────────────────
// Shown only on mobile (<md). Provides instant access to the 4 most-used views
// for each role, plus a "More" button that opens the full sidebar.
const MobileBottomNav: React.FC<{
  activeView: string;
  setActiveView: (v: string) => void;
  userRole: UserRole;
  onMorePress: () => void;
  unreadCount?: number;
}> = ({ activeView, setActiveView, userRole, onMorePress, unreadCount = 0 }) => {

  type TabItem = { id: string; icon: React.ElementType; label: string };

  const tabs: TabItem[] = React.useMemo(() => {
    switch (userRole) {
      case UserRole.DEVELOPER:
      case UserRole.ADMIN:
        return [
          { id: 'dashboard',  icon: LayoutDashboard, label: 'Home'    },
          { id: 'employees',  icon: Users,           label: 'People'  },
          { id: 'attendance', icon: Clock,           label: 'Attend'  },
          { id: 'chat',       icon: MessageSquare,   label: 'Chat'    },
        ];
      case UserRole.CO_ADMIN:
        return [
          { id: 'dashboard', icon: LayoutDashboard, label: 'Home'     },
          { id: 'employees', icon: Users,            label: 'People'  },
          { id: 'requests',  icon: FileText,         label: 'Requests'},
          { id: 'chat',      icon: MessageSquare,    label: 'Chat'    },
        ];
      case UserRole.HR:
        return [
          { id: 'dashboard', icon: LayoutDashboard, label: 'Home'     },
          { id: 'employees', icon: Users,            label: 'People'  },
          { id: 'requests',  icon: FileText,         label: 'Requests'},
          { id: 'chat',      icon: MessageSquare,    label: 'Chat'    },
        ];
      case UserRole.MANAGER:
        return [
          { id: 'dashboard', icon: LayoutDashboard, label: 'Home'    },
          { id: 'employees', icon: Users,            label: 'Team'   },
          { id: 'requests',  icon: FileText,         label: 'Requests'},
          { id: 'chat',      icon: MessageSquare,    label: 'Chat'   },
        ];
      default: // EMPLOYEE
        return [
          { id: 'portal',     icon: UserCircle,    label: 'Portal'  },
          { id: 'attendance', icon: Clock,         label: 'Clock'   },
          { id: 'chat',       icon: MessageSquare, label: 'Chat'    },
          { id: 'payroll',    icon: DollarSign,    label: 'Pay'     },
        ];
    }
  }, [userRole]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex items-stretch bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10"
      style={{
        boxShadow: '0 -8px 30px rgba(0,0,0,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map(tab => {
        const isActive = activeView === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className="relative flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-all duration-150 active:scale-90 active:opacity-60"
            style={{ minWidth: 0 }}
          >
            {/* Active top indicator */}
            <span
              className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-[#E31E24] transition-all duration-300 ease-out"
              style={{ width: isActive ? '24px' : '0px', opacity: isActive ? 1 : 0 }}
            />
            <tab.icon
              size={22}
              strokeWidth={isActive ? 2.5 : 1.8}
              className={`transition-all duration-200 ${isActive ? 'text-[#E31E24] -translate-y-0.5' : 'text-slate-400 dark:text-slate-500'}`}
            />
            <span className={`text-[9px] font-black uppercase tracking-wide leading-none transition-colors duration-200 ${
              isActive ? 'text-[#E31E24]' : 'text-slate-400 dark:text-slate-500'
            }`}>
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* More button — opens sidebar */}
      <button
        onClick={onMorePress}
        className="relative flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-all duration-150 active:scale-90 active:opacity-60 text-slate-400 dark:text-slate-500"
        style={{ minWidth: 0 }}
      >
        {unreadCount > 0 && (
          <span className="absolute top-1.5 left-[calc(50%+4px)] min-w-[16px] h-4 bg-[#E31E24] text-white text-[8px] font-black rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <Menu size={22} strokeWidth={1.8} />
        <span className="text-[9px] font-black uppercase tracking-wide leading-none">More</span>
      </button>
    </nav>
  );
};

const MainApp: React.FC = () => {
  const { currentUser, login, changePassword, updateUser, units, theme, toggleTheme, logout, isLoading, notifications, markNotificationRead, markAllNotificationsRead } = useHRM();
  const { t, lang, setLang, toggleLang } = useLanguage();
  const [showPwModal, setShowPwModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [activeView, setActiveView] = useState<string>(() => {
    try { return localStorage.getItem('exord-active-view') || 'dashboard'; } catch { return 'dashboard'; }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ── Pull-to-refresh ──────────────────────────────────────────────────
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = React.useRef<number | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const PULL_THRESHOLD = 70;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
    } else {
      pullStartY.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pullStartY.current === null || isRefreshing) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0 && scrollRef.current && scrollRef.current.scrollTop <= 0) {
      setPullDistance(Math.min(delta * 0.5, 100));
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      setTimeout(() => {
        window.location.reload();
      }, 400);
    } else {
      setPullDistance(0);
    }
    pullStartY.current = null;
  };

  // ── PWA install prompt ───────────────────────────────────────────────
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    let dismissed = false;
    try { dismissed = localStorage.getItem('exord-install-dismissed') === 'true'; } catch {}
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setShowInstallBanner(false);
      try { localStorage.setItem('exord-install-dismissed', 'true'); } catch {}
    }
  };

  const handleInstallDismiss = () => {
    setShowInstallBanner(false);
    try { localStorage.setItem('exord-install-dismissed', 'true'); } catch {}
  };
  const [showNotifDropdown, setShowNotifDropdown] = useState(false); // kept for compat, unused in header
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [unitSelectSaving, setUnitSelectSaving] = useState(false);
  const [unitSelectId, setUnitSelectId] = useState('');
  const [unitSelectError, setUnitSelectError] = useState('');
  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPass: '' });
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  // ── Theme system ────────────────────────────────────────────────────────────
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);
  const [promotionEvent, setPromotionEvent] = useState<{ employeeName: string; previousDesignation: string; newDesignation: string; } | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const readPersonalThemeId = (uid: string): string => {
    try { return localStorage.getItem(`exord-personal-theme-${uid}`) || DEFAULT_THEME_ID; }
    catch { return DEFAULT_THEME_ID; }
  };

  // Global theme is ALSO cached in localStorage so it survives reload
  // without waiting for Supabase. Supabase is the source of truth but
  // localStorage is used for instant paint on reload.
  const GLOBAL_CACHE_KEY = 'exord-global-theme';
  const readCachedGlobalThemeId = (): string | null => {
    try { return localStorage.getItem(GLOBAL_CACHE_KEY) || null; }
    catch { return null; }
  };
  const writeCachedGlobalThemeId = (id: string | null) => {
    try {
      if (id) localStorage.setItem(GLOBAL_CACHE_KEY, id);
      else localStorage.removeItem(GLOBAL_CACHE_KEY);
    } catch {}
  };

  // Initialise from cache — so on reload the theme is visible immediately
  const [globalThemeId, setGlobalThemeId] = useState<string | null>(readCachedGlobalThemeId);
  const [personalThemeId, setPersonalThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [globalThemeLoaded, setGlobalThemeLoaded] = useState(false);
  const currentUserId = currentUser?.id ?? null;

  // ── Single authoritative theme applier ───────────────────────────────────
  const applyActiveTheme = React.useCallback((
    gId: string | null,
    pId: string,
    userId: string | null,
    loading: boolean,
    manualDark: 'light' | 'dark'   // ✅ store toggle is the source of truth for dark class
  ) => {
    // While the store is still loading (session restore in progress),
    // keep whatever theme is already painted — do NOT reset to Classic.
    // This prevents the flash of unstyled content on reload.
    if (loading) return;

    if (!userId) {
      // Confirmed on login page (not loading) — always Classic
      resetTheme();
      return;
    }
    const activeId = gId || pId;
    const t = getThemeById(activeId);
    applyTheme(t);
    // ✅ Fixed: dark class is controlled by the store's toggleTheme.
    // A theme's own t.dark flag only applies as the *initial default* when
    // the user hasn't manually toggled — after that, manualDark wins.
    // This prevents applyActiveTheme from overriding the toggle state.
    if (manualDark === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  // ── On mount: paint from cache instantly, then verify with Supabase ──────
  useEffect(() => {
    // 1. Paint immediately from localStorage cache (zero latency on reload)
    const cachedGlobal = readCachedGlobalThemeId();
    if (cachedGlobal) {
      const t = getThemeById(cachedGlobal);
      applyTheme(t);
      if (t.dark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }

    // 2. Verify with Supabase in background
    supabase.from('system_settings').select('value').eq('key', 'app_global_theme').maybeSingle()
      .then(({ data }) => {
        // data.value may be: '"eid-ul-fitr"' (JSON string), 'null' (JSON null), or undefined (row missing)
        let freshId: string | null = null;
        if (data?.value) {
          try {
            const parsed = JSON.parse(data.value);
            freshId = typeof parsed === 'string' && parsed.length > 0 ? parsed : null;
          } catch {
            // If it's not valid JSON, treat as a raw string ID
            freshId = data.value !== 'null' ? data.value : null;
          }
        }
        writeCachedGlobalThemeId(freshId);
        setGlobalThemeId(freshId);
        setGlobalThemeLoaded(true);
      })
      .catch(() => {
        // Table missing or network error — keep cache-painted theme, don't reset
        setGlobalThemeLoaded(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── When user session resolves, load their personal theme ────────────────
  useEffect(() => {
    if (currentUserId) {
      setPersonalThemeId(readPersonalThemeId(currentUserId));
    } else {
      setPersonalThemeId(DEFAULT_THEME_ID);
    }
  }, [currentUserId]);

  // ── Re-apply whenever any signal changes ────────────────────────────────
  useEffect(() => {
    if (!globalThemeLoaded) return;
    applyActiveTheme(globalThemeId, personalThemeId, currentUserId, isLoading, theme);
  }, [globalThemeId, personalThemeId, currentUserId, globalThemeLoaded, isLoading, applyActiveTheme, theme]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePersonalThemeSelect = (themeId: string) => {
    try { localStorage.setItem(`exord-personal-theme-${currentUserId || 'guest'}`, themeId); } catch {}
    setPersonalThemeId(themeId);
  };

  const handleGlobalThemeSelect = (themeId: string | null) => {
    writeCachedGlobalThemeId(themeId);
    setGlobalThemeId(themeId);
  };

  // ── Layout settings ──────────────────────────────────────────────────────
  const [layoutSettings, setLayoutSettings] = useState<LayoutSettings>(DEFAULT_LAYOUT);

  // Load layout when user changes
  useEffect(() => {
    if (currentUserId) {
      const saved = readLayoutSettings(currentUserId);
      setLayoutSettings(saved);
      applyLayoutSettings(saved);
    } else {
      setLayoutSettings(DEFAULT_LAYOUT);
      resetLayoutSettings();
    }
  }, [currentUserId]);

  const handleLayoutChange = (newSettings: LayoutSettings) => {
    setLayoutSettings(newSettings);
    applyLayoutSettings(newSettings);
    if (currentUserId) writeLayoutSettings(currentUserId, newSettings);
  };

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Load user's preferred language on login ──────────────────────────────
  useEffect(() => {
    if (currentUserId) {
      const savedLang = loadUserLang(currentUserId);
      if (savedLang && savedLang !== lang) {
        setLang(savedLang);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // ── Per-user language switcher (saves per-user + updates global) ─────────
  const handleSetLang = React.useCallback((l: 'en' | 'bn') => {
    setLang(l);
    if (currentUserId) saveUserLang(currentUserId, l);
  }, [setLang, currentUserId]);

  // Track whether this is a fresh login vs a page reload session restore
  const didRestoreSession = React.useRef(false);
  useEffect(() => {
    if (currentUser) {
      if (!didRestoreSession.current) {
        // First time currentUser appears — check if it was restored from localStorage
        const savedSession = (() => { try { return localStorage.getItem('exord-session'); } catch { return null; } })();
        const savedView = (() => { try { return localStorage.getItem('exord-active-view'); } catch { return null; } })();
        if (savedSession && savedView) {
          // Session restore — keep the saved view, don't redirect
          setActiveView(savedView);
        } else {
          // Fresh login — navigate to role default
          const isManagement = [UserRole.DEVELOPER, UserRole.ADMIN, UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER].includes(currentUser.role);
          setActiveView(isManagement ? 'dashboard' : 'portal');
        }
        didRestoreSession.current = true;
      }
    } else {
      didRestoreSession.current = false;
    }
  }, [currentUser]);

  // Persist active view whenever it changes
  useEffect(() => {
    try { localStorage.setItem('exord-active-view', activeView); } catch {}
  }, [activeView]);

  // Handle promotion events fired from store.tsx
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setPromotionEvent(detail);
    };
    window.addEventListener('exord-promotion', handler);
    return () => window.removeEventListener('exord-promotion', handler);
  }, []);

  // Handle navigation events from child components (e.g. "Discuss with HR" button)
  useEffect(() => {
    const handler = (e: Event) => {
      const view = (e as CustomEvent).detail;
      if (view) setActiveView(view);
    };
    window.addEventListener('exord-navigate', handler);
    return () => window.removeEventListener('exord-navigate', handler);
  }, []);

  // Handle NAVIGATE messages from the Service Worker (when user taps a push notification).
  // SW registration itself is handled in index.html to avoid double-registration.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'NAVIGATE' && e.data?.view) setActiveView(e.data.view);
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    const success = await login(identifier, password);
    if (!success) setError(t('access_denied'));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    const res = await changePassword(newPassword);
    if (res.success) {
      setSuccessMsg('Credentials updated successfully.');
      setTimeout(() => { setSuccessMsg(''); setNewPassword(''); setConfirmPassword(''); }, 2000);
    } else { setError(res.message); }
  };

  // View label map for the header title
  const VIEW_LABELS: Record<string, TranslationKey> = {
    dashboard:        'control_center',
    employees:        'workforce_hub',
    portal:           'team_portal',
    tracking:         'field_mapping',
    security:         'security_protocols',
    payroll:          'remuneration',
    leaves:           'request_vault',
    requests:         'requests_hub',
    leave_policy:     'leave_policies',
    infrastructure:   'infrastructure',
    activity:         'activity_log',
    attendance:       'shift_logs',
    chat:             'messages',
    broadcast:        'broadcast',
    approval_flow:    'approval_flow',
    unit_approval_config: 'unit_approval_config',
    role_caps:        'role_capabilities',
    settings:         'system_settings',
    duty_replacement: 'duty_replacement',
    schedule_change:  'schedule_change',
    custom_roles:      'custom_roles',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-8 font-inter">
        <ExordLogo className="w-20 h-20 animate-pulse" />
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter"><span className="exord-brand">Exord</span> Online</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{t('synchronizing')}</p>
        </div>
        <div className="flex gap-1.5">
          <span className="w-2 h-2 bg-[#E31E24] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-[#E31E24] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-[#E31E24] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row font-inter overflow-hidden transition-colors duration-500">
        {/* Left panel */}
        <div className="hidden lg:flex lg:w-1/2 bg-white dark:bg-slate-900 p-16 flex-col justify-center items-center relative overflow-hidden border-r border-slate-300 dark:border-slate-800">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-red-600/5 rounded-full blur-[120px] -mr-96 -mt-96" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <ExordLogo className="w-48 h-48 drop-shadow-2xl mb-8" />
            <h1 className="text-6xl font-black tracking-tighter flex items-baseline">
              <span className="exord-brand">Exord</span>
              <span className="text-[#1A1A1B] dark:text-white ml-2 transition-colors">Online</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium italic tracking-widest mt-4 uppercase">
              {t('app_tagline')}
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto custom-scrollbar transition-colors">
          <div className="absolute top-6 right-6 flex items-center gap-2 z-50">
            <button onClick={toggleLang} className="px-3 py-3 bg-white dark:bg-slate-800 shadow-xl border border-slate-300 dark:border-slate-700 transition-all hover:scale-110 active:scale-95 text-[11px] font-black text-slate-700 dark:text-slate-200 tracking-widest">
              {lang === 'en' ? 'বাং' : 'EN'}
            </button>
            <button onClick={toggleTheme} className="p-4 bg-white dark:bg-slate-800 shadow-xl border border-slate-300 dark:border-slate-700 transition-all hover:scale-110 active:scale-95">
              {theme === 'light' ? <Moon size={24} className="text-slate-900" /> : <Sun size={24} className="text-amber-400" />}
            </button>
          </div>

          <div className="w-full max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
            <div className="lg:hidden flex flex-col items-center mb-8">
              <ExordLogo className="w-24 h-24 mb-4" />
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Exord Online</h2>
            </div>

            <div className="space-y-1">
              <h3 className="text-3xl font-black text-slate-900 dark:text-white font-jakarta tracking-tight">{t('welcome_back')}</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium">{t('sign_in_desc')}</p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-3">
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#E31E24] transition-colors" />
                  <input type="text" required value={identifier} onChange={e => setIdentifier(e.target.value)} {...{placeholder: t('employee_id_or_email')}}
                    className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all shadow-sm" />
                </div>
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#E31E24] transition-colors" />
                  <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} {...{placeholder: t('access_password')}}
                    className="w-full pl-11 pr-11 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all shadow-sm" />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#E31E24] transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[11px] font-black uppercase tracking-widest border-2 border-rose-100 dark:border-rose-900/40 flex items-center gap-3 animate-pulse">
                  <ShieldAlert size={14} /> {error}
                </div>
              )}

              <button type="submit" className="w-full py-5 bg-slate-950 dark:bg-white dark:text-slate-900 hover:bg-[#E31E24] dark:hover:bg-[#E31E24] dark:hover:text-white text-white font-black uppercase tracking-[0.2em] text-xs shadow-2xl transition-all duration-300 flex items-center justify-center gap-2">
                Access Node <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.mustChangePassword) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 font-inter transition-colors duration-500">
        <div className="w-full max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
          <div className="text-center space-y-4">
            <ExordLogo className="w-24 h-24 mx-auto drop-shadow-xl" />
            <h3 className="text-3xl font-black text-slate-900 dark:text-white font-jakarta tracking-tight">{t('security_protocol_update')}</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('initial_access_detected')}</p>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-6 bg-white dark:bg-slate-900 p-10 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">New Password</label>
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#E31E24] transition-colors" />
                  <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Confirm Password</label>
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#E31E24] transition-colors" />
                  <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
                </div>
              </div>
            </div>
            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[11px] font-black uppercase tracking-widest border-2 border-rose-100 dark:border-rose-900/40 flex items-center gap-3 animate-pulse">
                <ShieldAlert size={14} /> {error}
              </div>
            )}
            {successMsg && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase tracking-widest border-2 border-emerald-100 dark:border-emerald-900/40 flex items-center gap-3">
                <CheckCircle2 size={14} /> {successMsg}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button type="submit" className="w-full py-5 bg-slate-950 dark:bg-[#E31E24] text-white font-black uppercase tracking-[0.2em] text-xs shadow-2xl transition-all duration-300 flex items-center justify-center gap-2 group">
                Commit Credentials <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button type="button" onClick={logout} className="w-full py-4 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-red-600 transition-colors">
                Terminate Session
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Document deadline enforcement ─────────────────────────────────────────
  // Employees (non-admin) past their deadline with no docs get blocked
  const isDeadlineLocked = (() => {
    if (!currentUser) return false;
    // Developers, Admins and Co-Admins are never blocked
    if ([UserRole.DEVELOPER, UserRole.ADMIN, UserRole.CO_ADMIN].includes(currentUser.role)) return false;
    const deadline = currentUser.docDeadline;
    if (!deadline) return false;
    const hasDocs = currentUser.documents && (currentUser.documents as any[]).length > 0;
    if (hasDocs) return false;
    return new Date(deadline) < new Date();
  })();

  const isDeadlineWarning = (() => {
    if (!currentUser) return false;
    if ([UserRole.DEVELOPER, UserRole.ADMIN, UserRole.CO_ADMIN].includes(currentUser.role)) return false;
    const deadline = currentUser.docDeadline;
    if (!deadline) return false;
    const hasDocs = currentUser.documents && (currentUser.documents as any[]).length > 0;
    if (hasDocs) return false;
    const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    return daysLeft >= 0 && daysLeft <= 7;
  })();

  const deadlineDaysLeft = currentUser?.docDeadline
    ? Math.ceil((new Date(currentUser.docDeadline).getTime() - Date.now()) / 86400000)
    : null;

  if (isDeadlineLocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 transition-colors duration-500">
        <div className="w-full max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-red-100 dark:bg-red-900/20 rounded-[2rem] flex items-center justify-center">
              <CalendarClock size={36} className="text-[#E31E24]" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white font-jakarta tracking-tight">Account Restricted</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Your document upload deadline has passed. Please upload your identity document to restore access.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-widest">Deadline Passed</p>
                <p className="text-[11px] text-red-600 dark:text-red-500 mt-1">
                  Your deadline was {currentUser?.docDeadline ? new Date(currentUser.docDeadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}.
                  Upload your NID or birth certificate to unlock your account.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">What you need to do:</p>
              {[
                'Prepare a clear photo or scan of your National ID (NID) or Birth Certificate',
                'Contact your HR department or upload via the Employee Portal once access is restored',
                'If you believe this is an error, contact your HR officer immediately',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 flex-shrink-0 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black flex items-center justify-center">{i + 1}</div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={logout}
              className="w-full py-4 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest border-2 border-slate-200 dark:border-slate-700 hover:text-red-600 hover:border-red-300 transition-all"
            >
              <LogOut size={13} className="inline mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderView = () => {
    const wrap = (name: string, node: React.ReactNode) => (
      <ErrorBoundary viewName={name}><React.Suspense fallback={<ViewSkeleton />}>{node}</React.Suspense></ErrorBoundary>
    );
    switch (activeView) {
      case 'dashboard':      return wrap('Dashboard',         <AdminDashboard />);
      case 'employees':      return wrap('Workforce',         <WorkforceView onNavigate={setActiveView} />);
      case 'portal':         return wrap('Portal',            <EmployeePortal />);
      case 'tracking':       return wrap('Live Tracking',     <LiveTracking />);
      case 'security':       return wrap('Security',          <SecurityLogs />);
      case 'payroll':        return wrap('Payroll',           <PayrollView />);
      case 'leaves':         return wrap('Leaves',            <LeavesView />);
      case 'requests':       return wrap('Requests',          <RequestsHub />);
      case 'leave_policy':   return wrap('Leave Policy',      <LeavePolicyView />);
      case 'infrastructure': return wrap('Infrastructure',    <InfrastructureView />);
      case 'activity':       return wrap('Activity Log',      <ActivityLogView />);
      case 'attendance':     return wrap('Attendance',        <AttendanceView />);
      case 'chat':           return wrap('Chat',              <ChatView />);
      case 'assets':         return wrap('Assets',            <AssetView />);
      case 'permissions':    return wrap('Permissions',       <PermissionsView />);
      case 'broadcast':      return wrap('Broadcast',         <BroadcastView />);
      case 'approval_flow':  return wrap('Approval Flow',     <ApprovalFlowView />);
      case 'unit_approval_config': return wrap('Unit Approval Config', <UnitApprovalConfigView />);
      case 'role_caps':      return wrap('Access & Permissions', <PermissionsView />); // merged into Permissions
      case 'settings':       return wrap('System Settings',   <SystemSettingsView />);
      case 'duty_replacement': return wrap('Duty Replacement', <DutyReplacementView />);
      case 'schedule_change':  return wrap('Schedule Change',  <ScheduleChangeView />);
      case 'roster':           return wrap('Duty Roster',       <RosterView />);
      case 'custom_roles':    return wrap('Custom Roles',    <CustomRolesView />);
      case 'designation_admin': return wrap('Designation Management', <DesignationAdminView />);
      default:               return wrap('Dashboard',         <AdminDashboard />);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row transition-colors duration-500 overflow-hidden">
      {/* ── PWA Install Banner ── */}
      {showInstallBanner && (
        <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] animate-[slideUp_0.3s_ease-out]">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 flex items-center gap-3"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#E31E24] flex items-center justify-center flex-shrink-0">
              <img src="/logo.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">Install Exord HRM</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Add to home screen for quick access</p>
            </div>
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-2 bg-[#E31E24] text-white text-[11px] font-black uppercase tracking-wide rounded-xl flex-shrink-0 active:scale-95 transition-transform"
            >
              Install
            </button>
            <button
              onClick={handleInstallDismiss}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      <Sidebar activeView={activeView} setActiveView={setActiveView} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden transition-all duration-500" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main className="flex-1 flex flex-col min-h-screen transition-all duration-500 md:ml-72 relative">
        <header
          className="sticky top-0 z-30 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-300 dark:border-slate-800"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 md:hidden border-2 border-slate-300 dark:border-slate-700">
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white capitalize tracking-tight flex items-center gap-3 font-jakarta">
              {VIEW_LABELS[activeView] ? t(VIEW_LABELS[activeView]) : activeView.replace('-', ' ')}
              <div className="w-2 h-2 bg-[#E31E24] animate-pulse" />
            </h1>
          </div>

          {/* ── Right side: avatar only, everything else inside panel ── */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(p => !p)}
              className="relative flex items-center gap-3 hover:opacity-90 active:scale-95 transition-all"
            >
              {/* Unread badge on avatar */}
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="absolute -top-1 -right-1 z-10 min-w-[18px] h-[18px] bg-[#E31E24] text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-lg">
                  {notifications.filter(n => !n.isRead).length > 99 ? '99+' : notifications.filter(n => !n.isRead).length}
                </span>
              )}
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl overflow-hidden bg-slate-900 dark:bg-[#E31E24] text-white flex items-center justify-center font-black text-base shadow-lg ring-2 ring-slate-200 dark:ring-white/10 transition-all">
                {currentUser.avatar
                  ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  : currentUser.name.charAt(0)
                }
              </div>
            </button>

            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />

                {/* ── iPhone-style panel ── */}
                <div className="absolute right-0 top-full mt-3 w-80 z-50 animate-[slideDown_0.2s_ease-out]">
                  <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden">

                    {/* ── User card ── */}
                    <div className="px-5 pt-5 pb-4 flex items-center gap-4 border-b border-slate-100 dark:border-white/8">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-900 dark:bg-[#E31E24] text-white flex items-center justify-center font-black text-xl flex-shrink-0 shadow-md">
                        {currentUser.avatar
                          ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                          : currentUser.name.charAt(0)
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-900 dark:text-white leading-tight truncate">{currentUser.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">{currentUser.email}</p>
                        <span className="inline-block mt-1.5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-[#E31E24] text-white rounded-lg">
                          {(currentUser as any).designation || currentUser.role.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* ── Quick toggles: Appearance + Language ── */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-white/8 grid grid-cols-2 gap-2.5">
                      {/* Dark / Light */}
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Appearance</p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => { if (theme === 'dark') toggleTheme(); }}
                            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all text-[9px] font-black uppercase ${theme === 'light' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                          >
                            <Sun size={14} />
                            Light
                          </button>
                          <button
                            onClick={() => { if (theme === 'light') toggleTheme(); }}
                            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all text-[9px] font-black uppercase ${theme === 'dark' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <Moon size={14} />
                            Dark
                          </button>
                        </div>
                      </div>

                      {/* Language */}
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Language</p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleSetLang('en')}
                            className={`flex-1 py-2 rounded-xl transition-all text-[10px] font-black ${lang === 'en' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                          >
                            EN
                          </button>
                          <button
                            onClick={() => handleSetLang('bn')}
                            className={`flex-1 py-2 rounded-xl transition-all text-[10px] font-black ${lang === 'bn' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                          >
                            বাং
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── Notifications ── */}
                    <div className="border-b border-slate-100 dark:border-white/8">
                      <div className="px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell size={14} className="text-slate-500 dark:text-slate-400" />
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200">{t('notifications')}</span>
                          {notifications.filter(n => !n.isRead).length > 0 && (
                            <span className="px-1.5 py-0.5 bg-[#E31E24] text-white text-[9px] font-black rounded-full">
                              {notifications.filter(n => !n.isRead).length}
                            </span>
                          )}
                        </div>
                        {notifications.filter(n => !n.isRead).length > 0 && (
                          <button onClick={() => markAllNotificationsRead()} className="text-[10px] font-black text-[#E31E24]">
                            {t('mark_all_read')}
                          </button>
                        )}
                      </div>
                      <div className="max-h-44 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 && (
                          <p className="px-5 pb-3 text-[11px] text-slate-400 font-medium">{t('no_notifications')}</p>
                        )}
                        {notifications.slice(0, 8).map(notif => (
                          <div
                            key={notif.id}
                            onClick={() => { if (!notif.isRead) markNotificationRead(notif.id); setShowProfileMenu(false); setActiveView('portal'); }}
                            className={`px-5 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start gap-3 ${!notif.isRead ? 'bg-red-50/40 dark:bg-red-900/5' : ''}`}
                          >
                            {!notif.isRead && <div className="w-1.5 h-1.5 rounded-full bg-[#E31E24] flex-shrink-0 mt-1.5" />}
                            {notif.isRead && <div className="w-1.5 h-1.5 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] leading-tight truncate ${!notif.isRead ? 'font-black text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                                {notif.title}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{notif.message.slice(0, 55)}{notif.message.length > 55 ? '…' : ''}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Menu items ── */}
                    <div className="py-1.5">
                      {[
                        { label: 'Customise Theme',  icon: Palette, onClick: () => { setShowProfileMenu(false); setShowThemePicker(true); }, badge: globalThemeId ? 'Active' : null },
                        { label: 'Layout Style',     icon: Palette, onClick: () => { setShowProfileMenu(false); setShowLayoutPicker(true); }, badge: null },
                        { label: 'Change Password',  icon: KeyRound, onClick: () => { setShowProfileMenu(false); setPwForm({ current: '', next: '', confirm: '' }); setPwError(''); setPwSuccess(false); setShowPwModal(true); }, badge: null },
                        ...(currentUser.role === 'DEVELOPER' ? [{ label: 'Change Email', icon: CheckCircle2, onClick: () => { setShowProfileMenu(false); setEmailForm({ newEmail: currentUser.email || '', currentPass: '' }); setEmailError(''); setEmailSuccess(false); setShowEmailModal(true); }, badge: null }] : []),
                      ].map((item, i) => (
                        <button
                          key={i}
                          onClick={item.onClick}
                          className="w-full flex items-center gap-3 px-5 py-3 text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <item.icon size={15} className="text-slate-400 flex-shrink-0" />
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-md">{item.badge}</span>
                          )}
                          <ChevronRight size={13} className="text-slate-300 dark:text-slate-600" />
                        </button>
                      ))}
                    </div>

                    {/* ── Sign out ── */}
                    <div className="px-4 pb-4 pt-1">
                      <button
                        onClick={() => { setShowProfileMenu(false); logout(); }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all active:scale-95"
                      >
                        <LogOut size={14} />
                        Sign Out
                      </button>
                    </div>

                  </div>
                </div>
              </>
            )}
          </div>
          </div>
        </header>

        {activeView === 'tracking'
          ? (
            // Full-height container for map — no padding, no max-width, no overflow clipping
            <div className="flex-1 overflow-hidden p-4 sm:p-6" style={{ minHeight: 0 }}>
              <div key={activeView} className="view-transition h-full">
                {renderView()}
              </div>
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined, transition: pullDistance === 0 ? 'transform 0.25s ease-out' : 'none' }}
            >
              {/* ── Pull-to-refresh indicator ── */}
              {(pullDistance > 0 || isRefreshing) && (
                <div
                  className="absolute -top-12 left-0 right-0 flex items-center justify-center"
                  style={{ height: '48px' }}
                >
                  <div
                    className={`w-7 h-7 border-[3px] border-[#E31E24] border-t-transparent rounded-full ${isRefreshing ? 'animate-spin' : ''}`}
                    style={!isRefreshing ? { transform: `rotate(${pullDistance * 3.6}deg)`, opacity: Math.min(pullDistance / 70, 1) } : {}}
                  />
                </div>
              )}
              {/* Show festival banner with full name when a festival theme is active,
                  OR the regular personalised welcome banner on normal days — never both */}
              {globalThemeId ? (() => {
                const ft = FESTIVAL_THEMES.find(t => t.id === globalThemeId);
                return ft ? (
                  <FestivalBanner key={globalThemeId} theme={ft} userName={currentUser.name} />
                ) : (
                  <WelcomeBanner key={currentUser.id} name={currentUser.name} role={currentUser.role} lang={lang} />
                );
              })() : (
                <WelcomeBanner key={currentUser.id} name={currentUser.name} role={currentUser.role} lang={lang} />
              )}
              {/* ── Document deadline warning banner ── */}
              {isDeadlineWarning && deadlineDaysLeft !== null && (
                <div className="mx-4 sm:mx-10 mt-4 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-300 dark:border-amber-700 animate-[slideDown_0.4s_ease-out]">
                  <CalendarClock size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                      Document Upload Required — {deadlineDaysLeft === 0 ? 'Due Today!' : `${deadlineDaysLeft} day${deadlineDaysLeft === 1 ? '' : 's'} remaining`}
                    </p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">
                      Please upload your NID or identity document via the Employee Portal before{' '}
                      {new Date(currentUser.docDeadline!).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}.
                      Your account will be locked after the deadline.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveView('portal')}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all"
                  >
                    <Upload size={11} /> Upload Now
                  </button>
                </div>
              )}
              <div className="flex-1 p-4 sm:p-10 pb-28 sm:pb-10 max-w-[1600px] mx-auto w-full">
                <div key={activeView} className="view-transition">
                  {renderView()}
                </div>
              </div>
            </div>
          )
        }
      </main>

      {/* ── Mobile Bottom Nav — only when logged in and not in forced screens ── */}
      <MobileBottomNav
        activeView={activeView}
        setActiveView={setActiveView}
        userRole={currentUser.role}
        onMorePress={() => setIsSidebarOpen(true)}
        unreadCount={notifications.filter(n => !n.isRead).length}
      />

      {/* ── Change Password Modal ── */}
      {showPwModal && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="font-black text-slate-900 dark:text-white">Change Password</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Update your account password</p>
              </div>
              <button onClick={() => setShowPwModal(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">✕</button>
            </div>
            {/* Body */}
            <div className="p-6 space-y-4">
              {pwSuccess ? (
                <div className="text-center py-6 space-y-3">
                  <div className="text-5xl">✅</div>
                  <p className="font-black text-emerald-600">Password updated!</p>
                  <button onClick={() => setShowPwModal(false)}
                    className="w-full py-3 bg-[#E31E24] text-white text-xs font-black uppercase rounded-2xl">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {[
                    { label: 'Current Password', key: 'current', placeholder: 'Enter current password' },
                    { label: 'New Password',     key: 'next',    placeholder: 'Min 6 characters' },
                    { label: 'Confirm New',      key: 'confirm', placeholder: 'Repeat new password' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{f.label}</label>
                      <input
                        type="password"
                        placeholder={f.placeholder}
                        value={(pwForm as any)[f.key]}
                        onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#E31E24] outline-none"
                      />
                    </div>
                  ))}
                  {pwError && (
                    <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{pwError}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowPwModal(false)}
                      className="flex-1 py-3 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                      Cancel
                    </button>
                    <button
                      disabled={pwLoading}
                      onClick={async () => {
                        setPwError('');
                        if (!pwForm.current) { setPwError('Enter your current password.'); return; }
                        if (pwForm.next.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
                        if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match.'); return; }
                        if (pwForm.current === pwForm.next) { setPwError('New password must be different from current.'); return; }
                        setPwLoading(true);
                        const res = await changePassword(pwForm.next, pwForm.current);
                        setPwLoading(false);
                        if (res.success) { setPwSuccess(true); }
                        else { setPwError(res.message || 'Failed to update password.'); }
                      }}
                      className="flex-[2] py-3 text-xs font-black uppercase text-white bg-[#E31E24] rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2">
                      {pwLoading ? '⏳ Saving...' : '🔑 Update Password'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Change Email Modal (Developer only) ── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="font-black text-slate-900 dark:text-white">Change Email</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Update your login email address</p>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {emailSuccess ? (
                <div className="text-center py-6 space-y-3">
                  <div className="text-5xl">✅</div>
                  <p className="font-black text-emerald-600">Email updated!</p>
                  <button onClick={() => setShowEmailModal(false)}
                    className="w-full py-3 bg-[#E31E24] text-white text-xs font-black uppercase rounded-2xl">Done</button>
                </div>
              ) : (
                <>
                  {[
                    { label: 'New Email Address', key: 'newEmail', placeholder: 'new@email.com', type: 'email' },
                    { label: 'Current Password (to confirm)', key: 'currentPass', placeholder: 'Enter your password', type: 'password' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{f.label}</label>
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={(emailForm as any)[f.key]}
                        onChange={e => setEmailForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#E31E24] outline-none"
                      />
                    </div>
                  ))}
                  {emailError && <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{emailError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowEmailModal(false)}
                      className="flex-1 py-3 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl">Cancel</button>
                    <button
                      disabled={emailLoading}
                      onClick={async () => {
                        setEmailError('');
                        if (!emailForm.newEmail.includes('@')) { setEmailError('Enter a valid email.'); return; }
                        if (!emailForm.currentPass) { setEmailError('Enter your current password.'); return; }
                        if (emailForm.newEmail === currentUser?.email) { setEmailError('New email is the same as current.'); return; }
                        setEmailLoading(true);
                        // Verify current password against DB
                        const { data: userRow } = await supabase.from('users').select('password').eq('id', currentUser!.id).single();
                        if (!userRow || userRow.password !== emailForm.currentPass) {
                          setEmailError('Current password is incorrect.'); setEmailLoading(false); return;
                        }
                        await updateUser(currentUser!.id, { email: emailForm.newEmail });
                        setEmailLoading(false);
                        setEmailSuccess(true);
                      }}
                      className="flex-[2] py-3 text-xs font-black uppercase text-white bg-[#E31E24] rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2">
                      {emailLoading ? '⏳ Saving...' : '✉️ Update Email'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Theme Picker Modal ── */}
      {showThemePicker && (
        <ThemePicker
          currentPersonalThemeId={personalThemeId}
          currentGlobalThemeId={globalThemeId}
          isDeveloper={currentUser?.role === 'DEVELOPER'}
          onPersonalSelect={handlePersonalThemeSelect}
          onGlobalSelect={handleGlobalThemeSelect}
          onClose={() => setShowThemePicker(false)}
        />
      )}
      {showLayoutPicker && (
        <LayoutPicker
          settings={layoutSettings}
          onChange={handleLayoutChange}
          onClose={() => setShowLayoutPicker(false)}
        />
      )}
      {/* ── Unit Selection Modal (one-time, blocking) ── */}
      {currentUser && !currentUser.unitId && currentUser.role !== 'DEVELOPER' && currentUser.role !== 'ADMIN' && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 text-center space-y-1">
              <p className="text-2xl">🏢</p>
              <p className="font-black text-slate-900 dark:text-white text-lg">Which unit are you from?</p>
              <p className="text-[11px] text-slate-400 font-bold">This is a one-time setup. Your unit determines your leave approval chain.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Select Your Unit</label>
                <select
                  value={unitSelectId}
                  onChange={e => { setUnitSelectId(e.target.value); setUnitSelectError(''); }}
                  className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all"
                >
                  <option value="">— Select your unit —</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              {unitSelectError && (
                <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{unitSelectError}</p>
              )}
              <button
                disabled={unitSelectSaving || !unitSelectId}
                onClick={async () => {
                  if (!unitSelectId) { setUnitSelectError('Please select your unit.'); return; }
                  setUnitSelectSaving(true);
                  const { error } = await supabase.from('users').update({ unit_id: unitSelectId }).eq('id', currentUser.id);
                  if (error) { setUnitSelectError(error.message); setUnitSelectSaving(false); return; }
                  await updateUser(currentUser.id, { unitId: unitSelectId } as any);
                  setUnitSelectSaving(false);
                }}
                className="w-full py-3 bg-[#E31E24] text-white text-xs font-black uppercase rounded-2xl hover:bg-red-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {unitSelectSaving ? <span className="animate-spin">⏳</span> : '✓'} Confirm My Unit
              </button>
              <p className="text-[10px] text-center text-slate-400 font-bold">Can't find your unit? Contact your administrator.</p>
            </div>
          </div>
        </div>
      )}

      {currentUser && !currentUser.designationTrack && (
        <DesignationTrackModal
          userName={currentUser.name}
          salary={currentUser.baseSalary}
          onConfirm={async (track, designation) => {
            await updateUser(currentUser.id, {
              designationTrack: track,
              designation: designation || currentUser.designation,
            } as any);
          }}
        />
      )}
      {promotionEvent && (
        <PromotionCertModal
          employeeName={promotionEvent.employeeName}
          previousDesignation={promotionEvent.previousDesignation}
          newDesignation={promotionEvent.newDesignation}
          onClose={() => setPromotionEvent(null)}
        />
      )}
    </div>
  );
};

const AppInner: React.FC = () => {
  const { currentUser } = useHRM();
  return (
    <RoleCapabilitiesProvider currentRole={currentUser?.role}>
      <MainApp />
    </RoleCapabilitiesProvider>
  );
};

const App: React.FC = () => (
  <HRMProvider>
    <AppInner />
  </HRMProvider>
);

export default App;
