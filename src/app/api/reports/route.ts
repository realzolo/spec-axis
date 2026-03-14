import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getReports } from '@/services/db';
import { logger } from '@/services/logger';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const data = await withRetry(() => getReports());
    logger.info(`Reports fetched: ${data.length} reports`);
    return NextResponse.json(data);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Get reports failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  }
}
