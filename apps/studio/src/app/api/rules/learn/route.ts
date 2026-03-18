import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { exec, query } from '@/lib/db';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { getActiveOrgId, getOrgMemberRole, isRoleAllowed, ORG_ADMIN_ROLES, requireProjectAccess } from '@/services/orgs';

export const dynamic = 'force-dynamic';

// Trigger auto-adjustment of rule weights
const rateLimiter = createRateLimiter(RATE_LIMITS.general);

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);
  const role = await getOrgMemberRole(orgId, user.id);
  if (!isRoleAllowed(role, ORG_ADMIN_ROLES)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await exec(`select auto_adjust_rule_weights($1)`, [orgId]);

  return NextResponse.json({ success: true, message: 'Rule weights adjusted' });
}

// Get learned patterns
export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);

  let sql = `
    select lp.*
    from quality_learned_patterns lp
    join code_projects p on p.id = lp.project_id
    where lp.is_enabled = true and p.org_id = $1
  `;
  const params: unknown[] = [orgId];

  if (projectId) {
    const project = await requireProjectAccess(projectId, user.id);
    if (!project.org_id || project.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    params.push(projectId);
    sql += ` and lp.project_id = $${params.length}`;
  }

  sql += ` order by lp.confidence_score desc`;

  const data = await query<Record<string, unknown>>(sql, params);

  return NextResponse.json(data ?? []);
}
