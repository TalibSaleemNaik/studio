
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  
  // Get user from the 'user-session' cookie
  const userCookie = request.cookies.get('user-session')?.value;
  
  // If the cookie exists, forward its value in a request header
  if (userCookie) {
    requestHeaders.set('X-User-Session', userCookie);
  }

  // Return the request with the new headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

// Run middleware on all dashboard routes
export const config = {
  matcher: '/dashboard/:path*',
}
