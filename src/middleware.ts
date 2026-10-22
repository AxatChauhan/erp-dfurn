import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets, images, manifest, and auth APIs through unconditionally
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    /\.(png|jpg|jpeg|svg|webp|ico|gif|css|js|json)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isLoginPage = pathname.startsWith('/login');

  // For API endpoints, return 401 JSON instead of redirecting to HTML login page
  if (pathname.startsWith('/api/')) {
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication token is missing or invalid' },
        { status: 401 }
      );
    }

    // Role-based API route guards
    if (pathname.startsWith('/api/users')) {
      if (session.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Super Admin access required' },
          { status: 403 }
        );
      }
    }

    if (pathname.startsWith('/api/hrm')) {
      if (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER') {
        return NextResponse.json(
          { error: 'Forbidden: Manager or Admin access required' },
          { status: 403 }
        );
      }
    }

    return NextResponse.next();
  }

  const ua = request.headers.get('user-agent') || '';
  const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);

  // Page routes: Redirect unauthenticated requests to /login
  if (!session && !isLoginPage) {
    const loginUrl = new URL('/login', request.url);
    // Only persist explicit deep-link redirects, avoid forcing desktop /clients on mobile
    if (pathname !== '/' && pathname !== '/clients') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Page routes: Redirect authenticated users away from /login to role/device portal
  if (session && isLoginPage) {
    const target = isMobile ? '/app/enquiries' : '/clients';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Role-based Page route guards
  if (session) {
    if (pathname === '/users' || pathname.startsWith('/users/')) {
      if (session.role !== 'SUPER_ADMIN') {
        return NextResponse.redirect(new URL('/clients', request.url));
      }
    }

    if (pathname.startsWith('/hrm')) {
      if (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER') {
        return NextResponse.redirect(new URL('/clients', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static file extensions (svg, png, jpg, jpeg, gif, webp, ico)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
