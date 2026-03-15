import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProjects, createProject } from '@/services/db';
import { getRepoBranches } from '@/services/github';
import { logger } from '@/services/logger';
import { createProjectSchema } from '@/services/validation';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { auditLogger, extractClientInfo } from '@/services/audit';
import { requireUser, unauthorized } from '@/services/auth';
import { queryOne } from '@/lib/db';
import { createVCSClient } from '@/services/integrations';
import { readSecret } from '@/lib/vault';
import { getActiveOrgId, getOrgMemberRole, isRoleAllowed, ORG_ADMIN_ROLES } from '@/services/orgs';
import { codebaseService } from '@/services/CodebaseService';

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
    const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);
    const data = await withRetry(() => getProjects(orgId));
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
    const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);
    const role = await getOrgMemberRole(orgId, user.id);
    if (!isRoleAllowed(role, ORG_ADMIN_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    logger.setContext({ repo });

    if (ruleset_id) {
      const ruleSet = await queryOne<{ id: string; is_global: boolean; org_id: string | null }>(
        `select id, is_global, org_id
         from quality_rule_sets
         where id = $1`,
        [ruleset_id]
      );

      if (!ruleSet) {
        return NextResponse.json({ error: 'Rule set not found' }, { status: 400 });
      }

      if (!ruleSet.is_global && ruleSet.org_id !== orgId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get user's default VCS integration
    const vcsIntegration = await queryOne<Record<string, any>>(
      `select *
       from org_integrations
       where org_id = $1 and type = 'vcs' and is_default = true
       limit 1`,
      [orgId]
    );

    if (!vcsIntegration) {
      return NextResponse.json(
        { error: 'No VCS integration configured. Please add a code repository integration in Settings > Integrations.' },
        { status: 400 }
      );
    }

    // Get user's default AI integration
    const aiIntegration = await queryOne<Record<string, any>>(
      `select *
       from org_integrations
       where org_id = $1 and type = 'ai' and is_default = true
       limit 1`,
      [orgId]
    );

    if (!aiIntegration) {
      return NextResponse.json(
        { error: 'No AI integration configured. Please add an AI model integration in Settings > Integrations.' },
        { status: 400 }
      );
    }

    // Decrypt the VCS token
    const token = await readSecret(vcsIntegration.vault_secret_name);
    const vcsClient = createVCSClient(vcsIntegration, token);

    // Validate repository access
    const valid = await withRetry(() => vcsClient.testConnection());
    if (!valid) {
      return NextResponse.json({ error: 'Repository not accessible' }, { status: 400 });
    }

    // Create project first to get projectId
    const tempProject = await withRetry(() =>
      createProject({
        name,
        repo,
        description,
        default_branch: default_branch || 'main',
        ruleset_id,
        user_id: user.id,
        org_id: orgId,
        vcs_integration_id: vcsIntegration.id,
        ai_integration_id: aiIntegration.id,
      })
    );

    // Fetch branches (now we have projectId)
    const branches = await withRetry(() => getRepoBranches(repo, tempProject.id)).catch(() => [tempProject.default_branch]);

    // Update project with correct branch if needed
    const project = tempProject;

    enqueueInitialCodebaseSync(project);

    // Audit log
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

function enqueueInitialCodebaseSync(project: { id: string; org_id: string | null; repo: string | null; default_branch: string }) {
  if (!project.org_id || !project.repo) return;
  setTimeout(() => {
    codebaseService
      .ensureMirror(
        {
          orgId: project.org_id as string,
          projectId: project.id,
          repo: project.repo as string,
          ref: project.default_branch,
        },
        { syncPolicy: 'force' }
      )
      .catch((err) => {
        logger.warn('Initial codebase sync failed', err instanceof Error ? err : undefined);
      });
  }, 0);
}
