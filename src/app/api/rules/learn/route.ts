import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { requireProjectAccess } from '@/services/orgs';

export const dynamic = 'force-dynamic';

// Trigger auto-adjustment of rule weights
const rateLimiter = createRateLimiter(RATE_LIMITS.general);

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  const supabase = createAdminClient();

  const { error } = await supabase.rpc('auto_adjust_rule_weights');

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

  let query = supabase
    .from('learned_patterns')
    .select('*')
    .eq('is_enabled', true)
    .order('confidence_score', { ascending: false });

  if (projectId) {
    await requireProjectAccess(projectId, user.id);
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
