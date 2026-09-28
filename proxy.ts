import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, isSessionValid } from '@/lib/auth';

/** Sign-in screens: reachable signed out, bounced to the console signed in. */
const SIGN_IN_PAGES = new Set(['/', '/login']);
const PUBLIC_API = new Set(['/api/auth/login', '/api/auth/logout']);

const HOME = '/detections';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = isSessionValid(request.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC_API.has(pathname)) return NextResponse.next();

  if (SIGN_IN_PAGES.has(pathname)) {
    return signedIn
      ? NextResponse.redirect(new URL(HOME, request.url))
      : NextResponse.next();
  }

  if (signedIn) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const signIn = new URL('/', request.url);
  signIn.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(signIn);
}

export const config = {
  // Everything except build assets and static files served from public/.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
