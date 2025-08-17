
import { auth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    const idToken = authorization.split('Bearer ')[1];
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
    cookies().set('session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    return NextResponse.json({ status: 'success' });
  }
  return new Response('Unauthorized', { status: 401 });
}
