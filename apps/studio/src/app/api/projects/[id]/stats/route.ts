import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/services/logger';
import { projectIdSchema } from '@/services/validation';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { requireProjectAccess } from '@/services/orgs';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

interface Report {
  id: string;
  status: string;
  score: number | null;
  issues: Array<{ severity: string }> | null;
  created_at: string;
}

interface IssueItem {
  severity: string;
}

interface StatsResponse {
  totalReports: number;
  averageScore: number;
  totalIssues: number;
  criticalIssues: number;
  recentTrend: 'up' | 'down' | 'stable';
  trendValue: number;
  pendingReports: number;
}

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

    // Validate project ID
    const projectId = projectIdSchema.parse(id);

    logger.setContext({ projectId });

    // Fetch project stats with retry
    const stats = await withRetry(async () => {
      await requireProjectAccess(projectId, user.id);
      const reports = await query<Report>(
        `select id, status, score, issues, created_at
         from analysis_reports
         where project_id = $1
         order by created_at desc`,
        [projectId]
      );

      return calculateStats(reports);
    });

    logger.info(`Stats calculated: ${projectId}`);

    return NextResponse.json(stats);
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Stats request failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}

/**
 * Calculate project stats
 */
function calculateStats(reports: Report[]): StatsResponse {
  if (!reports || reports.length === 0) {
    return {
      totalReports: 0,
      averageScore: 0,
      totalIssues: 0,
      criticalIssues: 0,
      recentTrend: 'stable',
      trendValue: 0,
      pendingReports: 0,
    };
  }

  const doneReports = reports.filter((r) => r.status === 'done' || r.status === 'partial_failed');
  const pendingReports = reports.filter(
    (r) => r.status === 'pending' || r.status === 'running'
  ).length;

  // Calculate average score
  const scores = doneReports
    .map((r) => r.score)
    .filter((s): s is number => s != null);
  const averageScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  // Calculate issue stats
  let totalIssues = 0;
  let criticalIssues = 0;

  doneReports.forEach((r) => {
    if (r.issues && Array.isArray(r.issues)) {
      totalIssues += r.issues.length;
      criticalIssues += r.issues.filter(
        (i: IssueItem) => i.severity === 'critical' || i.severity === 'high'
      ).length;
    }
  });

  // Calculate trend (last 7 days vs previous 7 days)
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  const recentReports = doneReports.filter(
    (r) => new Date(r.created_at).getTime() > sevenDaysAgo
  );
  const previousReports = doneReports.filter(
    (r) =>
      new Date(r.created_at).getTime() > fourteenDaysAgo &&
      new Date(r.created_at).getTime() <= sevenDaysAgo
  );

  const recentAvg =
    recentReports.length > 0
      ? recentReports.reduce((sum, r) => sum + (r.score || 0), 0) / recentReports.length
      : 0;
  const previousAvg =
    previousReports.length > 0
      ? previousReports.reduce((sum, r) => sum + (r.score || 0), 0) / previousReports.length
      : 0;

  const trendValue = Math.round(recentAvg - previousAvg);
  const recentTrend = trendValue > 2 ? 'up' : trendValue < -2 ? 'down' : 'stable';

  return {
    totalReports: reports.length,
    averageScore,
    totalIssues,
    criticalIssues,
    recentTrend,
    trendValue,
    pendingReports,
  };
}
