import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { NextRequest } from 'next/server';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

interface CacheEntry {
  result: Record<string, unknown>;
  timestamp: number;
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
    return NextResponse.json({ error: 'projectId 和 commits 不能为空' }, { status: 400 });
  }

  const supabase = await createClient();

  // Get project
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
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
  const { data: recentReports } = await supabase
    .from('reports')
    .select('id, commits, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentReports && useCache) {
    for (const report of recentReports) {
      const reportCommits = (report.commits as Array<Record<string, unknown>>).map((c: Record<string, unknown>) => c.sha).sort();
      const requestCommits = [...commits].sort();

      if (JSON.stringify(reportCommits) === JSON.stringify(requestCommits)) {
        const age = Date.now() - new Date(report.created_at).getTime();
        if (age < CACHE_TTL) {
          console.log('Found recent identical analysis');
          return NextResponse.json({
            reportId: report.id,
            fromCache: true,
            message: '使用最近的相同分析结果',
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
