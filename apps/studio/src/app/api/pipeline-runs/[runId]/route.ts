import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser, unauthorized } from '@/services/auth';
import { getActiveOrgId } from '@/services/orgs';
import { createInMemoryRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { formatErrorResponse } from '@/services/retry';
import { getPipelineRun } from '@/services/conductorGateway';
import { queryOne } from '@/lib/db';
import type { ConductorPipelineRunDetail } from '@sykra/contracts/conductor';

type HydratedPipelineRunDetail = Omit<ConductorPipelineRunDetail, 'run'> & {
  run: ConductorPipelineRunDetail['run'] & {
    triggered_by_email?: string | null;
    triggered_by_name?: string | null;
  };
};

async function hydrateRunActor(detail: ConductorPipelineRunDetail): Promise<HydratedPipelineRunDetail> {
  const run = detail.run;
  if (!run.triggered_by) {
    return detail;
  }
  const actor = await queryOne<{ email: string | null; display_name: string | null }>(
    `select email, display_name
       from auth_users
      where id = $1`,
    [run.triggered_by]
  );
  return {
    ...detail,
    run: {
      ...run,
      triggered_by_email: actor?.email ?? null,
      triggered_by_name: actor?.display_name ?? null,
    },
  };
}

export { hydrateRunActor };


export const dynamic = 'force-dynamic';

const rateLimiter = createInMemoryRateLimiter(RATE_LIMITS.general);

export async function GET(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const { runId } = await params;
    const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);
    if (!orgId) return unauthorized();
    const data = await getPipelineRun(runId);
    const run = data.run;
    if (run.org_id && run.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(await hydrateRunActor(data));
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    return NextResponse.json({ error }, { status: statusCode });
  }
}
