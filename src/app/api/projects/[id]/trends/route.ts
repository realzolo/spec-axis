import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/services/logger';
import { projectIdSchema, dateRangeSchema } from '@/services/validation';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';

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

  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    // 验证项目 ID
    const projectId = projectIdSchema.parse(id);

    // 验证查询参数
    const validated = dateRangeSchema.parse({
      days: searchParams.get('days') ?? '30',
    });
    const { days } = validated;

    logger.setContext({ projectId });

    // 计算日期范围
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // 查询趋势数据（带重试）
    const data = await withRetry(async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('quality_snapshots')
        .select('*')
        .eq('project_id', projectId)
        .gte('snapshot_date', startDateStr)
        .order('snapshot_date', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data ?? [];
    });

    logger.info(`Trends fetched: ${projectId} (${data.length} snapshots)`);

    return NextResponse.json(data ?? []);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Trends request failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}
