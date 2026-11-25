import { NextResponse, type NextRequest } from 'next/server';
import { authEnv } from '@/lib/env';
import { isPublicPath } from '@/lib/auth/gate';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  let ok = false;
  try {
    ok = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, authEnv().SESSION_SECRET);
  } catch {
    ok = false; // missing config locks the app instead of opening it
  }
  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
