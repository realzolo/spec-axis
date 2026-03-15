import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { formatErrorResponse } from '@/services/retry';
import { createEmailVerification, createUser } from '@/services/auth';
import { ensurePersonalOrg } from '@/services/orgs';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { auditLogger, extractClientInfo } from '@/services/audit';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.strict);

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : null;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await createUser(email, password, displayName);
    const verification = await createEmailVerification(user.id);

    await ensurePersonalOrg(user.id, user.email ?? null);

    const clientInfo = extractClientInfo(request);
    await auditLogger.log({
      action: 'create',
      entityType: 'user',
      entityId: user.id,
      userId: user.id,
      ...clientInfo,
    });

    const payload: Record<string, unknown> = {
      user: { id: user.id, email: user.email },
      verificationRequired: true,
    };

    if (process.env.NODE_ENV !== 'production') {
      payload.verificationToken = verification.token;
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    return NextResponse.json({ error }, { status: statusCode });
  }
}
