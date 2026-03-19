'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Info, Zap,
  Copy, Check, MessageCircle, FileCode, Send, User, RefreshCw, ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import type { Dictionary } from '@/i18n';
import { formatLocalDateTime } from '@/lib/dateFormat';

type Issue = {
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

type IssueComment = {
  id: string;
  author: string;
  content: string;
  created_at: string;
  pending?: boolean;
};

type CommentSortOrder = 'oldest' | 'newest';

const COMMENT_PREVIEW_CHAR_LIMIT = 280;
const COMMENT_PREVIEW_LINE_LIMIT = 6;
const COMMENT_MAX_LENGTH = 4000;
const COMMENT_COMPOSER_MAX_HEIGHT = 180;

export default function IssueCard({
  issue,
  issueId,
  reportId,
  onChat,
  codebaseHref,
  dict,
}: {
  issue: Issue;
  issueId?: string;
  reportId?: string;
  onChat?: () => void;
  codebaseHref?: string;
  dict: Dictionary;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copiedSection, setCopiedSection] = useState<'snippet' | 'patch' | null>(null);

  // Comment thread state
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentSortOrder, setCommentSortOrder] = useState<CommentSortOrder>('oldest');
  const [expandedCommentIds, setExpandedCommentIds] = useState<Record<string, boolean>>({});
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

  const SEV_CONFIG = {
    critical: { icon: AlertCircle, iconClass: 'text-danger', badgeClass: 'bg-danger/10 text-danger', label: dict.reportDetail.severity.critical },
    high: { icon: AlertTriangle, iconClass: 'text-warning', badgeClass: 'bg-warning/20 text-warning', label: dict.reportDetail.severity.high },
    medium: { icon: AlertTriangle, iconClass: 'text-warning', badgeClass: 'bg-warning/10 text-warning', label: dict.reportDetail.severity.medium },
    low: { icon: Info, iconClass: 'text-accent', badgeClass: 'bg-accent/10 text-accent', label: dict.reportDetail.severity.low },
    info: { icon: Info, iconClass: 'text-success', badgeClass: 'bg-success/10 text-success', label: dict.reportDetail.severity.info },
  } as const;

  const config = SEV_CONFIG[issue.severity] || SEV_CONFIG.info;
  const Icon = config.icon;

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success(dict.common.copied);
  }

  const autoResizeComposer = useCallback(() => {
    const target = commentInputRef.current;
    if (!target) return;
    target.style.height = '0px';
    target.style.height = `${Math.min(target.scrollHeight, COMMENT_COMPOSER_MAX_HEIGHT)}px`;
    target.style.overflowY = target.scrollHeight > COMMENT_COMPOSER_MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    autoResizeComposer();
  }, [commentText, expanded, autoResizeComposer]);

  const loadComments = useCallback(async (force = false) => {
    if (!issueId || !reportId) return;
    if (commentsLoaded && !force) return;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/issues/${issueId}`);
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setComments(Array.isArray(data.issue_comments) ? data.issue_comments : []);
      setCommentsLoaded(true);
    } catch {
      setCommentsError('comments_fetch_failed');
    } finally {
      setCommentsLoading(false);
    }
  }, [issueId, reportId, commentsLoaded]);

  function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !commentsLoaded && issueId && reportId) {
      void loadComments();
    }
  }

  const sortedComments = useMemo(() => {
    const list = [...comments];
    list.sort((a, b) => {
      const aTs = Date.parse(a.created_at);
      const bTs = Date.parse(b.created_at);
      if (Number.isNaN(aTs) || Number.isNaN(bTs)) return 0;
      return commentSortOrder === 'oldest' ? aTs - bTs : bTs - aTs;
    });
    return list;
  }, [comments, commentSortOrder]);

  const isLongComment = useCallback((content: string) => {
    if (content.length > COMMENT_PREVIEW_CHAR_LIMIT) return true;
    return content.split('\n').length > COMMENT_PREVIEW_LINE_LIMIT;
  }, []);

  const previewComment = useCallback((content: string) => {
    if (!isLongComment(content)) return content;
    const collapsed = content.slice(0, COMMENT_PREVIEW_CHAR_LIMIT).trimEnd();
    return `${collapsed}...`;
  }, [isLongComment]);

  const toggleCommentExpanded = useCallback((commentId: string) => {
    setExpandedCommentIds((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  }, []);

  const handleSortToggle = useCallback(() => {
    setCommentSortOrder((prev) => (prev === 'oldest' ? 'newest' : 'oldest'));
  }, []);

  async function handleSubmitComment() {
    if (!commentText.trim() || !issueId || !reportId) return;
    const body = commentText.trim();
    const optimisticId = `pending-${Date.now()}`;
    const optimisticComment: IssueComment = {
      id: optimisticId,
      author: 'You',
      content: body,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setComments((prev) => [...prev, optimisticComment]);
    setCommentText('');
    setSubmitting(true);
    setCommentsError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/issues/${issueId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: 'You', content: body }),
      });
      if (!res.ok) throw new Error('failed');
      const newComment = await res.json() as IssueComment;
      setComments((prev) => prev.map((comment) => (
        comment.id === optimisticId
          ? newComment
          : comment
      )));
    } catch {
      setComments((prev) => prev.filter((comment) => comment.id !== optimisticId));
      setCommentText(body);
      toast.error(dict.reportDetail.postCommentFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[hsl(var(--ds-background-2))] border border-[hsl(var(--ds-border-1))] rounded-[8px] overflow-hidden mb-3 shadow-sm hover:shadow-md transition-all duration-200">
      <button
        type="button"
        onClick={handleExpand}
        className="flex w-full items-start gap-3 px-5 py-4 cursor-pointer hover:bg-[hsl(var(--ds-surface-1))] transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="shrink-0 mt-0.5">
          <Icon className={['size-5', config.iconClass].join(' ')} />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs font-mono bg-muted rounded-[8px] px-2.5 py-1">
              {issue.file}{issue.line ? `:${issue.line}` : ''}
            </code>
            <span className={['px-2.5 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wide', config.badgeClass].join(' ')}>
              {config.label}
            </span>
            <span className="px-2.5 py-1 rounded-[4px] text-xs font-semibold bg-primary/10 text-primary">
              {dict.reports.categories[issue.category as keyof typeof dict.reports.categories] ?? issue.category}
            </span>
            {issue.priority && (
              <span className="px-2.5 py-1 rounded-[4px] text-xs font-semibold bg-secondary text-secondary-foreground">
                P{issue.priority}
              </span>
            )}
            {issue.estimatedEffort && (
              <span className="text-[12px] font-medium text-[hsl(var(--ds-text-2))]">
                <Zap className="size-3 inline mr-1" />
                {issue.estimatedEffort}
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-foreground leading-relaxed">{issue.message}</div>
          {issue.impactScope && (
            <div className="text-[12px] text-[hsl(var(--ds-text-2))]">{dict.reportDetail.impactScopeLabel}: {issue.impactScope}</div>
          )}
        </div>

        <div className="shrink-0 text-[hsl(var(--ds-text-2))]">
          {expanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-surface-1))] p-5 space-y-4">
          <div>
            <div className="text-xs font-semibold text-[hsl(var(--ds-text-2))] mb-2">{dict.reportDetail.ruleLabel}</div>
            <div className="text-sm font-medium">{issue.rule}</div>
          </div>

          {issue.codeSnippet && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-[hsl(var(--ds-text-2))]">{dict.reportDetail.codeSnippetLabel}</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs rounded-[8px]"
                  onClick={() => {
                    void handleCopy(issue.codeSnippet!);
                    setCopiedSection('snippet');
                    setTimeout(() => setCopiedSection(null), 1500);
                  }}
                >
                  {copiedSection === 'snippet' ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                  {dict.common.copy}
                </Button>
              </div>
              <pre className="text-xs font-mono bg-[hsl(var(--ds-background-2))] border border-[hsl(var(--ds-border-1))] rounded-[8px] p-3 overflow-x-auto">
                {issue.codeSnippet}
              </pre>
            </div>
          )}

          {issue.suggestion && (
            <div>
              <div className="text-xs font-semibold text-[hsl(var(--ds-text-2))] mb-2">{dict.reportDetail.fixSuggestionLabel}</div>
              <div className="text-sm bg-[hsl(var(--ds-background-2))] border border-[hsl(var(--ds-border-1))] rounded-[8px] p-3 whitespace-pre-wrap">
                {issue.suggestion}
              </div>
            </div>
          )}

          {issue.fixPatch && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-[hsl(var(--ds-text-2))]">{dict.reportDetail.fixPatchLabel}</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs rounded-[8px]"
                  onClick={() => {
                    void handleCopy(issue.fixPatch!);
                    setCopiedSection('patch');
                    setTimeout(() => setCopiedSection(null), 1500);
                  }}
                >
                  {copiedSection === 'patch' ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                  {dict.common.copy}
                </Button>
              </div>
              <pre className="text-xs font-mono bg-[hsl(var(--ds-background-2))] border border-[hsl(var(--ds-border-1))] rounded-[8px] p-3 overflow-x-auto">
                {issue.fixPatch}
              </pre>
            </div>
          )}

          {(onChat || codebaseHref) && (
            <div className="pt-2 flex flex-wrap gap-2">
              {codebaseHref && (
                <Button asChild variant="outline" size="sm" className="gap-2 rounded-[8px]">
                  <Link href={codebaseHref}>
                    <FileCode className="size-4" />
                    {dict.reportDetail.viewInCodebase}
                  </Link>
                </Button>
              )}
              {onChat && (
                <Button variant="outline" size="sm" onClick={onChat} className="gap-2 rounded-[8px]">
                  <MessageCircle className="size-4" />
                  {dict.reportDetail.discussIssue}
                </Button>
              )}
            </div>
          )}

          {/* ── Comment Thread ─────────────────────────────── */}
          {issueId && reportId && (
            <div className="pt-2 border-t border-[hsl(var(--ds-border-1))]">
·              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-[hsl(var(--ds-text-2))] flex items-center gap-1.5">
                  <MessageCircle className="size-3.5" />
                  {dict.reportDetail.discussion}
                  <span className="ml-1 rounded-full bg-[hsl(var(--ds-surface-2))] px-1.5 py-0.5 text-[10px]">
                    {comments.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={handleSortToggle}
                  >
                    <ArrowUpDown className="size-3.5" />
                    {commentSortOrder === 'oldest'
                      ? dict.reportDetail.commentsOldestFirst
                      : dict.reportDetail.commentsNewestFirst}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => void loadComments(true)}
                    disabled={commentsLoading}
                    aria-label={dict.common.refresh}
                    title={dict.common.refresh}
                  >
                    {commentsLoading ? (
                      <Spinner size="sm" className="h-3.5 w-3.5" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {commentsLoading && comments.length === 0 && (
                <div className="text-[12px] text-[hsl(var(--ds-text-2))] py-2">{dict.reportDetail.loadingComments}</div>
              )}

              {!commentsLoading && commentsError && comments.length === 0 && (
                <div className="mb-3 rounded-[8px] border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger flex items-center justify-between gap-2">
                  <span>{dict.reportDetail.loadCommentsFailed}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => void loadComments(true)}
                  >
                    {dict.common.refresh}
                  </Button>
                </div>
              )}

              {!commentsLoading && comments.length > 0 && (
                <div className="mb-3 max-h-[280px] overflow-y-auto rounded-[8px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-background-2))] p-2 space-y-2">
                  {sortedComments.map((comment) => {
                    const isExpanded = expandedCommentIds[comment.id] ?? false;
                    const shouldCollapse = isLongComment(comment.content) && !isExpanded;
                    return (
                      <div key={comment.id} className="rounded-[6px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-surface-1))] px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--ds-surface-2))] shrink-0">
                              <User className="size-3 text-[hsl(var(--ds-text-2))]" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-[12px]">
                                <span className="font-medium text-foreground truncate">{comment.author}</span>
                                {comment.pending && (
                                  <span className="text-[10px] text-[hsl(var(--ds-text-2))]">{dict.common.loading}</span>
                                )}
                              </div>
                              <div className="text-[11px] text-[hsl(var(--ds-text-2))]">{formatLocalDateTime(comment.created_at)}</div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0"
                            onClick={() => {
                              void handleCopy(comment.content);
                            }}
                            title={dict.common.copy}
                            aria-label={dict.common.copy}
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                        <div className="mt-2 text-[13px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
                          {shouldCollapse ? previewComment(comment.content) : comment.content}
                        </div>
                        {isLongComment(comment.content) && (
                          <button
                            type="button"
                            className="mt-1 text-[11px] text-[hsl(var(--ds-accent-8))] hover:underline"
                            onClick={() => toggleCommentExpanded(comment.id)}
                          >
                            {isExpanded ? dict.reportDetail.collapseComment : dict.reportDetail.expandComment}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!commentsLoading && !commentsError && comments.length === 0 && (
                <p className="text-[12px] text-[hsl(var(--ds-text-2))] mb-3">{dict.reportDetail.noComments}</p>
              )}

              {/* Comment input */}
              <div className="rounded-[8px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-background-2))] p-2">
                <Textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value.slice(0, COMMENT_MAX_LENGTH))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void handleSubmitComment();
                    }
                  }}
                  placeholder={dict.reportDetail.commentPlaceholder}
                  rows={1}
                  className="min-h-[42px] max-h-[180px] resize-none border-0 bg-transparent px-2 py-1 hover:bg-transparent focus-visible:border-0 focus-visible:ring-0"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[hsl(var(--ds-text-2))]">
                    {dict.reportDetail.commentShortcutHint}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[hsl(var(--ds-text-2))]">
                      {commentText.length}/{COMMENT_MAX_LENGTH}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2.5"
                      disabled={!commentText.trim() || submitting}
                      onClick={handleSubmitComment}
                      aria-label={dict.reportDetail.postComment}
                    >
                      {submitting ? <Spinner size="sm" className="h-3.5 w-3.5" /> : <Send className="size-3.5" />}
                      {dict.reportDetail.postComment}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
