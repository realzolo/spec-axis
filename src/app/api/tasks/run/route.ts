import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { taskQueue } from '@/services/taskQueue';
import { handleQueuedTask } from '@/services/taskHandlers';
import { requireUser, unauthorized } from '@/services/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-task-token');
  if (process.env.TASK_RUNNER_TOKEN && token !== process.env.TASK_RUNNER_TOKEN) {
    return NextResponse.json({ error: '无效的任务令牌' }, { status: 403 });
  }

  if (!process.env.TASK_RUNNER_TOKEN) {
    const user = await requireUser();
    if (!user) return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '1'), 10);

  let processed = 0;
  for (let i = 0; i < limit; i += 1) {
    const ok = await taskQueue.processOnce(handleQueuedTask);
    if (!ok) break;
    processed += 1;
  }

  return NextResponse.json({ processed });
}
