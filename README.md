[Exord-HRM-Complete-Technical-Documentation.md](https://github.com/user-attachments/files/32788877/Exord-HRM-Complete-Technical-Documentation.md)

# Exord Online HRM --- Complete A-to-Z Technical Documentation

**Document type:** Production architecture, codebase, operations,
deployment, and maintenance guide\
**Repository:** `SyedMdAbuHaider/HRM-Project-for-exord`\
**Production domain:** `https://admin.exord.net`\
**Production server:** `/home/exord/HRM-Project-for-exord`\
**Production baseline commit:**
`8632ee59a5d8a221418bdf0b40cf6a2b2392bba7`\
**Default branch:** `main`\
**Runtime:** Ubuntu 24.04.4 LTS, Node.js 20.20.2, npm 10.8.2

------------------------------------------------------------------------

## 1. What This Application Is

Exord Online HRM is a web-based Human Resource Management system for
managing employees, attendance, payroll, leave, requests, permissions,
roles, assets, duty rosters, schedules, communication, security/audit
information, infrastructure/unit information, and employee self-service.

The system is a **frontend-heavy React/Vite application** backed by a
collection of services:

1.  A Vite-built React frontend.
2.  A Node/Express static server serving the compiled frontend.
3.  A Node/Express HRM API/probe service.
4.  A local PostgreSQL attendance mirror API.
5.  A file server.
6.  A backup API.
7.  An attendance/mirror service.
8.  Supabase as the application's primary cloud data/backend platform.
9.  Nginx as the public reverse proxy and TLS endpoint.
10. PM2 as the process supervisor.
11. A server-side automatic deployment timer that checks GitHub `main`
    every 60 seconds.

The production system is intentionally separated into multiple PM2
processes. The `vault` application is a completely separate application
and is **not part of HRM deployment**.

------------------------------------------------------------------------

# 2. High-Level Architecture

``` text
                         INTERNET
                            |
                            v
                 +----------------------+
                 |      NGINX           |
                 | admin.exord.net      |
                 | HTTPS / TLS          |
                 +----------+-----------+
                            |
          +-----------------+------------------+
          |                 |                  |
          v                 v                  v
       :3000             :8081              :3002
   HRM Frontend        HRM API /         Attendance
   Static Server       Probe Server       Mirror API
          |                 |                  |
          |                 |                  v
          |                 |              PostgreSQL
          |                 |
          |                 +-----> Resend API
          |
          +-----> Supabase client/API
          |
          +-----> File service / backup / other

                         PM2
          +--------------+----------------+
          |              |                |
          v              v                v
     exord-hrm      exord-probe        vault
       :3000           :8081          :6969
     HRM only       HRM only       SEPARATE APP
```

### Public Nginx routes

  Public path      Internal destination           Purpose
  ---------------- ------------------------------ -----------------------------
  `/`              `127.0.0.1:3000`               HRM frontend
  `/probe/`        `127.0.0.1:8081/probe/`        Probe/network functionality
  `/email/`        `127.0.0.1:8081/email/`        HRM email operations
  `/api/backup/`   `127.0.0.1:3001/api/backup/`   Backup API
  `/upload/`       `127.0.0.1:8080/upload/`       File upload
  `/files/`        `127.0.0.1:8080/files/`        File access
  `/file-health`   `127.0.0.1:8080/health`        File-server health
  `/mirror/`       `127.0.0.1:3002/`              Attendance mirror
  `/sw.js`         `127.0.0.1:3000/sw.js`         Service worker

------------------------------------------------------------------------

# 3. Source Repository

The production HRM source repository is:

``` text
SyedMdAbuHaider/HRM-Project-for-exord
```

Remote:

``` text
git@github.com:SyedMdAbuHaider/HRM-Project-for-exord.git
```

Branch:

``` text
main
```

Production baseline:

``` text
8632ee59a5d8a221418bdf0b40cf6a2b2392bba7
```

The production repository is located at:

``` text
/home/exord/HRM-Project-for-exord
```

The production working tree is intended to follow:

``` text
origin/main
```

------------------------------------------------------------------------

# 4. Frontend Architecture

## 4.1 Frontend technology

The frontend uses:

-   React 19
-   TypeScript
-   Vite 6
-   Tailwind CSS
-   Lucide React
-   Recharts
-   Leaflet
-   Supabase JavaScript client
-   XLSX
-   custom React context/state management

The build command is:

``` bash
npm run build
```

which runs:

``` bash
vite build
```

The output directory is:

``` text
dist/
```

`dist/` is generated and is not committed to Git.

------------------------------------------------------------------------

# 5. Frontend Entry Points

## `index.tsx`

This is the browser entry point.

Its responsibility is to bootstrap the React application and mount the
application into the HTML document.

Conceptually:

``` text
index.html
    |
    v
index.tsx
    |
    v
React application
    |
    v
App.tsx
```

------------------------------------------------------------------------

## `index.html`

This is the Vite HTML shell.

It provides the browser document into which React is mounted.

The actual application UI is generated by React components.

------------------------------------------------------------------------

## `App.tsx`

This is the main application controller.

It is one of the most important frontend files.

Responsibilities include:

-   application shell
-   authentication state integration
-   current-user handling
-   active view selection
-   routing-like view switching
-   role-based navigation
-   lazy-loading views
-   mobile navigation
-   desktop sidebar
-   notifications
-   theme handling
-   language handling
-   profile/password UI
-   welcome banner
-   festival banner
-   error boundary integration
-   global application layout

Major lazy-loaded views include:

``` text
AdminDashboard
EmployeePortal
LiveTracking
SecurityLogs
WorkforceView
PayrollView
LeavesView
RequestsHub
InfrastructureView
ActivityLog
AttendanceView
ChatView
AssetView
PermissionsView
LeavePolicyView
BroadcastView
ApprovalFlowView
UnitApprovalConfigView
RoleCapabilitiesView
SystemSettingsView
DutyReplacementView
CustomRolesView
ScheduleChangeView
RosterView
DesignationAdminView
ThemePicker
LayoutPicker
```

Lazy loading keeps large application areas from being loaded into the
initial browser bundle unnecessarily.

------------------------------------------------------------------------

# 6. Global Application State

## `store.tsx`

`store.tsx` is the central HRM state/context layer.

It is one of the most important files in the project.

The application exposes HRM state through:

``` text
HRMProvider
useHRM()
```

The store is responsible for application-level data and operations such
as:

-   current user
-   login
-   logout
-   password changes
-   employee/user data
-   units
-   attendance-related state
-   notifications
-   permissions
-   roles
-   leave-related state
-   payroll-related state
-   request state
-   configuration/state synchronization

Instead of every component independently implementing authentication and
data access, components generally consume the centralized HRM context.

Typical flow:

``` text
React component
      |
      v
useHRM()
      |
      v
HRMProvider
      |
      v
Supabase / local APIs / browser storage
```

------------------------------------------------------------------------

# 7. Types

## `types.ts`

Contains shared TypeScript types and enums.

This file is the common type vocabulary for the application.

Examples of concepts represented by the type system include:

-   users
-   employees
-   roles
-   attendance
-   requests
-   leave
-   payroll
-   units
-   permissions
-   notifications
-   assets
-   schedules
-   duties

A change to a shared type can affect many views, so this file should be
treated as a core dependency.

------------------------------------------------------------------------

# 8. Constants

## `constants.ts`

Contains shared application constants and static configuration used by
multiple components.

Typical uses include:

-   labels
-   application configuration
-   fixed values
-   default settings
-   shared lists

This prevents the same business constant from being duplicated
throughout the UI.

------------------------------------------------------------------------

# 9. Feature Registry and Permissions

## `featureRegistry.ts`

This is the central feature/permission registry.

It defines application capabilities such as:

``` text
dashboard
employees
attendance
payroll
requests
leave_policy
assets
approval_flow
duty_replacement
schedule_change
early_checkout
tracking
infrastructure
security
activity
permissions
custom_roles
role_caps
settings
doc_deadline
roster
designation_admin
```

Each feature contains information such as:

``` text
key
label
description
icon
group
nativeRoles
```

The feature groups include:

``` text
Core
Operations
Admin
System
```

The registry is converted into maps such as:

``` text
FEATURES
NATIVE_ACCESS
FEATURES_BY_GROUP
FEATURE_GROUPS
```

This allows the permission UI and application authorization logic to use
one central feature definition.

------------------------------------------------------------------------

# 10. Roles

The application uses roles including:

``` text
DEVELOPER
ADMIN
CO_ADMIN
HR
MANAGER
EMPLOYEE
```

Role behavior is used in:

-   navigation
-   permissions
-   dashboards
-   feature visibility
-   mobile navigation
-   administrative access
-   employee self-service

The application automatically determines the role from application data
rather than relying on a visible role selector.

------------------------------------------------------------------------

# 11. Main Frontend Components

The `components/` directory contains reusable UI components.

Important components include:

  File                          Responsibility
  ----------------------------- ---------------------------------
  `Sidebar.tsx`                 Main desktop navigation
  `ChatView.tsx`                Chat UI
  `BulkImportModal.tsx`         Bulk employee/data import
  `ErrorBoundary.tsx`           React runtime error containment
  `FileUploadButton.tsx`        File upload UI
  `HolidayCalendar.tsx`         Holiday/calendar UI
  `LayoutPicker.tsx`            UI layout selection
  `LoanSection.tsx`             Loan-related UI
  `MessageBubble.tsx`           Chat message presentation
  `PromotionCertModal.tsx`      Promotion certificate UI
  `DesignationTrackModal.tsx`   Designation/promotion track UI
  `ThemePicker.tsx`             Theme selection

The components are designed to be reused by multiple views rather than
containing entire application sections themselves.

------------------------------------------------------------------------

# 12. Main Views

The `views/` directory contains major application screens.

Important views include:

  -----------------------------------------------------------------------
  View                                Main responsibility
  ----------------------------------- -----------------------------------
  `AdminDashboard.tsx`                Administrative dashboard

  `EmployeePortal.tsx`                Employee self-service portal

  `WorkforceView.tsx`                 Employee/workforce management

  `AttendanceView.tsx`                Attendance management

  `PayrollView.tsx`                   Payroll/salary management

  `LeavesView.tsx`                    Leave management

  `RequestsHub.tsx`                   Leave/loan/advance/request workflow

  `InfrastructureView.tsx`            Units, departments,
                                      infrastructure/geofence

  `LiveTracking.tsx`                  Employee GPS/live tracking

  `SecurityLogs.tsx`                  Security/login-related logs

  `ActivityLog.tsx`                   Audit/activity trail

  `AssetView.tsx`                     Company asset management

  `PermissionsView.tsx`               User/feature permissions

  `LeavePolicyView.tsx`               Leave policy configuration

  `BroadcastView.tsx`                 Broadcast communication

  `ApprovalFlowView.tsx`              Approval workflow configuration

  `UnitApprovalConfigView.tsx`        Unit-level approval configuration

  `RoleCapabilitiesView.tsx`          Role capability limits

  `SystemSettingsView.tsx`            System-wide configuration

  `DutyReplacementView.tsx`           Duty replacement

  `DutySwapRequest.hook.ts`           Duty swap logic

  `ScheduleChangeView.tsx`            Schedule change requests

  `RosterView.tsx`                    Duty roster

  `CustomRolesView.tsx`               Custom roles

  `DesignationAdminView.tsx`          Designation management

  `DesignationTrackModal.tsx`         Promotion/designation workflow
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 13. Employee Portal

## `EmployeePortal.tsx`

The employee portal provides the employee-facing experience.

The employee-oriented navigation includes concepts such as:

``` text
Portal
Attendance / Clock
Chat
Payroll
```

Employees do not necessarily see the same administrative navigation as
HR, managers, administrators, or developers.

The frontend determines available features from:

``` text
current user
+
role
+
feature permissions
```

------------------------------------------------------------------------

# 14. Workforce Management

## `WorkforceView.tsx`

Responsible for employee/workforce administration.

It works with employee information and supports workforce operations
such as:

-   employee directory
-   employee details
-   organizational information
-   employee management
-   designation-related information
-   employment data

Related files include:

``` text
designationConstants.ts
views/DesignationAdminView.tsx
views/DesignationTrackModal.tsx
components/DesignationTrackModal.tsx
```

------------------------------------------------------------------------

# 15. Attendance System

Attendance is implemented through multiple layers.

``` text
Browser
   |
   +----> Primary application/backend data
   |
   +----> Local attendance mirror
```

The application also contains offline synchronization support.

Important files:

``` text
views/AttendanceView.tsx
utils/attendanceQueue.ts
utils/useAttendanceSync.ts
attendance-api.js
```

------------------------------------------------------------------------

## `utils/attendanceQueue.ts`

Handles queued attendance operations.

This is important for situations where an attendance action cannot
immediately synchronize with the backend.

Conceptually:

``` text
User clocks in/out
       |
       v
Attendance action
       |
       +---- online ---> backend
       |
       +---- offline --> local queue
                              |
                              v
                       sync when possible
```

------------------------------------------------------------------------

## `utils/useAttendanceSync.ts`

React hook for synchronization behavior.

It connects the frontend attendance state to the synchronization
queue/mirror mechanism.

------------------------------------------------------------------------

# 16. Local Attendance Mirror API

## `attendance-api.js`

This is a separate Node/Express service.

Production port:

``` text
3002
```

Binding:

``` text
127.0.0.1
```

Purpose:

> Local PostgreSQL backup/mirror for attendance records.

It uses PostgreSQL:

``` text
host: localhost
port: 5432
database: exord_hrm
user: exord_hrm
```

The service exposes:

``` text
POST /attendance
POST /attendance/bulk
GET  /health
```

### Single attendance record

``` text
POST /attendance
```

Stores fields including:

``` text
user_id
type
status
timestamp
location
ip_address
is_late
late_minutes
reason
source
synced_at
```

### Offline bulk synchronization

``` text
POST /attendance/bulk
```

Used for queued/offline attendance records.

### Health check

``` text
GET /health
```

Returns PostgreSQL-backed health information including the number of
attendance records.

------------------------------------------------------------------------

# 17. Supabase

The frontend uses:

``` text
supabaseClient.ts
```

The Supabase client is the application's cloud data/backend integration.

Supabase-related functionality can include:

-   authentication/data access
-   application database access
-   real-time/application backend functionality
-   Edge Functions

The repository contains:

``` text
supabase/
```

with Edge Functions such as:

``` text
supabase/functions/send-broadcast-email/index.ts
supabase/functions/send-salary-slip-email/index.ts
```

These are separate from the local Node/Express `server.js` email
service.

------------------------------------------------------------------------

# 18. Supabase Edge Functions

## `send-broadcast-email/index.ts`

Responsible for sending broadcast email through the configured email
provider/function environment.

## `send-salary-slip-email/index.ts`

Responsible for salary-slip email functionality.

The Resend credential is expected to be provided through runtime
environment configuration rather than committed directly into Git.

------------------------------------------------------------------------

# 19. Local HRM API / Probe Server

## `server.js`

This is the main Node/Express HRM API/probe service.

Production port:

``` text
8081
```

It provides email and probe-related functionality.

Current runtime configuration includes:

``` js
const RESEND_KEY = process.env.RESEND_API_KEY;
```

This is deliberate: the Resend API key is no longer hardcoded in the
GitHub production baseline.

------------------------------------------------------------------------

# 20. Email System

The HRM API provides:

``` text
POST /email/broadcast
POST /email/salary-slip
```

### Broadcast email

Receives:

``` text
recipients
subject
message
type
senderName
```

It generates an HTML Exord-branded email and sends it through Resend.

Supported announcement types include:

``` text
GENERAL
SALARY
LEAVE
SYSTEM
```

### Salary slip email

Receives salary information such as:

``` text
recipientEmail
recipientName
period
base
bonus
deductions
net
status
lateCount
lateDeduction
```

It generates a salary-slip email.

### Health

``` text
GET /health
```

Expected response:

``` json
{"status":"ok"}
```

------------------------------------------------------------------------

# 21. Resend Runtime Secret

The Resend API key is intentionally not stored in Git.

Production location:

``` text
/home/exord/.config/exord-hrm/production.env
```

Permissions:

``` text
600
```

The environment contains:

``` bash
RESEND_API_KEY=...
```

The HRM API loads this value into its runtime environment.

Never commit this file to Git.

Never put the API key into:

``` text
server.js
supabase functions
README.md
GitHub source
frontend JavaScript
```

------------------------------------------------------------------------

# 22. Static Frontend Server

## `static-server.js`

This service replaced PM2's generic `pm2 serve`.

Purpose:

-   serve `dist/`
-   provide SPA fallback
-   handle malformed percent-encoded URLs safely
-   configure browser caching

Production port:

``` text
3000
```

Directory served:

``` text
/home/exord/HRM-Project-for-exord/dist
```

The important behavior is:

``` text
Browser request
      |
      v
static-server.js
      |
      +--> existing static file
      |
      +--> otherwise index.html
```

This allows React client-side routes to work correctly.

------------------------------------------------------------------------

# 23. Why `static-server.js` Exists

The application previously encountered issues with generic PM2 static
serving, including malformed URI handling.

The custom server explicitly protects against malformed URL encoding:

``` text
decodeURIComponent(req.path)
```

If decoding fails:

``` text
400 Bad Request
```

instead of crashing the server.

It also uses an Express 5-compatible SPA fallback:

``` text
/{*path}
```

This is important for a React SPA.

------------------------------------------------------------------------

# 24. Build System

## `package.json`

The primary scripts are:

``` json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "lint": "tsc --noEmit"
}
```

Dependencies include:

``` text
React
React DOM
Supabase
Express
Leaflet
Lucide React
Recharts
XLSX
PostgreSQL client
ping
SNMP support
Nodemailer
Vite
TypeScript
Tailwind
```

------------------------------------------------------------------------

# 25. Vite

## `vite.config.ts`

Controls the Vite frontend build.

The build process transforms the React/TypeScript source into
browser-ready assets.

Output:

``` text
dist/
```

The production server does not directly serve TypeScript source files.

Production flow:

``` text
.tsx / .ts
   |
   v
Vite
   |
   v
dist/
   |
   v
static-server.js
   |
   v
browser
```

------------------------------------------------------------------------

# 26. Tailwind CSS

## `tailwind.config.js`

Defines Tailwind configuration used by the UI.

## `index.css`

Contains the global stylesheet and application-wide CSS.

The UI uses Tailwind utility classes heavily, with additional
application-specific styles.

------------------------------------------------------------------------

# 27. Themes

## `themes.ts`

Contains application theme definitions and theme application logic.

The application supports:

-   theme selection
-   dark/light behavior
-   festival themes
-   custom visual configuration

## `layoutSettings.ts`

Controls saved layout preferences.

The frontend can persist layout configuration locally.

------------------------------------------------------------------------

# 28. Internationalization

## `i18n.tsx`

Provides language functionality.

The application supports:

``` text
English
Bangla
```

The language system provides:

-   translations
-   language selection
-   greeting text
-   localized date presentation
-   language persistence

------------------------------------------------------------------------

# 29. Chat

Chat-related functionality is split across:

``` text
chatService.ts
components/ChatView.tsx
components/MessageBubble.tsx
views/ChatView.tsx
```

The architecture separates:

``` text
chat service/data operations
        +
chat presentation
```

This allows the UI to consume chat functionality without embedding all
communication logic directly into the component.

------------------------------------------------------------------------

# 30. File Management

## `fileService.ts`

Contains frontend file-management functionality.

The actual production file server is separate from the React frontend.

Nginx routes:

``` text
/upload/
    -> 127.0.0.1:8080/upload/

 /files/
    -> 127.0.0.1:8080/files/

 /file-health
    -> 127.0.0.1:8080/health
```

This separation prevents large file operations from being handled
directly by the Vite/React frontend server.

------------------------------------------------------------------------

# 31. Service Worker

## `public/sw.js`

Browser service worker.

It is exposed as:

``` text
/sw.js
```

Nginx explicitly routes this file to the frontend service.

The service worker can support browser caching/PWA-style behavior.

------------------------------------------------------------------------

# 32. Web App Manifest

## `public/manifest.json`

Defines browser/PWA metadata.

The frontend also contains:

``` text
public/logo.png
```

and:

``` text
logo.png
```

for application branding.

------------------------------------------------------------------------

# 33. Error Handling

## `components/ErrorBoundary.tsx`

React error boundary.

Its purpose is to prevent one rendering failure from taking down the
entire React interface without a controlled error state.

Conceptually:

``` text
React application
      |
      v
ErrorBoundary
      |
      +--> normal UI
      |
      +--> component crash
               |
               v
          controlled error UI
```

------------------------------------------------------------------------

# 34. Requests and Approval Architecture

The HRM contains multiple workflow-oriented modules.

Examples:

``` text
Leave requests
Loan requests
Advance salary requests
Duty replacement
Duty swap
Schedule change
Approval flow
Unit approval
```

Key files include:

``` text
RequestsHub.tsx
ApprovalFlowView.tsx
UnitApprovalConfigView.tsx
DutyReplacementView.tsx
DutyReplacementView.hook.ts
DutySwapRequest.hook.ts
ScheduleChangeView.tsx
LeavePolicyView.tsx
```

The general architecture is:

``` text
Employee submits request
        |
        v
Request record
        |
        v
Configured approval chain
        |
        v
Manager / HR / Unit approver
        |
        v
Approved / rejected / pending
```

------------------------------------------------------------------------

# 35. Payroll

## `views/PayrollView.tsx`

Payroll management interface.

The payroll system deals with concepts such as:

``` text
base salary
bonus
deductions
net salary
salary status
late deductions
salary period
```

The salary-slip email API uses the same concepts when generating
employee salary notifications.

------------------------------------------------------------------------

# 36. Leave System

Important files:

``` text
views/LeavesView.tsx
views/LeavePolicyView.tsx
views/RequestsHub.tsx
views/RoleCapabilitiesView.tsx
```

The system supports policy/configuration and request processing.

Leave-related permissions can be restricted by role and configured
capabilities.

------------------------------------------------------------------------

# 37. Duty Roster and Scheduling

Important files:

``` text
views/RosterView.tsx
views/ScheduleChangeView.tsx
views/DutyReplacementView.tsx
views/DutyReplacementView.hook.ts
views/DutySwapRequest.hook.ts
```

These collectively support:

-   duty schedules
-   roster management
-   schedule change requests
-   duty replacement
-   duty swaps

------------------------------------------------------------------------

# 38. Designation and Promotion

Important files:

``` text
designationConstants.ts
views/DesignationAdminView.tsx
views/DesignationTrackModal.tsx
components/DesignationTrackModal.tsx
components/PromotionCertModal.tsx
views/PromotionCertModal.tsx
```

These support:

-   job designation management
-   promotion tracks
-   designation changes
-   promotion certificate UI

------------------------------------------------------------------------

# 39. Assets

## `views/AssetView.tsx`

Responsible for company asset management.

The feature registry describes it as supporting:

-   viewing assets
-   adding assets
-   transferring assets
-   managing company assets

The feature is primarily administrative.

------------------------------------------------------------------------

# 40. Infrastructure

## `views/InfrastructureView.tsx`

Manages infrastructure-related HRM concepts such as:

-   office/unit concepts
-   departments
-   geofence zones

This is distinct from the ISP/network infrastructure managed elsewhere
on the server.

------------------------------------------------------------------------

# 41. Live Tracking

## `views/LiveTracking.tsx`

Provides live GPS tracking functionality for field employees.

It is restricted through the feature/role permission system.

The application uses map-related dependencies including Leaflet.

------------------------------------------------------------------------

# 42. Security and Audit

## `views/SecurityLogs.tsx`

Provides security/login-related event visibility.

## `views/ActivityLog.tsx`

Provides a broader application activity/audit trail.

## `views/PermissionsView.tsx`

Provides permission management.

Together:

``` text
User action
    |
    +--> security-related events
    |
    +--> application activity
    |
    +--> permission evaluation
```

------------------------------------------------------------------------

# 43. Custom Roles

## `views/CustomRolesView.tsx`

Allows creation and management of custom role groups.

The custom role system works together with:

``` text
featureRegistry.ts
PermissionsView.tsx
RoleCapabilitiesView.tsx
store.tsx
```

This provides a more granular access model than only using the six
native roles.

------------------------------------------------------------------------

# 44. Role Capabilities

## `views/RoleCapabilitiesView.tsx`

Controls capability limits associated with roles.

The feature registry describes examples such as:

``` text
leave days
```

This is different from basic feature visibility.

Conceptually:

``` text
Role
 |
 +--> Can access feature?
 |
 +--> What capability limit applies?
```

------------------------------------------------------------------------

# 45. System Settings

## `views/SystemSettingsView.tsx`

Developer/system-level configuration interface.

The feature registry identifies system settings as a developer-level
feature by default.

------------------------------------------------------------------------

# 46. Data Flow

A simplified normal application request looks like:

``` text
Browser
   |
   v
React component
   |
   v
useHRM() / service
   |
   +------------------+
   |                  |
   v                  v
Supabase          Local API
   |                  |
   |                  +--> :8081 HRM API
   |                  |
   |                  +--> :3002 attendance mirror
   |
   v
Database / backend
```

The exact backend path depends on the feature.

------------------------------------------------------------------------

# 47. Authentication / User Flow

The application uses centralized HRM state.

Conceptually:

``` text
Login screen
     |
     v
login()
     |
     v
HRMProvider / backend
     |
     v
currentUser
     |
     v
role detection
     |
     v
feature permissions
     |
     v
navigation + view access
```

After login, the application chooses the interface based on the user's
role and permissions.

------------------------------------------------------------------------

# 48. Browser Storage

The application uses browser storage for selected UI/session
preferences.

Examples visible in the source include:

``` text
localStorage
sessionStorage
```

Stored information includes things such as:

``` text
active view
language preference
dismissed welcome banner
dismissed festival banner
layout settings
theme settings
```

This is presentation/state preference data and is separate from the main
backend database.

------------------------------------------------------------------------

# 49. Production PM2 Architecture

Current PM2 processes include:

  PM2 name               Purpose                        Port
  ---------------------- ---------------------------- ------
  `exord-hrm`            HRM frontend/static server     3000
  `exord-probe`          HRM API/probe/email server     8081
  `exord-attendance-*`   Attendance-related service     3002
  `exord-file-server`    File service                   8080
  `exord-backup-api`     Backup API                     3001
  `vault`                Separate application           6969

The exact PM2 process IDs are not stable and must not be hardcoded into
documentation/scripts.

The deployment script identifies the HRM API by its:

``` text
pm_cwd
/home/exord/HRM-Project-for-exord

pm_exec_path
/home/exord/HRM-Project-for-exord/server.js
```

This is preferable to relying on a fixed numeric PM2 ID.

------------------------------------------------------------------------

# 50. The `vault` Application

`vault` is separate.

Production path:

``` text
/home/exord/vault
```

PM2:

``` text
vault
```

It is **not part of the HRM repository**.

The automatic HRM deployment does not:

``` text
git reset vault
npm install vault
build vault
restart vault
```

This separation is intentional.

------------------------------------------------------------------------

# 51. Nginx

Nginx is the public entry point.

It handles:

-   HTTP/HTTPS
-   TLS
-   domain routing
-   reverse proxying
-   path routing

Production hostname:

``` text
admin.exord.net
```

The active certificate is:

``` text
/etc/letsencrypt/live/admin.exord.net/fullchain.pem
/etc/letsencrypt/live/admin.exord.net/privkey.pem
```

The previous DuckDNS certificate was removed.

------------------------------------------------------------------------

# 52. TLS

The public site uses HTTPS:

``` text
https://admin.exord.net
```

Nginx terminates TLS and forwards requests to localhost services.

Internal services do not need to expose their ports publicly when Nginx
can proxy them.

------------------------------------------------------------------------

# 53. Production Ports

    Port Service
  ------ -------------------
    3000 HRM frontend
    3001 Backup API
    3002 Attendance mirror
    8080 File server
    8081 HRM API/probe
    6969 Vault

Most application services are intended to be accessed through Nginx
rather than directly from the Internet.

------------------------------------------------------------------------

# 54. Automatic Deployment

Production deployment is currently **server-side polling**, not GitHub
Actions.

The deployment timer is:

``` text
exord-hrm-deploy.timer
```

It checks GitHub every:

``` text
60 seconds
```

Service:

``` text
exord-hrm-deploy.service
```

Deployment script:

``` text
/usr/local/bin/deploy-exord-hrm
```

Environment:

``` text
/home/exord/.config/exord-hrm/production.env
```

Log:

``` text
/home/exord/.config/exord-hrm/deploy.log
```

------------------------------------------------------------------------

# 55. Automatic Deployment Flow

``` text
Developer
    |
    | git push origin main
    v
GitHub main
    |
    | server checks every 60 seconds
    v
git fetch origin main
    |
    v
compare local HEAD vs origin/main
    |
    +---- same --> do nothing
    |
    +---- different
             |
             v
       git reset --hard origin/main
             |
             v
           npm ci
             |
             v
        npm run build
             |
             +---- failure --> DO NOT restart application
             |
             v
      load production.env
             |
             v
      restart exord-hrm
             |
             v
      restart HRM API
             |
             v
          pm2 save
             |
             v
       health checks
```

------------------------------------------------------------------------

# 56. Deployment Safety

The deployment script uses a lock:

``` text
/run/lock/exord-hrm-deploy.lock
```

This prevents overlapping deployments.

The deployment process also:

1.  Fetches GitHub first.
2.  Detects whether anything changed.
3.  Builds before restarting.
4.  Stops before restart if `npm ci` fails.
5.  Stops before restart if `npm run build` fails.
6.  Checks the frontend after restart.
7.  Checks the HRM API after restart.

------------------------------------------------------------------------

# 57. Deployment Failure Behavior

If this fails:

``` bash
npm ci
```

the running application is not intentionally restarted.

If this fails:

``` bash
npm run build
```

the running application is not intentionally restarted.

This means the existing process continues running while the new version
fails to build.

------------------------------------------------------------------------

# 58. Deployment Commands

Manual deployment can be triggered with:

``` bash
sudo systemctl start exord-hrm-deploy.service
```

Check timer:

``` bash
systemctl status exord-hrm-deploy.timer --no-pager
```

Check deployment service:

``` bash
sudo systemctl status exord-hrm-deploy.service --no-pager -l
```

Check deployment log:

``` bash
tail -100 /home/exord/.config/exord-hrm/deploy.log
```

------------------------------------------------------------------------

# 59. Normal Developer Workflow

Developers should work through Git.

Normal workflow:

``` bash
git clone git@github.com:SyedMdAbuHaider/HRM-Project-for-exord.git
cd HRM-Project-for-exord

npm ci

# develop

npm run build

git add .
git commit -m "Describe change"
git push origin main
```

Production then detects the new `main` commit automatically.

------------------------------------------------------------------------

# 60. Important Git Rules

Do not commit:

``` text
.env
.env.*
private keys
certificates
node_modules
dist
runtime database files
uploads
logs
backup files
```

The repository `.gitignore` is configured to exclude
production-generated and sensitive runtime artifacts.

------------------------------------------------------------------------

# 61. Secret Handling

Secrets must stay outside the Git repository.

Current Resend secret:

``` text
/home/exord/.config/exord-hrm/production.env
```

The repository previously triggered GitHub Push Protection because a
Resend API key existed in an unpublished commit.

That secret was removed from the pushed production history.

The current source uses:

``` text
process.env.RESEND_API_KEY
```

for the local Node service.

------------------------------------------------------------------------

# 62. Important Existing Credential Caveat

Some legacy/application configuration in the codebase still contains
credentials or API keys directly in source, particularly the local
attendance mirror configuration.

For example, `attendance-api.js` currently contains PostgreSQL/API-key
configuration.

This is an existing production design choice and is different from the
Resend secret cleanup.

Long-term, those values should ideally be migrated to runtime
environment variables and rotated.

Do not expose actual credential values in documentation.

------------------------------------------------------------------------

# 63. Build Verification

The current production baseline was successfully built with:

``` bash
npm run build
```

Vite completed successfully.

The build generates:

``` text
dist/
```

The build also reported a non-fatal warning concerning a module that is
both dynamically and statically imported:

``` text
views/RoleCapabilitiesView.tsx
```

This did not prevent production compilation.

------------------------------------------------------------------------

# 64. TypeScript/Lint Status

The command:

``` bash
npm run lint
```

runs:

``` bash
tsc --noEmit
```

The current codebase has TypeScript errors.

The previous verification reported approximately:

``` text
84 TypeScript errors
```

across multiple files.

These errors currently do not prevent:

``` bash
npm run build
```

because Vite's production build is separate from the `tsc --noEmit`
script.

This distinction is important:

``` text
npm run lint
    |
    +--> TypeScript type-check
    +--> currently fails

npm run build
    |
    +--> Vite production build
    +--> currently succeeds
```

Do not treat `npm run build` success as proof that the entire TypeScript
project passes type checking.

------------------------------------------------------------------------

# 65. Runtime Health Checks

## Frontend

``` bash
curl -I http://127.0.0.1:3000/
```

A redirect such as:

``` text
HTTP/1.1 307 Temporary Redirect
```

is currently expected because the application redirects unauthenticated
users toward login.

Public check:

``` bash
curl -I https://admin.exord.net
```

------------------------------------------------------------------------

## HRM API

``` bash
curl http://127.0.0.1:8081/health
```

Expected:

``` json
{"status":"ok"}
```

------------------------------------------------------------------------

## Attendance mirror

``` bash
curl http://127.0.0.1:3002/health
```

This queries PostgreSQL and reports its status and record count.

------------------------------------------------------------------------

# 66. PM2 Troubleshooting

Check all processes:

``` bash
pm2 list
```

Check HRM frontend:

``` bash
pm2 describe exord-hrm
```

Check HRM API:

``` bash
pm2 describe exord-probe
```

Check logs:

``` bash
pm2 logs exord-hrm
```

or:

``` bash
pm2 logs exord-probe
```

Check vault independently:

``` bash
pm2 describe vault
```

Do not restart `vault` when troubleshooting HRM unless the vault
application itself is the subject of the incident.

------------------------------------------------------------------------

# 67. Nginx Troubleshooting

Show complete active configuration:

``` bash
sudo nginx -T
```

Check configuration syntax:

``` bash
sudo nginx -t
```

Reload:

``` bash
sudo systemctl reload nginx
```

Check service:

``` bash
sudo systemctl status nginx --no-pager
```

------------------------------------------------------------------------

# 68. Git Troubleshooting

Check current version:

``` bash
cd /home/exord/HRM-Project-for-exord
git rev-parse HEAD
```

Check remote version:

``` bash
git ls-remote origin refs/heads/main
```

Check working tree:

``` bash
git status
```

Check recent history:

``` bash
git log --oneline --decorate -10
```

------------------------------------------------------------------------

# 69. If GitHub Push Protection Blocks a Push

Do not bypass GitHub Push Protection just because a key is trusted.

Instead:

1.  Identify the secret.
2.  Remove it from the unpublished commit history.
3.  Move the value into runtime configuration.
4.  Verify the staged diff contains no secret.
5.  Push the cleaned history.

For the Resend incident, this was the exact approach.

------------------------------------------------------------------------

# 70. File-by-File Master Map

## Root frontend/application files

``` text
App.tsx
index.tsx
index.html
index.css
store.tsx
types.ts
constants.ts
designationConstants.ts
featureRegistry.ts
themes.ts
layoutSettings.ts
i18n.tsx
supabaseClient.ts
fileService.ts
chatService.ts
utils.ts
```

## Build/configuration

``` text
package.json
package-lock.json
vite.config.ts
tailwind.config.js
postcss.config.js
tsconfig.json / TypeScript configuration files if present
```

## Runtime/backend

``` text
server.js
attendance-api.js
static-server.js
probeRoutes.js
```

## Frontend reusable components

``` text
components/
```

## Major application screens

``` text
views/
```

## Attendance utilities

``` text
utils/attendanceQueue.ts
utils/useAttendanceSync.ts
```

## Supabase functions

``` text
supabase/functions/
```

## Public assets

``` text
public/
```

## Generated build

``` text
dist/
```

`dist/` should be generated by Vite and should not be treated as source
code.

------------------------------------------------------------------------

# 71. Responsibility Matrix

  -----------------------------------------------------------------------
  Area                                Primary files
  ----------------------------------- -----------------------------------
  Application shell                   `App.tsx`

  Global state                        `store.tsx`

  Types                               `types.ts`

  Feature permissions                 `featureRegistry.ts`

  UI constants                        `constants.ts`

  Authentication integration          `store.tsx`, `supabaseClient.ts`

  Employee management                 `WorkforceView.tsx`

  Employee portal                     `EmployeePortal.tsx`

  Attendance UI                       `AttendanceView.tsx`

  Attendance queue                    `attendanceQueue.ts`

  Attendance synchronization          `useAttendanceSync.ts`

  Attendance PostgreSQL mirror        `attendance-api.js`

  Payroll UI                          `PayrollView.tsx`

  Leave UI                            `LeavesView.tsx`,
                                      `LeavePolicyView.tsx`

  Request workflows                   `RequestsHub.tsx`

  Approval workflows                  `ApprovalFlowView.tsx`,
                                      `UnitApprovalConfigView.tsx`

  Duty roster                         `RosterView.tsx`

  Duty replacement                    `DutyReplacementView.tsx`

  Schedule changes                    `ScheduleChangeView.tsx`

  Chat                                `chatService.ts`, `ChatView.tsx`,
                                      `MessageBubble.tsx`

  File upload UI                      `FileUploadButton.tsx`,
                                      `fileService.ts`

  File backend                        production file-server service

  Email API                           `server.js`

  Broadcast email                     `server.js`, `send-broadcast-email`

  Salary email                        `server.js`,
                                      `send-salary-slip-email`

  Permissions UI                      `PermissionsView.tsx`

  Custom roles                        `CustomRolesView.tsx`

  Role capabilities                   `RoleCapabilitiesView.tsx`

  Security logs                       `SecurityLogs.tsx`

  Activity/audit                      `ActivityLog.tsx`

  Live tracking                       `LiveTracking.tsx`

  Infrastructure                      `InfrastructureView.tsx`

  Assets                              `AssetView.tsx`

  System settings                     `SystemSettingsView.tsx`

  Designations                        `DesignationAdminView.tsx`

  Promotion tracks                    designation/promotion
                                      components/views

  Themes                              `themes.ts`, `ThemePicker.tsx`

  Layout                              `layoutSettings.ts`,
                                      `LayoutPicker.tsx`

  Language                            `i18n.tsx`

  SPA server                          `static-server.js`

  Frontend build                      Vite

  Process management                  PM2

  Public reverse proxy                Nginx

  Automatic deployment                systemd timer + deployment script
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 72. What Happens When a User Opens the Site

``` text
1. User opens:
   https://admin.exord.net

2. DNS resolves the domain to the production server.

3. Nginx receives HTTPS traffic.

4. Nginx forwards `/` to:
   127.0.0.1:3000

5. static-server.js serves:
   dist/index.html

6. Browser downloads Vite-generated JS/CSS.

7. React starts through:
   index.tsx

8. App.tsx loads.

9. HRMProvider/store state initializes.

10. Authentication/user state is evaluated.

11. Current role is determined.

12. Feature permissions are evaluated.

13. Navigation is rendered.

14. Requested dashboard/portal/view loads.

15. Data is retrieved through the appropriate backend/Supabase path.

16. User interacts with the HRM system.
```

------------------------------------------------------------------------

# 73. What Happens During Attendance

Simplified flow:

``` text
Employee
   |
   v
AttendanceView
   |
   v
attendance synchronization logic
   |
   +---- online
   |       |
   |       v
   |   primary backend
   |
   +---- mirror
   |       |
   |       v
   |   127.0.0.1:3002
   |       |
   |       v
   |   PostgreSQL
   |
   +---- offline
           |
           v
       attendanceQueue
           |
           v
       later synchronization
```

------------------------------------------------------------------------

# 74. What Happens During Email Sending

``` text
HR user
   |
   v
Broadcast / Payroll UI
   |
   v
/email/broadcast
or
/email/salary-slip
   |
   v
server.js :8081
   |
   v
RESEND_API_KEY
   |
   v
Resend API
   |
   v
Recipient email
```

------------------------------------------------------------------------

# 75. What Happens During Deployment

``` text
Developer changes source
        |
        v
git commit
        |
        v
git push origin main
        |
        v
GitHub
        |
        | <= 60 seconds
        v
Production timer
        |
        v
git fetch origin main
        |
        v
new commit detected
        |
        v
git reset --hard origin/main
        |
        v
npm ci
        |
        v
npm run build
        |
        v
dist/
        |
        v
PM2 restart exord-hrm
        |
        v
PM2 restart HRM API
        |
        v
health checks
```

------------------------------------------------------------------------

# 76. Important Production Paths

``` text
HRM source:
/home/exord/HRM-Project-for-exord

HRM frontend build:
/home/exord/HRM-Project-for-exord/dist

HRM production environment:
/home/exord/.config/exord-hrm/production.env

Deployment script:
/usr/local/bin/deploy-exord-hrm

Deployment log:
/home/exord/.config/exord-hrm/deploy.log

Deployment service:
/etc/systemd/system/exord-hrm-deploy.service

Deployment timer:
/etc/systemd/system/exord-hrm-deploy.timer

PM2 home:
/home/exord/.pm2

Vault:
/home/exord/vault
```

------------------------------------------------------------------------

# 77. Things That Must NOT Be Deleted

Do not delete these without understanding their role:

``` text
/home/exord/HRM-Project-for-exord
/home/exord/.config/exord-hrm
/usr/local/bin/deploy-exord-hrm
/etc/systemd/system/exord-hrm-deploy.service
/etc/systemd/system/exord-hrm-deploy.timer
```

Do not accidentally remove:

``` text
/home/exord/vault
```

because it is a separate production application.

------------------------------------------------------------------------

# 78. Things Developers Should Normally Edit

For normal HRM development, developers primarily work inside:

``` text
App.tsx
components/
views/
utils/
store.tsx
types.ts
constants.ts
featureRegistry.ts
i18n.tsx
themes.ts
layoutSettings.ts
fileService.ts
chatService.ts
```

Backend work normally involves:

``` text
server.js
attendance-api.js
probeRoutes.js
supabase/functions/
```

Build/configuration changes involve:

``` text
package.json
package-lock.json
vite.config.ts
tailwind.config.js
postcss.config.js
```

------------------------------------------------------------------------

# 79. Files Developers Should Treat Carefully

These are central architecture files:

``` text
App.tsx
store.tsx
types.ts
featureRegistry.ts
supabaseClient.ts
server.js
attendance-api.js
static-server.js
package.json
vite.config.ts
```

A change to one of these can affect many parts of the application.

------------------------------------------------------------------------

# 80. Files That Are Generated

Do not manually edit generated production assets.

``` text
dist/
```

Instead edit source and run:

``` bash
npm run build
```

The deployment system generates `dist/` automatically.

------------------------------------------------------------------------

# 81. Production Recovery

If the application is unhealthy:

``` bash
pm2 list
```

Then:

``` bash
pm2 logs exord-hrm --lines 100
pm2 logs exord-probe --lines 100
```

Check:

``` bash
curl -I http://127.0.0.1:3000/
curl http://127.0.0.1:8081/health
```

Check deployment:

``` bash
systemctl status exord-hrm-deploy.timer --no-pager
tail -100 /home/exord/.config/exord-hrm/deploy.log
```

Check Nginx:

``` bash
sudo nginx -t
sudo systemctl status nginx --no-pager
```

------------------------------------------------------------------------

# 82. Rollback Concept

The Git repository is the source of truth for the HRM application.

To identify a previous production commit:

``` bash
cd /home/exord/HRM-Project-for-exord
git log --oneline --decorate -20
```

A rollback should be treated as a deliberate production operation.

Do not blindly run:

``` bash
git reset --hard
```

against an arbitrary commit without first confirming which version is
intended.

The automated deployment intentionally follows:

``` text
origin/main
```

so a rollback performed through Git should ultimately be represented by
the desired `main` state.

------------------------------------------------------------------------

# 83. Current Production Status

At the time this document was created:

``` text
Domain:
admin.exord.net

Frontend:
ONLINE

HRM API:
ONLINE

Attendance service:
ONLINE

File server:
ONLINE

Backup API:
ONLINE

Vault:
ONLINE

Automatic deployment:
ENABLED

Deployment interval:
60 seconds

Git branch:
main

Production commit:
8632ee59a5d8a221418bdf0b40cf6a2b2392bba7

Frontend health:
HTTP 307 -> /login

HRM API health:
{"status":"ok"}
```

------------------------------------------------------------------------

# 84. One-Sentence Architecture Summary

> Exord Online HRM is a React/Vite SPA backed by centralized HRM state,
> Supabase and several local Node services, exposed through Nginx and
> supervised by PM2, with attendance mirrored to PostgreSQL and HRM
> source automatically deployed from GitHub `main` by a server-side
> systemd timer.

------------------------------------------------------------------------

# 85. Operational Golden Rules

1.  **GitHub `main` is the HRM source of truth.**
2.  **Production source lives at `/home/exord/HRM-Project-for-exord`.**
3.  **`dist/` is generated; do not edit it manually.**
4.  **`exord-hrm` is the frontend PM2 process.**
5.  **`exord-probe` is the HRM API/probe/email process.**
6.  **Attendance mirror runs separately on port 3002.**
7.  **Nginx is the public reverse proxy.**
8.  **PM2 manages runtime processes.**
9.  **The deployment timer checks GitHub every 60 seconds.**
10. **A failed build should not intentionally replace the running
    application.**
11. **Resend credentials stay outside Git.**
12. **Never put production secrets into frontend source.**
13. **`vault` is a separate application.**
14. **Do not include `vault` in HRM deployment operations.**
15. **Use `npm run build` to verify production compilation.**
16. **Use `npm run lint` separately for TypeScript checking.**
17. **Check PM2, Nginx, deployment logs, and health endpoints before
    assuming an outage.**

------------------------------------------------------------------------

# 86. Quick Command Reference

## Update source manually

``` bash
cd /home/exord/HRM-Project-for-exord
git fetch origin main
git status
git log --oneline -10
```

## Build

``` bash
npm ci
npm run build
```

## PM2

``` bash
pm2 list
pm2 describe exord-hrm
pm2 logs exord-hrm
pm2 logs exord-probe
```

## Health

``` bash
curl -I http://127.0.0.1:3000/
curl http://127.0.0.1:8081/health
curl http://127.0.0.1:3002/health
```

## Deployment

``` bash
sudo systemctl start exord-hrm-deploy.service
systemctl status exord-hrm-deploy.timer --no-pager
tail -100 /home/exord/.config/exord-hrm/deploy.log
```

## Nginx

``` bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager
```

## Git

``` bash
git status
git branch --show-current
git rev-parse HEAD
git ls-remote origin refs/heads/main
git log --oneline --decorate -20
```

------------------------------------------------------------------------

# 87. Final Architecture Diagram

``` text
                                      ┌──────────────────────┐
                                      │      DEVELOPERS      │
                                      │                      │
                                      │ git commit           │
                                      │ git push origin main │
                                      └──────────┬───────────┘
                                                 │
                                                 v
                                      ┌──────────────────────┐
                                      │       GITHUB         │
                                      │      main branch     │
                                      └──────────┬───────────┘
                                                 │
                                      every <= 60 seconds
                                                 │
                                                 v
                                      ┌──────────────────────┐
                                      │ SYSTEMD DEPLOY TIMER │
                                      └──────────┬───────────┘
                                                 │
                                                 v
                                      ┌──────────────────────┐
                                      │ deploy-exord-hrm     │
                                      │                      │
                                      │ fetch                │
                                      │ reset                │
                                      │ npm ci               │
                                      │ npm build            │
                                      │ PM2 restart          │
                                      │ health check         │
                                      └──────────┬───────────┘
                                                 │
                                                 v
                         ┌────────────────────────────────────────┐
                         │              PRODUCTION                │
                         │                                        │
                         │  NGINX / HTTPS                         │
                         │       │                                │
                         │       ├── :3000 → HRM frontend         │
                         │       ├── :8081 → HRM API/probe        │
                         │       ├── :3002 → attendance mirror    │
                         │       ├── :8080 → file server          │
                         │       └── :3001 → backup API           │
                         │                                        │
                         │  PM2                                   │
                         │       │                                │
                         │       ├── exord-hrm                    │
                         │       ├── exord-probe                  │
                         │       ├── attendance service            │
                         │       ├── file server                   │
                         │       ├── backup API                    │
                         │       └── vault (SEPARATE)              │
                         └────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 88. Document Maintenance

This document describes the production architecture represented by the
HRM repository and server configuration at the documented baseline.

When architecture changes, update this document along with the relevant
source/configuration change.

At minimum update:

``` text
Production commit
New/removed services
New frontend views
New backend APIs
New Nginx routes
New PM2 processes
New environment variables
New deployment behavior
Database changes
Authentication changes
Permission/role changes
```

**End of document.**
