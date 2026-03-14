import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRuleSetById } from '@/services/db';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

export async function GET(request: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  const { setId } = await params;
  const data = await getRuleSetById(setId);
  return NextResponse.json(data);
}
