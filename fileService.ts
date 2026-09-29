/**
 * fileService.ts
 * All HTTP communication with the exord-file-server on port 8080
 * Accessed through Nginx proxy at /upload/ and /files/
 */

import { supabase } from './supabaseClient';

const FILE_SERVER = ''; // Empty = same origin via Nginx proxy

export interface UploadResult {
  url: string;
  filename: string;
  originalName?: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'document';
  mimeType?: string;
}

/**
 * Get auth token — reads from the active Supabase session (source of truth).
 * Falls back to the custom localStorage token only when no Supabase session
 * exists (e.g. custom-auth flows that don't use supabase.auth).
 */
const getToken = async (): Promise<string> => {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
  } catch { /* ignore */ }
  // Fallback for custom-auth: read the token stored by the login function
  try { return localStorage.getItem('exord_auth_token') || ''; }
  catch { return ''; }
};

/**
 * Build headers with Authorization bearer token.
 * Async because Supabase session retrieval is async.
 */
const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getToken();
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
};

/**
 * Upload a profile avatar photo
 */
export const uploadAvatar = async (file: File): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${FILE_SERVER}/upload/avatar`, {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Avatar upload failed');
  }
  return res.json();
};

/**
 * Upload a personal document (NID, etc.)
 * userId is sent as a request header — NOT a query param — to avoid
 * it being logged by every proxy, CDN, and server access log.
 */
export const uploadDocument = async (
  file: File,
  userId: string
): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${FILE_SERVER}/upload/document`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'X-User-Id': userId },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Document upload failed');
  }
  return res.json();
};

/**
 * Upload a chat attachment (image / video / audio / doc)
 * convId: sent as a header to avoid appearing in server access logs.
 */
export const uploadChatFile = async (
  file: File,
  convId: string,
  _userId?: string  // kept for backward compat — server doesn't use it
): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${FILE_SERVER}/upload/chat`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'X-Conv-Id': convId },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Chat file upload failed');
  }
  return res.json();
};

/**
 * Format bytes to human-readable string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Derive file category from MIME type or URL
 */
export const getFileType = (mimeType?: string, url?: string): 'image' | 'video' | 'audio' | 'document' => {
  const check = mimeType || url || '';
  if (check.match(/image\//i) || check.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
  if (check.match(/video\//i) || check.match(/\.(mp4|webm|ogg)$/i))          return 'video';
  if (check.match(/audio\//i) || check.match(/\.(mp3|wav|ogg|webm)$/i))      return 'audio';
  return 'document';
};
