import { NextRequest, NextResponse } from 'next/server';

/** "/" -> "/ar" or "/en" from the saved choice or the browser language (Arabic by default for Egypt). */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (/^\/(ar|en)(\/|$)/.test(pathname)) return NextResponse.next();
  const saved = request.cookies.get('locale')?.value;
  const header = request.headers.get('accept-language') ?? '';
  const locale = saved === 'en' || saved === 'ar' ? saved : header.toLowerCase().startsWith('en') ? 'en' : 'ar';
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'] };
