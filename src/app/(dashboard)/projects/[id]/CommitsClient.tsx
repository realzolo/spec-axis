'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Send, User, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { PageLoading } from '@/components/ui/page-loading';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Dictionary } from '@/i18n';
import { withOrgPrefix } from '@/lib/orgPath';

type Commit = { sha: string; message: string; author: string; date: string };
type Project = { id: string; name: string; repo: string; default_branch: string; ruleset_id?: string };

const PER_PAGE = 30;

export default function CommitsClient({ project, branches, dict }: { project: Project; branches: string[]; dict: Dictionary }) {
  const router = useRouter();
  const pathname = usePathname();
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (project.ruleset_id) {
      fetch(`/api/rules/${project.ruleset_id}`).then(r => r.json()).then(d => setRuleSetName(d.name ?? '')).catch(() => {});
    }
  }, [project.ruleset_id]);

  async function fetchCommits(targetBranch: string, targetPage: number, append = false) {
    if (!append) setLoading(true); else setLoadingMore(true);
    try {
      const data = await fetch(`/api/commits?repo=${project.repo}&branch=${targetBranch}&per_page=${PER_PAGE}&page=${targetPage}&project_id=${project.id}`).then(r => r.json());
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
    setConfirmOpen(false);
    if (!project.ruleset_id) { toast.warning(dict.commits.configureRuleSetFirst); return; }
    setAnalyzing(true);
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, commits: selected }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); setAnalyzing(false); return; }
    router.push(withOrgPrefix(pathname, `/reports/${data.reportId}`));
  }

  function formatDate(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const h = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (h < 1) return dict.commits.justNow;
    if (h < 24) return dict.commits.hoursAgo.replace('{{hours}}', h.toString());
    if (days < 30) return dict.commits.daysAgo.replace('{{days}}', days.toString());
    return new Date(d).toLocaleDateString();
  }

  const branchItems = branches.map(b => ({ id: b, label: b }));
  const authorItems = [{ id: 'all', label: dict.commits.allAuthors }, ...authors.map(a => ({ id: a, label: a }))];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border bg-card shrink-0">
        <Link href={withOrgPrefix(pathname, '/projects')}>
          <Button size="icon" variant="ghost"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">{project.name}</div>
          <div className="text-xs text-muted-foreground">{project.repo}</div>
        </div>
        {selected.length > 0 && <span className="text-xs text-muted-foreground font-medium">{dict.commits.selected.replace('{{count}}', selected.length.toString())}</span>}
        <Button
          disabled={!selected.length || analyzing}
          onClick={() => {
            if (!project.ruleset_id) { toast.warning(dict.commits.configureRuleSetFirst); return; }
            setConfirmOpen(true);
          }}
          className="gap-1.5"
          size="sm"
        >
          {analyzing ? <Spinner size="sm" /> : <Send className="size-3.5" />}
          {analyzing ? dict.commits.analyzing : dict.commits.reviewCommits.replace('{{count}}', (selected.length || '').toString())}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-border bg-card/50 shrink-0">
        <Select value={branch} onValueChange={(value) => setBranch(value)}>
          <SelectTrigger className="w-[150px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {branchItems.map(item => (
              <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={authorFilter} onValueChange={(value) => setAuthorFilter(value)}>
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {authorItems.map(item => (
              <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered.length > 0 && (
          <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="gap-1">
            {allFilteredSelected && <CheckCircle2 className="size-3.5" />}
            {allFilteredSelected ? dict.commits.deselectAll : dict.commits.selectAll.replace('{{count}}', filtered.length.toString())}
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{dict.commits.commitsCount.replace('{{count}}', filtered.length.toString())}</span>
      </div>

      {/* Commit list */}
      <div className="flex-1 overflow-auto bg-muted/30 p-4">
        {loading ? (
          <PageLoading label={dict.common.loading} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">{dict.commits.noCommits}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(commit => {
              const isSelected = selected.includes(commit.sha);
              return (
                <div
                  key={commit.sha}
                  onClick={() => toggleCommit(commit.sha)}
                  className={[
                    'flex items-center gap-3.5 px-4 py-3.5 cursor-pointer rounded-xl border transition-all',
                    isSelected
                      ? 'border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--accent)/0.08)] ring-2 ring-[hsl(var(--accent)/0.18)]'
                      : 'border-border bg-card hover:border-[hsl(var(--accent)/0.25)] hover:bg-[hsl(var(--accent)/0.06)]',
                  ].join(' ')}
                >
                  <div className={[
                    'w-4.5 h-4.5 rounded-md shrink-0 flex items-center justify-center border-2 transition-all',
                    isSelected ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))]' : 'border-border bg-background',
                  ].join(' ')}>
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {commit.sha.slice(0, 7)}
                      </code>
                      <span className="text-sm font-medium truncate">{commit.message}</span>
                    </div>
                    <div className="flex items-center gap-3.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="size-3" />{commit.author}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="size-3" />{formatDate(commit.date)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {hasMore && authorFilter === 'all' && (
              <div className="flex justify-center pt-2">
              <Button variant="ghost" disabled={loadingMore} onClick={() => { const next = page + 1; setPage(next); fetchCommits(branch, next, true); }}>
                {loadingMore ? <Spinner size="sm" /> : null}
                {loadingMore ? dict.common.loading : dict.commits.loadMore}
              </Button>
            </div>
          )}
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{dict.commits.confirmReview}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">{dict.commits.pendingCommitCount}</div>
                <div className="text-2xl font-bold">{selected.length}</div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">{dict.projects.ruleSet}</div>
                <div className="text-sm font-semibold">{ruleSetName || '—'}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {dict.commits.analysisNote}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>{dict.common.cancel}</Button>
            <Button onClick={startReview}>{dict.commits.startReview}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
