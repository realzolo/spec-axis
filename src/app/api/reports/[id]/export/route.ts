import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

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

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';

  const supabase = await createClient();

  const { data: report, error } = await supabase
    .from('reports')
    .select('*, projects(*)')
    .eq('id', id)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: '报告不存在' }, { status: 404 });
  }

  if (format === 'markdown') {
    const markdown = generateMarkdown(report);
    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="report-${id.slice(0, 8)}.md"`,
      },
    });
  }

  if (format === 'csv') {
    const csv = generateCSV(report);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="report-${id.slice(0, 8)}.csv"`,
      },
    });
  }

  // Default: JSON
  return NextResponse.json(report);
}

function generateMarkdown(report: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push(`# 代码审查报告`);
  lines.push('');
  lines.push(`**项目**: ${(report.projects as Record<string, unknown>)?.name || '未知'}`);
  lines.push(`**仓库**: ${(report.projects as Record<string, unknown>)?.repo || '未知'}`);
  lines.push(`**报告ID**: ${report.id}`);
  lines.push(`**创建时间**: ${new Date(report.created_at as string).toLocaleString('zh-CN')}`);
  lines.push(`**状态**: ${report.status}`);
  lines.push('');

  if (report.status === 'done') {
    lines.push(`## 总体评分: ${report.score}/100`);
    lines.push('');

    lines.push('### 分类评分');
    lines.push('');
    if (report.category_scores) {
      Object.entries(report.category_scores as Record<string, unknown>).forEach(([cat, score]) => {
        lines.push(`- **${cat}**: ${score}/100`);
      });
    }
    lines.push('');

    lines.push('### 代码变更统计');
    lines.push('');
    lines.push(`- 变更文件: ${report.total_files || 0}`);
    lines.push(`- 新增行数: ${report.total_additions || 0}`);
    lines.push(`- 删除行数: ${report.total_deletions || 0}`);
    lines.push(`- 提交数量: ${(report.commits as unknown[])?.length || 0}`);
    lines.push('');

    if (report.issues && Array.isArray(report.issues) && report.issues.length > 0) {
      lines.push(`## 问题列表 (${report.issues.length})`);
      lines.push('');

      const severityGroups: Record<string, Record<string, unknown>[]> = {};
      (report.issues as Record<string, unknown>[]).forEach((issue: Record<string, unknown>) => {
        const severity = issue.severity as string;
        if (!severityGroups[severity]) {
          severityGroups[severity] = [];
        }
        severityGroups[severity].push(issue);
      });

      ['critical', 'high', 'medium', 'low', 'info'].forEach(sev => {
        const issues = severityGroups[sev];
        if (issues && issues.length > 0) {
          lines.push(`### ${sev.toUpperCase()} (${issues.length})`);
          lines.push('');
          issues.forEach((issue: Record<string, unknown>, idx: number) => {
            lines.push(`#### ${idx + 1}. ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
            lines.push('');
            lines.push(`**规则**: ${issue.rule}`);
            lines.push(`**分类**: ${issue.category}`);
            lines.push(`**问题**: ${issue.message}`);
            if (issue.suggestion) {
              lines.push('');
              lines.push(`**建议**: ${issue.suggestion}`);
            }
            if (issue.priority) {
              lines.push(`**优先级**: P${issue.priority}`);
            }
            lines.push('');
          });
        }
      });
    }

    if (report.summary) {
      lines.push('## AI 总结');
      lines.push('');
      lines.push(report.summary as string);
      lines.push('');
    }

    if (report.context_analysis) {
      const contextAnalysis = report.context_analysis as Record<string, unknown>;
      lines.push('## 上下文分析');
      lines.push('');
      lines.push(`- **变更类型**: ${contextAnalysis.changeType}`);
      lines.push(`- **风险等级**: ${contextAnalysis.riskLevel}`);
      lines.push(`- **业务影响**: ${contextAnalysis.businessImpact}`);
      lines.push(`- **破坏性变更**: ${contextAnalysis.breakingChanges ? '是' : '否'}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateCSV(report: Record<string, unknown>): string {
  const lines: string[] = [];

  // Header
  lines.push('文件,行号,严重程度,分类,规则,问题描述,修复建议,优先级');

  // Issues
  if (report.issues && Array.isArray(report.issues) && report.issues.length > 0) {
    (report.issues as Record<string, unknown>[]).forEach((issue: Record<string, unknown>) => {
      const row = [
        issue.file,
        issue.line || '',
        issue.severity,
        issue.category,
        issue.rule,
        `"${(issue.message as string).replace(/"/g, '""')}"`,
        issue.suggestion ? `"${(issue.suggestion as string).replace(/"/g, '""')}"` : '',
        issue.priority || '',
      ];
      lines.push(row.join(','));
    });
  }

  return lines.join('\n');
}
