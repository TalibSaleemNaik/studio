
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/firebase-admin';

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // List of public paths that don't require authentication.
  const publicPaths = ['/login', '/signup', '/'];

  // Let the landing page be accessible without auth.
  if (pathname === '/') {
    return NextResponse.next();
  }
  
  // If accessing a public path, do nothing.
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // For all other paths, proceed with authentication check.
  if (!sessionCookie) {
    // If no session cookie, redirect to login, preserving the intended destination.
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url);
  }

  try {
    // Verify the session cookie.
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    
    // The cookie is valid, create new headers to pass user data.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('X-User-Session', JSON.stringify(decodedClaims));

    // Continue to the requested page with the new headers.
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  } catch (error) {
    // Session cookie is invalid. Clear it and redirect to login.
    console.log('Session cookie verification failed:', error);
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }
}

// Apply middleware to all routes except for static assets and API routes.
export const config = {
  /*
   * Match all request paths except for the ones starting with:
   * - api (API routes)
   * - _next/static (static files)
   * - _next/image (image optimization files)
   * - favicon.ico (favicon file)
   */
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
  runtime: 'nodejs',
};
