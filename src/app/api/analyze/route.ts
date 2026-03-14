import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProjectById, getRulesBySetId, createReport, updateReport } from '@/services/db';
import { getCommitsDiff, getRepoCommits } from '@/services/github';
import { analyzeCode } from '@/services/claude';
import { analyzeIncremental, shouldUseIncrementalAnalysis } from '@/services/incremental';
import { createClient } from '@/lib/supabase/server';
import { taskQueue } from '@/services/taskQueue';
import { logger } from '@/services/logger';
import { analyzeRequestSchema } from '@/services/validation';
import { withRetry, formatErrorResponse } from '@/services/retry';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.analyze);

export async function POST(request: NextRequest) {
  // 速率限制检查
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const validated = analyzeRequestSchema.parse(body);
    const { projectId, commits: selectedHashes, forceFullAnalysis } = validated;

    logger.setContext({ projectId });

    // 验证项目存在
    const project = await withRetry(() => getProjectById(projectId));
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    if (!project.ruleset_id) {
      return NextResponse.json({ error: '项目未配置规则集' }, { status: 400 });
    }

    // 获取规则集
    const rules = await withRetry(() => getRulesBySetId(project.ruleset_id));
    if (!rules.length) {
      return NextResponse.json({ error: '规则集没有启用的规则' }, { status: 400 });
    }

    // 获取提交信息
    const allCommits = await withRetry(() =>
      getRepoCommits(project.repo, project.default_branch, 100)
    );
    const selectedCommits = allCommits.filter((c) => selectedHashes.includes(c.sha));

    if (selectedCommits.length === 0) {
      return NextResponse.json({ error: '未找到指定的提交' }, { status: 400 });
    }

    // 检查是否使用增量分析
    const supabase = await createClient();
    const { data: recentReports } = await supabase
      .from('reports')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(1);

    const useIncremental =
      !forceFullAnalysis &&
      shouldUseIncrementalAnalysis(project, selectedHashes, recentReports || []);

    // 创建报告
    const report = await withRetry(() =>
      createReport({
        project_id: projectId,
        ruleset_snapshot: rules,
        commits: selectedCommits,
      })
    );

    logger.info(`Report created: ${report.id}`);

    // 将分析任务加入队列（高优先级）
    await taskQueue.enqueue(
      'analyze',
      projectId,
      {
        reportId: report.id,
        repo: project.repo,
        hashes: selectedHashes,
        rules,
        previousReport: useIncremental ? recentReports?.[0] : null,
      } as Record<string, unknown>,
      8, // 高优先级
      report.id
    );

    return NextResponse.json({
      reportId: report.id,
      incrementalAnalysis: useIncremental,
      status: 'queued',
    });
  } catch (err) {
    const { error, statusCode } = formatErrorResponse(err);
    logger.error('Analysis request failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error }, { status: statusCode });
  } finally {
    logger.clearContext();
  }
}
