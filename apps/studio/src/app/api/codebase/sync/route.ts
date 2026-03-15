import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/server';
import { codebaseService } from '@/services/CodebaseService';
import { projectIdSchema } from '@/services/validation';
import { formatErrorResponse } from '@/services/retry';
import { requireUser, unauthorized } from '@/services/auth';
import { logger } from '@/services/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-task-token');
  if (process.env.TASK_RUNNER_TOKEN) {
    if (token !== process.env.TASK_RUNNER_TOKEN) {
      const user = await requireUser();
      if (!user) return unauthorized();
    }
  } else {
    const user = await requireUser();
    if (!user) return unauthorized();
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? '10'), 50);
    const force = parseBoolean(searchParams.get('force'));
    const projectIdParam = searchParams.get('project_id');
    const orgIdParam = searchParams.get('org_id');

    const supabase = createAdminClient();
    let projects: Array<{ id: string; org_id: string | null; repo: string | null }> = [];

    if (projectIdParam) {
      const projectId = projectIdSchema.parse(projectIdParam);
      const { data, error } = await supabase
        .from('projects')
        .select('id, org_id, repo')
        .eq('id', projectId)
        .single();
      if (error || !data) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      projects = [data as { id: string; org_id: string | null; repo: string | null }];
    } else {
      let query = supabase
        .from('projects')
        .select('id, org_id, repo')
        .not('org_id', 'is', null);

      if (orgIdParam) {
        query = query.eq('org_id', orgIdParam);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        throw new Error(error.message);
      }
      projects = (data || []) as Array<{ id: string; org_id: string | null; repo: string | null }>;
    }

    let synced = 0;
    let failed = 0;
    const failures: Array<{ projectId: string; error: string }> = [];

    for (const project of projects) {
      if (!project.org_id || !project.repo) {
        failed += 1;
        failures.push({ projectId: project.id, error: 'missing_org_or_repo' });
        continue;
      }

      try {
        await codebaseService.ensureMirror(
          {
            orgId: project.org_id,
            projectId: project.id,
            repo: project.repo,
          },
          { forceSync: force }
        );
        synced += 1;
      } catch (err) {
        failed += 1;
        failures.push({
          projectId: project.id,
          error: err instanceof Error ? err.message : 'sync_failed',
        });
        logger.warn('Codebase sync failed', err instanceof Error ? err : undefined);
      }
    }

    return NextResponse.json({
      processed: projects.length,
      synced,
      failed,
      failures,
    });
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    return NextResponse.json({ error }, { status: statusCode });
  }
}

function parseBoolean(value: string | null) {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}
