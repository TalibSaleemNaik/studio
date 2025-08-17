
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/firebase-admin';

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // List of public paths that don't require authentication
  const publicPaths = ['/login', '/signup', '/'];

  // If the path is public, let the request through
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // For protected routes, check for a session cookie
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verify the session cookie.
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    
    // The cookie is valid, pass the user data in headers.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('X-User-Session', JSON.stringify(decodedClaims));

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
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - / (the root landing page)
     * - /login
     * - /signup
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|signup|$).*)',
  ],
  runtime: 'nodejs', // This is the crucial line to fix the error
};
