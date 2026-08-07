import { tokenStore } from '@/auth/tokenStore';
import type { ApiEnvelope, Tokens } from '@/types/models';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
let refreshPromise: Promise<Tokens> | null = null;
let onUnauthorized: (() => void) | undefined;
export const setUnauthorizedHandler = (handler: () => void) => { onUnauthorized = handler; };

export class ApiError extends Error {
  constructor(message: string, public status: number, public payload?: unknown) { super(message); }
}

async function parse<T>(response: Response): Promise<ApiEnvelope<T>> {
  let body: ApiEnvelope<T> | undefined;
  try { body = await response.json() as ApiEnvelope<T>; } catch { /* non-JSON gateway response */ }
  if (!response.ok || !body?.success) throw new ApiError(body?.message || `Request failed (${response.status})`, response.status, body);
  return body;
}

async function refresh(): Promise<Tokens> {
  const existing = await tokenStore.getTokens();
  if (!existing?.refreshToken) throw new ApiError('Session expired', 401);
  const response = await fetch(`${API_URL}/api/auth/refresh-token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: existing.refreshToken }),
  });
  const envelope = await parse<{ tokens: Tokens }>(response);
  await tokenStore.saveTokens(envelope.data.tokens);
  return envelope.data.tokens;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<ApiEnvelope<T>> {
  if (!API_URL) throw new ApiError('EXPO_PUBLIC_API_URL is not configured', 0);
  const tokens = await tokenStore.getTokens();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (tokens?.accessToken) headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  let response: Response;
  try { response = await fetch(`${API_URL}${path}`, { ...init, headers }); }
  catch { throw new ApiError('Unable to reach SparkCRM. Check your connection and API URL.', 0); }
  if (response.status === 401 && retry && !path.includes('/auth/')) {
    try {
      refreshPromise ||= refresh().finally(() => { refreshPromise = null; });
      const next = await refreshPromise;
      headers.set('Authorization', `Bearer ${next.accessToken}`);
      response = await fetch(`${API_URL}${path}`, { ...init, headers });
    } catch (error) {
      await tokenStore.clear(); onUnauthorized?.(); throw error;
    }
  }
  return parse<T>(response);
}

export const json = (value: unknown) => JSON.stringify(value);
