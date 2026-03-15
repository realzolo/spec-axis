import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { getActiveOrgId, requireReportAccess } from '@/services/orgs';

export const dynamic = 'force-dynamic';

// Submit feedback for a rule
const rateLimiter = createRateLimiter(RATE_LIMITS.general);

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const {
    ruleId,
    reportId,
    issueFile,
    issueLine,
    feedbackType,
    notes,
  } = body;

  if (!ruleId || !reportId || !issueFile || !feedbackType) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const validFeedbackTypes = ['helpful', 'not_helpful', 'false_positive', 'too_strict', 'too_lenient'];
  if (!validFeedbackTypes.includes(feedbackType)) {
    return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 });
  }

  await requireReportAccess(reportId, user.id);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('rule_feedback')
    .insert({
      rule_id: ruleId,
      report_id: reportId,
      issue_file: issueFile,
      issue_line: issueLine,
      feedback_type: feedbackType,
      user_id: user.id,
      notes,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// Get rule statistics
export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get('ruleId');

  const supabase = createAdminClient();
  const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);

  if (ruleId) {
    const { data: ruleRow, error: ruleError } = await supabase
      .from('rules')
      .select('id, rule_sets!inner(org_id, is_global)')
      .eq('id', ruleId)
      .single();

    if (ruleError || !ruleRow) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const ruleSetJoin = (ruleRow as {
      rule_sets: { org_id: string | null; is_global: boolean } | { org_id: string | null; is_global: boolean }[];
    }).rule_sets;
    const ruleSet = Array.isArray(ruleSetJoin) ? ruleSetJoin[0] : ruleSetJoin;
    if (!ruleSet || ruleSet.is_global || ruleSet.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('rule_statistics')
      .select('*')
      .eq('rule_id', ruleId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || {
      total_triggers: 0,
      helpful_count: 0,
      not_helpful_count: 0,
      false_positive_count: 0,
      accuracy_score: null,
    });
  }

  const { data: rules, error: rulesError } = await supabase
    .from('rules')
    .select('id, name, category, rule_sets!inner(org_id, is_global)')
    .eq('rule_sets.org_id', orgId)
    .eq('rule_sets.is_global', false);

  if (rulesError) {
    return NextResponse.json({ error: rulesError.message }, { status: 500 });
  }

  const ruleIds = (rules || []).map((r: { id: string }) => r.id);
  if (ruleIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from('rule_statistics')
    .select('*')
    .in('rule_id', ruleIds)
    .order('accuracy_score', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ruleMap = new Map(
    (rules || []).map((r: { id: string; name: string; category: string }) => [
      r.id,
      { name: r.name, category: r.category },
    ])
  );

  const merged = (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    rules: ruleMap.get(String(row.rule_id)) ?? null,
  }));

  return NextResponse.json(merged);
}
