import { NextResponse } from 'next/server';
import { callPlatform, clientIp, json, sameOrigin } from '@/lib/Platform_Server';
import { clearAll, readCookie, setSession, setStepToken } from '@/lib/Session_Cookies';

type Login_Result =
  | { next: 'setup'; setupToken: string; mustChangePassword: boolean; mfaEnabled: boolean }
  | { next: 'mfa'; mfaToken: string }
  | { next: 'done'; accessToken: string; refreshToken: string; expiresIn: number };

/** Turns an API sign-in result into cookies; the browser only learns which step comes next. */
async function handleResult(status: number, body: unknown): Promise<NextResponse> {
  if (status !== 200) return NextResponse.json(body, { status });
  const result = body as Login_Result;
  if (result.next === 'setup') {
    await setStepToken('setup', result.setupToken);
    return NextResponse.json({ next: 'setup', mustChangePassword: result.mustChangePassword, mfaEnabled: result.mfaEnabled });
  }
  if (result.next === 'mfa') {
    await setStepToken('mfa', result.mfaToken);
    return NextResponse.json({ next: 'mfa' });
  }
  await setSession(result.accessToken, result.refreshToken, result.expiresIn);
  return NextResponse.json({ next: 'done' });
}

export async function POST(request: Request, { params }: { params: Promise<{ step: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ code: 'BAD_ORIGIN' }, { status: 403 });
  const { step } = await params;
  const body = await request.json().catch(() => ({}));
  const ip = clientIp(request);
  const ua = request.headers.get('user-agent') ?? '';

  switch (step) {
    case 'login': {
      const r = await callPlatform('auth/login', { method: 'POST', body: { email: body.email, password: body.password }, ip, ua });
      return handleResult(r.status, r.body);
    }
    case 'password': {
      const token = (await readCookie('setup')) ?? (await readCookie('access'));
      if (!token) return NextResponse.json({ code: 'SIGNED_OUT' }, { status: 401 });
      const r = await callPlatform('auth/password/change', { method: 'POST', token, body: { currentPassword: body.currentPassword, newPassword: body.newPassword }, ip, ua });
      return handleResult(r.status, r.body);
    }
    case 'mfa-setup': {
      const token = await readCookie('setup');
      if (!token) return NextResponse.json({ code: 'SIGNED_OUT' }, { status: 401 });
      return json(await callPlatform('auth/mfa/setup', { method: 'POST', token, ip, ua }));
    }
    case 'mfa-enable': {
      const token = await readCookie('setup');
      if (!token) return NextResponse.json({ code: 'SIGNED_OUT' }, { status: 401 });
      const r = await callPlatform('auth/mfa/enable', { method: 'POST', token, body: { code: body.code }, ip, ua });
      return handleResult(r.status, r.body);
    }
    case 'mfa-verify': {
      const token = await readCookie('mfa');
      if (!token) return NextResponse.json({ code: 'SIGNED_OUT' }, { status: 401 });
      const r = await callPlatform('auth/mfa/verify', { method: 'POST', token, body: { code: body.code }, ip, ua });
      return handleResult(r.status, r.body);
    }
    case 'logout': {
      const token = await readCookie('access');
      const refreshToken = await readCookie('refresh');
      if (token) await callPlatform('auth/logout', { method: 'POST', token, body: { refreshToken } });
      await clearAll();
      return new NextResponse(null, { status: 204 });
    }
    default:
      return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  }
}
