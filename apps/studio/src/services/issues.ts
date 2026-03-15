import { createAdminClient } from '@/lib/supabase/server';

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
  const db = createAdminClient();

  await db.from('report_issues').delete().eq('report_id', reportId);

  if (!issues || issues.length === 0) {
    return;
  }

  const records = issues.map((i) => ({
    report_id: reportId,
    file: i.file,
    line: i.line ?? null,
    severity: i.severity,
    category: i.category,
    rule: i.rule,
    message: i.message,
    suggestion: i.suggestion ?? null,
    code_snippet: i.codeSnippet ?? null,
    fix_patch: i.fixPatch ?? null,
    priority: i.priority ?? null,
    impact_scope: i.impactScope ?? null,
    estimated_effort: i.estimatedEffort ?? null,
    status: 'open',
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < records.length; i += INSERT_CHUNK_SIZE) {
    const chunk = records.slice(i, i + INSERT_CHUNK_SIZE);
    const { error } = await db.from('report_issues').insert(chunk);
    if (error) {
      throw error;
    }
  }
}
