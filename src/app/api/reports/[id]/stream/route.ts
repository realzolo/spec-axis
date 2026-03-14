import type { NextRequest } from 'next/server';
import { createSSEResponse, watchReportStatus } from '@/services/sse';
import { logger } from '@/services/logger';
import { reportIdSchema } from '@/services/validation';
import { formatErrorResponse } from '@/services/retry';
import { requireUser, unauthorized } from '@/services/auth';
import { requireReportAccess } from '@/services/orgs';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;

    // Validate report ID
    const reportId = reportIdSchema.parse(id);

    logger.setContext({ reportId });
    logger.info('SSE connection established');

    await requireReportAccess(reportId, user.id);

    // Create SSE response
    const response = createSSEResponse(reportId);

    // Watch report status in background
    watchReportStatus(reportId).catch((err) => {
      logger.error('Failed to watch report status', err instanceof Error ? err : undefined);
    });

    return response;
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('SSE connection failed', err instanceof Error ? err : undefined);

    return new Response(
      JSON.stringify({ error }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    logger.clearContext();
  }
}
