'use client';
import { useCallback, useEffect, useState } from 'react';

export interface Api_Problem {
  status: number;
  code: string;
  detail?: string;
  errors?: unknown[];
}

/** Client helper: all calls go to our own server (/api/...), never directly to the Admin API. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`/api/platform/${path.replace(/^\//, '')}`, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (response.status === 401) {
    // The server already cleared the session cookies, so /login will not bounce back here.
    if (!window.location.pathname.startsWith('/login')) window.location.replace('/login');
    throw { status: 401, code: 'SIGNED_OUT' } satisfies Api_Problem;
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw { status: response.status, code: data?.code ?? 'ERROR', detail: data?.detail, errors: data?.errors } satisfies Api_Problem;
  return data as T;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Api_Problem | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e as Api_Problem);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

export function problemText(problem: Api_Problem | null): string | null {
  if (!problem) return null;
  const known: Record<string, string> = {
    PERMISSION_DENIED: 'Your role does not allow this action.',
    STATION_CODE_TAKEN: 'This station code is already used. Pick another one.',
    REQUEST_ALREADY_DECIDED: 'Someone already decided this request.',
    VALIDATION_FAILED: 'Please check the highlighted fields.',
    LAST_SUPER_ADMIN: 'At least one active Super Admin must remain.',
    CANNOT_GRANT: 'You cannot give permissions you do not have yourself.',
    API_UNREACHABLE: 'The admin API is not running. Start it with: npm run start:platform',
  };
  return known[problem.code] ?? problem.detail ?? `Something went wrong (${problem.code}).`;
}
