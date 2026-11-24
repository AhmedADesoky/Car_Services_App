import 'server-only';
import { cookies } from 'next/headers';

/**
 * Tokens NEVER reach browser JavaScript: they live in httpOnly, SameSite=Strict cookies,
 * and only this Next.js server talks to the Admin API.
 */
export const COOKIE = {
  access: 'gos_access',
  refresh: 'gos_refresh',
  setup: 'gos_setup',
  mfa: 'gos_mfa',
} as const;

const secure = process.env.NODE_ENV === 'production';
const base = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/' };

export async function setSession(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE.access, accessToken, { ...base, maxAge: Math.max(60, expiresIn - 30) });
  jar.set(COOKIE.refresh, refreshToken, { ...base, maxAge: 12 * 3600 });
  jar.delete(COOKIE.setup);
  jar.delete(COOKIE.mfa);
}

export async function setStepToken(name: 'setup' | 'mfa', token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE[name], token, { ...base, maxAge: name === 'setup' ? 15 * 60 : 5 * 60 });
}

export async function clearAll(): Promise<void> {
  const jar = await cookies();
  for (const name of Object.values(COOKIE)) jar.delete(name);
}

export async function readCookie(name: keyof typeof COOKIE): Promise<string | undefined> {
  return (await cookies()).get(COOKIE[name])?.value;
}
