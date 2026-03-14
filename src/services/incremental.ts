import { resolveAIIntegration } from './integrations';
import { ReviewResult, ReviewIssue } from './claude';

export interface IncrementalAnalysisResult {
  changedFiles: string[];
  unchangedFiles: string[];
  newIssues: ReviewIssue[];
  resolvedIssues: ReviewIssue[];
  persistentIssues: ReviewIssue[];
  incrementalScore: number;
}

export interface PreviousReport {
  issues?: ReviewIssue[];
  created_at?: string;
}

export interface RuleConfig {
  category: string;
  name: string;
  prompt: string;
  severity: string;
}

export async function analyzeIncremental(
  currentDiff: string,
  previousReport: PreviousReport | null,
  rules: RuleConfig[],
  projectId: string
): Promise<ReviewResult> {
  // Get AI client for the project
  const { client } = await resolveAIIntegration(projectId);

  // Extract changed files from diff
  const changedFiles = extractChangedFiles(currentDiff);
  const previousIssues = previousReport?.issues || [];

  // Filter previous issues to only those in changed files
  const relevantPreviousIssues = previousIssues.filter((issue: ReviewIssue) =>
    changedFiles.includes(issue.file)
  );

  const rulesText = rules
    .map((r, i) => `${i + 1}. [${r.category.toUpperCase()}] ${r.name}: ${r.prompt}`)
    .join('\n');

  const prompt = `你是一位资深代码审查专家。这是一次**增量分析**，请重点关注变更的文件。

## 审查规则
${rulesText}

## 代码变更 (Git Diff)
\`\`\`diff
${currentDiff.slice(0, 150000)}
\`\`\`

## 上次分析的问题（仅变更文件）
${relevantPreviousIssues.length > 0 ? JSON.stringify(relevantPreviousIssues, null, 2) : '无'}

## 增量分析要求

1. **重点分析变更文件**：只深入分析本次变更的文件
2. **对比上次结果**：
   - 标记哪些问题已修复
   - 标记哪些问题仍然存在
   - 标记新增的问题
3. **评分策略**：
   - 如果修复了问题，给予加分
   - 如果引入新问题，给予减分
   - 基于变更质量评分，而非整体代码质量

## 输出格式
返回标准的 ReviewResult JSON 格式，但在 issues 数组中，每个问题额外包含：
- \`isNew\`: true/false（是否为新问题）
- \`wasFixed\`: true/false（是否修复了旧问题）

所有文本内容必须使用中文。`;

  // Use the generic AI client interface
  const result = await client.analyze(prompt, '') as ReviewResult;

  // Add metadata about incremental analysis
  const resultWithMetadata = result as ReviewResult & {
    incrementalAnalysis?: {
      changedFiles: string[];
      previousIssuesCount: number;
      newIssuesCount: number;
      fixedIssuesCount: number;
    };
  };
  resultWithMetadata.incrementalAnalysis = {
    changedFiles,
    previousIssuesCount: relevantPreviousIssues.length,
    newIssuesCount: result.issues.filter((i: ReviewIssue) => (i as ReviewIssue & { isNew?: boolean }).isNew).length,
    fixedIssuesCount: result.issues.filter((i: ReviewIssue) => (i as ReviewIssue & { wasFixed?: boolean }).wasFixed).length,
  };

  return result;
}

function extractChangedFiles(diff: string): string[] {
  const filePattern = /^diff --git a\/(.+?) b\/.+$/gm;
  const files = new Set<string>();
  let match;

  while ((match = filePattern.exec(diff)) !== null) {
    files.add(match[1]);
  }

  return Array.from(files);
}

export function shouldUseIncrementalAnalysis(
  project: Record<string, unknown>,
  commits: string[],
  recentReports: PreviousReport[]
): boolean {
  // Use incremental analysis if:
  // 1. There's a recent report (within 7 days)
  // 2. The commit count is small (< 5)
  // 3. Project has incremental analysis enabled

  if (!recentReports || recentReports.length === 0) return false;
  if (commits.length >= 5) return false;

  const latestReport = recentReports[0];
  if (!latestReport.created_at) return false;

  const age = Date.now() - new Date(latestReport.created_at).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  return age < sevenDays;
}
