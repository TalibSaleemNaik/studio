import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  
  // Example of getting user from a cookie
  // In a real app, you would verify a session token here
  const userCookie = request.cookies.get('user-session')?.value;
  
  if (userCookie) {
    requestHeaders.set('X-User-Session', userCookie);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: '/dashboard/:path*', // Run middleware on dashboard routes
}
