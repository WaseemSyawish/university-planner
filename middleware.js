import { NextResponse } from 'next/server';

// Phase A middleware: protect a small set of pages by ensuring a demo `userId` cookie exists.
// This is intentionally minimal for local/dev use. Do not rely on this for production auth.

const PROTECTED_PATHS = ['/overview', '/calendar', '/timetable', '/modules', '/grades', '/attendance', '/settings', '/profile'];

export function middleware(req) {
  try {
    const url = req.nextUrl.clone();
    const { pathname } = url;

    // Allow non-protected paths through
    if (!PROTECTED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();

    // Synchronously check for next-auth session cookies only.
    try {
      if (req.cookies && req.cookies.get) {
        const na1 = req.cookies.get('next-auth.session-token');
        const na2 = req.cookies.get('__Secure-next-auth.session-token');
        if (na1 || na2) return NextResponse.next();
      }
      // Fallback: check the raw Cookie header for presence of next-auth token names
      const raw = req.headers.get('cookie') || '';
      if (raw.includes('next-auth.session-token=') || raw.includes('__Secure-next-auth.session-token=')) {
        return NextResponse.next();
      }
    } catch (e) {
      // ignore and redirect
    }

    url.pathname = '/signin';
    // preserve returnTo param so user can be redirected back after sign-in
    url.searchParams.set('returnTo', req.nextUrl.pathname);
    // Dev-only logging to help trace auth redirects
    try { if (process.env.NODE_ENV !== 'production') console.log('[middleware] redirecting unauthenticated request to /signin, returnTo=', req.nextUrl.pathname); } catch (e) {}
    return NextResponse.redirect(url);
  } catch (err) {
    // Fail open on unexpected errors to avoid blocking the app during dev
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/overview', '/calendar', '/timetable', '/modules', '/grades', '/attendance', '/settings', '/profile'],
};
