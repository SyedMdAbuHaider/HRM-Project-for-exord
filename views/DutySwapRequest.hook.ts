/**
 * DutySwapRequest.hook.ts
 *
 * Two flows:
 *
 * 1. EMPLOYEE REQUEST
 *    Employee picks a colleague in the same department and proposes a duty swap.
 *    → Status: PENDING_MANAGER
 *    → Department Manager approves → Status: PENDING_HR
 *    → HR finalizes (approves/rejects) → Status: APPROVED | REJECTED
 *    → On APPROVED: both employees get in-app notification + email,
 *      a DutyReplacement row is created (SHIFT_SWAP type) so schedules apply.
 *
 * 2. HR MANUAL SWAP
 *    HR directly creates a swap between any two employees.
 *    → Immediately APPROVED, DutyReplacement row created, both notified.
 *
 * DB table: duty_swap_requests  (SQL at bottom of file)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../serverOwnedClient';
import { useHRM } from '../store';
import { UserRole, DutySchedule } from '../types';
import { detectReplacementType } from './DutyReplacementView.hook';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SwapRequestStatus =
  | 'PENDING_MANAGER'   // waiting for department manager
  | 'PENDING_HR'        // manager approved, waiting for HR
  | 'APPROVED'          // HR approved, swap is active
  | 'REJECTED'          // rejected at any stage
  | 'CANCELLED';        // cancelled by requester

export interface DutySwapRequest {
  id: string;
  // Requester
  requesterId: string;
  requesterName: string;
  requesterDepartment: string;
  requesterSchedule: DutySchedule;      // their current/proposed shift
  // Target
  targetId: string;
  targetName: string;
  targetDepartment: string;
  targetSchedule: DutySchedule;         // their current/proposed shift
  // Period
  startDate: string;    // "YYYY-MM-DD"
  endDate: string;
  // Reason
  reason: string;
  // Approval chain
  status: SwapRequestStatus;
  managerApprovedBy?: string;
  hrApprovedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  // Linked replacement (set on APPROVED)
  dutyReplacementId?: string;
  // Meta
  isHrDirect: boolean;   // true = HR manual swap, skips approval chain
  createdAt: string;
}

export interface CreateSwapRequestInput {
  targetId: string;
  targetName: string;
  targetDepartment: string;
  startDate: string;
  endDate: string;
  requesterSchedule: DutySchedule;
  targetSchedule: DutySchedule;
  reason: string;
}

export interface HrDirectSwapInput {
  employeeAId: string;
  employeeBId: string;
  startDate: string;
  endDate: string;
  scheduleA: DutySchedule;
  scheduleB: DutySchedule;
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row mapper
// ─────────────────────────────────────────────────────────────────────────────

const parseJson = (v: any): any =>
  v ? (typeof v === 'string' ? JSON.parse(v) : v) : undefined;

const mapRow = (r: any): DutySwapRequest => ({
  id:                   r.id,
  requesterId:          r.requester_id,
  requesterName:        r.requester_name,
  requesterDepartment:  r.requester_department,
  requesterSchedule:    parseJson(r.requester_schedule) || { checkInTime: '09:00', checkOutTime: '17:00', graceMinutes: 5, earlyCheckInMinutes: 30 },
  targetId:             r.target_id,
  targetName:           r.target_name,
  targetDepartment:     r.target_department,
  targetSchedule:       parseJson(r.target_schedule) || { checkInTime: '09:00', checkOutTime: '17:00', graceMinutes: 5, earlyCheckInMinutes: 30 },
  startDate:            r.start_date,
  endDate:              r.end_date,
  reason:               r.reason || '',
  status:               r.status as SwapRequestStatus,
  managerApprovedBy:    r.manager_approved_by || undefined,
  hrApprovedBy:         r.hr_approved_by || undefined,
  rejectedBy:           r.rejected_by || undefined,
  rejectionReason:      r.rejection_reason || undefined,
  dutyReplacementId:    r.duty_replacement_id || undefined,
  isHrDirect:           !!r.is_hr_direct,
  createdAt:            r.created_at,
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create a DutyReplacement row when swap is approved
// ─────────────────────────────────────────────────────────────────────────────

const createReplacementFromSwap = async (
  swap: DutySwapRequest,
  approvedBy: string
): Promise<string> => {
  const replacementType = detectReplacementType(swap.requesterSchedule, swap.targetSchedule);
  const id = `DR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  await supabase.from('duty_replacements').insert({
    id,
    leave_id:                        swap.id,           // reference back to swap request
    leave_employee_id:               swap.requesterId,
    leave_employee_name:             swap.requesterName,
    replacement_employee_id:         swap.targetId,
    replacement_employee_name:       swap.targetName,
    department:                      swap.requesterDepartment,
    start_date:                      swap.startDate,
    end_date:                        swap.endDate,
    replacement_type:                replacementType,
    leave_employee_schedule:         JSON.stringify(swap.requesterSchedule),
    replacement_employee_schedule:   JSON.stringify(swap.targetSchedule),
    override_schedule:               null,
    note:                            `Duty swap approved by ${approvedBy}. Reason: ${swap.reason}`,
    assigned_by:                     approvedBy,
    status:                          'ACTIVE',
    created_at:                      new Date().toISOString(),
  });
  return id;
};

// ─────────────────────────────────────────────────────────────────────────────
// Notification helper
// ─────────────────────────────────────────────────────────────────────────────

async function sendSwapEmail(
  to: string,
  name: string,
  swap: DutySwapRequest,
  mySchedule: DutySchedule,
  otherName: string,
  statusLabel: string,
  note?: string
) {
  try {
    const startFmt = new Date(swap.startDate).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' });
    const endFmt   = new Date(swap.endDate).toLocaleDateString('en-BD',   { day: 'numeric', month: 'short', year: 'numeric' });
    await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject: `[Exord Online] Duty Swap ${statusLabel} — ${startFmt} to ${endFmt}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;padding:32px;background:#f8f9fb;">
            <div style="background:#E31E24;padding:20px 28px;border-radius:8px 8px 0 0;">
              <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900;">Exord Online HRM</h1>
            </div>
            <div style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
              <p style="color:#0f172a;font-size:15px;font-weight:700;">Hi ${name},</p>
              <p style="color:#475569;font-size:14px;line-height:1.6;">
                Your duty swap with <strong>${otherName}</strong> has been <strong>${statusLabel}</strong>.
              </p>
              <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
                <tr style="background:#f1f5f9;">
                  <td style="padding:10px 14px;font-weight:900;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;">Period</td>
                  <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${startFmt} – ${endFmt}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:900;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;">Your Shift</td>
                  <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${mySchedule.checkInTime} – ${mySchedule.checkOutTime}</td>
                </tr>
                <tr style="background:#f1f5f9;">
                  <td style="padding:10px 14px;font-weight:900;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;">Swap With</td>
                  <td style="padding:10px 14px;font-weight:700;color:#0f172a;">${otherName}</td>
                </tr>
                ${note ? `<tr><td style="padding:10px 14px;font-weight:900;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;">Note</td><td style="padding:10px 14px;color:#475569;">${note}</td></tr>` : ''}
              </table>
              <p style="color:#64748b;font-size:13px;">Log in at <a href="https://exord.online" style="color:#E31E24;">exord.online</a> for full details.</p>
              <p style="color:#94a3b8;font-size:12px;margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;">Automated message from Exord Online HRM</p>
            </div>
          </div>`,
      },
    });
  } catch { /* silent */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export const useDutySwapRequests = () => {
  const { currentUser, users, addActivityLog, sendNotification } = useHRM();
  const [swapRequests, setSwapRequests] = useState<DutySwapRequest[]>([]);
  const [isLoading, setIsLoading]       = useState(true);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('duty_swap_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.warn('[DutySwap] Table error:', error.message); setSwapRequests([]); return; }
      setSwapRequests((data || []).map(mapRow));
    } catch (e) { console.warn('[DutySwap] Load error:', e); setSwapRequests([]); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Employee: submit swap request ─────────────────────────────────────────
  const submitSwapRequest = useCallback(async (
    input: CreateSwapRequestInput
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Auth required.' };

    const id  = `DSR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const now = new Date().toISOString();

    const row = {
      id,
      requester_id:         currentUser.id,
      requester_name:       currentUser.name,
      requester_department: currentUser.department,
      requester_schedule:   JSON.stringify(input.requesterSchedule),
      target_id:            input.targetId,
      target_name:          input.targetName,
      target_department:    input.targetDepartment,
      target_schedule:      JSON.stringify(input.targetSchedule),
      start_date:           input.startDate,
      end_date:             input.endDate,
      reason:               input.reason,
      status:               'PENDING_MANAGER',
      is_hr_direct:         false,
      created_at:           now,
    };

    const { error } = await supabase.from('duty_swap_requests').insert(row);
    if (error) return { success: false, message: error.message };

    setSwapRequests(prev => [mapRow(row), ...prev]);

    // Notify target employee — they need to be aware (but can't reject here, only managers can)
    await sendNotification(
      input.targetId,
      '🔄 Duty Swap Requested',
      `${currentUser.name} has requested a duty swap with you from ${new Date(input.startDate).toLocaleDateString()} to ${new Date(input.endDate).toLocaleDateString()}. Pending manager approval.`,
      'GENERAL',
      { type: 'DUTY_SWAP_REQUEST', swapRequestId: id }
    );

    // Notify department managers
    const managers = users.filter(u =>
      u.role === UserRole.MANAGER && u.department === currentUser.department
    );
    for (const mgr of managers) {
      await sendNotification(
        mgr.id,
        '📋 Duty Swap Request — Action Required',
        `${currentUser.name} requested a duty swap with ${input.targetName} (${new Date(input.startDate).toLocaleDateString()} – ${new Date(input.endDate).toLocaleDateString()}). Please review and approve/reject.`,
        'GENERAL',
        { type: 'DUTY_SWAP_REQUEST', swapRequestId: id }
      );
    }

    await addActivityLog('DUTY_SWAP_REQUESTED', 'ATTENDANCE',
      `${currentUser.name} requested duty swap with ${input.targetName} (${input.startDate} – ${input.endDate}).`, 'LOW');

    return { success: true, message: 'Swap request submitted. Waiting for manager approval.' };
  }, [currentUser, users, sendNotification, addActivityLog]);

  // ── Manager: approve → PENDING_HR ─────────────────────────────────────────
  const managerApprove = useCallback(async (
    id: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Auth required.' };
    const swap = swapRequests.find(r => r.id === id);
    if (!swap) return { success: false, message: 'Request not found.' };

    const update = { status: 'PENDING_HR', manager_approved_by: currentUser.name };
    const { error } = await supabase.from('duty_swap_requests').update(update).eq('id', id);
    if (error) return { success: false, message: error.message };

    setSwapRequests(prev => prev.map(r => r.id === id
      ? { ...r, status: 'PENDING_HR', managerApprovedBy: currentUser.name }
      : r
    ));

    // Notify HR
    const hrUsers = users.filter(u => u.role === UserRole.HR || u.role === UserRole.ADMIN || u.role === UserRole.DEVELOPER);
    for (const hr of hrUsers.slice(0, 3)) {
      await sendNotification(
        hr.id,
        '📋 Duty Swap — HR Approval Needed',
        `Manager ${currentUser.name} approved a duty swap between ${swap.requesterName} and ${swap.targetName}. Needs your final approval.`,
        'GENERAL',
        { type: 'DUTY_SWAP_REQUEST', swapRequestId: id }
      );
    }
    // Notify requester
    await sendNotification(swap.requesterId, '✅ Swap Approved by Manager',
      `Your duty swap request with ${swap.targetName} was approved by manager ${currentUser.name}. Waiting for HR final approval.`,
      'GENERAL', { type: 'DUTY_SWAP_REQUEST', swapRequestId: id });

    await addActivityLog('DUTY_SWAP_MANAGER_APPROVED', 'ATTENDANCE',
      `Manager ${currentUser.name} approved swap request ${id}.`, 'MEDIUM');

    return { success: true, message: 'Approved. HR will now finalize.' };
  }, [currentUser, users, swapRequests, sendNotification, addActivityLog]);

  // ── HR: finalize approve → APPROVED ───────────────────────────────────────
  const hrApprove = useCallback(async (
    id: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Auth required.' };
    const swap = swapRequests.find(r => r.id === id);
    if (!swap) return { success: false, message: 'Request not found.' };

    // Create the DutyReplacement row
    const drId = await createReplacementFromSwap(swap, currentUser.name);

    const update = { status: 'APPROVED', hr_approved_by: currentUser.name, duty_replacement_id: drId };
    const { error } = await supabase.from('duty_swap_requests').update(update).eq('id', id);
    if (error) return { success: false, message: error.message };

    setSwapRequests(prev => prev.map(r => r.id === id
      ? { ...r, status: 'APPROVED', hrApprovedBy: currentUser.name, dutyReplacementId: drId }
      : r
    ));

    const startFmt = new Date(swap.startDate).toLocaleDateString();
    const endFmt   = new Date(swap.endDate).toLocaleDateString();

    // Notify both employees
    const requesterUser = users.find(u => u.id === swap.requesterId);
    const targetUser    = users.find(u => u.id === swap.targetId);

    await sendNotification(swap.requesterId, '✅ Duty Swap Approved',
      `Your duty swap with ${swap.targetName} (${startFmt} – ${endFmt}) has been approved by HR. Your shift: ${swap.requesterSchedule.checkInTime} – ${swap.requesterSchedule.checkOutTime}.`,
      'GENERAL', { type: 'DUTY_SWAP_APPROVED', swapRequestId: id, dutyReplacementId: drId });
    await sendNotification(swap.targetId, '✅ Duty Swap Approved',
      `Duty swap with ${swap.requesterName} (${startFmt} – ${endFmt}) has been finalized by HR. Your shift: ${swap.targetSchedule.checkInTime} – ${swap.targetSchedule.checkOutTime}.`,
      'GENERAL', { type: 'DUTY_SWAP_APPROVED', swapRequestId: id, dutyReplacementId: drId });

    // Email both
    if (requesterUser) await sendSwapEmail(requesterUser.email, requesterUser.name, swap, swap.requesterSchedule, swap.targetName, 'Approved');
    if (targetUser)    await sendSwapEmail(targetUser.email,    targetUser.name,    swap, swap.targetSchedule,    swap.requesterName, 'Approved');

    await addActivityLog('DUTY_SWAP_HR_APPROVED', 'ATTENDANCE',
      `HR ${currentUser.name} finalized swap between ${swap.requesterName} and ${swap.targetName} (${startFmt}–${endFmt}).`, 'MEDIUM');

    return { success: true, message: `Swap approved. Both ${swap.requesterName} and ${swap.targetName} have been notified.` };
  }, [currentUser, users, swapRequests, sendNotification, addActivityLog]);

  // ── Reject (Manager or HR) ─────────────────────────────────────────────────
  const rejectSwapRequest = useCallback(async (
    id: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Auth required.' };
    const swap = swapRequests.find(r => r.id === id);
    if (!swap) return { success: false, message: 'Request not found.' };

    const update = { status: 'REJECTED', rejected_by: currentUser.name, rejection_reason: reason };
    const { error } = await supabase.from('duty_swap_requests').update(update).eq('id', id);
    if (error) return { success: false, message: error.message };

    setSwapRequests(prev => prev.map(r => r.id === id
      ? { ...r, status: 'REJECTED', rejectedBy: currentUser.name, rejectionReason: reason }
      : r
    ));

    await sendNotification(swap.requesterId, '❌ Duty Swap Rejected',
      `Your duty swap request with ${swap.targetName} was rejected by ${currentUser.name}.${reason ? ` Reason: ${reason}` : ''}`,
      'GENERAL', { type: 'DUTY_SWAP_REJECTED', swapRequestId: id });
    await sendNotification(swap.targetId, '❌ Duty Swap Rejected',
      `The duty swap request from ${swap.requesterName} was rejected by ${currentUser.name}.`,
      'GENERAL', { type: 'DUTY_SWAP_REJECTED', swapRequestId: id });

    await addActivityLog('DUTY_SWAP_REJECTED', 'ATTENDANCE',
      `${currentUser.name} rejected swap request ${id} between ${swap.requesterName} and ${swap.targetName}.`, 'MEDIUM');

    return { success: true, message: 'Swap request rejected.' };
  }, [currentUser, swapRequests, sendNotification, addActivityLog]);

  // ── Employee: cancel own pending request ──────────────────────────────────
  const cancelSwapRequest = useCallback(async (
    id: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Auth required.' };
    const swap = swapRequests.find(r => r.id === id);
    if (!swap || swap.requesterId !== currentUser.id) return { success: false, message: 'Not authorised.' };
    if (!['PENDING_MANAGER', 'PENDING_HR'].includes(swap.status)) return { success: false, message: 'Cannot cancel at this stage.' };

    await supabase.from('duty_swap_requests').update({ status: 'CANCELLED' }).eq('id', id);
    setSwapRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'CANCELLED' } : r));

    await sendNotification(swap.targetId, '↩️ Swap Request Cancelled',
      `${swap.requesterName} has cancelled their duty swap request with you.`,
      'GENERAL', { type: 'DUTY_SWAP_CANCELLED', swapRequestId: id });

    await addActivityLog('DUTY_SWAP_CANCELLED', 'ATTENDANCE',
      `${currentUser.name} cancelled swap request ${id}.`, 'LOW');

    return { success: true, message: 'Request cancelled.' };
  }, [currentUser, swapRequests, sendNotification, addActivityLog]);

  // ── HR: direct manual swap (no approval chain) ────────────────────────────
  const hrDirectSwap = useCallback(async (
    input: HrDirectSwapInput
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Auth required.' };

    const empA = users.find(u => u.id === input.employeeAId);
    const empB = users.find(u => u.id === input.employeeBId);
    if (!empA || !empB) return { success: false, message: 'Employee(s) not found.' };

    const id  = `DSR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const now = new Date().toISOString();

    // Insert swap request row (already approved)
    const row = {
      id,
      requester_id:         empA.id,
      requester_name:       empA.name,
      requester_department: empA.department,
      requester_schedule:   JSON.stringify(input.scheduleA),
      target_id:            empB.id,
      target_name:          empB.name,
      target_department:    empB.department,
      target_schedule:      JSON.stringify(input.scheduleB),
      start_date:           input.startDate,
      end_date:             input.endDate,
      reason:               input.note || 'HR manual swap',
      status:               'APPROVED',
      hr_approved_by:       currentUser.name,
      is_hr_direct:         true,
      created_at:           now,
    };
    const { error } = await supabase.from('duty_swap_requests').insert(row);
    if (error) return { success: false, message: error.message };

    // Create DutyReplacement row
    const fakeSwap: DutySwapRequest = {
      id, requesterId: empA.id, requesterName: empA.name,
      requesterDepartment: empA.department, requesterSchedule: input.scheduleA,
      targetId: empB.id, targetName: empB.name,
      targetDepartment: empB.department, targetSchedule: input.scheduleB,
      startDate: input.startDate, endDate: input.endDate,
      reason: input.note || 'HR manual swap',
      status: 'APPROVED', isHrDirect: true, createdAt: now,
    };
    const drId = await createReplacementFromSwap(fakeSwap, currentUser.name);

    await supabase.from('duty_swap_requests').update({ duty_replacement_id: drId }).eq('id', id);
    setSwapRequests(prev => [{ ...mapRow(row), dutyReplacementId: drId }, ...prev]);

    const startFmt = new Date(input.startDate).toLocaleDateString();
    const endFmt   = new Date(input.endDate).toLocaleDateString();

    // Notify both immediately
    await sendNotification(empA.id, '🔄 Duty Swap — HR Assigned',
      `HR has swapped your duty with ${empB.name} from ${startFmt} to ${endFmt}. Your shift: ${input.scheduleA.checkInTime} – ${input.scheduleA.checkOutTime}.${input.note ? ` Note: ${input.note}` : ''}`,
      'GENERAL', { type: 'DUTY_SWAP_APPROVED', swapRequestId: id, dutyReplacementId: drId });
    await sendNotification(empB.id, '🔄 Duty Swap — HR Assigned',
      `HR has swapped your duty with ${empA.name} from ${startFmt} to ${endFmt}. Your shift: ${input.scheduleB.checkInTime} – ${input.scheduleB.checkOutTime}.${input.note ? ` Note: ${input.note}` : ''}`,
      'GENERAL', { type: 'DUTY_SWAP_APPROVED', swapRequestId: id, dutyReplacementId: drId });

    // Email both
    await sendSwapEmail(empA.email, empA.name, fakeSwap, input.scheduleA, empB.name, 'Assigned by HR', input.note);
    await sendSwapEmail(empB.email, empB.name, fakeSwap, input.scheduleB, empA.name, 'Assigned by HR', input.note);

    await addActivityLog('DUTY_SWAP_HR_DIRECT', 'ATTENDANCE',
      `HR ${currentUser.name} manually swapped duties between ${empA.name} and ${empB.name} (${startFmt}–${endFmt}).`, 'MEDIUM');

    return { success: true, message: `Swap created. Both ${empA.name} and ${empB.name} have been notified.` };
  }, [currentUser, users, sendNotification, addActivityLog]);

  // ── Visibility helpers ────────────────────────────────────────────────────

  /** Can current user approve at manager stage? */
  const canManagerApprove = useCallback((req: DutySwapRequest): boolean => {
    if (!currentUser) return false;
    if (req.status !== 'PENDING_MANAGER') return false;
    return currentUser.role === UserRole.MANAGER && currentUser.department === req.requesterDepartment;
  }, [currentUser]);

  /** Can current user approve at HR stage? */
  const canHrApprove = useCallback((req: DutySwapRequest): boolean => {
    if (!currentUser) return false;
    if (req.status !== 'PENDING_HR') return false;
    return [UserRole.HR, UserRole.ADMIN, UserRole.DEVELOPER].includes(currentUser.role);
  }, [currentUser]);

  /** Requests visible to current user */
  const visibleRequests = useCallback((): DutySwapRequest[] => {
    if (!currentUser) return [];
    const role = currentUser.role;
    if ([UserRole.DEVELOPER, UserRole.ADMIN].includes(role)) return swapRequests;
    if (role === UserRole.HR) return swapRequests;
    if (role === UserRole.MANAGER) {
      return swapRequests.filter(r =>
        r.requesterId === currentUser.id ||
        r.targetId === currentUser.id ||
        r.requesterDepartment === currentUser.department
      );
    }
    // Employee sees their own
    return swapRequests.filter(r =>
      r.requesterId === currentUser.id || r.targetId === currentUser.id
    );
  }, [currentUser, swapRequests]);

  return {
    swapRequests,
    visibleRequests,
    isLoading,
    submitSwapRequest,
    managerApprove,
    hrApprove,
    rejectSwapRequest,
    cancelSwapRequest,
    hrDirectSwap,
    canManagerApprove,
    canHrApprove,
    refresh: load,
  };
};

/*
─────────────────────────────────────────────────────────────────────────────
SUPABASE SQL — run once:
─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS duty_swap_requests (
  id                    TEXT PRIMARY KEY,
  requester_id          TEXT NOT NULL,
  requester_name        TEXT NOT NULL,
  requester_department  TEXT NOT NULL,
  requester_schedule    JSONB NOT NULL,
  target_id             TEXT NOT NULL,
  target_name           TEXT NOT NULL,
  target_department     TEXT NOT NULL,
  target_schedule       JSONB NOT NULL,
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  reason                TEXT,
  status                TEXT NOT NULL DEFAULT 'PENDING_MANAGER',
  manager_approved_by   TEXT,
  hr_approved_by        TEXT,
  rejected_by           TEXT,
  rejection_reason      TEXT,
  duty_replacement_id   TEXT,
  is_hr_direct          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE duty_swap_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage duty swap requests"
  ON duty_swap_requests FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_dsr_requester  ON duty_swap_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_dsr_target     ON duty_swap_requests(target_id);
CREATE INDEX IF NOT EXISTS idx_dsr_status     ON duty_swap_requests(status);
─────────────────────────────────────────────────────────────────────────────
*/
