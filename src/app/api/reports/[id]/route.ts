import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getReportById, deleteReport } from '@/services/db';
import { logger } from '@/services/logger';
import { reportIdSchema } from '@/services/validation';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { auditLogger, extractClientInfo } from '@/services/audit';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await params;
    const reportId = reportIdSchema.parse(id);

    logger.setContext({ reportId });

    const report = await withRetry(() => getReportById(reportId));
    if (!report) {
      return NextResponse.json({ error: '报告不存在' }, { status: 404 });
    }

    logger.info(`Report fetched: ${reportId}`);
    return NextResponse.json(report);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Get report failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await params;
    const reportId = reportIdSchema.parse(id);

    logger.setContext({ reportId });

    await withRetry(() => deleteReport(reportId));

    // 记录审计日志
    const clientInfo = extractClientInfo(request);
    await auditLogger.log({
      action: 'delete',
      entityType: 'report',
      entityId: reportId,
      ...clientInfo,
    });

    logger.info(`Report deleted: ${reportId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Delete report failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}
