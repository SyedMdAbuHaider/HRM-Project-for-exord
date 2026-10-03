const API_BASE = (import.meta.env.VITE_HRM_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = localStorage.getItem('exord_auth_token');

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && retry && path !== '/api/v1/auth/login' && path !== '/api/v1/auth/refresh') {
      const refreshToken = localStorage.getItem('exord_refresh_token');
      if (refreshToken) {
        try {
          const refreshed = await request<any>('/api/v1/auth/refresh', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken})}, false);
          if (refreshed?.accessToken) localStorage.setItem('exord_auth_token', refreshed.accessToken);
          if (refreshed?.refreshToken) localStorage.setItem('exord_refresh_token', refreshed.refreshToken);
          return request<T>(path, options, false);
        } catch {}
      }
    }
    throw new ApiError(data?.error || `Request failed with status ${response.status}`, response.status, data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};