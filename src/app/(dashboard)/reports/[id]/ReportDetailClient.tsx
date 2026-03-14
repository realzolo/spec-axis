'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, ChevronDown, ChevronUp, RefreshCw, Github, Loader2 } from 'lucide-react';
import { Button, Select, ListBox } from '@heroui/react';
import { toast } from 'sonner';

type Issue = {
  file: string; line?: number; severity: 'error' | 'warning' | 'info';
  category: string; rule: string; message: string; suggestion?: string;
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
};

const SEV_ORDER = { error: 0, warning: 1, info: 2 };
const SEV_COLOR: Record<string, string> = { error: '#c01048', warning: '#b54708', info: '#027a48' };
const SEV_BG: Record<string, string> = { error: '#fff1f3', warning: '#fffaeb', info: '#ecfdf3' };
const CAT_LABEL: Record<string, string> = { style: '风格', security: '安全', architecture: '架构', performance: '性能', maintainability: '可维护性' };

function scoreColor(s: number) {
  if (s >= 85) return '#027a48';
  if (s >= 70) return '#b54708';
  return '#c01048';
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
  { id: 'error', label: '错误' },
  { id: 'warning', label: '警告' },
  { id: 'info', label: '提示' },
];

function IssueRow({ issue }: { issue: Issue }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-[#eaecf0] rounded-lg overflow-hidden mb-1.5">
      <div
        onClick={() => issue.suggestion && setExpanded(e => !e)}
        className="flex items-start gap-3 px-4 py-3 select-none"
        style={{ cursor: issue.suggestion ? 'pointer' : 'default' }}
      >
        <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
          style={{ background: SEV_BG[issue.severity], color: SEV_COLOR[issue.severity] }}>
          {issue.severity === 'error' ? '错误' : issue.severity === 'warning' ? '警告' : '提示'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <code className="text-[11px] font-mono bg-[#f2f4f7] rounded px-1.5 py-0.5 text-[#344054]">
              {issue.file}{issue.line ? `:${issue.line}` : ''}
            </code>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#eff4ff] text-[#4f6ef7]">
              {CAT_LABEL[issue.category] ?? issue.category}
            </span>
            <span className="text-[11px] text-[#98a2b3]">{issue.rule}</span>
          </div>
          <div className="text-[13px] text-[#344054] leading-relaxed">{issue.message}</div>
        </div>
        {issue.suggestion && (
          <div className="shrink-0 text-[#98a2b3] mt-0.5">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        )}
      </div>
      {expanded && issue.suggestion && (
        <div className="border-t border-[#eaecf0] px-4 py-3 bg-[#f8f9fc]">
          <div className="text-[11px] font-semibold text-[#667085] mb-1.5">💡 建议</div>
          <div className="text-xs text-[#344054] leading-relaxed font-mono whitespace-pre-wrap bg-white border border-[#eaecf0] rounded-md px-3.5 py-2.5">
            {issue.suggestion}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportDetailClient({ initialReport }: { initialReport: Report }) {
  const router = useRouter();
  const [report, setReport] = useState<Report>(initialReport);
  const [sevFilter, setSevFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [retrying, setRetrying] = useState(false);
  const [commitsExpanded, setCommitsExpanded] = useState(false);

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
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

  const errorCount = allIssues.filter(i => i.severity === 'error').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  const infoCount = allIssues.filter(i => i.severity === 'info').length;

  const catItems = [{ id: 'all', label: '所有分类' }, ...categories.map(c => ({ id: c, label: CAT_LABEL[c] ?? c }))];

  const statusStyle = {
    done: { bg: '#ecfdf3', color: '#027a48', label: '已完成' },
    failed: { bg: '#fff1f3', color: '#c01048', label: '失败' },
    pending: { bg: '#eff8ff', color: '#1570ef', label: '待处理' },
    analyzing: { bg: '#eff8ff', color: '#1570ef', label: '分析中' },
  }[report.status] ?? { bg: '#eff8ff', color: '#1570ef', label: report.status };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 h-[60px] border-b border-[#eaecf0] bg-white shrink-0">
        <Link href="/reports">
          <Button isIconOnly variant="ghost" className="h-8 w-8"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-[#101828]">
            报告 <span className="font-mono text-[13px] text-[#667085]">#{report.id.slice(0, 8)}</span>
          </div>
          <div className="text-xs text-[#667085] mt-0.5">{report.projects?.name}</div>
        </div>
        {(report.status === 'done' || report.status === 'failed') && (
          <Button variant="outline" size="sm" isLoading={retrying} onPress={handleRetry} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            重新分析
          </Button>
        )}
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
          {statusStyle.label}
        </span>
      </div>

      {/* Analyzing */}
      {(report.status === 'pending' || report.status === 'analyzing') && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="size-10 animate-spin text-[#4f6ef7]" />
          <div className="text-sm text-[#667085]">AI 正在分析您的代码变更…</div>
          <div className="text-xs text-[#98a2b3]">这可能需要一分钟，页面将自动更新。</div>
        </div>
      )}

      {/* Failed */}
      {report.status === 'failed' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <AlertCircle className="size-12 text-[#c01048]" />
          <div className="text-sm font-semibold text-[#344054]">分析失败</div>
          <div className="text-[13px] text-[#667085]">{report.error_message}</div>
          <Button isLoading={retrying} onPress={handleRetry} className="mt-2 gap-1.5">
            <RefreshCw className="size-3.5" />
            重新分析
          </Button>
        </div>
      )}

      {/* Done */}
      {report.status === 'done' && (
        <div className="flex-1 overflow-auto p-6 flex flex-col gap-5">
          {/* Score + categories */}
          <div className="flex gap-4">
            <div className="px-7 py-5 rounded-xl border border-[#eaecf0] bg-white text-center shrink-0">
              <div className="text-5xl font-bold leading-none" style={{ color: scoreColor(report.score ?? 0) }}>{report.score}</div>
              <div className="text-xs text-[#98a2b3] mt-1">/ 100</div>
              <div className="text-[13px] font-semibold mt-1.5" style={{ color: scoreColor(report.score ?? 0) }}>
                {(report.score ?? 0) >= 85 ? '优秀' : (report.score ?? 0) >= 70 ? '良好' : '需改进'}
              </div>
            </div>
            <div className="flex-1 px-5 py-4 rounded-xl border border-[#eaecf0] bg-white flex flex-col gap-2.5">
              {Object.entries(report.category_scores ?? {}).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <div className="w-[110px] text-[13px] text-[#667085] capitalize">{CAT_LABEL[k] ?? k}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${v}%`, backgroundColor: scoreColor(v) }} />
                  </div>
                  <div className="w-7 text-right text-[13px] font-bold" style={{ color: scoreColor(v) }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Commit stats */}
          <div className="rounded-xl border border-[#eaecf0] bg-white overflow-hidden">
            <div className="px-5 py-3.5 flex gap-7 flex-wrap items-center"
              style={{ borderBottom: commitsExpanded ? '1px solid #eaecf0' : 'none' }}>
              <div className="text-[13px]"><span className="text-[#667085]">变更文件: </span><strong className="text-[#101828]">{report.total_files ?? 0}</strong></div>
              <div className="text-[13px] text-[#027a48] font-semibold">+{report.total_additions ?? 0}</div>
              <div className="text-[13px] text-[#c01048] font-semibold">-{report.total_deletions ?? 0}</div>
              <div className="text-[13px]"><span className="text-[#667085]">提交数: </span><strong className="text-[#101828]">{report.commits?.length ?? 0}</strong></div>
              <Button variant="ghost" size="sm" onPress={() => setCommitsExpanded(e => !e)}
                className="ml-auto text-[#667085] gap-1 h-7">
                {commitsExpanded ? <><ChevronUp className="size-4" />隐藏提交</> : <><ChevronDown className="size-4" />显示提交</>}
              </Button>
            </div>
            {commitsExpanded && (
              <div className="flex flex-col">
                {report.commits.map((c, idx) => (
                  <div key={c.sha} className="flex items-center gap-3 px-5 py-2.5"
                    style={{ borderBottom: idx < report.commits.length - 1 ? '1px solid #f2f4f7' : 'none' }}>
                    <code className="text-[11px] font-mono shrink-0 px-1.5 py-0.5 rounded bg-[#f2f4f7] text-[#344054]">{c.sha.slice(0, 7)}</code>
                    <span className="flex-1 text-[13px] text-[#344054] truncate">{c.message}</span>
                    <span className="text-[11px] text-[#98a2b3] shrink-0">{c.author}</span>
                    <span className="text-[11px] text-[#98a2b3] shrink-0">{formatDate(c.date)}</span>
                    {report.projects?.repo && (
                      <a href={`https://github.com/${report.projects.repo}/commit/${c.sha}`} target="_blank" rel="noopener noreferrer"
                        className="text-[#98a2b3] flex shrink-0" onClick={e => e.stopPropagation()}>
                        <Github className="size-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Issues */}
          <div className="rounded-xl border border-[#eaecf0] overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-[#eaecf0] flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-bold text-[#101828]">问题</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fff1f3] text-[#c01048]">{errorCount} 个错误</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fffaeb] text-[#b54708]">{warningCount} 个警告</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ecfdf3] text-[#027a48]">{infoCount} 个提示</span>
              <div className="ml-auto flex gap-2">
                <Select selectedKey={sevFilter} onSelectionChange={(key) => setSevFilter(key as string)} className="h-8 w-[140px] text-xs">
                  <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                  <Select.Popover>
                    <ListBox items={SEV_ITEMS}>
                      {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
                    </ListBox>
                  </Select.Popover>
                </Select>
                {categories.length > 1 && (
                  <Select selectedKey={catFilter} onSelectionChange={(key) => setCatFilter(key as string)} className="h-8 w-[150px] text-xs">
                    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                    <Select.Popover>
                      <ListBox items={catItems}>
                        {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
                {(sevFilter !== 'all' || catFilter !== 'all') && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onPress={() => { setSevFilter('all'); setCatFilter('all'); }}>清除</Button>
                )}
              </div>
            </div>
            <div className="p-3 pb-1.5">
              {filteredIssues.length === 0 ? (
                <div className="text-center py-10 text-[#98a2b3] text-[13px]">没有匹配当前筛选条件的问题</div>
              ) : (
                filteredIssues.map((issue, idx) => (
                  <IssueRow key={`${issue.file}-${issue.line}-${issue.rule}-${idx}`} issue={issue} />
                ))
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="px-5 py-4 rounded-xl border border-[#eaecf0] bg-white">
            <div className="text-sm font-bold text-[#101828] mb-2.5">AI 总结</div>
            <div className="text-[13px] text-[#667085] leading-[1.8] whitespace-pre-wrap">{report.summary}</div>
          </div>
        </div>
      )}
    </div>
  );
}
