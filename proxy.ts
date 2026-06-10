import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getApiPrefix } from './lib/utils';

function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Decode base64 payload from JWT token
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    
    const exp = payload.exp;
    if (!exp) return false;
    
    const now = Math.floor(Date.now() / 1000);
    return exp > now;
  } catch (error) {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const apiPrefix = getApiPrefix();

  // Intercept and proxy API calls to the backend to bypass CORS (server-to-server rewrite)
  if (pathname.startsWith(apiPrefix + '/') && !pathname.endsWith('/attendance/justify/chat')) {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    const path = pathname.replace(apiPrefix + '/', '');
    const targetUrl = new URL(`${backendUrl}/${path}${search}`);
    return NextResponse.rewrite(targetUrl);
  }

  const token = request.cookies.get('id_token')?.value;
  const isAuthenticated = isTokenValid(token);

  // Let public assets, next internals, and specific paths pass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/)
  ) {
    return NextResponse.next();
  }

  const isAuthPage = pathname.startsWith('/auth');

  if (!isAuthenticated && !isAuthPage) {
    const signInUrl = new URL('/auth/sign-in', request.url);
    // Keep target url in a query param to redirect after login if needed
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthenticated && isAuthPage) {
    const dashboardUrl = new URL('/', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
