import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { requireReportAccess } from '@/services/orgs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await requireUser();
  if (!user) return unauthorized();

  const { id: reportId } = await params;
  const body = await request.json();
  const { message, conversationId, issueId } = body;

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  await requireReportAccess(reportId, user.id);
  const supabase = createAdminClient();

  // Get report details
  const { data: report } = await supabase
    .from('reports')
    .select('*, projects(*)')
    .eq('id', reportId)
    .single();

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // Get or create conversation
  let conversation;
  if (conversationId) {
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    conversation = data;
  }

  if (!conversation) {
    const { data } = await supabase
      .from('ai_conversations')
      .insert({
        report_id: reportId,
        issue_id: isUuid(issueId) ? issueId : null,
        messages: []
      })
      .select()
      .single();
    conversation = data;
  }

  const messages = conversation?.messages || [];

  // Build context
  let context = `You are a senior code reviewer assisting a developer with code quality questions.

## Project
- Name: ${report.projects?.name}
- Repository: ${report.projects?.repo}
- Overall score: ${report.score}/100

## Report summary
${report.summary}

## Issue stats
- Total issues: ${report.issues?.length ?? 0}
- Critical/high issues: ${report.issues?.filter((i: Record<string, unknown>) => i.severity === 'critical' || i.severity === 'high').length ?? 0}

`;

  if (issueId) {
    let issue: Record<string, unknown> | null = null;
    if (isUuid(issueId)) {
      const { data } = await supabase
        .from('report_issues')
        .select('*')
        .eq('id', issueId)
        .single();
      issue = data || null;
    }

    if (!issue && report.issues) {
      issue = report.issues.find((i: Record<string, unknown>) => i.file === issueId) || null;
    }

    if (issue) {
      context += `\n## Focus issue
File: ${issue.file}
Line: ${issue.line ?? 'Unknown'}
Severity: ${issue.severity}
Category: ${issue.category}
Rule: ${issue.rule}
Issue: ${issue.message}
Suggestion: ${issue.suggestion ?? 'None'}
`;
      if (issue.code_snippet || issue.codeSnippet) {
        const snippet = (issue.code_snippet || issue.codeSnippet) as string;
        context += `\nCode snippet:\n\`\`\`\n${snippet}\n\`\`\`\n`;
      }
    }
  }

  context += `\nPlease respond in English with clear, actionable guidance.`;

  // Call Claude API
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    ...(process.env.ANTHROPIC_BASE_URL && { baseURL: process.env.ANTHROPIC_BASE_URL }),
  });

  const apiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...messages,
    { role: 'user', content: message }
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: context,
    messages: apiMessages
  });

  const assistantMessage = response.content[0].type === 'text' ? response.content[0].text : '';

  // Update conversation
  const updatedMessages = [
    ...messages,
    { role: 'user', content: message, timestamp: new Date().toISOString() },
    { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() }
  ];

  await supabase
    .from('ai_conversations')
    .update({
      messages: updatedMessages,
      updated_at: new Date().toISOString()
    })
    .eq('id', conversation.id);

  return NextResponse.json({
    conversationId: conversation.id,
    message: assistantMessage
  });
}

// Get conversation history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await requireUser();
  if (!user) return unauthorized();

  const { id: reportId } = await params;
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');

  const supabase = createAdminClient();

  await requireReportAccess(reportId, user.id);

  if (conversationId) {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }

  // Get all conversations for this report
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

function isUuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
