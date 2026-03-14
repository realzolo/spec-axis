import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/services/logger';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { auditLogger, extractClientInfo } from '@/services/audit';
import { z } from 'zod';
import { requireUser, unauthorized } from '@/services/auth';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

const updateIssueSchema = z.object({
  status: z.enum(['open', 'fixed', 'ignored', 'false_positive', 'planned']).optional(),
  notes: z.string().optional(),
  assigned_to: z.string().optional(),
});

const commentSchema = z.object({
  author: z.string().min(1),
  content: z.string().min(1),
});

// 获取问题详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const { id: reportId, issueId } = await params;

    logger.setContext({ issueId });

    const data = await withRetry(async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('report_issues')
        .select('*, issue_comments(*)')
        .eq('id', issueId)
        .eq('report_id', reportId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    });

    logger.info(`Issue fetched: ${issueId}`);
    return NextResponse.json(data);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Get issue failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}

// 更新问题状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const { id: reportId, issueId } = await params;
    const body = await request.json();
    const validated = updateIssueSchema.parse(body);
    const { status, notes, assigned_to } = validated;

    logger.setContext({ issueId });

    const data = await withRetry(async () => {
      const supabase = await createClient();

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (assigned_to !== undefined) updateData.assigned_to = assigned_to;

      const { data, error } = await supabase
        .from('report_issues')
        .update(updateData)
        .eq('id', issueId)
        .eq('report_id', reportId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    });

    // 记录审计日志
    const clientInfo = extractClientInfo(request);
    await auditLogger.log({
      action: 'update',
      entityType: 'report',
      entityId: issueId,
      changes: { status, notes, assigned_to },
      ...clientInfo,
    });

    logger.info(`Issue updated: ${issueId}`);
    return NextResponse.json(data);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Update issue failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}

// 添加评论
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const { issueId } = await params;
    const body = await request.json();
    const validated = commentSchema.parse(body);
    const { author, content } = validated;

    logger.setContext({ issueId });

    const data = await withRetry(async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('issue_comments')
        .insert({ issue_id: issueId, author, content })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    });

    // 记录审计日志
    const clientInfo = extractClientInfo(request);
    await auditLogger.log({
      action: 'create',
      entityType: 'report',
      entityId: issueId,
      changes: { author, content },
      ...clientInfo,
    });

    logger.info(`Comment added to issue: ${issueId}`);
    return NextResponse.json(data);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Add comment failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}
