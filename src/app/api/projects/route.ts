import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProjects, createProject } from '@/services/db';
import { validateRepo, getRepoBranches } from '@/services/github';
import { logger } from '@/services/logger';
import { createProjectSchema } from '@/services/validation';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { auditLogger, extractClientInfo } from '@/services/audit';
import { requireUser, unauthorized } from '@/services/auth';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const data = await withRetry(() => getProjects());
    logger.info(`Projects fetched: ${data.length} projects`);
    return NextResponse.json(data);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Get projects failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const validated = createProjectSchema.parse(body);
    const { name, repo, description, default_branch, ruleset_id } = validated;

    logger.setContext({ repo });

    // 验证仓库
    const valid = await withRetry(() => validateRepo(repo));
    if (!valid) {
      return NextResponse.json({ error: '仓库不存在或无法访问' }, { status: 400 });
    }

    // 获取分支列表
    const branches = await withRetry(() => getRepoBranches(repo));
    const branch = default_branch ?? branches[0] ?? 'main';

    // 创建项目
    const project = await withRetry(() =>
      createProject({ name, repo, description, default_branch: branch, ruleset_id })
    );

    // 记录审计日志
    const clientInfo = extractClientInfo(request);
    await auditLogger.log({
      action: 'create',
      entityType: 'project',
      entityId: project.id,
      changes: { name, repo, description },
      ...clientInfo,
    });

    logger.info(`Project created: ${project.id}`);
    return NextResponse.json(project);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Create project failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}
