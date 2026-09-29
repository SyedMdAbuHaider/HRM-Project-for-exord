/**
 * i18n.ts — Exord Online HRM Bilingual System
 * English (en) + Bengali (bn)
 *
 * Usage:
 *   const { t, lang, setLang } = useLanguage();
 *   <p>{t('check_in')}</p>
 *
 * Per-user language: use saveUserLang / loadUserLang helpers in App.tsx
 * Add new keys at the bottom of each section.
 * Bengali uses Unicode — no font import needed (system fonts cover it).
 */

export type Lang = 'en' | 'bn';

export type TranslationKey = keyof typeof TRANSLATIONS;

// ─────────────────────────────────────────────────────────────────────────────
// Per-user language persistence helpers
// ─────────────────────────────────────────────────────────────────────────────
const USER_LANG_KEY = (uid: string) => `exord-lang-${uid}`;

/** Save this user's preferred language to localStorage */
export const saveUserLang = (uid: string, l: Lang): void => {
  try { localStorage.setItem(USER_LANG_KEY(uid), l); } catch {}
};

/** Load this user's preferred language (returns null if not set yet) */
export const loadUserLang = (uid: string): Lang | null => {
  try { return localStorage.getItem(USER_LANG_KEY(uid)) as Lang | null; } catch { return null; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Greeting helpers
// ─────────────────────────────────────────────────────────────────────────────
export type GreetingPeriod = 'good_morning' | 'good_afternoon' | 'good_evening' | 'good_night';

/** Returns which greeting key matches current time */
export const getGreetingKey = (): GreetingPeriod => {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'good_morning';
  if (h >= 12 && h < 17) return 'good_afternoon';
  if (h >= 17 && h < 21) return 'good_evening';
  return 'good_night';
};

/** Emoji for current time period */
export const getGreetingEmoji = (): string => {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return '🌅';
  if (h >= 12 && h < 17) return '☀️';
  if (h >= 17 && h < 21) return '🌇';
  return '🌙';
};

/** Get the user's first name */
export const getFirstName = (fullName: string): string =>
  fullName.trim().split(' ')[0] || fullName;

// ─────────────────────────────────────────────────────────────────────────────
// Translation table
// ─────────────────────────────────────────────────────────────────────────────
export const TRANSLATIONS = {

  // ── Branding ───────────────────────────────────────────────────────────────
  app_name:                { en: 'Exord Online', bn: 'এক্সর্ড অনলাইন' },
  app_tagline:             { en: 'Extraordinary Internet Experience...', bn: 'অসাধারণ ইন্টারনেট অভিজ্ঞতা...' },
  synchronizing:           { en: 'Synchronizing node...', bn: 'সংযোগ স্থাপন হচ্ছে...' },

  // ── Auth ───────────────────────────────────────────────────────────────────
  welcome_back:            { en: 'Welcome Back', bn: 'স্বাগতম' },
  sign_in_desc:            { en: 'Sign in with your Employee ID or email address.', bn: 'আপনার কর্মী আইডি বা ইমেইল দিয়ে লগইন করুন।' },
  employee_id_or_email:    { en: 'EXXXX or Email', bn: 'কর্মী আইডি বা ইমেইল' },
  access_password:         { en: 'Access Password', bn: 'পাসওয়ার্ড' },
  access_node:             { en: 'Access Node', bn: 'প্রবেশ করুন' },
  access_denied:           { en: 'Access Denied. Invalid credentials.', bn: 'প্রবেশ অস্বীকৃত। ভুল তথ্য।' },
  security_protocol_update:{ en: 'Security Protocol Update', bn: 'নিরাপত্তা আপডেট' },
  initial_access_detected: { en: 'Initial node access detected. You must update your credentials to proceed.', bn: 'প্রথম লগইন শনাক্ত হয়েছে। এগিয়ে যেতে পাসওয়ার্ড পরিবর্তন করুন।' },
  new_password:            { en: 'New Password', bn: 'নতুন পাসওয়ার্ড' },
  confirm_password:        { en: 'Confirm Password', bn: 'পাসওয়ার্ড নিশ্চিত করুন' },
  min_8_chars:             { en: 'Min 8 characters', bn: 'কমপক্ষে ৮ অক্ষর' },
  repeat_password:         { en: 'Repeat password', bn: 'পাসওয়ার্ড পুনরায় লিখুন' },
  commit_credentials:      { en: 'Commit Credentials', bn: 'পাসওয়ার্ড সংরক্ষণ করুন' },
  terminate_session:       { en: 'Terminate Session', bn: 'সেশন বাতিল করুন' },
  sign_out:                { en: 'Sign Out', bn: 'লগআউট' },
  exit_session:            { en: 'Exit Session', bn: 'সেশন শেষ করুন' },
  change_password:         { en: 'Change Password', bn: 'পাসওয়ার্ড পরিবর্তন' },
  change_email:            { en: 'Change Email', bn: 'ইমেইল পরিবর্তন' },
  customise_theme:         { en: 'Customise Theme', bn: 'থিম পরিবর্তন' },
  layout_style:            { en: 'Layout Style', bn: 'লেআউট স্টাইল' },

  // ── Greetings ──────────────────────────────────────────────────────────────
  good_morning:            { en: 'Good Morning',   bn: 'শুভ সকাল' },
  good_afternoon:          { en: 'Good Afternoon', bn: 'শুভ অপরাহ্ন' },
  good_evening:            { en: 'Good Evening',   bn: 'শুভ সন্ধ্যা' },
  good_night:              { en: 'Good Night',     bn: 'শুভ রাত্রি' },

  // Role-based motivational sub-messages shown in the welcome banner
  wish_developer:          {
    en: 'The system is in your hands. Build something great today.',
    bn: 'সিস্টেম আপনার হাতে। আজ কিছু দুর্দান্ত তৈরি করুন।',
  },
  wish_admin:              {
    en: 'A strong team is built one decision at a time. Lead well.',
    bn: 'একটি শক্তিশালী দল গড়া হয় একটি একটি সিদ্ধান্তে। সুন্দরভাবে নেতৃত্ব দিন।',
  },
  wish_co_admin:           {
    en: 'Your support keeps the engine running. Have a productive day.',
    bn: 'আপনার সহায়তায় দল এগিয়ে যায়। উৎপাদনশীল দিন হোক।',
  },
  wish_hr:                 {
    en: 'People are the heart of every organisation. Thank you for yours.',
    bn: 'মানুষই প্রতিটি প্রতিষ্ঠানের হৃদয়। আপনার অবদানের জন্য ধন্যবাদ।',
  },
  wish_manager:            {
    en: 'Your team looks up to you. Make today count.',
    bn: 'আপনার দল আপনার দিকে তাকিয়ে আছে। আজকের দিনটি সার্থক করুন।',
  },
  wish_employee:           {
    en: 'Every great day starts with showing up. Welcome!',
    bn: 'প্রতিটি সুন্দর দিন শুরু হয় উপস্থিতি দিয়ে। স্বাগতম!',
  },

  // ── Language preference ────────────────────────────────────────────────────
  preferred_language:      { en: 'Preferred Language', bn: 'পছন্দের ভাষা' },
  language_saved:          { en: 'Language saved', bn: 'ভাষা সংরক্ষিত' },
  set_language:            { en: 'App Language', bn: 'অ্যাপের ভাষা' },

  // ── Navigation labels ──────────────────────────────────────────────────────
  control_center:          { en: 'Control Center', bn: 'নিয়ন্ত্রণ কেন্দ্র' },
  workforce_hub:           { en: 'Workforce Hub', bn: 'কর্মী কেন্দ্র' },
  infrastructure:          { en: 'Infrastructure', bn: 'অবকাঠামো' },
  shift_logs:              { en: 'Shift Logs', bn: 'শিফট লগ' },
  team_portal:             { en: 'Team Portal', bn: 'টিম পোর্টাল' },
  messages:                { en: 'Messages', bn: 'বার্তা' },
  field_mapping:           { en: 'Field Mapping', bn: 'ফিল্ড ম্যাপিং' },
  remuneration:            { en: 'Remuneration', bn: 'বেতন' },
  request_vault:           { en: 'Request Vault', bn: 'অনুরোধ ভল্ট' },
  requests_hub:            { en: 'Requests Hub', bn: 'অনুরোধ কেন্দ্র' },
  leave_policies:          { en: 'Leave Policies', bn: 'ছুটির নীতি' },
  security_protocols:      { en: 'Security Protocols', bn: 'নিরাপত্তা প্রোটোকল' },
  activity_log:            { en: 'Activity Log', bn: 'কার্যক্রম লগ' },
  asset_manager:           { en: 'Asset Manager', bn: 'সম্পদ ব্যবস্থাপক' },
  permissions:             { en: 'Permissions', bn: 'অনুমতি' },
  broadcast:               { en: 'Broadcast', bn: 'সম্প্রচার' },
  approval_flow:           { en: 'Approval Flow', bn: 'অনুমোদন প্রবাহ' },
  unit_approval_config:    { en: 'Unit Approval Config', bn: 'ইউনিট অনুমোদন কনফিগ' },
  role_capabilities:       { en: 'Role Capabilities', bn: 'ভূমিকার সক্ষমতা' },
  system_settings:         { en: 'System Settings', bn: 'সিস্টেম সেটিংস' },
  duty_replacement:        { en: 'Duty Replacement', bn: 'ডিউটি প্রতিস্থাপন' },
  schedule_change:         { en: 'Schedule Change', bn: 'সময়সূচি পরিবর্তন' },
  custom_roles:            { en: 'Custom Roles', bn: 'কাস্টম রোল' },
  overview:                { en: 'Overview', bn: 'সংক্ষিপ্ত বিবরণ' },
  personnel_directory:     { en: 'Personnel Directory', bn: 'কর্মী তালিকা' },
  leave_approvals:         { en: 'Leave Approvals', bn: 'ছুটির অনুমোদন' },
  service_portal:          { en: 'Service Portal', bn: 'সেবা পোর্টাল' },
  biometric_clock:         { en: 'Biometric Clock', bn: 'বায়োমেট্রিক ক্লক' },
  pay_stubs:               { en: 'Pay Stubs', bn: 'বেতন স্লিপ' },
  leave_center:            { en: 'Leave Center', bn: 'ছুটি কেন্দ্র' },
  secure_core:             { en: 'Secure Core', bn: 'নিরাপদ কোর' },

  // ── Dashboard ──────────────────────────────────────────────────────────────
  network_command:         { en: 'Network Command', bn: 'নেটওয়ার্ক কমান্ড' },
  real_time_sync:          { en: 'Real-time workforce synchronization.', bn: 'রিয়েল-টাইম কর্মী সমন্বয়।' },
  operational_node_active: { en: 'Operational Node Active', bn: 'অপারেশনাল নোড সক্রিয়' },
  total_workforce:         { en: 'Total Workforce', bn: 'মোট কর্মী' },
  present_today:           { en: 'present today', bn: 'আজ উপস্থিত' },
  duty_velocity:           { en: 'Duty Velocity', bn: 'ডিউটি গতি' },
  checked_in_today:        { en: 'checked in today', bn: 'আজ চেক-ইন করেছেন' },
  monthly_payroll:         { en: 'Monthly Payroll', bn: 'মাসিক বেতন' },
  total_disbursed:         { en: 'total disbursed', bn: 'মোট বিতরণ' },
  protocol_alerts:         { en: 'Protocol Alerts', bn: 'প্রোটোকল সতর্কতা' },
  seven_day_trend:         { en: '7-Day Check-In Trend', bn: '৭ দিনের চেক-ইন প্রবণতা' },
  unique_employees:        { en: 'Unique employees checked in per day', bn: 'প্রতিদিন অনন্য কর্মীর চেক-ইন' },
  todays_events:           { en: "Today's Events", bn: 'আজকের ঘটনা' },
  no_events_today:         { en: 'No events yet today.', bn: 'আজ এখনো কোনো ঘটনা নেই।' },
  total_today:             { en: 'Total today', bn: 'আজ মোট' },
  events:                  { en: 'events', bn: 'ঘটনা' },
  live:                    { en: 'Live', bn: 'সরাসরি' },

  // ── Attendance / Portal ────────────────────────────────────────────────────
  check_in:                { en: 'Check In', bn: 'চেক-ইন' },
  check_out:               { en: 'Check Out', bn: 'চেক-আউট' },
  start_session:           { en: 'Start Session', bn: 'সেশন শুরু' },
  end_session:             { en: 'End Session', bn: 'সেশন শেষ' },
  break_start:             { en: 'Break', bn: 'বিরতি' },
  break_end:               { en: 'Resume', bn: 'পুনরায় শুরু' },
  start_break:             { en: 'Start Break', bn: 'বিরতি শুরু' },
  end_break:               { en: 'End Break', bn: 'বিরতি শেষ' },
  on_break:                { en: 'On Break', bn: 'বিরতিতে' },
  active_session:          { en: 'Active Session', bn: 'সক্রিয় সেশন' },
  not_clocked_in:          { en: 'Not Clocked In', bn: 'চেক-ইন হয়নি' },
  session_complete:        { en: 'Session complete for today. See you tomorrow!', bn: 'আজকের সেশন সম্পন্ন। আগামীকাল দেখা হবে!' },
  session_active:          { en: 'Session active. Take a break or check out anytime.', bn: 'সেশন সক্রিয়। যেকোনো সময় বিরতি নিন বা চেক-আউট করুন।' },
  enjoy_break:             { en: 'Enjoy your break. Resume when ready.', bn: 'বিরতি উপভোগ করুন। প্রস্তুত হলে ফিরে আসুন।' },
  check_in_to_start:       { en: 'Check in to start your session.', bn: 'সেশন শুরু করতে চেক-ইন করুন।' },
  gps_transmitting:        { en: 'GPS Transmitting', bn: 'জিপিএস সক্রিয়' },
  gps_standby:             { en: 'GPS Standby', bn: 'জিপিএস অপেক্ষায়' },
  network_simulation:      { en: 'Network Simulation', bn: 'নেটওয়ার্ক সিমুলেশন' },
  unit_wifi:               { en: 'Unit WiFi', bn: 'ইউনিট ওয়াইফাই' },
  public_4g:               { en: 'Public 4G', bn: 'পাবলিক ৪জি' },
  this_month:              { en: 'This Month', bn: 'এই মাস' },
  today:                   { en: 'Today', bn: 'আজ' },
  weekend:                 { en: 'Weekend', bn: 'সাপ্তাহিক ছুটি' },
  attendance:              { en: 'Attendance', bn: 'উপস্থিতি' },

  // ── Team status ────────────────────────────────────────────────────────────
  live_workforce:          { en: 'Live Workforce — Today', bn: 'লাইভ কর্মী — আজ' },
  active:                  { en: 'Active', bn: 'সক্রিয়' },
  absent:                  { en: 'Absent', bn: 'অনুপস্থিত' },
  on_leave:                { en: 'On Leave', bn: 'ছুটিতে' },
  checked_out:             { en: 'Done', bn: 'সম্পন্ন' },
  no_employees:            { en: 'No employees found.', bn: 'কোনো কর্মী পাওয়া যায়নি।' },

  // ── Requests Hub ───────────────────────────────────────────────────────────
  requests_hub_title:      { en: 'Requests Hub', bn: 'অনুরোধ কেন্দ্র' },
  requests_hub_desc:       { en: 'All requests, approvals and workflows in one place.', bn: 'সকল অনুরোধ, অনুমোদন এবং কার্যপ্রবাহ এক জায়গায়।' },
  pending_your_action:     { en: 'pending your action', bn: 'আপনার পদক্ষেপ প্রয়োজন' },
  leave:                   { en: 'Leave', bn: 'ছুটি' },
  loan_advance:            { en: 'Loan & Advance', bn: 'ঋণ ও অগ্রিম' },
  duty_swap:               { en: 'Duty Swap', bn: 'ডিউটি অদলবদল' },
  new_leave_request:       { en: 'New Leave Request', bn: 'নতুন ছুটির আবেদন' },
  request_change:          { en: 'Request Change', bn: 'পরিবর্তনের আবেদন' },
  request_duty_swap:       { en: 'Request Duty Swap', bn: 'ডিউটি অদলবদলের আবেদন' },
  apply_loan_advance:      { en: 'Apply for Loan / Advance', bn: 'ঋণ / অগ্রিমের জন্য আবেদন' },
  awaiting_approval:       { en: 'awaiting your approval', bn: 'আপনার অনুমোদনের অপেক্ষায়' },
  your_turn:               { en: 'Your turn', bn: 'আপনার পালা' },
  approve:                 { en: 'Approve', bn: 'অনুমোদন' },
  reject:                  { en: 'Reject', bn: 'প্রত্যাখ্যান' },
  reject_leave:            { en: 'Reject Leave?', bn: 'ছুটি প্রত্যাখ্যান করবেন?' },
  confirm_reject:          { en: 'Confirm', bn: 'নিশ্চিত করুন' },
  rejection_reason:        { en: 'Reason (optional)', bn: 'কারণ (ঐচ্ছিক)' },
  no_requests_found:       { en: 'No requests found.', bn: 'কোনো আবেদন পাওয়া যায়নি।' },
  swap_with:               { en: 'Swap With', bn: 'অদলবদল করুন' },
  select_colleague:        { en: 'Select colleague...', bn: 'সহকর্মী নির্বাচন করুন...' },
  my_new_shift:            { en: 'My New Shift', bn: 'আমার নতুন শিফট' },
  their_new_shift:         { en: 'Their New Shift', bn: 'তাদের নতুন শিফট' },

  // ── Leave ──────────────────────────────────────────────────────────────────
  leave_type:              { en: 'Leave Type', bn: 'ছুটির ধরন' },
  start_date:              { en: 'Start Date', bn: 'শুরুর তারিখ' },
  end_date:                { en: 'End Date', bn: 'শেষের তারিখ' },
  reason:                  { en: 'Reason', bn: 'কারণ' },
  describe_reason:         { en: 'Describe your reason...', bn: 'আপনার কারণ বর্ণনা করুন...' },
  submit_request:          { en: 'Submit Request', bn: 'আবেদন জমা দিন' },
  pending:                 { en: 'Pending', bn: 'অপেক্ষামাণ' },
  approved:                { en: 'Approved', bn: 'অনুমোদিত' },
  rejected:                { en: 'Rejected', bn: 'প্রত্যাখ্যাত' },
  mgr_approved:            { en: 'Mgr Approved', bn: 'ম্যানেজার অনুমোদিত' },
  hr_approved:             { en: 'HR Approved', bn: 'এইচআর অনুমোদিত' },
  co_admin_approved:       { en: 'Co-Admin Approved', bn: 'কো-অ্যাডমিন অনুমোদিত' },
  approval_progress:       { en: 'Approval Progress', bn: 'অনুমোদনের অগ্রগতি' },
  rejected_by:             { en: 'Rejected by', bn: 'প্রত্যাখ্যাত করেছেন' },
  filter_all:              { en: 'All', bn: 'সব' },

  // ── Payroll ────────────────────────────────────────────────────────────────
  salary:                  { en: 'Salary', bn: 'বেতন' },
  payslip:                 { en: 'Payslip', bn: 'বেতন স্লিপ' },
  base_salary:             { en: 'Base Salary', bn: 'মূল বেতন' },
  base:                    { en: 'Base', bn: 'মূল' },
  bonus:                   { en: 'Bonus', bn: 'বোনাস' },
  deductions:              { en: 'Deductions', bn: 'কর্তন' },
  net_payable:             { en: 'Net Payable', bn: 'নিট প্রদেয়' },
  total_deductions:        { en: 'Total Deductions', bn: 'মোট কর্তন' },
  total_disbursement:      { en: 'Total Net Disbursement', bn: 'মোট নিট বিতরণ' },
  paid:                    { en: 'Paid', bn: 'পরিশোধিত' },
  unpaid:                  { en: 'Unpaid', bn: 'অপরিশোধিত' },
  paid_records:            { en: 'Paid Records', bn: 'পরিশোধিত রেকর্ড' },
  pending_payment:         { en: 'Pending Payment', bn: 'পেমেন্ট বাকি' },
  discuss_with_hr:         { en: 'Discuss with HR', bn: 'এইচআর-এর সাথে আলোচনা' },
  no_salary_records:       { en: 'No salary records yet', bn: 'এখনো কোনো বেতন রেকর্ড নেই' },
  advance_salary:          { en: 'Advance Salary', bn: 'অগ্রিম বেতন' },
  company_loan:            { en: 'Company Loan', bn: 'কোম্পানি ঋণ' },
  loan:                    { en: 'Loan', bn: 'ঋণ' },
  amount:                  { en: 'Amount', bn: 'পরিমাণ' },
  loan_amount:             { en: 'Loan Amount (৳)', bn: 'ঋণের পরিমাণ (৳)' },
  purpose:                 { en: 'Purpose', bn: 'উদ্দেশ্য' },
  not_eligible:            { en: 'Not yet eligible', bn: 'এখনো যোগ্য নন' },
  months_needed:           { en: 'more month(s) needed.', bn: 'মাস আরো প্রয়োজন।' },
  salary_slip:             { en: 'SALARY SLIP', bn: 'বেতন স্লিপ' },
  pay_period:              { en: 'Pay Period', bn: 'বেতন সময়কাল' },
  payment_status:          { en: 'Payment Status', bn: 'পেমেন্ট অবস্থা' },

  // ── Employee fields ────────────────────────────────────────────────────────
  employee_id:             { en: 'Employee ID', bn: 'কর্মী আইডি' },
  full_name:               { en: 'Full Name', bn: 'পূর্ণ নাম' },
  email:                   { en: 'Email', bn: 'ইমেইল' },
  department:              { en: 'Department', bn: 'বিভাগ' },
  role:                    { en: 'Role', bn: 'ভূমিকা' },
  phone_official:          { en: 'Phone (Official)', bn: 'ফোন (অফিশিয়াল)' },
  phone_personal:          { en: 'Phone (Personal)', bn: 'ফোন (ব্যক্তিগত)' },
  alternative_number:      { en: 'Alternative Number', bn: 'বিকল্প নম্বর' },
  present_address:         { en: 'Present Address', bn: 'বর্তমান ঠিকানা' },
  permanent_address:       { en: 'Permanent Address', bn: 'স্থায়ী ঠিকানা' },
  emergency_contact:       { en: 'Emergency Contact', bn: 'জরুরি যোগাযোগ' },
  join_date:               { en: 'Join Date', bn: 'যোগদানের তারিখ' },
  gender:                  { en: 'Gender', bn: 'লিঙ্গ' },
  blood_group:             { en: 'Blood Group', bn: 'রক্তের গ্রুপ' },
  date_of_birth:           { en: 'Date of Birth', bn: 'জন্ম তারিখ' },
  nationality:             { en: 'Nationality', bn: 'জাতীয়তা' },
  religion:                { en: 'Religion', bn: 'ধর্ম' },
  marital_status:          { en: 'Marital Status', bn: 'বৈবাহিক অবস্থা' },
  father_name:             { en: 'Father Name', bn: 'পিতার নাম' },
  mother_name:             { en: 'Mother Name', bn: 'মাতার নাম' },
  nid:                     { en: 'NID', bn: 'জাতীয় পরিচয়পত্র' },

  // ── Profile ────────────────────────────────────────────────────────────────
  my_profile:              { en: 'My Profile', bn: 'আমার প্রোফাইল' },
  request_profile_changes: { en: 'Request Profile Changes', bn: 'প্রোফাইল পরিবর্তনের আবেদন' },
  request_changes:         { en: 'Request Changes', bn: 'পরিবর্তনের আবেদন' },
  current_information:     { en: 'Your Current Information', bn: 'আপনার বর্তমান তথ্য' },
  profile_edit_note:       { en: 'You cannot edit your profile directly. Submit a change request — HR will review and apply the updates.', bn: 'আপনি সরাসরি প্রোফাইল সম্পাদনা করতে পারবেন না। পরিবর্তনের আবেদন জমা দিন — এইচআর পর্যালোচনা করে আপডেট করবেন।' },
  reason_for_change:       { en: 'Reason for Change', bn: 'পরিবর্তনের কারণ' },
  no_changes_detected:     { en: 'No changes detected.', bn: 'কোনো পরিবর্তন পাওয়া যায়নি।' },
  my_previous_requests:    { en: 'My Previous Requests', bn: 'আমার পূর্ববর্তী আবেদন' },

  // ── Common actions ─────────────────────────────────────────────────────────
  submit:                  { en: 'Submit', bn: 'জমা দিন' },
  cancel:                  { en: 'Cancel', bn: 'বাতিল' },
  save:                    { en: 'Save', bn: 'সংরক্ষণ' },
  save_changes:            { en: 'Save Changes', bn: 'পরিবর্তন সংরক্ষণ' },
  delete:                  { en: 'Delete', bn: 'মুছুন' },
  edit:                    { en: 'Edit', bn: 'সম্পাদনা' },
  add:                     { en: 'Add', bn: 'যোগ করুন' },
  search:                  { en: 'Search', bn: 'অনুসন্ধান' },
  filter:                  { en: 'Filter', bn: 'ফিল্টার' },
  refresh:                 { en: 'Refresh', bn: 'রিফ্রেশ' },
  close:                   { en: 'Close', bn: 'বন্ধ করুন' },
  confirm:                 { en: 'Confirm', bn: 'নিশ্চিত' },
  back:                    { en: 'Back', bn: 'পিছনে' },
  next:                    { en: 'Next', bn: 'পরবর্তী' },
  done:                    { en: 'Done', bn: 'সম্পন্ন' },
  update:                  { en: 'Update', bn: 'আপডেট' },
  print:                   { en: 'Print', bn: 'প্রিন্ট' },
  submitting:              { en: 'Submitting...', bn: 'জমা দেওয়া হচ্ছে...' },
  saving:                  { en: 'Saving...', bn: 'সংরক্ষণ হচ্ছে...' },
  loading:                 { en: 'Loading...', bn: 'লোড হচ্ছে...' },
  try_again:               { en: 'Try Again', bn: 'আবার চেষ্টা করুন' },
  mark_all_read:           { en: 'Mark all read', bn: 'সব পঠিত চিহ্নিত করুন' },
  new_request:             { en: 'New Request', bn: 'নতুন আবেদন' },

  // ── Common fields ──────────────────────────────────────────────────────────
  name:                    { en: 'Name', bn: 'নাম' },
  date:                    { en: 'Date', bn: 'তারিখ' },
  status:                  { en: 'Status', bn: 'অবস্থা' },
  type:                    { en: 'Type', bn: 'ধরন' },
  period:                  { en: 'Period', bn: 'সময়কাল' },
  from:                    { en: 'From', bn: 'থেকে' },
  to:                      { en: 'To', bn: 'পর্যন্ত' },
  description:             { en: 'Description', bn: 'বিবরণ' },
  notes:                   { en: 'Notes', bn: 'নোট' },
  total:                   { en: 'Total', bn: 'মোট' },
  records:                 { en: 'records', bn: 'রেকর্ড' },
  id:                      { en: 'ID', bn: 'আইডি' },
  no_data:                 { en: 'No data found.', bn: 'কোনো তথ্য পাওয়া যায়নি।' },
  showing:                 { en: 'Showing', bn: 'দেখাচ্ছে' },
  of:                      { en: 'of', bn: 'এর মধ্যে' },

  // ── Notifications / Inbox ──────────────────────────────────────────────────
  notifications:           { en: 'Notifications', bn: 'বিজ্ঞপ্তি' },
  inbox:                   { en: 'Inbox', bn: 'ইনবক্স' },
  no_notifications:        { en: 'No notifications', bn: 'কোনো বিজ্ঞপ্তি নেই' },
  no_messages:             { en: 'No messages yet', bn: 'এখনো কোনো বার্তা নেই' },
  unread:                  { en: 'unread', bn: 'অপঠিত' },
  tap_to_mark_read:        { en: 'Tap to mark as read', bn: 'পঠিত চিহ্নিত করতে ট্যাপ করুন' },

  // ── Security / Logs ────────────────────────────────────────────────────────
  security_events:         { en: 'Security Events', bn: 'নিরাপত্তা ঘটনা' },
  failed_logins:           { en: 'Failed Logins', bn: 'ব্যর্থ লগইন' },
  auth_events:             { en: 'Auth Events', bn: 'অথেনটিকেশন ঘটনা' },
  high_today:              { en: 'High Today', bn: 'আজ উচ্চ' },
  critical_today:          { en: 'Critical Today', bn: 'আজ জটিল' },
  timestamp:               { en: 'Timestamp', bn: 'সময় চিহ্ন' },
  identity:                { en: 'Identity', bn: 'পরিচয়' },
  action:                  { en: 'Action', bn: 'কার্যক্রম' },
  severity:                { en: 'Severity', bn: 'তীব্রতা' },
  details:                 { en: 'Details', bn: 'বিস্তারিত' },
  no_security_events:      { en: 'No security events found.', bn: 'কোনো নিরাপত্তা ঘটনা পাওয়া যায়নি।' },

  // ── Live Tracking ──────────────────────────────────────────────────────────
  active_nodes:            { en: 'Active Nodes', bn: 'সক্রিয় নোড' },
  no_telemetry:            { en: 'No live telemetry detected in this sector.', bn: 'এই সেক্টরে কোনো লাইভ টেলিমেট্রি পাওয়া যায়নি।' },
  sync_status:             { en: 'Sync Status', bn: 'সিঙ্ক অবস্থা' },
  unit_perimeter:          { en: 'Unit Perimeter', bn: 'ইউনিট পরিধি' },
  signal_active:           { en: 'Signal Active', bn: 'সিগন্যাল সক্রিয়' },

  // ── Error boundary ─────────────────────────────────────────────────────────
  view_error:              { en: 'encountered an error', bn: 'একটি ত্রুটি হয়েছে' },
  error_desc:              { en: 'Something went wrong while rendering this panel. Your data is safe — try reloading.', bn: 'এই প্যানেলে কিছু সমস্যা হয়েছে। আপনার ডেটা নিরাপদ — পুনরায় লোড করুন।' },

  // ── Password modal ─────────────────────────────────────────────────────────
  update_account_password: { en: 'Update your account password', bn: 'আপনার অ্যাকাউন্টের পাসওয়ার্ড আপডেট করুন' },
  current_password:        { en: 'Current Password', bn: 'বর্তমান পাসওয়ার্ড' },
  enter_current_password:  { en: 'Enter current password', bn: 'বর্তমান পাসওয়ার্ড লিখুন' },
  min_6_chars:             { en: 'Min 6 characters', bn: 'কমপক্ষে ৬ অক্ষর' },
  confirm_new:             { en: 'Confirm New', bn: 'নতুন নিশ্চিত করুন' },
  password_updated:        { en: 'Password updated!', bn: 'পাসওয়ার্ড আপডেট হয়েছে!' },
  update_password:         { en: 'Update Password', bn: 'পাসওয়ার্ড আপডেট করুন' },

  // ── Language toggle ────────────────────────────────────────────────────────
  language:                { en: 'Language', bn: 'ভাষা' },
  english:                 { en: 'English', bn: 'ইংরেজি' },
  bangla:                  { en: 'বাংলা', bn: 'বাংলা' },
  switch_to_bangla:        { en: 'বাংলা', bn: 'English' },

} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Global (non-user-specific) fallback key — used before login
const LANG_KEY = 'exord-language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem(LANG_KEY) as Lang) || 'en'; }
    catch { return 'en'; }
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    // Always update the global fallback key so the login page
    // stays in whatever language the user last used
    try { localStorage.setItem(LANG_KEY, l); } catch {}
    document.documentElement.lang = l === 'bn' ? 'bn' : 'en';
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'bn' : 'en');
  }, [lang, setLang]);

  const t = useCallback((key: TranslationKey): string => {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    return entry[lang] ?? entry['en'];
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
