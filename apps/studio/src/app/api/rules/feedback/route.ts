import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
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
  const data = await queryOne<Record<string, any>>(
    `insert into quality_rule_feedback
      (rule_id, report_id, issue_file, issue_line, feedback_type, user_id, notes, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,now())
     returning *`,
    [ruleId, reportId, issueFile, issueLine ?? null, feedbackType, user.id, notes ?? null]
  );

  if (!data) {
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
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

  const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);

  if (ruleId) {
    const ruleSet = await queryOne<{ org_id: string | null; is_global: boolean }>(
      `select rs.org_id, rs.is_global
       from quality_rules r
       join quality_rule_sets rs on rs.id = r.ruleset_id
       where r.id = $1`,
      [ruleId]
    );

    if (!ruleSet) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    if (ruleSet.is_global || ruleSet.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await queryOne<Record<string, any>>(
      `select * from quality_rule_stats where rule_id = $1`,
      [ruleId]
    );

    return NextResponse.json(data || {
      total_triggers: 0,
      helpful_count: 0,
      not_helpful_count: 0,
      false_positive_count: 0,
      accuracy_score: null,
    });
  }

  const rules = await query<{ id: string; name: string; category: string }>(
    `select r.id, r.name, r.category
     from quality_rules r
     join quality_rule_sets rs on rs.id = r.ruleset_id
     where rs.org_id = $1 and rs.is_global = false`,
    [orgId]
  );

  const ruleIds = (rules || []).map((r: { id: string }) => r.id);
  if (ruleIds.length === 0) {
    return NextResponse.json([]);
  }

  const data = await query<Record<string, any>>(
    `select *
     from quality_rule_stats
     where rule_id = any($1::uuid[])
     order by accuracy_score desc`,
    [ruleIds]
  );

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
