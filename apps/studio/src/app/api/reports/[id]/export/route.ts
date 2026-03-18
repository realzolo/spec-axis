import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { requireReportAccess } from '@/services/orgs';

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

  await requireReportAccess(id, user.id);
  const reportRow = await queryOne<Record<string, unknown>>(
    `select r.*, p.name as project_name, p.repo as project_repo
     from analysis_reports r
     join code_projects p on p.id = r.project_id
     where r.id = $1`,
    [id]
  );

  if (!reportRow) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const report = {
    ...reportRow,
    projects: {
      name: reportRow.project_name,
      repo: reportRow.project_repo,
    },
  };
  delete (report as Record<string, unknown>).project_name;
  delete (report as Record<string, unknown>).project_repo;

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

  lines.push(`# Code Review Report`);
  lines.push('');
  lines.push(`**Project**: ${(report.projects as Record<string, unknown>)?.name || 'Unknown'}`);
  lines.push(`**Repository**: ${(report.projects as Record<string, unknown>)?.repo || 'Unknown'}`);
  lines.push(`**Report ID**: ${report.id}`);
  lines.push(`**Created At**: ${new Date(report.created_at as string).toLocaleString()}`);
  lines.push(`**Status**: ${report.status}`);
  lines.push('');

  if (report.status === 'done') {
    lines.push(`## Overall Score: ${report.score}/100`);
    lines.push('');

    lines.push('### Category Scores');
    lines.push('');
    if (report.category_scores) {
      Object.entries(report.category_scores as Record<string, unknown>).forEach(([cat, score]) => {
        lines.push(`- **${cat}**: ${score}/100`);
      });
    }
    lines.push('');

    lines.push('### Change Summary');
    lines.push('');
    lines.push(`- Files changed: ${report.total_files || 0}`);
    lines.push(`- Additions: ${report.total_additions || 0}`);
    lines.push(`- Deletions: ${report.total_deletions || 0}`);
    lines.push(`- Commits: ${(report.commits as unknown[])?.length || 0}`);
    lines.push('');

    if (report.issues && Array.isArray(report.issues) && report.issues.length > 0) {
      lines.push(`## Issues (${report.issues.length})`);
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
            lines.push(`**Rule**: ${issue.rule}`);
            lines.push(`**Category**: ${issue.category}`);
            lines.push(`**Issue**: ${issue.message}`);
            if (issue.suggestion) {
              lines.push('');
              lines.push(`**Suggestion**: ${issue.suggestion}`);
            }
            if (issue.priority) {
              lines.push(`**Priority**: P${issue.priority}`);
            }
            lines.push('');
          });
        }
      });
    }

    if (report.summary) {
      lines.push('## AI Summary');
      lines.push('');
      lines.push(report.summary as string);
      lines.push('');
    }

    if (report.context_analysis) {
      const contextAnalysis = report.context_analysis as Record<string, unknown>;
      lines.push('## Context Analysis');
      lines.push('');
      lines.push(`- **Change type**: ${contextAnalysis.changeType}`);
      lines.push(`- **Risk level**: ${contextAnalysis.riskLevel}`);
      lines.push(`- **Business impact**: ${contextAnalysis.businessImpact}`);
      lines.push(`- **Breaking changes**: ${contextAnalysis.breakingChanges ? 'Yes' : 'No'}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateCSV(report: Record<string, unknown>): string {
  const lines: string[] = [];

  // Header
  lines.push('File,Line,Severity,Category,Rule,Issue,Suggestion,Priority');

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
