/**
 * fileService.ts
 * All HTTP communication with the exord-file-server on port 8080
 * Accessed through Nginx proxy at /upload/ and /files/
 */

const FILE_SERVER = (import.meta.env.VITE_HRM_API_URL || '').replace(/\/$/,'');

export interface UploadResult {
  url: string;
  filename: string;
  originalName?: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'document';
  mimeType?: string;
}

/**
 * Get the access token issued by the Exord HRM API.
 */
const getToken = (): string => {
  try { return localStorage.getItem('exord_auth_token') || ''; }
  catch { return ''; }
};

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Upload a profile avatar photo
 */
export const uploadAvatar = async (file: File): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${FILE_SERVER}/api/v1/files/upload/avatar`, {
    method: 'POST',
    headers: authHeaders(),
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

  const res = await fetch(`${FILE_SERVER}/api/v1/files/upload/document`, {
    method: 'POST',
    headers: { ...authHeaders(), 'X-User-Id': userId },
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

  const res = await fetch(`${FILE_SERVER}/api/v1/files/upload/chat`, {
    method: 'POST',
    headers: { ...authHeaders(), 'X-Conv-Id': convId },
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
