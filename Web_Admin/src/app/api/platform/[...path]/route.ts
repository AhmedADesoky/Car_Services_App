import { NextResponse } from 'next/server';
import { callWithSession, clientIp, json, sameOrigin } from '@/lib/Platform_Server';

/**
 * Same-origin proxy: browser -> /api/platform/<path> -> Admin API with the session cookie.
 * Only whitelisted top-level resources; auth endpoints go through /api/auth/*.
 */
const ALLOWED = new Set(['dashboard', 'station-requests', 'stations', 'plans', 'team', 'roles', 'permissions', 'departments', 'audit-logs', 'auth']);

async function forward(request: Request, path: string[], method: string) {
  if (!ALLOWED.has(path[0]) || (path[0] === 'auth' && path[1] !== 'me')) {
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  }
  if (path.some((p) => p === '..' || p.includes('/'))) return NextResponse.json({ code: 'BAD_PATH' }, { status: 400 });
  if (method !== 'GET' && !sameOrigin(request)) return NextResponse.json({ code: 'BAD_ORIGIN' }, { status: 403 });
  const url = new URL(request.url);
  const body = method === 'GET' || method === 'DELETE' ? undefined : await request.json().catch(() => ({}));
  const result = await callWithSession(`${path.map(encodeURIComponent).join('/')}${url.search}`, {
    method, body, ip: clientIp(request), ua: request.headers.get('user-agent') ?? '',
  });
  return json(result);
}

type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, ctx: Ctx) { return forward(request, (await ctx.params).path, 'GET'); }
export async function POST(request: Request, ctx: Ctx) { return forward(request, (await ctx.params).path, 'POST'); }
export async function PATCH(request: Request, ctx: Ctx) { return forward(request, (await ctx.params).path, 'PATCH'); }
export async function PUT(request: Request, ctx: Ctx) { return forward(request, (await ctx.params).path, 'PUT'); }
export async function DELETE(request: Request, ctx: Ctx) { return forward(request, (await ctx.params).path, 'DELETE'); }
