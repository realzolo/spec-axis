import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
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

  const supabase = createAdminClient();
  const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);
  const role = await getOrgMemberRole(orgId, user.id);
  if (!isRoleAllowed(role, ORG_ADMIN_ROLES)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.rpc('auto_adjust_rule_weights', { p_org_id: orgId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  const supabase = createAdminClient();
  const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);

  let query = supabase
    .from('learned_patterns')
    .select('*, projects!inner(org_id)')
    .eq('is_enabled', true)
    .eq('projects.org_id', orgId)
    .order('confidence_score', { ascending: false });

  if (projectId) {
    const project = await requireProjectAccess(projectId, user.id);
    if (!project.org_id || project.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cleaned = (data || []).map((row: Record<string, unknown>) => {
    const { projects, ...rest } = row;
    return rest;
  });

  return NextResponse.json(cleaned);
}
