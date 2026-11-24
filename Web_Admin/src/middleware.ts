import { NextRequest, NextResponse } from 'next/server';

/** Console pages need a session (access or refresh cookie). The API still checks every request. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = request.cookies.has('gos_access') || request.cookies.has('gos_refresh');
  if (pathname.startsWith('/login')) {
    return signedIn ? NextResponse.redirect(new URL('/dashboard', request.url)) : NextResponse.next();
  }
  if (!signedIn) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
