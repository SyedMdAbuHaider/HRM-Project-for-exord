/**
 * DutyReplacementView.hook.ts
 *
 * AUTO-DETECTION LOGIC:
 * ─────────────────────
 * HR provides both employees' shift times. We compare:
 *
 *   Shifts DON'T overlap (e.g. 12:00–16:00 vs 18:00–21:00)
 *   → SHIFT_SWAP
 *     Both employees work the same calendar day, different hours.
 *     - On-leave employee: attendance shows "SHIFT_REPLACED" (not absent)
 *     - Replacement employee: works their assigned slot normally
 *     - Both get notified with their own specific shift times
 *     - Both get schedule overrides for the covered dates
 *
 *   Shifts DO overlap (e.g. 09:00–17:00 vs 09:00–17:00)
 *   → FULL_LEAVE_COVER
 *     One employee is fully off, the other covers the whole duty.
 *     - On-leave employee: absent for those days
 *     - Replacement employee: covers the full shift
 *     - Only replacement gets notified
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../serverOwnedClient';
import { useHRM } from '../store';
import { DutySchedule } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ReplacementType = 'FULL_LEAVE_COVER' | 'SHIFT_SWAP';

export interface DutyReplacement {
  id: string;
  leaveId: string;
  leaveEmployeeId: string;
  leaveEmployeeName: string;
  replacementEmployeeId: string;
  replacementEmployeeName: string;
  department: string;
  startDate: string;
  endDate: string;
  replacementType: ReplacementType;
  leaveEmployeeSchedule?: DutySchedule;
  replacementEmployeeSchedule?: DutySchedule;
  overrideSchedule?: DutySchedule;
  note?: string;
  assignedBy: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

export interface CreateAssignmentInput {
  leaveId: string;
  leaveEmployeeId: string;
  leaveEmployeeName: string;
  replacementEmployeeId: string;
  department: string;
  startDate: string;
  endDate: string;
  leaveEmployeeSchedule: DutySchedule;
  replacementEmployeeSchedule: DutySchedule;
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-detection helpers
// ─────────────────────────────────────────────────────────────────────────────

const toMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export const schedulesOverlap = (a: DutySchedule, b: DutySchedule): boolean => {
  const aStart = toMinutes(a.checkInTime);
  const aEnd   = toMinutes(a.checkOutTime);
  const bStart = toMinutes(b.checkInTime);
  const bEnd   = toMinutes(b.checkOutTime);
  return aStart < bEnd && bStart < aEnd;
};

export const detectReplacementType = (
  leaveSchedule: DutySchedule,
  replacementSchedule: DutySchedule
): ReplacementType =>
  schedulesOverlap(leaveSchedule, replacementSchedule) ? 'FULL_LEAVE_COVER' : 'SHIFT_SWAP';

// ─────────────────────────────────────────────────────────────────────────────
// Row mapper
// ─────────────────────────────────────────────────────────────────────────────

const parseJson = (v: any) =>
  v ? (typeof v === 'string' ? JSON.parse(v) : v) : undefined;

const mapRow = (r: any): DutyReplacement => ({
  id:                          r.id,
  leaveId:                     r.leave_id,
  leaveEmployeeId:             r.leave_employee_id,
  leaveEmployeeName:           r.leave_employee_name,
  replacementEmployeeId:       r.replacement_employee_id,
  replacementEmployeeName:     r.replacement_employee_name,
  department:                  r.department,
  startDate:                   r.start_date,
  endDate:                     r.end_date,
  replacementType:             (r.replacement_type as ReplacementType) || 'FULL_LEAVE_COVER',
  leaveEmployeeSchedule:       parseJson(r.leave_employee_schedule),
  replacementEmployeeSchedule: parseJson(r.replacement_employee_schedule),
  overrideSchedule:            parseJson(r.override_schedule),
  note:                        r.note || undefined,
  assignedBy:                  r.assigned_by,
  status:                      r.status,
  createdAt:                   r.created_at,
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-complete expired assignments
// ─────────────────────────────────────────────────────────────────────────────

const autoCompleteExpired = async (rows: DutyReplacement[]) => {
  const today = new Date().toISOString().split('T')[0];
  const expired = rows.filter(r => r.status === 'ACTIVE' && r.endDate < today);
  for (const r of expired) {
    await supabase.from('duty_replacements').update({ status: 'COMPLETED' }).eq('id', r.id);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Public helpers — used by AttendanceView
// ─────────────────────────────────────────────────────────────────────────────

export const isShiftSwap      = (a: DutyReplacement) => a.replacementType === 'SHIFT_SWAP';
export const isFullLeaveCover = (a: DutyReplacement) => a.replacementType === 'FULL_LEAVE_COVER';

/**
 * Returns the effective DutySchedule for an employee on a given date,
 * considering any active duty replacement assignment.
 */
export const getEffectiveSchedule = (
  employeeId: string,
  assignments: DutyReplacement[],
  fallback: DutySchedule,
  date: Date = new Date()
): DutySchedule => {
  const dateStr = date.toISOString().split('T')[0];
  const active = assignments.find(a =>
    a.status === 'ACTIVE' &&
    a.startDate <= dateStr &&
    a.endDate >= dateStr &&
    (a.leaveEmployeeId === employeeId || a.replacementEmployeeId === employeeId)
  );
  if (!active) return fallback;

  if (isShiftSwap(active)) {
    if (active.leaveEmployeeId === employeeId)       return active.leaveEmployeeSchedule       || fallback;
    if (active.replacementEmployeeId === employeeId) return active.replacementEmployeeSchedule || fallback;
  }
  if (isFullLeaveCover(active)) {
    if (active.replacementEmployeeId === employeeId) return active.overrideSchedule || fallback;
  }
  return fallback;
};

/**
 * If an on-leave employee has a SHIFT_SWAP active on the given date,
 * returns the assignment so AttendanceView can show "Shift Replaced" instead of "Absent".
 */
export const getShiftSwapForLeaveEmployee = (
  leaveEmployeeId: string,
  assignments: DutyReplacement[],
  date: Date = new Date()
): DutyReplacement | undefined => {
  const dateStr = date.toISOString().split('T')[0];
  return assignments.find(a =>
    a.status === 'ACTIVE' &&
    a.replacementType === 'SHIFT_SWAP' &&
    a.leaveEmployeeId === leaveEmployeeId &&
    a.startDate <= dateStr &&
    a.endDate >= dateStr
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Email helper (Supabase edge function — silent fail if not deployed)
// ─────────────────────────────────────────────────────────────────────────────

async function sendEmail(
  to: string,
  name: string,
  input: CreateAssignmentInput,
  startFmt: string,
  endFmt: string,
  replacementType: ReplacementType,
  schedule: DutySchedule,
  assignedBy: string,
  isLeaveEmployee = false
) {
  try {
    const isSwap = replacementType === 'SHIFT_SWAP';
    const subject = isSwap
      ? `[Exord Online] Shift Reassignment — ${startFmt} to ${endFmt}`
      : `[Exord Online] Duty Cover Assignment — ${startFmt} to ${endFmt}`;

    const introText = isLeaveEmployee
      ? `Your duty shift has been temporarily reassigned. Please report for your new shift time below.`
      : `You have been assigned to cover a duty shift for <strong>${input.leaveEmployeeName}</strong>.`;

    const typeRow = isSwap
      ? `<tr style="background:#eff6ff;"><td style="padding:10px 14px;font-weight:900;color:#3b82f6;font-size:10px;text-transform:uppercase;letter-spacing:.1em;">Type</td><td style="padding:10px 14px;font-weight:700;color:#1d4ed8;">Shift Swap — both employees working, different hours</td></tr>`
      : `<tr style="background:#f0fdf4;"><td style="padding:10px 14px;font-weight:900;color:#16a34a;font-size:10px;text-transform:uppercase;letter-spacing:.1em;">Type</td><td style="padding:10px 14px;font-weight:700;color:#15803d;">Full Leave Cover</td></tr>`;

    await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;padding:32px;background:#f8f9fb;">
            <div style="background:#E31E24;padding:20px 28px;border-radius:8px 8px 0 0;">
              <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900;">Exord Online HRM</h1>
            </div>
            <div style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
              <p style="color:#0f172a;font-size:15px;font-weight:700;">Hi ${name},</p>
              <p style="color:#475569;font-size:14px;line-height:1.6;">${introText}</p>
              <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
                <tr style="background:#f1f5f9;">
                  <td style="padding:10px 14px;font-weight:900;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;">Period</td>
                  <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${startFmt} – ${endFmt}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:900;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;">Department</td>
                  <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${input.department}</td>
                </tr>
                <tr style="background:#f1f5f9;">
                  <td style="padding:10px 14px;font-weight:900;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;">Your Shift</td>
                  <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${schedule.checkInTime} – ${schedule.checkOutTime}</td>
                </tr>
                ${typeRow}
                ${input.note ? `<tr><td style="padding:10px 14px;font-weight:900;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;">HR Note</td><td style="padding:10px 14px;color:#475569;">${input.note}</td></tr>` : ''}
              </table>
              <p style="color:#64748b;font-size:13px;">Log in at <a href="https://exord.online" style="color:#E31E24;">exord.online</a> for full details.</p>
              <p style="color:#94a3b8;font-size:12px;margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;">
                Automated message · Assigned by ${assignedBy}
              </p>
            </div>
          </div>
        `,
      },
    });
  } catch {
    // Edge function not deployed — in-app notification already sent
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export const useDutyReplacements = () => {
  const { currentUser, users, addActivityLog, sendNotification } = useHRM();
  const [assignments, setAssignments] = useState<DutyReplacement[]>([]);
  const [isLoading, setIsLoading]     = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('duty_replacements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[DutyReplacement] Table error:', error.message);
        setAssignments([]);
        return;
      }

      const mapped = (data || []).map(mapRow);
      autoCompleteExpired(mapped).catch(() => {});
      const today = new Date().toISOString().split('T')[0];
      setAssignments(mapped.map(r =>
        r.status === 'ACTIVE' && r.endDate < today ? { ...r, status: 'COMPLETED' as const } : r
      ));
    } catch (e) {
      console.warn('[DutyReplacement] Load error:', e);
      setAssignments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createAssignment = useCallback(async (
    input: CreateAssignmentInput
  ): Promise<{ success: boolean; message: string; replacementType?: ReplacementType }> => {
    if (!currentUser) return { success: false, message: 'Authentication required.' };

    const replacementUser = users.find(u => u.id === input.replacementEmployeeId);
    const leaveUser       = users.find(u => u.id === input.leaveEmployeeId);
    if (!replacementUser) return { success: false, message: 'Replacement employee not found.' };

    const replacementType = detectReplacementType(
      input.leaveEmployeeSchedule,
      input.replacementEmployeeSchedule
    );
    const isSwap = replacementType === 'SHIFT_SWAP';

    const id  = `DR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const now = new Date().toISOString();

    const row: any = {
      id,
      leave_id:                        input.leaveId,
      leave_employee_id:               input.leaveEmployeeId,
      leave_employee_name:             input.leaveEmployeeName,
      replacement_employee_id:         input.replacementEmployeeId,
      replacement_employee_name:       replacementUser.name,
      department:                      input.department,
      start_date:                      input.startDate,
      end_date:                        input.endDate,
      replacement_type:                replacementType,
      leave_employee_schedule:         JSON.stringify(input.leaveEmployeeSchedule),
      replacement_employee_schedule:   JSON.stringify(input.replacementEmployeeSchedule),
      override_schedule:               isSwap ? null : JSON.stringify(input.replacementEmployeeSchedule),
      note:                            input.note || null,
      assigned_by:                     currentUser.name,
      status:                          'ACTIVE',
      created_at:                      now,
    };

    const { error } = await supabase.from('duty_replacements').insert(row);
    if (error) return { success: false, message: error.message };

    setAssignments(prev => [mapRow(row), ...prev]);

    const startFmt = new Date(input.startDate).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' });
    const endFmt   = new Date(input.endDate).toLocaleDateString('en-BD',   { day: 'numeric', month: 'short', year: 'numeric' });

    if (isSwap) {
      // Notify BOTH employees with their individual shift times
      await sendNotification(
        input.leaveEmployeeId,
        '🔄 Your Shift Has Been Reassigned',
        `HR has reassigned your duty from ${startFmt} to ${endFmt}. Your new shift: ${input.leaveEmployeeSchedule.checkInTime} – ${input.leaveEmployeeSchedule.checkOutTime} (${input.department}). Your attendance will show "Shift Replaced" for these dates.${input.note ? ` HR note: ${input.note}` : ''}`,
        'GENERAL',
        { type: 'DUTY_REPLACEMENT', dutyReplacementId: id, replacementType, startDate: input.startDate, endDate: input.endDate }
      );
      await sendNotification(
        input.replacementEmployeeId,
        '📋 Shift Assignment — Temporary Cover',
        `You are assigned to cover a shift for ${input.leaveEmployeeName} from ${startFmt} to ${endFmt}. Your shift: ${input.replacementEmployeeSchedule.checkInTime} – ${input.replacementEmployeeSchedule.checkOutTime} (${input.department}).${input.note ? ` HR note: ${input.note}` : ''}`,
        'GENERAL',
        { type: 'DUTY_REPLACEMENT', dutyReplacementId: id, replacementType, startDate: input.startDate, endDate: input.endDate }
      );
      // Email both
      await sendEmail(replacementUser.email, replacementUser.name, input, startFmt, endFmt, replacementType, input.replacementEmployeeSchedule, currentUser.name);
      if (leaveUser) await sendEmail(leaveUser.email, leaveUser.name, input, startFmt, endFmt, replacementType, input.leaveEmployeeSchedule, currentUser.name, true);
    } else {
      // FULL_LEAVE_COVER — only notify replacement
      await sendNotification(
        input.replacementEmployeeId,
        '📋 Duty Replacement Assigned',
        `You are assigned to cover ${input.leaveEmployeeName}'s full duty from ${startFmt} to ${endFmt}. Shift: ${input.replacementEmployeeSchedule.checkInTime} – ${input.replacementEmployeeSchedule.checkOutTime} (${input.department}).${input.note ? ` HR note: ${input.note}` : ''}`,
        'GENERAL',
        { type: 'DUTY_REPLACEMENT', dutyReplacementId: id, replacementType, startDate: input.startDate, endDate: input.endDate }
      );
      await sendEmail(replacementUser.email, replacementUser.name, input, startFmt, endFmt, replacementType, input.replacementEmployeeSchedule, currentUser.name);
    }

    await addActivityLog(
      `DUTY_REPLACEMENT_${replacementType}`,
      'ATTENDANCE',
      `${currentUser.name} assigned ${replacementUser.name} to cover ${input.leaveEmployeeName}'s duties (${startFmt}–${endFmt}). Auto-detected type: ${replacementType}.`,
      'MEDIUM',
      { dutyReplacementId: id, replacementType }
    );

    return {
      success: true,
      replacementType,
      message: isSwap
        ? `Shift Swap detected — both ${input.leaveEmployeeName} and ${replacementUser.name} have been notified with their respective shift times.`
        : `Full Leave Cover — ${replacementUser.name} has been notified.`,
    };
  }, [currentUser, users, sendNotification, addActivityLog]);

  const cancelAssignment = useCallback(async (id: string) => {
    const assignment = assignments.find(a => a.id === id);
    await supabase.from('duty_replacements').update({ status: 'CANCELLED' }).eq('id', id);
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCELLED' } : a));

    if (assignment) {
      const period = `${new Date(assignment.startDate).toLocaleDateString()} – ${new Date(assignment.endDate).toLocaleDateString()}`;
      await sendNotification(
        assignment.replacementEmployeeId,
        '❌ Duty Assignment Cancelled',
        `Your duty assignment covering ${assignment.leaveEmployeeName} (${period}) has been cancelled. Your original schedule is restored.`,
        'GENERAL',
        { type: 'DUTY_REPLACEMENT_CANCELLED', dutyReplacementId: id }
      );
      if (assignment.replacementType === 'SHIFT_SWAP') {
        await sendNotification(
          assignment.leaveEmployeeId,
          '↩️ Shift Reassignment Cancelled',
          `Your shift swap for (${period}) has been cancelled by HR. Your original schedule is restored.`,
          'GENERAL',
          { type: 'DUTY_REPLACEMENT_CANCELLED', dutyReplacementId: id }
        );
      }
      await addActivityLog('DUTY_REPLACEMENT_CANCELLED', 'ATTENDANCE', `Duty replacement ${id} cancelled by ${currentUser?.name}.`, 'MEDIUM');
    }
  }, [assignments, currentUser, sendNotification, addActivityLog]);

  const getEffectiveScheduleForEmployee = useCallback((
    employeeId: string,
    fallback: DutySchedule,
    date: Date = new Date()
  ): DutySchedule => getEffectiveSchedule(employeeId, assignments, fallback, date),
  [assignments]);

  const getShiftSwapStatus = useCallback((
    leaveEmployeeId: string,
    date: Date = new Date()
  ): DutyReplacement | undefined => getShiftSwapForLeaveEmployee(leaveEmployeeId, assignments, date),
  [assignments]);

  return {
    assignments,
    isLoading,
    createAssignment,
    cancelAssignment,
    getEffectiveScheduleForEmployee,
    getShiftSwapStatus,
    refresh: load,
  };
};

/*
─────────────────────────────────────────────────────────────────────────────
SUPABASE SQL
─────────────────────────────────────────────────────────────────────────────

-- If table already exists from v1, just add the new columns:
ALTER TABLE duty_replacements
  ADD COLUMN IF NOT EXISTS replacement_type                TEXT NOT NULL DEFAULT 'FULL_LEAVE_COVER',
  ADD COLUMN IF NOT EXISTS leave_employee_schedule         JSONB,
  ADD COLUMN IF NOT EXISTS replacement_employee_schedule   JSONB;

-- Or full fresh create:
CREATE TABLE IF NOT EXISTS duty_replacements (
  id                              TEXT PRIMARY KEY,
  leave_id                        TEXT NOT NULL,
  leave_employee_id               TEXT NOT NULL,
  leave_employee_name             TEXT NOT NULL,
  replacement_employee_id         TEXT NOT NULL,
  replacement_employee_name       TEXT NOT NULL,
  department                      TEXT NOT NULL,
  start_date                      DATE NOT NULL,
  end_date                        DATE NOT NULL,
  replacement_type                TEXT NOT NULL DEFAULT 'FULL_LEAVE_COVER',
  leave_employee_schedule         JSONB,
  replacement_employee_schedule   JSONB,
  override_schedule               JSONB,
  note                            TEXT,
  assigned_by                     TEXT NOT NULL,
  status                          TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE duty_replacements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage duty replacements" ON duty_replacements FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE INDEX IF NOT EXISTS idx_dr_replacement_employee ON duty_replacements(replacement_employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_dr_leave_employee ON duty_replacements(leave_employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_dr_leave_id ON duty_replacements(leave_id);
─────────────────────────────────────────────────────────────────────────────
*/
