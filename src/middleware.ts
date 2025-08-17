
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/firebase-admin';

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value;

  if (!sessionCookie) {
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('X-User-Session', JSON.stringify(decodedClaims));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    // Session cookie is invalid. Clear it and redirect to login.
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }
}

// Protect all routes under /dashboard
export const config = {
  matcher: ['/dashboard/:path*'],
}
