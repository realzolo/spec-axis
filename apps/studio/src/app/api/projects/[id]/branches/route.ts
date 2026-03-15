import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRepoBranches } from '@/services/github';
import { codebaseService } from '@/services/CodebaseService';
import { logger } from '@/services/logger';
import { projectIdSchema } from '@/services/validation';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { requireProjectAccess } from '@/services/orgs';

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
    const projectId = projectIdSchema.parse(id);

    logger.setContext({ projectId });

    const project = await withRetry(() => requireProjectAccess(projectId, user.id));
    const syncPolicy = resolveSyncPolicy(request.nextUrl.searchParams.get('sync'));
    const branches = await withRetry(async () => {
      try {
        return await codebaseService.listBranches(
          {
            orgId: project.org_id,
            projectId,
            repo: project.repo,
            ref: project.default_branch,
          },
          { syncPolicy }
        );
      } catch {
        return await getRepoBranches(project.repo, projectId).catch(() => [project.default_branch]);
      }
    });

    const result = Array.isArray(branches) && branches.length ? branches : [project.default_branch];
    logger.info(`Branches fetched: ${projectId}`);
    return NextResponse.json(result);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Get branches failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}

function resolveSyncPolicy(value: string | null): 'auto' | 'force' | 'never' {
  if (!value) return 'auto';
  const normalized = value.trim().toLowerCase();
  if (['0', 'false', 'no', 'off', 'never'].includes(normalized)) return 'never';
  if (['1', 'true', 'yes', 'force'].includes(normalized)) return 'force';
  return 'auto';
}
