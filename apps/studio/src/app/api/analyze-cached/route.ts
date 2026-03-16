import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { NextRequest } from 'next/server';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { createHash } from 'crypto';
import { requireProjectAccess } from '@/services/orgs';

export const dynamic = 'force-dynamic';

interface CacheEntry {
  result: Record<string, unknown>;
  timestamp: number;
}

interface RecentReportRow {
  id: string;
  commits: Array<{ sha: string }>;
  created_at: string | Date;
}

// Cache analysis results
const analysisCache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { projectId, commits, useCache = true } = body;

  if (!projectId || !commits?.length) {
    return NextResponse.json({ error: 'projectId and commits are required' }, { status: 400 });
  }

  await requireProjectAccess(projectId, user.id);
  // Get project
  const project = await queryOne<Record<string, unknown>>(
    `select * from code_projects where id = $1`,
    [projectId]
  );

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Check cache
  if (useCache) {
    const cacheKey = generateCacheKey(projectId, commits);
    const cached = analysisCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Using cached analysis result');
      return NextResponse.json({
        reportId: cached.result.reportId,
        fromCache: true,
      });
    }
  }

  // Check for recent identical analysis
  const recentReports = await query<RecentReportRow>(
    `select id, commits, created_at
     from analysis_reports
     where project_id = $1
     order by created_at desc
     limit 10`,
    [projectId]
  );

  if (recentReports && useCache) {
    for (const report of recentReports) {
      const reportCommits = (report.commits ?? [])
        .map((commit) => commit.sha)
        .filter((sha): sha is string => typeof sha === 'string')
        .sort();
      const requestCommits = [...commits].sort();

      if (JSON.stringify(reportCommits) === JSON.stringify(requestCommits)) {
        const age = Date.now() - new Date(report.created_at).getTime();
        if (age < CACHE_TTL) {
          console.log('Found recent identical analysis');
          return NextResponse.json({
            reportId: report.id,
            fromCache: true,
            message: 'Used a recent identical analysis result',
          });
        }
      }
    }
  }

  // Proceed with new analysis
  const analyzeRes = await fetch(`${request.url.replace('/analyze-cached', '/analyze')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, commits }),
  });

  const result = await analyzeRes.json();

  // Cache the result
  if (useCache && result.reportId) {
    const cacheKey = generateCacheKey(projectId, commits);
    analysisCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    cleanCache();
  }

  return NextResponse.json(result);
}

function generateCacheKey(projectId: string, commits: string[]): string {
  const sorted = [...commits].sort();
  const data = `${projectId}:${sorted.join(',')}`;
  return createHash('md5').update(data).digest('hex');
}

function cleanCache() {
  const now = Date.now();
  for (const [key, value] of analysisCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      analysisCache.delete(key);
    }
  }
}
