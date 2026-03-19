import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { exec, query, queryOne } from '@/lib/db';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { requireReportAccess } from '@/services/orgs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

interface ReportRow {
  score: number | null;
  summary: string | null;
  issues: Array<Record<string, unknown>> | null;
  project_name: string | null;
  project_repo: string | null;
}

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
};

type ConversationRow = {
  id: string;
  messages: unknown;
};

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

  // Get report details
  const reportRow = await queryOne<ReportRow>(
    `select r.*, p.name as project_name, p.repo as project_repo
     from analysis_reports r
     join code_projects p on p.id = r.project_id
     where r.id = $1`,
    [reportId]
  );

  if (!reportRow) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const project = {
    name: reportRow.project_name,
    repo: reportRow.project_repo,
  };
  const issues = Array.isArray(reportRow.issues) ? reportRow.issues : [];
  const summary = typeof reportRow.summary === 'string' ? reportRow.summary : '';
  const score = typeof reportRow.score === 'number' ? reportRow.score : 0;

  // Get or create conversation
  let conversation: ConversationRow | null = null;
  if (conversationId) {
    conversation = await queryOne<ConversationRow>(
      `select * from analysis_conversations where id = $1`,
      [conversationId]
    );
  }

  if (!conversation) {
    conversation = await queryOne<ConversationRow>(
      `insert into analysis_conversations
        (report_id, issue_id, messages, created_at, updated_at)
       values ($1,$2,'[]'::jsonb,now(),now())
       returning *`,
      [reportId, isUuid(issueId) ? issueId : null]
    );
  }

  if (!conversation) {
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }

  const messages = normalizeConversationMessages(conversation.messages);

  // Build context
  let context = `You are a senior code reviewer assisting a developer with code quality questions.

## Project
- Name: ${project.name}
- Repository: ${project.repo}
- Overall score: ${score}/100

## Report summary
${summary}

## Issue stats
- Total issues: ${issues.length}
- Critical/high issues: ${issues.filter((i: Record<string, unknown>) => i.severity === 'critical' || i.severity === 'high').length}

`;

  if (issueId) {
    let issue: Record<string, unknown> | null = null;
    if (isUuid(issueId)) {
      issue = await queryOne<Record<string, unknown>>(
        `select * from analysis_issues where id = $1`,
        [issueId]
      );
    }

    if (!issue && issues.length > 0) {
      issue = issues.find((i: Record<string, unknown>) => i.file === issueId) || null;
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

  // Call Anthropic Messages API via unified HTTP transport
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
  }
  const baseUrl = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
  const endpoint = baseUrl.endsWith('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`;

  const apiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...messages,
    { role: 'user', content: message }
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: context,
      messages: apiMessages,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: `Anthropic API error: ${response.status} ${response.statusText}` },
      { status: 502 }
    );
  }
  if (looksLikeHTML(response.headers.get('content-type'), raw)) {
    return NextResponse.json(
      { error: 'Anthropic endpoint returned HTML instead of JSON' },
      { status: 502 }
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJSONLoose(raw);
  } catch {
    return NextResponse.json(
      { error: 'Anthropic endpoint returned invalid JSON' },
      { status: 502 }
    );
  }

  const contentBlocks = parsed.content;
  if (!Array.isArray(contentBlocks) || contentBlocks.length === 0 || typeof contentBlocks[0] !== 'object' || !contentBlocks[0]) {
    return NextResponse.json(
      { error: 'Anthropic response missing content' },
      { status: 502 }
    );
  }

  const firstContent = contentBlocks[0] as Record<string, unknown>;
  const assistantMessage = typeof firstContent.text === 'string' ? firstContent.text : '';
  if (!assistantMessage) {
    return NextResponse.json(
      { error: 'Anthropic response missing text content' },
      { status: 502 }
    );
  }

  // Update conversation
  const updatedMessages = [
    ...messages,
    { role: 'user', content: message, timestamp: new Date().toISOString() },
    { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() }
  ];

  await exec(
    `update analysis_conversations
     set messages = $2, updated_at = now()
     where id = $1`,
    [conversation.id, JSON.stringify(updatedMessages)]
  );

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

  await requireReportAccess(reportId, user.id);

  if (conversationId) {
    const data = await queryOne<ConversationRow>(
      `select * from analysis_conversations where id = $1`,
      [conversationId]
    );

    if (!data) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  }

  // Get all conversations for this report
  const data = await query<Record<string, unknown>>(
    `select * from analysis_conversations
     where report_id = $1
     order by created_at desc`,
    [reportId]
  );

  return NextResponse.json(data ?? []);
}

function isUuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function looksLikeHTML(contentType: string | null, bodySnippet: string): boolean {
  const lowerType = (contentType ?? '').toLowerCase();
  if (lowerType.includes('text/html')) return true;
  return bodySnippet.trim().startsWith('<');
}

function parseJSONLoose(raw: string): Record<string, unknown> {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('invalid json');
  }
  const candidate = raw.slice(start, end + 1).trim();
  return JSON.parse(candidate) as Record<string, unknown>;
}

function normalizeConversationMessages(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): ConversationMessage | null => {
      if (!item || typeof item !== 'object') return null;
      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;
      if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
        return null;
      }
      const timestampValue = (item as { timestamp?: unknown }).timestamp;
      return {
        role,
        content,
        ...(typeof timestampValue === 'string' ? { timestamp: timestampValue } : {}),
      };
    })
    .filter((item): item is ConversationMessage => item !== null);
}
