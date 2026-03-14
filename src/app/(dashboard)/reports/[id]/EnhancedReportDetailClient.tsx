'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, AlertCircle, RefreshCw, Github, Loader2, ChevronDown, ChevronUp,
  TrendingUp, Shield, Zap, Code2, FileCode, MessageCircle, BarChart3, Lightbulb
} from 'lucide-react';
import { Button, Select, ListBox, Modal, useOverlayState } from '@heroui/react';
import { toast } from 'sonner';
import EnhancedIssueCard from '@/components/report/EnhancedIssueCard';
import AIChat from '@/components/report/AIChat';
import TrendChart from '@/components/report/TrendChart';

type Issue = {
  file: string; line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string; rule: string; message: string; suggestion?: string;
  codeSnippet?: string; fixPatch?: string; priority?: number;
  impactScope?: string; estimatedEffort?: string;
};
type CommitMeta = { sha: string; message: string; author: string; date: string };
type Report = {
  id: string; status: string; score?: number;
  category_scores?: Record<string, number>;
  issues?: Issue[]; summary?: string; error_message?: string;
  commits: CommitMeta[];
  total_files?: number; total_additions?: number; total_deletions?: number;
  projects?: { name: string; repo: string };
  project_id: string;
  complexity_metrics?: {
    cyclomaticComplexity: number; cognitiveComplexity: number;
    averageFunctionLength: number; maxFunctionLength: number; totalFunctions: number;
  };
  duplication_metrics?: {
    duplicatedLines: number; duplicatedBlocks: number;
    duplicationRate: number; duplicatedFiles: string[];
  };
  dependency_metrics?: {
    totalDependencies: number; outdatedDependencies: number;
    circularDependencies: string[]; unusedDependencies: string[];
  };
  security_findings?: Array<{
    type: string; severity: string; description: string; file: string; line?: number; cwe?: string;
  }>;
  performance_findings?: Array<{
    type: string; description: string; file: string; line?: number; impact: string;
  }>;
  ai_suggestions?: Array<{
    type: string; title: string; description: string; priority: number; estimatedImpact: string;
  }>;
  code_explanations?: Array<{
    file: string; line?: number; complexity: string; explanation: string; recommendation: string;
  }>;
  context_analysis?: {
    changeType: string; businessImpact: string; riskLevel: string;
    affectedModules: string[]; breakingChanges: boolean;
  };
};

const CAT_LABEL: Record<string, string> = {
  style: '风格', security: '安全', architecture: '架构',
  performance: '性能', maintainability: '可维护性',
};

function scoreColor(s: number) {
  if (s >= 85) return '#059669';
  if (s >= 70) return '#ca8a04';
  return '#dc2626';
}

function formatDate(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (h < 1) return '刚刚';
  if (h < 24) return `${h}小时前`;
  if (days < 30) return `${days}天前`;
  return new Date(d).toLocaleDateString('zh-CN');
}

const SEV_ITEMS = [
  { id: 'all', label: '所有严重级别' },
  { id: 'critical', label: '严重' },
  { id: 'high', label: '高' },
  { id: 'medium', label: '中' },
  { id: 'low', label: '低' },
  { id: 'info', label: '提示' },
];

export default function EnhancedReportDetailClient({ initialReport }: { initialReport: Report }) {
  const router = useRouter();
  const [report, setReport] = useState<Report>(initialReport);
  const [sevFilter, setSevFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [retrying, setRetrying] = useState(false);
  const [commitsExpanded, setCommitsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'issues' | 'metrics' | 'security' | 'performance' | 'suggestions'>('issues');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatIssueId, setChatIssueId] = useState<string | undefined>();
  const [trendsOpen, setTrendsOpen] = useState(false);

  const chatModalState = useOverlayState({ isOpen: chatOpen, onOpenChange: (v) => { if (!v) setChatOpen(false); } });
  const trendsModalState = useOverlayState({ isOpen: trendsOpen, onOpenChange: (v) => { if (!v) setTrendsOpen(false); } });

  const pollReport = useCallback(async () => {
    const res = await fetch(`/api/reports/${report.id}`);
    const data = await res.json();
    setReport(data);
  }, [report.id]);

  useEffect(() => {
    if (report.status !== 'pending' && report.status !== 'analyzing') return;
    const interval = setInterval(pollReport, 2500);
    return () => clearInterval(interval);
  }, [report.status, pollReport]);

  async function handleRetry() {
    const commitShas = report.commits.map(c => c.sha);
    if (!commitShas.length) { toast.error('没有可重新分析的提交'); return; }
    setRetrying(true);
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: report.project_id, commits: commitShas }),
    });
    const data = await res.json();
    setRetrying(false);
    if (!res.ok) { toast.error(data.error ?? '重试失败'); return; }
    router.push(`/reports/${data.reportId}`);
  }

  const allIssues = report.issues ?? [];
  const categories = [...new Set(allIssues.map(i => i.category))];
  const filteredIssues = allIssues
    .filter(i => (sevFilter === 'all' || i.severity === sevFilter) && (catFilter === 'all' || i.category === catFilter))
    .sort((a, b) => {
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return sevOrder[a.severity] - sevOrder[b.severity];
    });

  const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
  const highCount = allIssues.filter(i => i.severity === 'high').length;
  const mediumCount = allIssues.filter(i => i.severity === 'medium').length;
  const lowCount = allIssues.filter(i => i.severity === 'low').length;
  const infoCount = allIssues.filter(i => i.severity === 'info').length;

  const catItems = [{ id: 'all', label: '所有分类' }, ...categories.map(c => ({ id: c, label: CAT_LABEL[c] ?? c }))];

  const statusStyle = {
    done: { bg: '#d1fae5', color: '#059669', label: '已完成' },
    failed: { bg: '#fee2e2', color: '#dc2626', label: '失败' },
    pending: { bg: '#dbeafe', color: '#2563eb', label: '待处理' },
    analyzing: { bg: '#dbeafe', color: '#2563eb', label: '分析中' },
  }[report.status] ?? { bg: '#dbeafe', color: '#2563eb', label: report.status };

  function openChat(issueFile?: string) {
    setChatIssueId(issueFile);
    setChatOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-8 h-16 border-b shrink-0 bg-background">
        <Link href="/reports">
          <Button isIconOnly variant="ghost" className="h-8 w-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">报告详情</h2>
            <code className="text-xs font-mono text-muted-foreground">#{report.id.slice(0, 8)}</code>
          </div>
          <div className="text-sm text-muted-foreground">{report.projects?.name}</div>
        </div>
        {report.status === 'done' && (
          <>
            <Button variant="outline" size="sm" onPress={() => setTrendsOpen(true)} className="gap-2">
              <BarChart3 className="size-4" />
              趋势分析
            </Button>
            <Button variant="outline" size="sm" onPress={() => openChat()} className="gap-2">
              <MessageCircle className="size-4" />
              AI 对话
            </Button>
          </>
        )}
        {(report.status === 'done' || report.status === 'failed') && (
          <Button variant="outline" size="sm" isLoading={retrying} onPress={handleRetry} className="gap-2">
            <RefreshCw className="size-3.5" />
            重新分析
          </Button>
        )}
        <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
          {statusStyle.label}
        </span>
      </div>

      {/* Analyzing */}
      {(report.status === 'pending' || report.status === 'analyzing') && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="size-12 animate-spin text-primary" />
          <div className="text-sm text-muted-foreground">AI 正在深度分析您的代码...</div>
          <div className="text-xs text-muted-foreground">正在进行多维度质量分析、安全扫描、性能评估...</div>
        </div>
      )}

      {/* Failed */}
      {report.status === 'failed' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <AlertCircle className="size-12 text-destructive" />
          <div className="text-sm font-semibold">分析失败</div>
          <div className="text-sm text-muted-foreground">{report.error_message}</div>
          <Button isLoading={retrying} onPress={handleRetry} className="mt-2 gap-2">
            <RefreshCw className="size-4" />
            重新分析
          </Button>
        </div>
      )}

      {/* Done */}
      {report.status === 'done' && (
        <div className="flex-1 overflow-auto">
          <div className="p-8 space-y-6">
            {/* Score Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card border rounded-lg p-6 text-center">
                <div className="text-5xl font-bold" style={{ color: scoreColor(report.score ?? 0) }}>{report.score}</div>
                <div className="text-sm text-muted-foreground mt-1">/ 100</div>
                <div className="text-sm font-semibold mt-2" style={{ color: scoreColor(report.score ?? 0) }}>
                  {(report.score ?? 0) >= 85 ? '优秀' : (report.score ?? 0) >= 70 ? '良好' : '需改进'}
                </div>
              </div>
              <div className="md:col-span-2 bg-card border rounded-lg p-6 space-y-3">
                {Object.entries(report.category_scores ?? {}).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-muted-foreground">{CAT_LABEL[k] ?? k}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${v}%`, backgroundColor: scoreColor(v) }} />
                    </div>
                    <div className="w-12 text-right text-sm font-bold" style={{ color: scoreColor(v) }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Context Analysis */}
            {report.context_analysis && (
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-5 text-primary" />
                  <h3 className="text-lg font-semibold">上下文分析</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">变更类型</div>
                    <div className="text-sm font-medium">{report.context_analysis.changeType}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">风险等级</div>
                    <div className="text-sm font-medium">{report.context_analysis.riskLevel}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">破坏性变更</div>
                    <div className="text-sm font-medium">{report.context_analysis.breakingChanges ? '是' : '否'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">影响模块</div>
                    <div className="text-sm font-medium">{report.context_analysis.affectedModules.length} 个</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-xs text-muted-foreground mb-1">业务影响</div>
                  <div className="text-sm">{report.context_analysis.businessImpact}</div>
                </div>
              </div>
            )}

            {/* Commit Stats */}
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="px-6 py-4 flex gap-6 flex-wrap items-center"
                style={{ borderBottom: commitsExpanded ? '1px solid hsl(var(--border))' : 'none' }}>
                <div className="text-sm"><span className="text-muted-foreground">变更文件: </span><strong>{report.total_files ?? 0}</strong></div>
                <div className="text-sm text-green-600 font-semibold">+{report.total_additions ?? 0}</div>
                <div className="text-sm text-red-600 font-semibold">-{report.total_deletions ?? 0}</div>
                <div className="text-sm"><span className="text-muted-foreground">提交数: </span><strong>{report.commits?.length ?? 0}</strong></div>
                <Button variant="ghost" size="sm" onPress={() => setCommitsExpanded(e => !e)} className="ml-auto gap-2">
                  {commitsExpanded ? <><ChevronUp className="size-4" />隐藏提交</> : <><ChevronDown className="size-4" />显示提交</>}
                </Button>
              </div>
              {commitsExpanded && (
                <div className="divide-y">
                  {report.commits.map(c => (
                    <div key={c.sha} className="flex items-center gap-3 px-6 py-3">
                      <code className="text-xs font-mono shrink-0 px-2 py-0.5 rounded bg-muted">{c.sha.slice(0, 7)}</code>
                      <span className="flex-1 text-sm truncate">{c.message}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{c.author}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatDate(c.date)}</span>
                      {report.projects?.repo && (
                        <a href={`https://github.com/${report.projects.repo}/commit/${c.sha}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground shrink-0">
                          <Github className="size-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Tabs */}
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="flex border-b">
                <button onClick={() => setActiveTab("issues")} className={"flex-1 px-4 py-3 text-sm font-medium transition-colors " + (activeTab === "issues" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                  <Code2 className="size-4 inline mr-2" />问题列表 ({allIssues.length})
                </button>
                <button onClick={() => setActiveTab("metrics")} className={"flex-1 px-4 py-3 text-sm font-medium transition-colors " + (activeTab === "metrics" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                  <BarChart3 className="size-4 inline mr-2" />质量指标
                </button>
                {report.security_findings && report.security_findings.length > 0 && (
                  <button onClick={() => setActiveTab("security")} className={"flex-1 px-4 py-3 text-sm font-medium transition-colors " + (activeTab === "security" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                    <Shield className="size-4 inline mr-2" />安全发现 ({report.security_findings.length})
                  </button>
                )}
                {report.performance_findings && report.performance_findings.length > 0 && (
                  <button onClick={() => setActiveTab("performance")} className={"flex-1 px-4 py-3 text-sm font-medium transition-colors " + (activeTab === "performance" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                    <Zap className="size-4 inline mr-2" />性能发现 ({report.performance_findings.length})
                  </button>
                )}
                {report.ai_suggestions && report.ai_suggestions.length > 0 && (
                  <button onClick={() => setActiveTab("suggestions")} className={"flex-1 px-4 py-3 text-sm font-medium transition-colors " + (activeTab === "suggestions" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                    <Lightbulb className="size-4 inline mr-2" />AI 建议 ({report.ai_suggestions.length})
                  </button>
                )}
              </div>
              <div className="p-6">
                {activeTab === "issues" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">{criticalCount} 严重</span>
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">{highCount} 高</span>
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">{mediumCount} 中</span>
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700">{lowCount} 低</span>
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{infoCount} 提示</span>
                      </div>
                      <div className="ml-auto flex gap-2">
                        <Select selectedKey={sevFilter} onSelectionChange={(key) => setSevFilter(key as string)} className="w-[140px]">
                          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                          <Select.Popover>
                            <ListBox items={SEV_ITEMS}>
                              {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                        {categories.length > 1 && (
                          <Select selectedKey={catFilter} onSelectionChange={(key) => setCatFilter(key as string)} className="w-[150px]">
                            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                            <Select.Popover>
                              <ListBox items={catItems}>
                                {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        )}
                        {(sevFilter !== "all" || catFilter !== "all") && (
                          <Button variant="ghost" size="sm" onPress={() => { setSevFilter("all"); setCatFilter("all"); }}>清除</Button>
                        )}
                      </div>
                    </div>
                    {filteredIssues.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">没有匹配当前筛选条件的问题</div>
                    ) : (
                      filteredIssues.map((issue, idx) => (
                        <EnhancedIssueCard key={issue.file + "-" + issue.line + "-" + idx} issue={issue} onChat={() => openChat(issue.file)} />
                      ))
                    )}
                  </div>
                )}
                {activeTab === "metrics" && (
                  <div className="space-y-6">
                    {report.complexity_metrics && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileCode className="size-4" />代码复杂度</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="bg-muted/50 rounded-lg p-4"><div className="text-2xl font-bold">{report.complexity_metrics.cyclomaticComplexity}</div><div className="text-xs text-muted-foreground mt-1">圈复杂度</div></div>
                          <div className="bg-muted/50 rounded-lg p-4"><div className="text-2xl font-bold">{report.complexity_metrics.cognitiveComplexity}</div><div className="text-xs text-muted-foreground mt-1">认知复杂度</div></div>
                          <div className="bg-muted/50 rounded-lg p-4"><div className="text-2xl font-bold">{report.complexity_metrics.averageFunctionLength}</div><div className="text-xs text-muted-foreground mt-1">平均函数行数</div></div>
                          <div className="bg-muted/50 rounded-lg p-4"><div className="text-2xl font-bold">{report.complexity_metrics.maxFunctionLength}</div><div className="text-xs text-muted-foreground mt-1">最长函数行数</div></div>
                          <div className="bg-muted/50 rounded-lg p-4"><div className="text-2xl font-bold">{report.complexity_metrics.totalFunctions}</div><div className="text-xs text-muted-foreground mt-1">函数总数</div></div>
                        </div>
                      </div>
                    )}
                    {report.duplication_metrics && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3">代码重复度</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="bg-muted/50 rounded-lg p-4"><div className="text-2xl font-bold">{report.duplication_metrics.duplicatedLines}</div><div className="text-xs text-muted-foreground mt-1">重复行数</div></div>
                          <div className="bg-muted/50 rounded-lg p-4"><div className="text-2xl font-bold">{report.duplication_metrics.duplicatedBlocks}</div><div className="text-xs text-muted-foreground mt-1">重复块数</div></div>
                          <div className="bg-muted/50 rounded-lg p-4"><div className="text-2xl font-bold">{report.duplication_metrics.duplicationRate}%</div><div className="text-xs text-muted-foreground mt-1">重复率</div></div>
                        </div>
                        {report.duplication_metrics.duplicatedFiles.length > 0 && (
                          <div className="mt-3"><div className="text-xs text-muted-foreground mb-2">重复文件:</div><div className="space-y-1">{report.duplication_metrics.duplicatedFiles.map(f => (<code key={f} className="block text-xs bg-muted px-2 py-1 rounded">{f}</code>))}</div></div>
                        )}
                      </div>
                    )}
                    {report.dependency_metrics && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3">依赖分析</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-muted/50 rounded-lg p-4"><div className="text-2xl font-bold">{report.dependency_metrics.totalDependencies}</div><div className="text-xs text-muted-foreground mt-1">依赖总数</div></div>
                          <div className="bg-muted/50 rounded-lg p-4"><div className="text-2xl font-bold">{report.dependency_metrics.outdatedDependencies}</div><div className="text-xs text-muted-foreground mt-1">过时依赖</div></div>
                        </div>
                        {report.dependency_metrics.circularDependencies.length > 0 && (
                          <div className="mt-3"><div className="text-xs text-muted-foreground mb-2">循环依赖:</div><div className="space-y-1">{report.dependency_metrics.circularDependencies.map((d, i) => (<code key={i} className="block text-xs bg-muted px-2 py-1 rounded">{d}</code>))}</div></div>
                        )}
                        {report.dependency_metrics.unusedDependencies.length > 0 && (
                          <div className="mt-3"><div className="text-xs text-muted-foreground mb-2">未使用依赖:</div><div className="space-y-1">{report.dependency_metrics.unusedDependencies.map(d => (<code key={d} className="block text-xs bg-muted px-2 py-1 rounded">{d}</code>))}</div></div>
                        )}
                      </div>
                    )}
                    {report.code_explanations && report.code_explanations.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3">复杂代码解释</h4>
                        <div className="space-y-3">
                          {report.code_explanations.map((exp, i) => (
                            <div key={i} className="bg-muted/50 rounded-lg p-4">
                              <code className="text-xs font-mono bg-background px-2 py-1 rounded">{exp.file}{exp.line ? ":" + exp.line : ""}</code>
                              <div className="mt-2 text-xs text-muted-foreground">复杂度: {exp.complexity}</div>
                              <div className="mt-2 text-sm">{exp.explanation}</div>
                              <div className="mt-2 text-sm text-primary">💡 {exp.recommendation}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "security" && report.security_findings && (
                  <div className="space-y-3">
                    {report.security_findings.map((finding, i) => (
                      <div key={i} className="bg-card border border-red-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Shield className="size-5 text-red-600 shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{finding.type}</span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase" style={{ background: finding.severity === "critical" ? "#fee2e2" : "#ffedd5", color: finding.severity === "critical" ? "#dc2626" : "#ea580c" }}>{finding.severity}</span>
                              {finding.cwe && <span className="text-xs text-muted-foreground">{finding.cwe}</span>}
                            </div>
                            <div className="text-sm">{finding.description}</div>
                            <code className="block text-xs font-mono bg-muted px-2 py-1 rounded">{finding.file}{finding.line ? ":" + finding.line : ""}</code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "performance" && report.performance_findings && (
                  <div className="space-y-3">
                    {report.performance_findings.map((finding, i) => (
                      <div key={i} className="bg-card border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Zap className="size-5 text-yellow-600 shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <div className="font-semibold">{finding.type}</div>
                            <div className="text-sm">{finding.description}</div>
                            <code className="block text-xs font-mono bg-muted px-2 py-1 rounded">{finding.file}{finding.line ? ":" + finding.line : ""}</code>
                            <div className="text-xs text-muted-foreground">影响: {finding.impact}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "suggestions" && report.ai_suggestions && (
                  <div className="space-y-3">
                    {report.ai_suggestions.sort((a, b) => b.priority - a.priority).map((sug, i) => (
                      <div key={i} className="bg-card border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Lightbulb className="size-5 text-blue-600 shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{sug.title}</span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">P{sug.priority}</span>
                              <span className="text-xs text-muted-foreground">{sug.type}</span>
                            </div>
                            <div className="text-sm">{sug.description}</div>
                            <div className="text-xs text-muted-foreground">预期影响: {sug.estimatedImpact}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">AI 总结</h3>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{report.summary}</div>
            </div>
          </div>
        </div>
      )}

      <Modal state={chatModalState}>
        <Modal.Backdrop isDismissable>
          <Modal.Container size="xl">
            <Modal.Dialog className="h-[600px] flex flex-col">
              <Modal.Header className="px-6 py-4 border-b">
                <Modal.Heading>AI 代码审查员</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex-1 min-h-0 p-0">
                <AIChat reportId={report.id} issueId={chatIssueId} />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={trendsModalState}>
        <Modal.Backdrop isDismissable>
          <Modal.Container size="2xl">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>质量趋势分析</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <TrendChart projectId={report.project_id} />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
