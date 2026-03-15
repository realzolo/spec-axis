import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clearSessionCookie, getSession, revokeSession } from '@/services/auth';
import { auditLogger, extractClientInfo } from '@/services/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getSession();
  const token = request.cookies.get('session')?.value;
  if (token) {
    await revokeSession(token);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);

  if (session) {
    const clientInfo = extractClientInfo(request);
    await auditLogger.log({
      action: 'logout',
      entityType: 'user',
      entityId: session.user.id,
      userId: session.user.id,
      ...clientInfo,
    });
  }

  return response;
}
