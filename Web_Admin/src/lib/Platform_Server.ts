import 'server-only';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { clearAll, readCookie, setSession } from './Session_Cookies';

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

const API = (process.env.PLATFORM_API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');

export interface Api_Response {
  status: number;
  body: unknown;
}

/** Server-to-server call to the Admin API. */
export async function callPlatform(path: string, init: { method?: string; token?: string; body?: unknown; ip?: string; ua?: string } = {}): Promise<Api_Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.ua) headers['User-Agent'] = init.ua.slice(0, 200);
  if (init.ip) headers['X-Forwarded-For'] = init.ip;
  try {
    const response = await fetch(`${API}/platform/v1/${path.replace(/^\//, '')}`, {
      method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), cache: 'no-store',
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: 503, body: { code: 'API_UNREACHABLE', detail: 'The admin API is not reachable' } };
  }
}

type Token_Pair = { accessToken: string; refreshToken: string; expiresIn: number };

/**
 * Single-flight refresh: a page fires several requests at once; if each rotated the same refresh token,
 * the Admin API would see the 2nd use as a STOLEN token replay and revoke the session.
 * So concurrent callers holding the same refresh token share ONE rotation (kept 30 s for late callers).
 * (In-memory per server instance; with several instances, add sticky sessions or a shared cache.)
 */
const inFlight = new Map<string, Promise<Token_Pair | null>>();

function rotateOnce(refresh: string, ip?: string, ua?: string): Promise<Token_Pair | null> {
  const key = sha256Hex(refresh);
  let pending = inFlight.get(key);
  if (!pending) {
    pending = callPlatform('auth/refresh', { method: 'POST', body: { refreshToken: refresh }, ip, ua })
      .then((r) => (r.status === 200 ? (r.body as Token_Pair) : null));
    inFlight.set(key, pending);
    setTimeout(() => inFlight.delete(key), 30_000);
  }
  return pending;
}

const signedOut = (): Api_Response => ({ status: 401, body: { code: 'SIGNED_OUT', detail: 'Sign in again' } });

/** Uses the session cookie; on an expired access token it rotates the refresh token once and retries. */
export async function callWithSession(path: string, init: { method?: string; body?: unknown; ip?: string; ua?: string } = {}): Promise<Api_Response> {
  const access = await readCookie('access');
  if (access) {
    const first = await callPlatform(path, { ...init, token: access });
    if (first.status !== 401) return first;
  }
  const refresh = await readCookie('refresh');
  if (!refresh) {
    await clearAll(); // dead cookies would make /login bounce back to the console forever
    return signedOut();
  }
  const tokens = await rotateOnce(refresh, init.ip, init.ua);
  if (!tokens) {
    await clearAll();
    return signedOut();
  }
  await setSession(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
  const retried = await callPlatform(path, { ...init, token: tokens.accessToken });
  if (retried.status === 401) {
    await clearAll();
    return signedOut();
  }
  return retried;
}

export function json(result: Api_Response): NextResponse {
  return result.status === 204 ? new NextResponse(null, { status: 204 }) : NextResponse.json(result.body, { status: result.status });
}

/** CSRF defence for state-changing requests: same-origin only (cookies are SameSite=Strict as well). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * The visitor's IP, for audit logs and rate limits in the Admin API.
 * X-Forwarded-For can be typed by anyone, so we only trust the entries added by OUR proxies:
 * set TRUSTED_PROXY_HOPS to the number of proxies in front of this site (e.g. 1 behind one load balancer).
 * Without it nothing is forwarded (the Admin API then sees this server's own address).
 */
export function clientIp(request: Request): string {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 0);
  if (!Number.isInteger(hops) || hops < 1) return '';
  const chain = (request.headers.get('x-forwarded-for') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  // The right-most `hops` entries were appended by our own proxies; the one just before them is the client.
  const ip = chain[chain.length - hops] ?? '';
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : '';
}
