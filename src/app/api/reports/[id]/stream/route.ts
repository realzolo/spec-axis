import type { NextRequest } from 'next/server';
import { createSSEResponse, watchReportStatus } from '@/services/sse';
import { logger } from '@/services/logger';
import { reportIdSchema } from '@/services/validation';
import { formatErrorResponse } from '@/services/retry';
import { requireUser, unauthorized } from '@/services/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;

    // 验证报告 ID
    const reportId = reportIdSchema.parse(id);

    logger.setContext({ reportId });
    logger.info('SSE connection established');

    // 创建 SSE 响应
    const response = createSSEResponse(reportId);

    // 异步监听报告状态变化
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
