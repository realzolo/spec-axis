import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, maybeRotateSession, setSessionCookie, unauthorized } from '@/services/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
  const userAgent = request.headers.get('user-agent');
  const rotated = await maybeRotateSession(session.token, session.user.id, ip, userAgent);

  const response = NextResponse.json({ user: session.user });
  if (rotated) {
    setSessionCookie(response, rotated.token, rotated.expiresAt);
  }
  return response;
}
