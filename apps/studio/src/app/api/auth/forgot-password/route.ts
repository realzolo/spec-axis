import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createPasswordReset } from '@/services/auth';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.strict);

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = await request.json();
  const email = String(body?.email ?? '').trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const reset = await createPasswordReset(email);

  const payload: Record<string, unknown> = { success: true };
  if (process.env.NODE_ENV !== 'production' && reset) {
    payload.resetToken = reset.token;
  }

  return NextResponse.json(payload);
}
