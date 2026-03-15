import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/services/logger';
import { projectIdSchema } from '@/services/validation';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { requireProjectAccess } from '@/services/orgs';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

const createCommentSchema = z.object({
  ref: z.string().min(1),
  path: z.string().min(1),
  line: z.number().int().positive(),
  line_end: z.number().int().positive().optional(),
  selection_text: z.string().max(2000).optional(),
  assignees: z.array(z.string().uuid()).max(20).optional(),
  body: z.string().min(1).max(5000),
}).refine((data) => !data.line_end || data.line_end >= data.line, {
  message: 'line_end must be >= line',
  path: ['line_end'],
});

// List comments for a file (optionally filter by line)
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

  try {
    const { id } = await params;
    const projectId = projectIdSchema.parse(id);

    logger.setContext({ projectId });

    const project = await withRetry(() => requireProjectAccess(projectId, user.id));
    const ref = request.nextUrl.searchParams.get('ref') || project.default_branch;
    const path = request.nextUrl.searchParams.get('path') || '';
    const lineParam = request.nextUrl.searchParams.get('line');
    const line = lineParam ? Number(lineParam) : undefined;

    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    const comments = await withRetry(async () => {
      const supabase = createAdminClient();
      let query = supabase
        .from('codebase_comments')
        .select('*, assignees:codebase_comment_assignees(user_id,email)')
        .eq('project_id', projectId)
        .eq('org_id', project.org_id)
        .eq('repo', project.repo)
        .eq('ref', ref)
        .eq('path', path)
        .order('created_at', { ascending: true });

      if (Number.isFinite(line)) {
        query = query.eq('line', line);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      return data ?? [];
    });

    return NextResponse.json(comments);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Get codebase comments failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}

// Create a new comment
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

  try {
    const { id } = await params;
    const projectId = projectIdSchema.parse(id);
    const body = await request.json();
    const validated = createCommentSchema.parse(body);

    logger.setContext({ projectId });

    const project = await withRetry(() => requireProjectAccess(projectId, user.id));

    const comment = await withRetry(async () => {
      const supabase = createAdminClient();
      const selectionText = validated.selection_text?.trim();
      const lineEnd = validated.line_end && validated.line_end >= validated.line
        ? validated.line_end
        : null;
      const { data, error } = await supabase
        .from('codebase_comments')
        .insert({
          org_id: project.org_id,
          project_id: projectId,
          repo: project.repo,
          ref: validated.ref,
          path: validated.path,
          line: validated.line,
          line_end: lineEnd,
          selection_text: selectionText || null,
          author_id: user.id,
          author_email: user.email ?? 'unknown',
          body: validated.body,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const assigneeIds = Array.from(new Set(validated.assignees ?? []));
      if (assigneeIds.length > 0) {
        const { data: members, error: memberError } = await supabase
          .from('org_members')
          .select('user_id')
          .eq('org_id', project.org_id)
          .in('user_id', assigneeIds);

        if (memberError) {
          throw new Error(memberError.message);
        }

        const allowedIds = new Set((members ?? []).map((member) => member.user_id));
        const assigneeRows = await Promise.all(
          assigneeIds
            .filter((id) => allowedIds.has(id))
            .map(async (id) => {
              let email: string | null = null;
              try {
                const { data: userData } = await supabase.auth.admin.getUserById(id);
                email = userData?.user?.email ?? null;
              } catch {}
              return {
                comment_id: data.id,
                user_id: id,
                email,
              };
            })
        );

        if (assigneeRows.length > 0) {
          const { error: assignError } = await supabase
            .from('codebase_comment_assignees')
            .upsert(assigneeRows, { onConflict: 'comment_id,user_id' });
          if (assignError) {
            throw new Error(assignError.message);
          }
        }
      }

      const { data: enriched, error: fetchError } = await supabase
        .from('codebase_comments')
        .select('*, assignees:codebase_comment_assignees(user_id,email)')
        .eq('id', data.id)
        .single();

      if (fetchError || !enriched) {
        return data;
      }

      return enriched;
    });

    return NextResponse.json(comment);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Create codebase comment failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}
