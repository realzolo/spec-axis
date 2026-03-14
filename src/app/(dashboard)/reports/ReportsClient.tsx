'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ChevronRight, Trash2 } from 'lucide-react';
import { Button, Select, ListBox } from '@heroui/react';
import { toast } from 'sonner';

type Report = {
  id: string; status: string; score?: number;
  category_scores?: Record<string, number>;
  commits: unknown[]; created_at: string;
  projects?: { name: string; repo: string } | { name: string; repo: string }[];
};

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#f2f4f7', color: '#667085', label: '待处理' },
  analyzing: { bg: '#eff8ff', color: '#1570ef', label: '分析中…' },
  done:      { bg: '#ecfdf3', color: '#027a48', label: '已完成' },
  failed:    { bg: '#fff1f3', color: '#c01048', label: '失败' },
};

const CAT_LABEL: Record<string, string> = {
  style: '风格', security: '安全', architecture: '架构',
  performance: '性能', maintainability: '可维护',
};

function scoreColor(s: number) {
  if (s >= 85) return '#027a48';
  if (s >= 70) return '#b54708';
  return '#c01048';
}
function scoreBg(s: number) {
  if (s >= 85) return '#ecfdf3';
  if (s >= 70) return '#fffaeb';
  return '#fff1f3';
}

const STATUS_ITEMS = [
  { id: 'all', label: '所有状态' },
  { id: 'done', label: '已完成' },
  { id: 'analyzing', label: '分析中' },
  { id: 'pending', label: '待处理' },
  { id: 'failed', label: '失败' },
];

export default function ReportsClient({ initialReports }: { initialReports: Report[] }) {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const projectNames = useMemo(() => {
    return [...new Set(reports.map(r => {
      const projects = r.projects;
      if (Array.isArray(projects)) return projects[0]?.name;
      return projects?.name;
    }).filter(Boolean))] as string[];
  }, [reports]);

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (projectFilter !== 'all') {
        const projects = r.projects;
        const projectName = Array.isArray(projects) ? projects[0]?.name : projects?.name;
        if (projectName !== projectFilter) return false;
      }
      return true;
    });
  }, [reports, statusFilter, projectFilter]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    if (!res.ok) { toast.error('删除失败'); return; }
    toast.success('报告已删除');
    setReports(prev => prev.filter(r => r.id !== id));
  }

  const projectItems = useMemo(() => [
    { id: 'all', label: '所有项目' },
    ...projectNames.map(name => ({ id: name, label: name })),
  ], [projectNames]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex flex-col gap-6 px-8 py-6 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">报告</h2>
              <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                {filtered.length}
              </span>
              {(statusFilter !== 'all' || projectFilter !== 'all') && (
                <span className="text-sm text-muted-foreground">共 {reports.length}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">查看代码审查报告和质量评分</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select selectedKey={statusFilter} onSelectionChange={(key) => setStatusFilter(key as string)} className="w-[180px]">
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox items={STATUS_ITEMS}>
                {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
              </ListBox>
            </Select.Popover>
          </Select>
          {projectNames.length > 1 && (
            <Select selectedKey={projectFilter} onSelectionChange={(key) => setProjectFilter(key as string)} className="w-[200px]">
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox items={projectItems}>
                  {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
          {(statusFilter !== 'all' || projectFilter !== 'all') && (
            <Button variant="outline" size="sm" onPress={() => { setStatusFilter('all'); setProjectFilter('all'); }}>
              清除筛选
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {reports.length === 0 ? (
          <div className="flex h-[450px] shrink-0 items-center justify-center rounded-xl border border-dashed border-border">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">暂无报告</h3>
              <p className="mt-2 text-sm text-muted-foreground">从任意项目发起代码审查</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-[450px] shrink-0 items-center justify-center rounded-xl border border-dashed border-border">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">没有匹配当前筛选条件的报告</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(report => {
              const st = STATUS_MAP[report.status] ?? STATUS_MAP.pending;
              return (
                <div
                  key={report.id}
                  onClick={() => router.push(`/reports/${report.id}`)}
                  className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-6 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-lg border border-border"
                    style={{ background: report.score != null ? scoreBg(report.score) : 'var(--muted)' }}>
                    <span className="text-3xl font-bold leading-none"
                      style={{ color: report.score != null ? scoreColor(report.score) : 'var(--muted-foreground)' }}>
                      {report.score ?? '—'}
                    </span>
                    {report.score != null && <span className="mt-1 text-xs font-medium text-muted-foreground">/ 100</span>}
                  </div>

                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-semibold leading-none">
                        {(() => {
                          const projects = report.projects;
                          const projectName = Array.isArray(projects) ? projects[0]?.name : projects?.name;
                          return projectName ?? '未知';
                        })()}
                      </p>
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(report.commits as unknown[])?.length ?? 0} 个提交 · {new Date(report.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>

                  {report.category_scores && (
                    <div className="flex gap-6 shrink-0">
                      {Object.entries(report.category_scores).map(([k, v]) => (
                        <div key={k} className="text-center">
                          <div className="text-base font-bold" style={{ color: scoreColor(v) }}>{v}</div>
                          <div className="mt-1 text-xs font-medium text-muted-foreground">{CAT_LABEL[k] ?? k}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    isIconOnly
                    variant="ghost"
                    className="h-9 w-9 shrink-0 rounded-lg"
                    isLoading={deletingId === report.id}
                    onPress={(e) => handleDelete(report.id, e as unknown as React.MouseEvent)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
