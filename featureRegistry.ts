/**
 * featureRegistry.ts — Exord Online HRM
 *
 * ─── SINGLE SOURCE OF TRUTH FOR ALL PERMISSIONABLE FEATURES ───────────────
 *
 * To add a new feature to the permissions system, just add one entry here.
 * It will automatically appear in:
 *   • Permissions → By Employee  (grant to individual users)
 *   • Permissions → By Role      (grant to all users of a role)
 *   • Permissions → Custom Roles (grant to custom role groups)
 *   • hasPermission() checks in Sidebar and views
 *
 * ── Field reference ────────────────────────────────────────────────────────
 *  key         Unique string key — used in DB and hasPermission() calls.
 *              Should match the view ID in App.tsx where possible.
 *  label       Short display name shown in the permissions UI.
 *  desc        One-line description of what this permission unlocks.
 *  icon        Lucide icon name (string) — used in PermissionsView.
 *  group       Section header in the permissions list UI.
 *  nativeRoles Roles that already have this access without a grant.
 *              DEVELOPER + ADMIN always have everything — don't list them.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { UserRole } from './types';

export interface FeatureDefinition {
  key: string;
  label: string;
  desc: string;
  icon: string;
  group: 'Core' | 'Operations' | 'Admin' | 'System';
  nativeRoles: UserRole[];
}

export const FEATURE_REGISTRY: FeatureDefinition[] = [

  // ── Core ──────────────────────────────────────────────────────────────────
  {
    key: 'dashboard',
    label: 'Dashboard',
    desc: 'Access the main control centre with stats and charts.',
    icon: 'LayoutDashboard',
    group: 'Core',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER],
  },
  {
    key: 'chat',
    label: 'Messages',
    desc: 'Send and receive direct and group messages.',
    icon: 'MessageSquare',
    group: 'Core',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE],
  },
  {
    key: 'portal',
    label: 'Employee Portal',
    desc: 'Access the self-service employee portal.',
    icon: 'UserCircle',
    group: 'Core',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE],
  },
  {
    key: 'broadcast',
    label: 'Broadcast',
    desc: 'Send announcements to all or selected employees.',
    icon: 'Radio',
    group: 'Core',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR],
  },

  // ── Operations ────────────────────────────────────────────────────────────
  {
    key: 'employees',
    label: 'Workforce Hub',
    desc: 'View and manage the full employee directory.',
    icon: 'Users',
    group: 'Operations',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER],
  },
  {
    key: 'attendance',
    label: 'Attendance',
    desc: 'View and manage attendance and shift records.',
    icon: 'Clock',
    group: 'Operations',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER],
  },
  {
    key: 'payroll',
    label: 'Payroll',
    desc: 'View and manage employee salary and payroll records.',
    icon: 'DollarSign',
    group: 'Operations',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR],
  },
  {
    key: 'requests',
    label: 'Requests Hub',
    desc: 'View and action leave, loan and advance salary requests.',
    icon: 'FileText',
    group: 'Operations',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER],
  },
  {
    key: 'leave_policy',
    label: 'Leave Policies',
    desc: 'Create and manage leave policy rules.',
    icon: 'Calendar',
    group: 'Operations',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR],
  },
  {
    key: 'assets',
    label: 'Asset Manager',
    desc: 'View, add, transfer and manage all company assets.',
    icon: 'Package',
    group: 'Operations',
    nativeRoles: [UserRole.CO_ADMIN],
  },
  {
    key: 'approval_flow',
    label: 'Approval Flow',
    desc: 'Configure and manage multi-step approval workflows.',
    icon: 'GitBranch',
    group: 'Operations',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR],
  },
  {
    key: 'duty_replacement',
    label: 'Duty Replacement',
    desc: 'Manage duty replacement and swap requests.',
    icon: 'UserCheck',
    group: 'Operations',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER],
  },
  {
    key: 'schedule_change',
    label: 'Schedule Change',
    desc: 'Review and approve duty schedule change requests.',
    icon: 'Clock',
    group: 'Operations',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER],
  },
  {
    key: 'early_checkout',
    label: 'Early Checkout',
    desc: 'Allow this employee to check out before their duty end time.',
    icon: 'LogOut',
    group: 'Operations',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER],
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  {
    key: 'tracking',
    label: 'Live Tracking',
    desc: 'View live GPS tracking map of all field employees.',
    icon: 'Map',
    group: 'Admin',
    nativeRoles: [UserRole.CO_ADMIN],
  },
  {
    key: 'infrastructure',
    label: 'Infrastructure',
    desc: 'Manage office units, departments and geofence zones.',
    icon: 'Network',
    group: 'Admin',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR],
  },
  {
    key: 'security',
    label: 'Security Logs',
    desc: 'View login events and high-severity security alerts.',
    icon: 'ShieldAlert',
    group: 'Admin',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR],
  },
  {
    key: 'activity',
    label: 'Activity Log',
    desc: 'Full audit trail of all actions taken in the system.',
    icon: 'Activity',
    group: 'Admin',
    nativeRoles: [UserRole.CO_ADMIN],
  },
  {
    key: 'permissions',
    label: 'Permissions',
    desc: 'Grant or revoke feature access for users and roles.',
    icon: 'ShieldCheck',
    group: 'Admin',
    nativeRoles: [],                    // ADMIN/DEVELOPER only by default
  },
  {
    key: 'custom_roles',
    label: 'Custom Roles',
    desc: 'Create and manage custom role groups with feature sets.',
    icon: 'Tag',
    group: 'Admin',
    nativeRoles: [],                    // ADMIN/DEVELOPER only by default
  },
  {
    key: 'role_caps',
    label: 'Role Capabilities',
    desc: 'Configure capability limits per role (e.g. leave days).',
    icon: 'Sliders',
    group: 'Admin',
    nativeRoles: [],                    // ADMIN/DEVELOPER only by default
  },

  // ── System ────────────────────────────────────────────────────────────────
  {
    key: 'settings',
    label: 'System Settings',
    desc: 'Configure global system settings including logo and theme.',
    icon: 'Settings',
    group: 'System',
    nativeRoles: [],                    // DEVELOPER only by default
  },
  {
    key: 'doc_deadline',
    label: 'Document Deadline',
    desc: 'Set document upload deadlines for employees who have not submitted NID/docs.',
    icon: 'ClipboardCheck',
    group: 'Admin',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR],
  },

  {
    key: 'roster',
    label: 'Duty Roster',
    desc: 'View and manage employee duty rosters and shift schedules.',
    icon: 'CalendarRange',
    group: 'Operations',
    nativeRoles: [UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER],
  },

  {
    key: 'designation_admin',
    label: 'Designation Management',
    desc: 'Create and manage job designations and promotion tracks.',
    icon: 'Briefcase',
    group: 'Admin',
    nativeRoles: [],                    // ADMIN/DEVELOPER only by default
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ADD NEW FEATURES BELOW THIS LINE
  // Copy this template and fill in the fields:
  //
  // {
  //   key:         'my_new_feature',
  //   label:       'My New Feature',
  //   desc:        'One line describing what this permission unlocks.',
  //   icon:        'LucideIconName',
  //   group:       'Operations',          // Core | Operations | Admin | System
  //   nativeRoles: [UserRole.CO_ADMIN],  // roles with access by default
  // },
  // ─────────────────────────────────────────────────────────────────────────
];

/**
 * Flat key→definition map — drop-in replacement for the old FEATURES object.
 * Imported by store.tsx and PermissionsView.tsx.
 */
export const FEATURES: Record<string, { label: string; desc: string; icon: string }> =
  Object.fromEntries(
    FEATURE_REGISTRY.map(f => [f.key, { label: f.label, desc: f.desc, icon: f.icon }])
  );

/**
 * Native access map — drop-in replacement for NATIVE_ACCESS in PermissionsView.
 * Maps feature key → roles that have it without a grant.
 */
export const NATIVE_ACCESS: Record<string, UserRole[]> =
  Object.fromEntries(
    FEATURE_REGISTRY.map(f => [f.key, f.nativeRoles])
  );

/**
 * Features grouped by their group label — used to render section headers
 * in the permissions UI.
 */
export const FEATURES_BY_GROUP: Record<string, FeatureDefinition[]> =
  FEATURE_REGISTRY.reduce((acc, f) => {
    if (!acc[f.group]) acc[f.group] = [];
    acc[f.group].push(f);
    return acc;
  }, {} as Record<string, FeatureDefinition[]>);

export const FEATURE_GROUPS: string[] = ['Core', 'Operations', 'Admin', 'System'];
