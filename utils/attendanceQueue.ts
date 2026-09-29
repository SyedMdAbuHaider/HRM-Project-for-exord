// ============================================================
// Exord HRM — Offline Attendance Queue  (utils/attendanceQueue.ts)
// ============================================================

export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';

export interface QueuedAttendance {
  id: string;
  userId: string;
  type: AttendanceType;
  timestamp: string;       // Dhaka local ISO — captured at exact moment of tap
  location?: { lat: number; lng: number; accuracy?: number } | null;
  ipAddress?: string;
  retries: number;
  created_at: string;
}

const QUEUE_KEY = 'exord_attendance_queue';

export function getQueue(): QueuedAttendance[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function enqueue(
  entry: Pick<QueuedAttendance, 'userId' | 'type' | 'timestamp' | 'location' | 'ipAddress'>
): QueuedAttendance {
  const item: QueuedAttendance = {
    ...entry,
    id: crypto.randomUUID(),
    retries: 0,
    created_at: new Date().toISOString(),
  };
  const q = getQueue();
  q.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  console.log('[AttendanceQueue] Enqueued', item.type, 'at', item.timestamp);
  return item;
}

export function dequeue(id: string) {
  const q = getQueue().filter(i => i.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function incrementRetry(id: string) {
  const q = getQueue().map(i =>
    i.id === id ? { ...i, retries: i.retries + 1 } : i
  );
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function getPendingCount(): number {
  return getQueue().filter(i => i.retries < 5).length;
}
