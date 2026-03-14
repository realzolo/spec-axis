import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Submit feedback for a rule
export async function POST(request: Request) {
  const body = await request.json();
  const {
    ruleId,
    reportId,
    issueFile,
    issueLine,
    feedbackType,
    userId,
    notes,
  } = body;

  if (!ruleId || !reportId || !issueFile || !feedbackType || !userId) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  const validFeedbackTypes = ['helpful', 'not_helpful', 'false_positive', 'too_strict', 'too_lenient'];
  if (!validFeedbackTypes.includes(feedbackType)) {
    return NextResponse.json({ error: '无效的反馈类型' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('rule_feedback')
    .insert({
      rule_id: ruleId,
      report_id: reportId,
      issue_file: issueFile,
      issue_line: issueLine,
      feedback_type: feedbackType,
      user_id: userId,
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
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get('ruleId');

  const supabase = await createClient();

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
