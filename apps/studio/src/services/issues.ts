import { exec } from '@/lib/db';

type IssueInput = {
  file: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  rule: string;
  message: string;
  suggestion?: string;
  codeSnippet?: string;
  fixPatch?: string;
  priority?: number;
  impactScope?: string;
  estimatedEffort?: string;
};

const INSERT_CHUNK_SIZE = 200;

export async function syncReportIssues(reportId: string, issues: IssueInput[]) {
  await exec(`delete from analysis_issues where report_id = $1`, [reportId]);

  if (!issues || issues.length === 0) {
    return;
  }

  const columns = [
    'report_id',
    'file',
    'line',
    'severity',
    'category',
    'rule',
    'message',
    'suggestion',
    'code_snippet',
    'fix_patch',
    'priority',
    'impact_scope',
    'estimated_effort',
    'status',
    'updated_at',
  ];
  const paramsPerRow = columns.length;

  for (let i = 0; i < issues.length; i += INSERT_CHUNK_SIZE) {
    const chunk = issues.slice(i, i + INSERT_CHUNK_SIZE);
    const updatedAt = new Date();
    const values: any[] = [];
    const placeholders = chunk.map((issue, rowIndex) => {
      const base = rowIndex * paramsPerRow;
      values.push(
        reportId,
        issue.file,
        issue.line ?? null,
        issue.severity,
        issue.category,
        issue.rule,
        issue.message,
        issue.suggestion ?? null,
        issue.codeSnippet ?? null,
        issue.fixPatch ?? null,
        issue.priority ?? null,
        issue.impactScope ?? null,
        issue.estimatedEffort ?? null,
        'open',
        updatedAt
      );
      const indices = Array.from({ length: paramsPerRow }, (_, idx) => `$${base + idx + 1}`);
      return `(${indices.join(', ')})`;
    });

    await exec(
      `insert into analysis_issues (${columns.join(', ')})
       values ${placeholders.join(', ')}`,
      values
    );
  }
}
