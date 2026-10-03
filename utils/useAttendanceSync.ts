// ============================================================
// Exord HRM — Auto-sync hook  (utils/useAttendanceSync.ts)
// Drop this hook in App.tsx once — works globally for all users
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../serverOwnedClient';
import { getQueue, dequeue, incrementRetry } from './attendanceQueue';

const MAX_RETRIES = 5;
const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useAttendanceSync() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const refreshCount = useCallback(() => {
    setPendingCount(getQueue().length);
  }, []);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;

    const queue = getQueue();
    if (queue.length === 0) return;

    let synced = 0;
    console.log(`[AttendanceSync] Flushing ${queue.length} queued record(s)…`);

    for (const item of queue) {
      if (item.retries >= MAX_RETRIES) {
        console.warn('[AttendanceSync] Skipping (max retries):', item.id, item.type);
        continue;
      }

      try {
        const { error } = await supabase.from('attendance').insert({
          // ⚠️  Match these field names to your actual Supabase column names
          user_id: item.userId,          // or employee_id — check your schema
          type: item.type,
          status: 'SUCCESS',
          timestamp: item.timestamp,     // original time preserved — not "now"
          location: item.location ?? null,
          synced_at: new Date().toISOString(),
          source: 'offline_queue',       // lets admins see these were delayed
        });

        if (error) throw error;

        dequeue(item.id);
        synced++;
        console.log('[AttendanceSync] ✓ Synced', item.type, item.timestamp);
      } catch (err) {
        incrementRetry(item.id);
        console.error('[AttendanceSync] ✗ Failed to sync', item.id, err);
      }
    }

    if (synced > 0) {
      setLastSyncAt(new Date());
      console.log(`[AttendanceSync] Done — synced ${synced} record(s)`);
    }
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    // Flush when browser comes back online
    window.addEventListener('online', flushQueue);

    // Poll every 30s as fallback (handles silent reconnects)
    timerRef.current = setInterval(flushQueue, POLL_INTERVAL_MS);

    // Attempt flush on mount — handles "was offline, now refreshed" case
    flushQueue();
    refreshCount();

    return () => {
      window.removeEventListener('online', flushQueue);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [flushQueue, refreshCount]);

  return {
    pendingCount,
    lastSyncAt,
    flushQueue,  // expose so you can call it manually (e.g. on pull-to-refresh)
  };
}
