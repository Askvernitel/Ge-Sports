// Thin typed HTTP client wired to the real backend (server/README.md documents
// the API surface). Sends the in-memory JWT access token as a Bearer header
// and the httpOnly refresh cookie via credentials:'include'; on a 401 it
// transparently tries POST /auth/refresh once and retries the original call
// before giving up, mirroring the refresh-rotation flow in
// server/src/services/authService.ts.

import { useSessionStore } from '@/app/store';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  /** Backend AppError code (e.g. 'KYC_REQUIRED', 'UNAUTHORIZED'), when present. */
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Deduped: only one /auth/refresh is ever in flight at a time, no matter how
 * many callers ask for it concurrently. This matters more than it looks —
 * refresh tokens rotate on every use (server/README.md security notes), so
 * two concurrent refresh calls with the same pre-rotation cookie (e.g. React
 * 19 StrictMode double-invoking an effect in dev) would have the second one
 * treated as reuse of an already-rotated token, which revokes the whole
 * token family server-side. Exported so app/providers.tsx's cold-boot
 * session restore shares this exact dedup instead of racing its own fetch.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
        if (!res.ok) return null;
        const data = (await res.json()) as { accessToken: string };
        const { user, setSession } = useSessionStore.getState();
        // Keep the new token in the store either way; if `user` isn't loaded
        // yet (cold boot — see providers.tsx) leave isAuthenticated for the
        // caller to flip once it has fetched /me, rather than clobbering it.
        if (user) setSession(data.accessToken, user);
        else useSessionStore.setState({ accessToken: data.accessToken });
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function request<T>(path: string, init?: RequestInit, _retried = false): Promise<T> {
  const token = useSessionStore.getState().accessToken;

  // NOTE: `...init` must come *before* `headers` here — init.headers is
  // `undefined` on plenty of calls (see http.post below), and spreading it
  // after our merged headers object would overwrite the whole thing with
  // `undefined`, silently dropping Content-Type and falling back to the
  // browser's text/plain default for a string body. Learned the hard way
  // via a live "Request validation failed" 400 during E2E browser testing.
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401 && !_retried && path !== '/auth/login' && path !== '/auth/refresh') {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, init, true);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let message = text || res.statusText;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } | string; message?: string };
      if (typeof parsed.error === 'string') message = parsed.error;
      else if (parsed.error?.message) {
        message = parsed.error.message;
        code = parsed.error.code;
      } else if (parsed.message) message = parsed.message;
    } catch {
      // not JSON, keep raw text
    }
    throw new ApiError(message, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
};

/** Simulated network latency for mock api functions, so loading states are visible. */
export function mockDelay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
