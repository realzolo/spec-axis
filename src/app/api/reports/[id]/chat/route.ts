import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';

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
    return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
  }

  const supabase = await createClient();

  // Get report details
  const { data: report } = await supabase
    .from('reports')
    .select('*, projects(*)')
    .eq('id', reportId)
    .single();

  if (!report) {
    return NextResponse.json({ error: '报告不存在' }, { status: 404 });
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
  let context = `你是一位资深代码审查专家，正在与开发者讨论代码质量问题。

## 项目信息
- 项目名称：${report.projects?.name}
- 仓库：${report.projects?.repo}
- 总体评分：${report.score}/100

## 报告摘要
${report.summary}

## 问题统计
- 总问题数：${report.issues?.length ?? 0}
- 严重问题：${report.issues?.filter((i: Record<string, unknown>) => i.severity === 'critical' || i.severity === 'high').length ?? 0}

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
      context += `\n## 当前讨论的问题
文件：${issue.file}
行号：${issue.line ?? '未知'}
严重程度：${issue.severity}
类别：${issue.category}
规则：${issue.rule}
问题描述：${issue.message}
修复建议：${issue.suggestion ?? '无'}
`;
      if (issue.code_snippet || issue.codeSnippet) {
        const snippet = (issue.code_snippet || issue.codeSnippet) as string;
        context += `\n代码片段：\n\`\`\`\n${snippet}\n\`\`\`\n`;
      }
    }
  }

  context += `\n请用中文回答开发者的问题，提供专业、详细、可操作的建议。`;

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

  const supabase = await createClient();

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
