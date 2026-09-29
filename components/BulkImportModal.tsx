/**
 * BulkImportModal.tsx — Exord Online HRM
 *
 * Upload an Excel (.xlsx / .xls) file to batch-create employee accounts.
 *
 * Required columns:  id, name, email, department
 * Optional columns:  role, base_salary, phone_personal, gender, join_date
 *
 * After import:
 *   • All accounts created with mustChangePassword = true
 *   • Default password: Exord@2024
 *   • HR staff notified about employees with incomplete profiles
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, X, CheckCircle2, AlertTriangle, Loader2,
  FileSpreadsheet, Users, Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useHRM } from '../store';
import { UserRole } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ImportRow {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  baseSalary: number;
  phone: string;
  gender: string;
  joinDate: string;
  // extra fields parsed from Excel
  bloodGroup?: string;
  phoneOfficial?: string;
  dateOfBirth?: string;
  // set after import attempt
  status: 'pending' | 'ready' | 'invalid' | 'success' | 'error' | 'skip';
  validationError?: string;
  importError?: string;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

interface Props {
  onClose: () => void;
  /** Called after a successful import so the parent can refresh */
  onImported?: (count: number) => void;
}

// ─── Column alias map — normalises header variations ─────────────────────────
const COL_ALIASES: Record<string, string> = {
  // ID
  'employee id':    'id',   'emp id':        'id',   'employee_id':    'id',
  'employee no':    'id',   'emp no':         'id',   'staff id':       'id',
  'id':             'id',
  // Name
  'full name':      'name', 'employee name':  'name', 'staff name':     'name',
  'name':           'name',
  // Email
  'email address':  'email', 'e-mail':        'email', 'email':         'email',
  // Department
  'dept':           'department', 'department': 'department',
  // Salary
  'salary':         'base_salary', 'base salary': 'base_salary',
  'monthly salary': 'base_salary', 'base_salary': 'base_salary',
  // Phone official
  'offiicial ph no':  'phone_official', 'official ph no': 'phone_official',
  'official phone':   'phone_official', 'office phone':   'phone_official',
  'phone_official':   'phone_official', 'official mobile': 'phone_official',
  // Phone personal
  'personal ph no':   'phone_personal', 'phone personal':  'phone_personal',
  'phone':            'phone_personal', 'mobile':           'phone_personal',
  'contact':          'phone_personal', 'phone_personal':   'phone_personal',
  'personal mobile':  'phone_personal',
  // Gender
  'sex':            'gender', 'gender': 'gender',
  // Blood group
  'blood group':    'blood_group', 'blood_group': 'blood_group', 'bloodgroup': 'blood_group',
  // Join date
  'joining date':   'join_date', 'date of joining': 'join_date',
  'joining_date':   'join_date', 'start date':       'join_date',
  'join date':      'join_date', 'join_date':         'join_date',
  // Date of birth
  'date of birth':  'date_of_birth', 'dob':            'date_of_birth',
  'date_of_birth':  'date_of_birth', 'birth date':     'date_of_birth',
  // Misc
  'sl':             '_sl',  // serial number — ignored
  'sl.':            '_sl',
};

const VALID_ROLES = Object.values(UserRole) as string[];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normaliseKey = (k: string): string => {
  const lower = k.toLowerCase().trim().replace(/\s+/g, ' ');
  return COL_ALIASES[lower] ?? lower.replace(/\s/g, '_');
};

const INCOMPLETE_FIELDS: (keyof ImportRow)[] = ['phone', 'gender', 'baseSalary', 'department'];

const isIncomplete = (row: ImportRow): boolean =>
  !row.phone || !row.gender || !row.baseSalary || !row.department;

const validateRow = (row: ImportRow): string | null => {
  if (!row.id)                   return 'Employee ID is missing.';
  if (!/^E\d{3,6}$/.test(row.id)) return `ID "${row.id}" must be E followed by digits (e.g. E0001).`;
  if (!row.name)                 return 'Name is missing.';
  // email is optional — auto-generated if absent
  if (row.email && !row.email.includes('@')) return `Email "${row.email}" is not valid.`;
  if (row.role && !VALID_ROLES.includes(row.role.toUpperCase()))
    return `Role "${row.role}" is not valid. Use: EMPLOYEE, MANAGER, HR, CO_ADMIN.`;
  return null;
};

/** Auto-generate a placeholder email from the employee ID if none provided */
const autoEmail = (id: string): string =>
  `${id.toLowerCase()}@exord.net`;

// ─── Main Component ───────────────────────────────────────────────────────────
const BulkImportModal: React.FC<Props> = ({ onClose, onImported }) => {
  const { createEmployee, users, sendNotification, currentUser } = useHRM();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]           = useState<Step>('upload');
  const [rows, setRows]           = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [results, setResults]     = useState({ success: 0, failed: 0, skipped: 0, incomplete: 0 });
  const [showColGuide, setShowColGuide] = useState(false);

  // ── Parse Excel ────────────────────────────────────────────────────────────
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: 'array', cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });

        if (raw.length === 0) { setParseError('The first sheet is empty.'); return; }
        if (raw.length > 500) { setParseError('Max 500 rows per import. Split into multiple files.'); return; }

        const parsed: ImportRow[] = raw.map((r) => {
          // normalise keys
          const norm: Record<string, string> = {};
          Object.entries(r).forEach(([k, v]) => {
            norm[normaliseKey(k)] = String(v ?? '').trim();
          });

          const rawId = (norm.id ?? '').toUpperCase().trim();
          const rawEmail = (norm.email ?? '').toLowerCase().trim();

          const row: ImportRow = {
            id:         rawId,
            name:       norm.name ?? '',
            email:      rawEmail || autoEmail(rawId),
            department: norm.department ?? '',
            role:       (norm.role ?? 'EMPLOYEE').toUpperCase(),
            baseSalary: norm.base_salary ? parseFloat(norm.base_salary.replace(/,/g, '')) : 0,
            phone:      norm.phone_personal || norm.phone_official || '',
            gender:     norm.gender ?? '',
            joinDate:   norm.join_date || new Date().toISOString().split('T')[0],
            // extra fields from Excel
            bloodGroup:   norm.blood_group ?? '',
            phoneOfficial: norm.phone_official ?? '',
            dateOfBirth:  norm.date_of_birth ?? '',
            status:     'pending',
          };

          const err = validateRow(row);
          row.status = err ? 'invalid' : 'ready';
          if (err) row.validationError = err;

          return row;
        });

        setRows(parsed);
        setStep('preview');
      } catch (err: any) {
        setParseError('Failed to parse file: ' + (err.message || 'Unknown error'));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    setStep('importing');
    let success = 0, failed = 0, skipped = 0, incomplete = 0;
    const incompleteNames: string[] = [];
    const updated = [...rows];

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (row.status === 'invalid') { failed++; continue; }

      // Duplicate check against already-loaded users (by ID)
      const exists = users.find(u => u.id === row.id);
      if (exists) {
        updated[i] = { ...row, status: 'skip', importError: 'ID already exists' };
        skipped++;
        setRows([...updated]);
        continue;
      }

      const res = await createEmployee({
        id:            row.id,
        name:          row.name,
        email:         row.email,
        password:      'Exord@2024',
        role:          (VALID_ROLES.includes(row.role) ? row.role : 'EMPLOYEE') as UserRole,
        department:    row.department || '',
        baseSalary:    row.baseSalary || 0,
        phonePersonal: row.phone || '',
        phoneOfficial: row.phoneOfficial || '',
        gender:        row.gender || '',
        bloodGroup:    row.bloodGroup || '',
        dateOfBirth:   row.dateOfBirth || '',
        joinDate:      row.joinDate,
        mustChangePassword: true,
      });

      if (res.success) {
        updated[i] = { ...row, status: 'success' };
        success++;
        if (isIncomplete(row)) {
          incomplete++;
          incompleteNames.push(`${row.name} (${row.id})`);
        }
      } else {
        // Treat "already exists" as a skip, not a hard failure
        const alreadyExists = res.message?.toLowerCase().includes('already exist');
        updated[i] = { ...row, status: alreadyExists ? 'skip' : 'error', importError: res.message };
        if (alreadyExists) skipped++; else failed++;
      }

      setRows([...updated]);
    }

    // ── Notify all HR users about incomplete profiles ──────────────────────
    if (incompleteNames.length > 0 && currentUser) {
      // Notify the importing user (who is likely HR/Admin) as a summary
      await sendNotification(
        currentUser.id,
        `${incompleteNames.length} employee profile${incompleteNames.length > 1 ? 's' : ''} need completion`,
        `The following employees were imported with incomplete details and need manual updates: ${incompleteNames.slice(0, 10).join(', ')}${incompleteNames.length > 10 ? ` and ${incompleteNames.length - 10} more` : ''}.`,
        'SYSTEM',
        { importedBy: currentUser.id, incompleteIds: updated.filter(r => r.status === 'success' && isIncomplete(r)).map(r => r.id) }
      );
    }

    setResults({ success, failed, skipped, incomplete });
    onImported?.(success);
    setStep('done');
  };

  // ── Counts ─────────────────────────────────────────────────────────────────
  const readyCount   = rows.filter(r => r.status === 'ready').length;
  const invalidCount = rows.filter(r => r.status === 'invalid').length;
  const partialCount = rows.filter(r => r.status === 'ready' && isIncomplete(r)).length;

  // ── Column guide data ──────────────────────────────────────────────────────
  const COLUMNS = [
    { col: 'Employee ID',      example: 'E0001',           req: true,  desc: 'E followed by digits (e.g. E0001, E1001)' },
    { col: 'Name',             example: 'Rahim Ahmed',      req: true,  desc: 'Full name of the employee' },
    { col: 'email',            example: 'rahim@exord.net',  req: false, desc: 'Login email — auto-generated as ID@exord.net if blank' },
    { col: 'department',       example: 'Network Ops',      req: false, desc: 'Department name — HR can update later' },
    { col: 'role',             example: 'EMPLOYEE',         req: false, desc: 'EMPLOYEE / MANAGER / HR / CO_ADMIN' },
    { col: 'Offiicial ph no',  example: '01800000001',      req: false, desc: 'Official / office phone number' },
    { col: 'Personal ph no',   example: '01712345678',      req: false, desc: 'Personal mobile number' },
    { col: 'blood group',      example: 'B+',               req: false, desc: 'Blood group' },
    { col: 'Date of Birth',    example: '1990-05-12',       req: false, desc: 'Date of birth (YYYY-MM-DD or Excel date)' },
    { col: 'Join Date',        example: '2024-03-15',       req: false, desc: 'Joining date (YYYY-MM-DD or Excel date)' },
    { col: 'base_salary',      example: '25000',            req: false, desc: 'Monthly salary in BDT' },
    { col: 'gender',           example: 'Male',             req: false, desc: 'Male or Female' },
  ];

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center shadow-md">
              <FileSpreadsheet size={18} className="text-white dark:text-slate-900" />
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white">Bulk Employee Import</p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">Create multiple accounts from an Excel spreadsheet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">

          {/* ── STEP: UPLOAD ── */}
          {step === 'upload' && (
            <>
              {/* Column guide (collapsible) */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowColGuide(s => !s)}
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Info size={14} className="text-[#E31E24]" />
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">Excel Column Reference</span>
                  </div>
                  {showColGuide ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </button>
                {showColGuide && (
                  <div className="p-5 border-t border-slate-200 dark:border-slate-700">
                    <div className="grid gap-2">
                      {COLUMNS.map(c => (
                        <div key={c.col} className="flex items-start gap-3">
                          <span className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest ${c.req ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                            {c.req ? 'REQ' : 'OPT'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-mono text-[11px] font-black text-slate-900 dark:text-white">{c.col}</span>
                            <span className="ml-2 text-[10px] text-slate-400 font-medium">— {c.desc}</span>
                          </div>
                          <span className="flex-shrink-0 font-mono text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{c.example}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-900/30">
                      <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                        Default password for all imported accounts: <span className="font-mono font-black">Exord@2024</span> — employees will be forced to change it on first login.
                        HR will receive a notification listing employees with incomplete profiles.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                className="relative border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-14 text-center cursor-pointer hover:border-[#E31E24] hover:bg-red-50/20 dark:hover:bg-red-900/5 transition-all group"
              >
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 group-hover:bg-red-50 dark:group-hover:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
                  <Upload size={22} className="text-slate-400 group-hover:text-[#E31E24] transition-colors" />
                </div>
                <p className="font-black text-slate-700 dark:text-slate-200 text-base mb-1">Drop your Excel file here</p>
                <p className="text-sm text-slate-400">or click to browse — .xlsx and .xls supported · max 500 rows</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </div>

              {parseError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-2xl flex items-center gap-2 border border-red-200 dark:border-red-900/40">
                  <AlertTriangle size={14} className="flex-shrink-0" /> {parseError}
                </div>
              )}
            </>
          )}

          {/* ── STEP: PREVIEW / IMPORTING / DONE ── */}
          {(step === 'preview' || step === 'importing' || step === 'done') && (
            <>
              {/* Summary pills */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-[11px] font-black flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> {readyCount} ready to import
                </div>
                {partialCount > 0 && (
                  <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-[11px] font-black flex items-center gap-1.5">
                    <AlertTriangle size={12} /> {partialCount} with incomplete details
                  </div>
                )}
                {invalidCount > 0 && (
                  <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-[11px] font-black flex items-center gap-1.5">
                    <X size={12} /> {invalidCount} invalid (will be skipped)
                  </div>
                )}
                {step === 'done' && (
                  <>
                    <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-[11px] font-black">✓ {results.success} imported</div>
                    {results.failed > 0  && <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-[11px] font-black">✗ {results.failed} failed</div>}
                    {results.skipped > 0 && <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[11px] font-black">⊘ {results.skipped} skipped (already exist)</div>}
                    {results.incomplete > 0 && <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-[11px] font-black">⚠ {results.incomplete} need profile completion</div>}
                  </>
                )}
              </div>

              {/* HR notice (done step) */}
              {step === 'done' && results.incomplete > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-2xl flex items-start gap-3">
                  <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 leading-relaxed">
                    A notification has been sent listing employees with incomplete profiles. HR staff can open each employee's record in Workforce Hub and fill in the missing details.
                  </p>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 text-[9px] uppercase font-black tracking-widest">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className={
                          row.status === 'success' ? 'bg-emerald-50/40 dark:bg-emerald-900/5' :
                          row.status === 'error'   ? 'bg-red-50/40 dark:bg-red-900/5' :
                          row.status === 'skip'    ? 'bg-amber-50/40 dark:bg-amber-900/5' :
                          row.status === 'invalid' ? 'bg-red-50/30 dark:bg-red-900/5' : ''
                        }
                      >
                        <td className="px-4 py-3 font-mono font-black text-slate-900 dark:text-white text-[11px]">{row.id || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 max-w-[130px] truncate">{row.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[160px] truncate">{row.email || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[120px] truncate">{row.department || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[9px] font-black">
                            {row.role || 'EMPLOYEE'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isIncomplete(row)
                            ? <span className="text-amber-500 text-[9px] font-black">Partial</span>
                            : <span className="text-emerald-500 text-[9px] font-black">Complete</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {row.status === 'ready'   && <span className="text-blue-500 text-[9px] font-black">Ready</span>}
                          {row.status === 'invalid' && (
                            <span className="text-red-500 text-[9px] font-black" title={row.validationError}>
                              ✗ Invalid
                            </span>
                          )}
                          {row.status === 'success' && <span className="text-emerald-600 text-[9px] font-black">✓ Created</span>}
                          {row.status === 'error'   && (
                            <span className="text-red-500 text-[9px] font-black" title={row.importError}>
                              ✗ Failed
                            </span>
                          )}
                          {row.status === 'skip'    && <span className="text-amber-500 text-[9px] font-black">⊘ Exists</span>}
                          {row.status === 'pending' && <span className="text-slate-400 text-[9px] font-black">…</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 flex items-center justify-between gap-3">

          {step === 'upload' && (
            <button onClick={onClose} className="px-5 py-2.5 text-xs font-black text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => { setRows([]); setParseError(''); setStep('upload'); }}
                className="px-5 py-2.5 text-xs font-black text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={readyCount === 0}
                className="px-6 py-2.5 text-xs font-black text-white bg-[#E31E24] rounded-2xl disabled:opacity-40 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-red-900/20"
              >
                <Users size={13} /> Import {readyCount} Employee{readyCount !== 1 ? 's' : ''}
              </button>
            </>
          )}

          {step === 'importing' && (
            <div className="flex items-center gap-2.5 text-sm text-slate-500 dark:text-slate-400 font-bold">
              <Loader2 size={16} className="animate-spin text-[#E31E24]" />
              Importing employees — please wait…
            </div>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-xs font-black text-white bg-[#E31E24] rounded-2xl active:scale-95 transition-all flex items-center gap-2"
            >
              <CheckCircle2 size={13} /> Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkImportModal;
