import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

import { query, withTransaction } from '@/lib/db';
import { logger } from '@/services/logger';
import { projectIdSchema } from '@/services/validation';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { requireProjectAccess } from '@/services/orgs';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

const createCommentSchema = z.object({
  thread_id: z.string().uuid().optional(),
  ref: z.string().min(1).optional(),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/i, 'commit is required').optional(),
  path: z.string().min(1).optional(),
  line: z.number().int().positive().optional(),
  line_end: z.number().int().positive().optional(),
  selection_text: z.string().max(2000).optional(),
  assignees: z.array(z.string().uuid()).max(20).optional(),
  body: z.string().min(1).max(5000),
}).refine((data) => (
  Boolean(data.thread_id) ||
  Boolean(data.ref && data.commit && data.path && data.line)
), {
  message: 'thread_id or complete location is required',
  path: ['thread_id'],
}).refine((data) => (
  data.line_end == null ||
  data.line == null ||
  data.line_end >= data.line
), {
  message: 'line_end must be >= line',
  path: ['line_end'],
});

const patchThreadSchema = z.object({
  thread_id: z.string().uuid(),
  status: z.enum(['open', 'resolved']),
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
    if (!project.org_id || !project.repo) {
      return NextResponse.json({ error: 'Project is not configured' }, { status: 400 });
    }
    const ref = request.nextUrl.searchParams.get('ref') || project.default_branch;
    const commit = request.nextUrl.searchParams.get('commit');
    const path = request.nextUrl.searchParams.get('path') || '';
    const lineParam = request.nextUrl.searchParams.get('line');
    const line = lineParam ? Number(lineParam) : undefined;

    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }
    if (commit && !/^[0-9a-f]{7,40}$/i.test(commit)) {
      return NextResponse.json({ error: 'Invalid commit' }, { status: 400 });
    }

    const comments = await withRetry(async () => {
      const params: unknown[] = [projectId, project.org_id, project.repo, path];
      let sql = `
        select c.*,
               t.id as thread_id,
               t.status as thread_status,
               t.line as thread_line,
               t.line_end as thread_line_end,
               t.resolved_by,
               t.resolved_at,
               coalesce(
                 jsonb_agg(
                   jsonb_build_object('user_id', a.user_id, 'email', a.email)
                   order by a.created_at
                 ) filter (where a.id is not null),
                 '[]'::jsonb
               ) as assignees
        from codebase_comments c
        join codebase_comment_threads t on t.id = c.thread_id
        left join codebase_comment_assignees a on a.comment_id = c.id
        where t.project_id = $1
          and t.org_id = $2
          and t.repo = $3
          and t.path = $4
      `;

      if (commit) {
        params.push(commit);
        sql += ` and t.commit_sha = $${params.length}`;
      } else {
        params.push(ref);
        sql += ` and t.ref = $${params.length}`;
      }

      if (Number.isFinite(line)) {
        params.push(line);
        sql += ` and t.line <= $${params.length} and coalesce(t.line_end, t.line) >= $${params.length}`;
      }

      sql += ` group by c.id, t.id order by t.line asc, c.created_at asc`;

      return query<Record<string, unknown>>(sql, params);
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
    if (!project.org_id || !project.repo) {
      return NextResponse.json({ error: 'Project is not configured' }, { status: 400 });
    }

    const comment = await withRetry(async () => {
      const selectionText = validated.selection_text?.trim();

      return withTransaction(async (client) => {
        const thread = await resolveOrCreateThread({
          client,
          projectId,
          projectOrgId: project.org_id,
          projectRepo: project.repo,
          userId: user.id,
          userEmail: user.email ?? 'unknown',
          input: validated,
        });

        const insertResult = await client.query(
          `insert into codebase_comments
            (thread_id, org_id, project_id, repo, ref, commit_sha, path, line, line_end, selection_text, author_id, author_email, body, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
           returning *`,
          [
            thread.id,
            thread.org_id,
            thread.project_id,
            thread.repo,
            thread.ref,
            thread.commit_sha,
            thread.path,
            thread.line,
            thread.line_end,
            selectionText || null,
            user.id,
            user.email ?? 'unknown',
            validated.body,
          ]
        );

        const inserted = insertResult.rows[0];
        if (!inserted) {
          throw new Error('Failed to create comment');
        }

        const assigneeIds = Array.from(new Set(validated.assignees ?? []));
        if (assigneeIds.length > 0) {
          const memberResult = await client.query(
            `select user_id
             from org_members
             where org_id = $1 and user_id = any($2::uuid[])`,
            [project.org_id, assigneeIds]
          );
          const allowedIds = memberResult.rows.map((row) => row.user_id);

          if (allowedIds.length > 0) {
            const userRows = await client.query(
              `select id, email
               from auth_users
               where id = any($1::uuid[])`,
              [allowedIds]
            );
            const emailMap = new Map(
              userRows.rows.map((row) => [row.id, row.email ?? null])
            );

            const values: unknown[] = [];
            const placeholders = allowedIds.map((id, idx) => {
              const base = idx * 3;
              values.push(inserted.id, id, emailMap.get(id) ?? null);
              return `($${base + 1}, $${base + 2}, $${base + 3})`;
            });

            await client.query(
              `insert into codebase_comment_assignees (comment_id, user_id, email)
               values ${placeholders.join(', ')}
               on conflict (comment_id, user_id) do nothing`,
              values
            );
          }
        }

        const enrichedResult = await client.query(
          `select c.*,
                 t.id as thread_id,
                 t.status as thread_status,
                 t.line as thread_line,
                 t.line_end as thread_line_end,
                 t.resolved_by,
                 t.resolved_at,
                 coalesce(
                   jsonb_agg(
                     jsonb_build_object('user_id', a.user_id, 'email', a.email)
                     order by a.created_at
                   ) filter (where a.id is not null),
                   '[]'::jsonb
                 ) as assignees
           from codebase_comments c
           join codebase_comment_threads t on t.id = c.thread_id
           left join codebase_comment_assignees a on a.comment_id = c.id
           where c.id = $1
           group by c.id, t.id`,
          [inserted.id]
        );

        return enrichedResult.rows[0] ?? inserted;
      });
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

// Update thread status (open/resolved)
export async function PATCH(
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
    const validated = patchThreadSchema.parse(body);

    logger.setContext({ projectId, threadId: validated.thread_id });

    const project = await withRetry(() => requireProjectAccess(projectId, user.id));
    if (!project.org_id || !project.repo) {
      return NextResponse.json({ error: 'Project is not configured' }, { status: 400 });
    }

    const updated = await withRetry(async () => {
      const values: unknown[] = [validated.thread_id, projectId, project.org_id, project.repo];
      const status = validated.status;
      values.push(status);
      const statusIndex = values.length;

      let resolvedFieldsSql = `resolved_by = null, resolved_at = null`;
      if (status === 'resolved') {
        values.push(user.id);
        const resolvedByIndex = values.length;
        resolvedFieldsSql = `resolved_by = $${resolvedByIndex}, resolved_at = now()`;
      }

      const result = await query<Record<string, unknown>>(
        `update codebase_comment_threads
         set status = $${statusIndex},
             ${resolvedFieldsSql},
             updated_at = now()
         where id = $1
           and project_id = $2
           and org_id = $3
           and repo = $4
         returning *`,
        values
      );
      return result[0] ?? null;
    });

    if (!updated) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Update codebase comment thread failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}

async function resolveOrCreateThread(args: {
  client: PoolClient;
  projectId: string;
  projectOrgId: string;
  projectRepo: string;
  userId: string;
  userEmail: string;
  input: z.infer<typeof createCommentSchema>;
}) {
  const {
    client,
    projectId,
    projectOrgId,
    projectRepo,
    userId,
    userEmail,
    input,
  } = args;

  if (input.thread_id) {
    const existingResult = await client.query(
      `select *
       from codebase_comment_threads
       where id = $1
         and project_id = $2
         and org_id = $3
         and repo = $4`,
      [input.thread_id, projectId, projectOrgId, projectRepo]
    );

    const existing = existingResult.rows[0];
    if (!existing) {
      throw new Error('Thread not found');
    }

    if (existing.status === 'resolved') {
      await client.query(
        `update codebase_comment_threads
         set status = 'open',
             resolved_by = null,
             resolved_at = null,
             updated_at = now()
         where id = $1`,
        [existing.id]
      );
      existing.status = 'open';
      existing.resolved_by = null;
      existing.resolved_at = null;
    }

    return existing as {
      id: string;
      org_id: string;
      project_id: string;
      repo: string;
      ref: string;
      commit_sha: string;
      path: string;
      line: number;
      line_end: number | null;
    };
  }

  const threadId = randomUUID();
  const line = input.line;
  const ref = input.ref;
  const commit = input.commit;
  const path = input.path;

  if (!line || !ref || !commit || !path) {
    throw new Error('thread location is required');
  }

  const lineEnd = input.line_end && input.line_end >= line
    ? input.line_end
    : null;

  const createdResult = await client.query(
    `insert into codebase_comment_threads
      (id, org_id, project_id, repo, ref, commit_sha, path, line, line_end, status, author_id, author_email, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',$10,$11,now(),now())
     returning *`,
    [
      threadId,
      projectOrgId,
      projectId,
      projectRepo,
      ref,
      commit,
      path,
      line,
      lineEnd,
      userId,
      userEmail,
    ]
  );

  const created = createdResult.rows[0];
  if (!created) {
    throw new Error('Failed to create thread');
  }
  return created as {
    id: string;
    org_id: string;
    project_id: string;
    repo: string;
    ref: string;
    commit_sha: string;
    path: string;
    line: number;
    line_end: number | null;
  };
}
