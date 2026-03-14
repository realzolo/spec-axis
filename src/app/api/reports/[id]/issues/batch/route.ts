import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/services/logger';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { auditLogger, extractClientInfo } from '@/services/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

const batchOperationSchema = z.object({
  action: z.enum(['update_status', 'assign', 'delete']),
  issueIds: z.array(z.string()).min(1),
  status: z.enum(['open', 'resolved', 'ignored']).optional(),
  assigned_to: z.string().optional(),
});

// 批量更新问题
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id: reportId } = await params;
    const body = await request.json();
    const validated = batchOperationSchema.parse(body);
    const { action, issueIds, status, assigned_to } = validated;

    logger.setContext({ reportId, action, count: issueIds.length });

    const result = await withRetry(async () => {
      const supabase = await createClient();

      switch (action) {
        case 'update_status': {
          if (!status) {
            throw new Error('状态不能为空');
          }

          const { error } = await supabase
            .from('report_issues')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('report_id', reportId)
            .in('id', issueIds);

          if (error) {
            throw new Error(error.message);
          }

          return { action, affected: issueIds.length };
        }

        case 'assign': {
          if (!assigned_to) {
            throw new Error('分配对象不能为空');
          }

          const { error } = await supabase
            .from('report_issues')
            .update({ assigned_to, updated_at: new Date().toISOString() })
            .eq('report_id', reportId)
            .in('id', issueIds);

          if (error) {
            throw new Error(error.message);
          }

          return { action, affected: issueIds.length };
        }

        case 'delete': {
          const { error } = await supabase
            .from('report_issues')
            .delete()
            .eq('report_id', reportId)
            .in('id', issueIds);

          if (error) {
            throw new Error(error.message);
          }

          return { action, affected: issueIds.length };
        }
      }
    });

    // 记录审计日志
    const clientInfo = extractClientInfo(request);
    await auditLogger.log({
      action: 'update',
      entityType: 'report',
      entityId: reportId,
      changes: { batchAction: action, count: issueIds.length },
      ...clientInfo,
    });

    logger.info(`Batch operation completed: ${action} (${issueIds.length} issues)`);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Batch operation failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}
