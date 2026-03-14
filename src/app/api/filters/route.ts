import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/services/logger';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

const filterSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(100),
  filterConfig: z.record(z.string(), z.unknown()),
  isDefault: z.boolean().optional(),
});

// 获取用户保存的筛选器
export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    logger.setContext({ userId });

    const data = await withRetry(async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('saved_filters')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data ?? [];
    });

    logger.info(`Filters fetched: ${data.length} filters`);
    return NextResponse.json(data);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Get filters failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}

// 创建保存的筛选器
export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const validated = filterSchema.parse(body);
    const { userId, name, filterConfig, isDefault } = validated;

    logger.setContext({ userId });

    const data = await withRetry(async () => {
      const supabase = await createClient();

      // 如果设置为默认，取消其他默认设置
      if (isDefault) {
        await supabase
          .from('saved_filters')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { data, error } = await supabase
        .from('saved_filters')
        .insert({
          user_id: userId,
          name,
          filter_config: filterConfig,
          is_default: isDefault ?? false,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    });

    logger.info(`Filter created: ${data.id}`);
    return NextResponse.json(data);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Create filter failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}

// 删除保存的筛选器
export async function DELETE(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    const filterId = searchParams.get('filterId');

    if (!filterId) {
      return NextResponse.json({ error: '筛选器ID不能为空' }, { status: 400 });
    }

    logger.setContext({ filterId });

    await withRetry(async () => {
      const supabase = await createClient();
      const { error } = await supabase
        .from('saved_filters')
        .delete()
        .eq('id', filterId);

      if (error) {
        throw new Error(error.message);
      }
    });

    logger.info(`Filter deleted: ${filterId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Delete filter failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}
