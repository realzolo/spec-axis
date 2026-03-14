'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, User, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button, Select, ListBox, Modal, useOverlayState } from '@heroui/react';
import { toast } from 'sonner';

type Commit = { sha: string; message: string; author: string; date: string };
type Project = { id: string; name: string; repo: string; default_branch: string; ruleset_id?: string };

const PER_PAGE = 30;

export default function CommitsClient({ project, branches }: { project: Project; branches: string[] }) {
  const router = useRouter();
  const [branch, setBranch] = useState(project.default_branch);
  const [authorFilter, setAuthorFilter] = useState('all');
  const [commits, setCommits] = useState<Commit[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [ruleSetName, setRuleSetName] = useState('');
  const confirmState = useOverlayState();

  useEffect(() => {
    if (project.ruleset_id) {
      fetch(`/api/rules/${project.ruleset_id}`).then(r => r.json()).then(d => setRuleSetName(d.name ?? '')).catch(() => {});
    }
  }, [project.ruleset_id]);

  async function fetchCommits(targetBranch: string, targetPage: number, append = false) {
    if (!append) setLoading(true); else setLoadingMore(true);
    try {
      const data = await fetch(`/api/commits?repo=${project.repo}&branch=${targetBranch}&per_page=${PER_PAGE}&page=${targetPage}`).then(r => r.json());
      setHasMore(data.length === PER_PAGE);
      if (append) setCommits(prev => [...prev, ...data]);
      else { setCommits(data); setSelected([]); }
    } catch { /* silent */ }
    finally { setLoading(false); setLoadingMore(false); }
  }

  useEffect(() => {
    setPage(1); setAuthorFilter('all');
    fetchCommits(branch, 1, false);
  }, [branch, project.repo]);

  const authors = [...new Set(commits.map(c => c.author))];
  const filtered = authorFilter === 'all' ? commits : commits.filter(c => c.author === authorFilter);
  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selected.includes(c.sha));

  function toggleCommit(sha: string) {
    setSelected(prev => prev.includes(sha) ? prev.filter(s => s !== sha) : [...prev, sha]);
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      const shas = new Set(filtered.map(c => c.sha));
      setSelected(prev => prev.filter(s => !shas.has(s)));
    } else {
      setSelected(prev => [...new Set([...prev, ...filtered.map(c => c.sha)])]);
    }
  }

  async function startReview() {
    confirmState.close();
    if (!project.ruleset_id) { toast.warning('请先为此项目配置规则集'); return; }
    setAnalyzing(true);
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, commits: selected }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); setAnalyzing(false); return; }
    router.push(`/reports/${data.reportId}`);
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

  const branchItems = branches.map(b => ({ id: b, label: b }));
  const authorItems = [{ id: 'all', label: '所有作者' }, ...authors.map(a => ({ id: a, label: a }))];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 h-[60px] border-b border-[#eaecf0] bg-white shrink-0">
        <Link href="/projects">
          <Button isIconOnly variant="ghost" className="h-8 w-8"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-[#101828]">{project.name}</div>
          <div className="text-xs text-[#667085]">{project.repo}</div>
        </div>
        {selected.length > 0 && <span className="text-xs text-[#667085] font-medium">已选 {selected.length} 个</span>}
        <Button
          isDisabled={!selected.length || analyzing}
          isLoading={analyzing}
          onPress={() => {
            if (!project.ruleset_id) { toast.warning('请先为此项目配置规则集'); return; }
            confirmState.open();
          }}
          className="gap-1.5 font-semibold h-[34px]"
          style={selected.length ? { background: 'linear-gradient(135deg, #4f6ef7 0%, #7c3aed 100%)', border: 'none' } : {}}
        >
          <Send className="size-3.5" />
          {analyzing ? '分析中…' : `审查 ${selected.length || ''} 个提交`}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-[#eaecf0] bg-[#fafafa] shrink-0">
        <Select selectedKey={branch} onSelectionChange={(key) => setBranch(key as string)} className="w-[150px]">
          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
          <Select.Popover>
            <ListBox items={branchItems}>
              {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select selectedKey={authorFilter} onSelectionChange={(key) => setAuthorFilter(key as string)} className="w-[160px]">
          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
          <Select.Popover>
            <ListBox items={authorItems}>
              {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
            </ListBox>
          </Select.Popover>
        </Select>
        {filtered.length > 0 && (
          <Button isIconOnly variant="ghost" onPress={toggleSelectAll} className="text-[#4f6ef7] font-medium h-8 text-xs gap-1">
            {allFilteredSelected && <CheckCircle2 className="size-3.5" />}
            {allFilteredSelected ? '取消全选' : `全选 (${filtered.length})`}
          </Button>
        )}
        <span className="text-xs text-[#98a2b3] ml-auto">{filtered.length} 个提交</span>
      </div>

      {/* Commit list */}
      <div className="flex-1 overflow-auto bg-[#f0f2f5] p-4">
        {loading ? (
          <div className="flex justify-center items-center h-[200px]">
            <Loader2 className="size-8 animate-spin text-[#98a2b3]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[#98a2b3] text-sm">未找到提交</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(commit => {
              const isSelected = selected.includes(commit.sha);
              return (
                <div
                  key={commit.sha}
                  onClick={() => toggleCommit(commit.sha)}
                  className="flex items-center gap-3.5 px-[18px] py-3.5 cursor-pointer rounded-xl transition-all"
                  style={{
                    border: `1px solid ${isSelected ? '#c7d7fd' : '#eaecf0'}`,
                    background: isSelected ? '#eff4ff' : '#fff',
                    boxShadow: isSelected ? '0 0 0 3px rgba(79,110,247,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div className="w-[18px] h-[18px] rounded-[5px] shrink-0 flex items-center justify-center transition-all"
                    style={{ border: `2px solid ${isSelected ? '#4f6ef7' : '#d0d5dd'}`, background: isSelected ? '#4f6ef7' : '#fff' }}>
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <code className="text-[11px] font-mono px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: isSelected ? '#e0eaff' : '#f2f4f7', color: '#344054' }}>
                        {commit.sha.slice(0, 7)}
                      </code>
                      <span className="text-[13px] text-[#101828] font-medium truncate">{commit.message}</span>
                    </div>
                    <div className="flex items-center gap-3.5">
                      <span className="text-xs text-[#667085] flex items-center gap-1"><User className="size-3" />{commit.author}</span>
                      <span className="text-xs text-[#667085] flex items-center gap-1"><Clock className="size-3" />{formatDate(commit.date)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {hasMore && authorFilter === 'all' && (
              <div className="flex justify-center pt-2">
                <Button variant="ghost" isLoading={loadingMore} onPress={() => { const next = page + 1; setPage(next); fetchCommits(branch, next, true); }}
                  className="text-[#4f6ef7] font-semibold">
                  {loadingMore ? '加载中…' : '加载更多提交'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      <Modal state={confirmState}>
        <Modal.Backdrop isDismissable>
          <Modal.Container className="max-w-[420px]">
            <Modal.Dialog>
              <Modal.Header><Modal.Heading>开始代码审查</Modal.Heading></Modal.Header>
              <Modal.Body className="flex flex-col gap-4 mt-2">
                <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#f8f9fc] border border-[#eaecf0]">
                  <div className="flex-1">
                    <div className="text-[13px] text-[#667085] mb-1">待分析提交数</div>
                    <div className="text-[22px] font-bold text-[#101828]">{selected.length}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] text-[#667085] mb-1">规则集</div>
                    <div className="text-[13px] font-semibold text-[#101828]">{ruleSetName || '—'}</div>
                  </div>
                </div>
                <div className="text-[13px] text-[#667085] leading-relaxed">
                  Claude 将根据您配置的规则分析所选提交，生成质量报告。这可能需要一两分钟。
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="outline" onPress={confirmState.close}>取消</Button>
                <Button onPress={startReview} style={{ background: 'linear-gradient(135deg, #4f6ef7 0%, #7c3aed 100%)', border: 'none' }}>
                  开始分析
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
