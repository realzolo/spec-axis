import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { requireReportAccess } from '@/services/orgs';

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

  if (ruleId) {
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

  // Get all rule statistics
  const { data, error } = await supabase
    .from('rule_statistics')
    .select('*, rules(name, category)')
    .order('accuracy_score', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
