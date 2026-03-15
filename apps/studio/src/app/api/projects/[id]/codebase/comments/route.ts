import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { query, queryOne, withTransaction } from '@/lib/db';
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
    if (!project.org_id || !project.repo) {
      return NextResponse.json({ error: 'Project is not configured' }, { status: 400 });
    }
    const ref = request.nextUrl.searchParams.get('ref') || project.default_branch;
    const path = request.nextUrl.searchParams.get('path') || '';
    const lineParam = request.nextUrl.searchParams.get('line');
    const line = lineParam ? Number(lineParam) : undefined;

    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    const comments = await withRetry(async () => {
      const params: any[] = [projectId, project.org_id, project.repo, ref, path];
      let sql = `
        select c.*,
               coalesce(
                 jsonb_agg(
                   jsonb_build_object('user_id', a.user_id, 'email', a.email)
                   order by a.created_at
                 ) filter (where a.id is not null),
                 '[]'::jsonb
               ) as assignees
        from codebase_comments c
        left join codebase_comment_assignees a on a.comment_id = c.id
        where c.project_id = $1
          and c.org_id = $2
          and c.repo = $3
          and c.ref = $4
          and c.path = $5
      `;

      if (Number.isFinite(line)) {
        params.push(line);
        sql += ` and c.line = $${params.length}`;
      }

      sql += ` group by c.id order by c.created_at asc`;

      return query<Record<string, any>>(sql, params);
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
      const lineEnd = validated.line_end && validated.line_end >= validated.line
        ? validated.line_end
        : null;

      return withTransaction(async (client) => {
        const insertResult = await client.query(
          `insert into codebase_comments
            (org_id, project_id, repo, ref, path, line, line_end, selection_text, author_id, author_email, body, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
           returning *`,
          [
            project.org_id,
            projectId,
            project.repo,
            validated.ref,
            validated.path,
            validated.line,
            lineEnd,
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

            const values: any[] = [];
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
                 coalesce(
                   jsonb_agg(
                     jsonb_build_object('user_id', a.user_id, 'email', a.email)
                     order by a.created_at
                   ) filter (where a.id is not null),
                   '[]'::jsonb
                 ) as assignees
           from codebase_comments c
           left join codebase_comment_assignees a on a.comment_id = c.id
           where c.id = $1
           group by c.id`,
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
