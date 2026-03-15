'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  FileText,
  Folder,
  FolderUp,
  Image as ImageIcon,
  MessageSquarePlus,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Type as TypeIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import type { Dictionary } from '@/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Project = {
  id: string;
  name: string;
  repo: string;
  default_branch: string;
};

type TreeEntry = {
  path: string;
  name: string;
  type: 'tree' | 'blob';
  size?: number;
};

type TreeResponse = {
  ref: string;
  path: string;
  entries: TreeEntry[];
};

type FileResponse = {
  path: string;
  ref: string;
  size: number;
  content: string;
  truncated: boolean;
  isBinary: boolean;
};

type CodebaseComment = {
  id: string;
  line: number;
  line_end?: number | null;
  selection_text?: string | null;
  body: string;
  author_email: string;
  created_at: string;
};

type DraftSelection = {
  lineStart: number;
  lineEnd: number;
  text: string;
  anchor: { x: number; y: number };
};

const COMPOSER_WIDTH = 360;
const COMPOSER_PADDING = 12;
const MAX_SELECTION_TEXT = 1200;

export default function CodebaseClient({
  project,
  branches,
  dict,
}: {
  project: Project;
  branches: string[];
  dict: Dictionary;
}) {
  const [branch, setBranch] = useState<string>(branches[0] ?? project.default_branch);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<TreeEntry[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileResponse | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [comments, setComments] = useState<CodebaseComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastLineClicked, setLastLineClicked] = useState<number | null>(null);

  const treeRequestId = useRef(0);
  const fileRequestId = useRef(0);
  const commentRequestId = useRef(0);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const codeContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!branches.length) return;
    if (!branches.includes(branch)) {
      setBranch(branches[0]);
    }
  }, [branches, branch]);

  useEffect(() => {
    const requestId = ++treeRequestId.current;
    let active = true;

    async function loadTree() {
      setTreeLoading(true);
      setTreeError(null);
      try {
        const params = new URLSearchParams();
        params.set('ref', branch);
        if (currentPath) params.set('path', currentPath);
        const res = await fetch(`/api/projects/${project.id}/codebase/tree?${params.toString()}`);
        if (!res.ok) throw new Error('tree_fetch_failed');
        const data = (await res.json()) as TreeResponse;
        if (!active || treeRequestId.current !== requestId) return;
        setEntries(data.entries || []);
      } catch (err) {
        if (!active || treeRequestId.current !== requestId) return;
        setTreeError(err instanceof Error ? err.message : 'tree_fetch_failed');
      } finally {
        if (!active || treeRequestId.current !== requestId) return;
        setTreeLoading(false);
      }
    }

    loadTree();
    return () => {
      active = false;
    };
  }, [branch, currentPath, project.id, refreshKey]);

  useEffect(() => {
    if (!draftSelection) return;
    const handle = requestAnimationFrame(() => {
      draftRef.current?.focus();
    });
    return () => cancelAnimationFrame(handle);
  }, [draftSelection]);

  useEffect(() => {
    if (!draftSelection) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (composerRef.current?.contains(target)) return;
      if (codeContainerRef.current?.contains(target)) return;
      setDraftSelection(null);
      setDraftBody('');
    };
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [draftSelection]);

  useEffect(() => {
    if (!draftSelection) return;
    const container = codeContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      setDraftSelection(null);
      setDraftBody('');
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [draftSelection]);

  useEffect(() => {
    setDraftSelection(null);
    setDraftBody('');
    setCommentError(null);
  }, [filePath, branch]);

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    return currentPath.split('/').filter(Boolean);
  }, [currentPath]);

  const filteredEntries = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => entry.name.toLowerCase().includes(query));
  }, [entries, deferredSearch]);

  const handleSelectBranch = (value: string) => {
    setBranch(value);
    setCurrentPath('');
    setEntries([]);
    setFilePath(null);
    setFileData(null);
    setFileError(null);
    setComments([]);
    setDraftSelection(null);
    setDraftBody('');
    setCommentError(null);
    setSearch('');
    setLastLineClicked(null);
  };

  const handleSelectEntry = (entry: TreeEntry) => {
    if (entry.type === 'tree') {
      setCurrentPath(entry.path);
      setFilePath(null);
      setFileData(null);
      setFileError(null);
      setDraftSelection(null);
      setDraftBody('');
      setCommentError(null);
      return;
    }
    void loadFile(entry.path);
  };

  const loadFile = async (path: string) => {
    const requestId = ++fileRequestId.current;
    setFileLoading(true);
    setFileError(null);
    setFilePath(path);
    setFileData(null);
    try {
      const params = new URLSearchParams();
      params.set('ref', branch);
      params.set('path', path);
      const res = await fetch(`/api/projects/${project.id}/codebase/file?${params.toString()}`);
      if (!res.ok) throw new Error('file_fetch_failed');
      const data = (await res.json()) as FileResponse;
      if (fileRequestId.current !== requestId) return;
      setFileData(data);
      setComments([]);
      setDraftSelection(null);
      setDraftBody('');
      setCommentError(null);
    } catch (err) {
      if (fileRequestId.current !== requestId) return;
      setFileError(err instanceof Error ? err.message : 'file_fetch_failed');
    } finally {
      if (fileRequestId.current !== requestId) return;
      setFileLoading(false);
    }
  };

  const loadComments = async (path: string) => {
    const requestId = ++commentRequestId.current;
    setCommentsLoading(true);
    setCommentError(null);
    try {
      const params = new URLSearchParams();
      params.set('ref', branch);
      params.set('path', path);
      const res = await fetch(`/api/projects/${project.id}/codebase/comments?${params.toString()}`);
      if (!res.ok) throw new Error('comments_fetch_failed');
      const data = (await res.json()) as CodebaseComment[];
      if (commentRequestId.current !== requestId) return;
      setComments(Array.isArray(data) ? data : []);
    } catch (err) {
      if (commentRequestId.current !== requestId) return;
      setCommentError(err instanceof Error ? err.message : 'comments_fetch_failed');
    } finally {
      if (commentRequestId.current !== requestId) return;
      setCommentsLoading(false);
    }
  };

  const parentPath = useMemo(() => {
    if (!currentPath) return '';
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
  }, [currentPath]);

  useEffect(() => {
    if (!filePath) return;
    void loadComments(filePath);
  }, [filePath, branch, project.id]);

  const lines = useMemo(() => {
    if (!fileData || fileData.isBinary || fileData.truncated) return [];
    return fileData.content.split('\n');
  }, [fileData]);

  const commentsByLine = useMemo(() => {
    const map = new Map<number, CodebaseComment[]>();
    for (const comment of comments) {
      if (!map.has(comment.line)) map.set(comment.line, []);
      map.get(comment.line)!.push(comment);
    }
    return map;
  }, [comments]);

  const handleSubmitComment = async () => {
    if (!filePath || !draftSelection || !draftBody.trim()) return;
    setCommentSaving(true);
    try {
      const selectionText = normalizeSelectionText(draftSelection.text);
      const lineEnd = draftSelection.lineEnd !== draftSelection.lineStart ? draftSelection.lineEnd : undefined;
      const res = await fetch(`/api/projects/${project.id}/codebase/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: branch,
          path: filePath,
          line: draftSelection.lineStart,
          line_end: lineEnd,
          selection_text: selectionText || undefined,
          body: draftBody.trim(),
        }),
      });
      if (!res.ok) throw new Error('comment_create_failed');
      setDraftBody('');
      setDraftSelection(null);
      await loadComments(filePath);
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'comment_create_failed');
    } finally {
      setCommentSaving(false);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/codebase/sync?project_id=${project.id}&force=1`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('sync_failed');
      }
      setSyncMessage(dict.projects.codebaseSyncSuccess);
      setRefreshKey((value) => value + 1);
      if (filePath) {
        await loadFile(filePath);
      }
    } catch {
      setSyncMessage(dict.projects.codebaseSyncFailed);
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyPath = async () => {
    if (!filePath) return;
    try {
      await navigator.clipboard.writeText(filePath);
      toast.success(dict.common.copied);
    } catch {
      toast.error(dict.common.error);
    }
  };

  const openComposer = (lineStart: number, lineEnd: number, text: string, rect: DOMRect) => {
    const container = codeContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const rawX = rect.left - containerRect.left;
    const rawY = rect.bottom - containerRect.top + 8;
    const maxX = Math.max(COMPOSER_PADDING, containerRect.width - COMPOSER_WIDTH - COMPOSER_PADDING);
    const anchorX = clamp(rawX, COMPOSER_PADDING, maxX);
    const anchorY = Math.max(COMPOSER_PADDING, rawY);
    setDraftSelection({
      lineStart,
      lineEnd,
      text,
      anchor: { x: anchorX, y: anchorY },
    });
    setDraftBody('');
    setCommentError(null);
  };

  const handleLineClick = (lineNo: number, rect: DOMRect, shiftKey: boolean) => {
    let lineStart = lineNo;
    let lineEnd = lineNo;
    if (shiftKey && lastLineClicked) {
      lineStart = Math.min(lastLineClicked, lineNo);
      lineEnd = Math.max(lastLineClicked, lineNo);
    }
    setLastLineClicked(lineNo);
    openComposer(lineStart, lineEnd, '', rect);
  };

  const handleTextSelection = (event: React.MouseEvent<HTMLDivElement>) => {
    if (composerRef.current?.contains(event.target as Node)) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!codeContainerRef.current?.contains(range.commonAncestorContainer)) return;
    const anchorLineEl = findLineElement(selection.anchorNode);
    const focusLineEl = findLineElement(selection.focusNode);
    if (!anchorLineEl || !focusLineEl) return;
    const anchorLine = Number(anchorLineEl.dataset.line);
    const focusLine = Number(focusLineEl.dataset.line);
    if (!Number.isFinite(anchorLine) || !Number.isFinite(focusLine)) return;
    const text = selection.toString().trim();
    if (!text) return;
    const [lineStart, lineEnd] = anchorLine <= focusLine
      ? [anchorLine, focusLine]
      : [focusLine, anchorLine];
    const rect = range.getBoundingClientRect();
    openComposer(lineStart, lineEnd, text, rect);
    selection.removeAllRanges();
  };

  const shouldRenderFile = filePath && fileData && !fileData.isBinary && !fileData.truncated;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background px-6 py-3 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs font-medium text-muted-foreground">{dict.projects.branch}</div>
            <Select value={branch} onValueChange={handleSelectBranch}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? dict.projects.codebaseSyncing : dict.projects.codebaseSync}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              aria-label={dict.common.refresh}
              onClick={() => {
                setRefreshKey((value) => value + 1);
                if (filePath) {
                  void loadFile(filePath);
                }
              }}
            >
              <RefreshCcw className="size-4" />
            </Button>
            {syncMessage && (
              <span className="text-xs text-muted-foreground">{syncMessage}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{project.repo}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setCurrentPath('');
              setFilePath(null);
              setFileData(null);
              setFileError(null);
              setDraftSelection(null);
              setDraftBody('');
            }}
          >
            {dict.projects.codebaseRoot}
          </button>
          {breadcrumbs.map((segment, index) => {
            const nextPath = breadcrumbs.slice(0, index + 1).join('/');
            const isLast = index === breadcrumbs.length - 1;
            const isFile = Boolean(filePath);
            const isClickable = !(isFile && isLast);
            return (
              <button
                key={nextPath}
                className={cn(
                  'text-xs text-muted-foreground hover:text-foreground',
                  !isClickable && 'cursor-default text-foreground',
                )}
                onClick={() => {
                  if (!isClickable) return;
                  setCurrentPath(nextPath);
                  setFilePath(null);
                  setFileData(null);
                  setFileError(null);
                  setDraftSelection(null);
                  setDraftBody('');
                }}
                type="button"
              >
                / {segment}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        <div className="lg:w-80 border-r border-border bg-background/60 overflow-auto">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">{project.repo}</div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              aria-label={dict.common.refresh}
              onClick={() => {
                setRefreshKey((value) => value + 1);
              }}
            >
              <RefreshCcw className="size-3.5" />
            </Button>
          </div>

          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={dict.projects.codebaseFindFile}
                className="pl-9"
              />
            </div>
          </div>

          {currentPath && (
            <button
              className="w-full px-4 py-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center gap-2"
              onClick={() => {
                setCurrentPath(parentPath);
                setFilePath(null);
                setFileData(null);
                setFileError(null);
                setDraftSelection(null);
                setDraftBody('');
              }}
              type="button"
            >
              <FolderUp className="size-4" />
              {dict.projects.codebaseParent}
            </button>
          )}

          {treeLoading && (
            <div className="px-4 py-6 text-xs text-muted-foreground">{dict.common.loading}</div>
          )}

          {!treeLoading && treeError && (
            <div className="px-4 py-6 text-xs text-danger">{dict.common.error}</div>
          )}

          {!treeLoading && !treeError && filteredEntries.length === 0 && (
            <div className="px-4 py-6 text-xs text-muted-foreground">
              {search.trim()
                ? dict.projects.codebaseNoMatches
                : dict.projects.codebaseEmpty}
            </div>
          )}

          {!treeLoading && !treeError && filteredEntries.length > 0 && (
            <div className="flex flex-col">
              {filteredEntries.map((entry) => {
                const isActive = filePath === entry.path;
                return (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => handleSelectEntry(entry)}
                    className={cn(
                      'w-full px-4 py-2 text-left text-xs flex items-center gap-2 hover:bg-muted/40',
                      isActive && 'bg-muted/40 text-foreground'
                    )}
                  >
                    {entry.type === 'tree' ? (
                      <Folder className="size-4 text-accent" />
                    ) : (
                      <FileText className="size-4 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{entry.name}</span>
                    {entry.type === 'blob' && entry.size != null && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatBytes(entry.size)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-background">
          <div className="px-6 py-4 border-b border-border flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground truncate">
              {filePath ? filePath : dict.projects.codebaseSelectFile}
            </div>
            {filePath && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {fileData && !fileData.isBinary && !fileData.truncated && (
                  <span>{dict.projects.codebaseLines.replace('{{count}}', String(lines.length))}</span>
                )}
                {fileData && (
                  <span>{formatBytes(fileData.size)}</span>
                )}
                <Button variant="ghost" size="sm" onClick={handleCopyPath}>
                  <Copy className="size-3.5" />
                  {dict.projects.codebaseCopyPath}
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            <div
              className="h-full overflow-auto relative"
              ref={codeContainerRef}
              onMouseUp={handleTextSelection}
            >
              {fileLoading && (
                <div className="px-6 py-6 text-xs text-muted-foreground">{dict.common.loading}</div>
              )}

              {!fileLoading && fileError && (
                <div className="px-6 py-6 text-xs text-danger">{dict.common.error}</div>
              )}

              {!fileLoading && !fileError && fileData && fileData.truncated && (
                <div className="px-6 py-6 text-xs text-muted-foreground">{dict.projects.codebaseFileTooLarge}</div>
              )}

              {!fileLoading && !fileError && fileData && fileData.isBinary && (
                <div className="px-6 py-6 text-xs text-muted-foreground">{dict.projects.codebaseBinaryFile}</div>
              )}

              {!fileLoading && !fileError && shouldRenderFile && (
                <div className="divide-y divide-border">
                  {lines.map((line, index) => {
                    const lineNo = index + 1;
                    const lineComments = commentsByLine.get(lineNo) || [];
                    const rangeActive = draftSelection
                      ? lineNo >= draftSelection.lineStart && lineNo <= draftSelection.lineEnd
                      : false;
                    const hasComments = lineComments.length > 0;
                    return (
                      <div key={lineNo} className="border-b border-border last:border-b-0" data-line={lineNo}>
                        <div
                          className={cn(
                            'group grid grid-cols-[60px_minmax(0,1fr)_60px] gap-2 px-3 py-1.5 text-xs font-mono',
                            (hasComments || rangeActive) && 'bg-muted/30'
                          )}
                        >
                          <button
                            type="button"
                            onClick={(event) => handleLineClick(lineNo, event.currentTarget.getBoundingClientRect(), event.shiftKey)}
                            className="text-right text-[11px] text-muted-foreground hover:text-foreground"
                            aria-label={`${dict.projects.codebaseAddComment} ${lineNo}`}
                          >
                            {lineNo}
                          </button>
                          <pre className="whitespace-pre overflow-auto leading-relaxed text-xs" data-line={lineNo}>
                            {line || ' '}
                          </pre>
                          <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                            {hasComments && (
                              <span className="px-2 py-0.5 rounded-full bg-muted/60">
                                {lineComments.length}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(event) => handleLineClick(lineNo, event.currentTarget.getBoundingClientRect(), event.shiftKey)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label={`${dict.projects.codebaseAddComment} ${lineNo}`}
                            >
                              <MessageSquarePlus className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        {hasComments && (
                          <div className="border-t border-border bg-background/80">
                            {lineComments.map((comment) => {
                              const lineEnd = comment.line_end && comment.line_end !== comment.line
                                ? `${comment.line}-${comment.line_end}`
                                : `${comment.line}`;
                              return (
                                <div
                                  key={comment.id}
                                  className="flex gap-3 px-4 py-3 border-b border-border last:border-b-0"
                                >
                                  <div className="size-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                                    {initialsFromEmail(comment.author_email)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="font-medium text-foreground">{comment.author_email}</span>
                                      <span className="text-muted-foreground">{formatDate(comment.created_at)}</span>
                                      <span className="text-muted-foreground">
                                        {dict.projects.codebaseLine} {lineEnd}
                                      </span>
                                    </div>
                                    {comment.selection_text && (
                                      <pre className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground whitespace-pre-wrap">
                                        {comment.selection_text}
                                      </pre>
                                    )}
                                    <div className="mt-2 text-xs whitespace-pre-wrap text-foreground">
                                      {comment.body}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!fileLoading && !fileError && !fileData && (
                <div className="px-6 py-6 text-xs text-muted-foreground">{dict.projects.codebaseSelectFile}</div>
              )}

              {draftSelection && (
                <div
                  ref={composerRef}
                  className="absolute z-20"
                  style={{ left: draftSelection.anchor.x, top: draftSelection.anchor.y, width: COMPOSER_WIDTH }}
                >
                  <div className="rounded-2xl border border-border bg-background/95 shadow-xl backdrop-blur">
                    {draftSelection.text && (
                      <div className="px-4 pt-3 text-[11px] text-muted-foreground">
                        <div className="rounded-md bg-muted/40 px-3 py-2 whitespace-pre-wrap">
                          {draftSelection.text}
                        </div>
                      </div>
                    )}
                    <div className="px-4 py-3">
                      <Textarea
                        ref={draftRef}
                        value={draftBody}
                        onChange={(event) => setDraftBody(event.target.value)}
                        placeholder={dict.projects.codebaseThreadPlaceholder}
                        className="min-h-[110px] border-0 bg-transparent px-0 py-0 text-xs focus-visible:border-0"
                        onKeyDown={(event) => {
                          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                            event.preventDefault();
                            void handleSubmitComment();
                          }
                          if (event.key === 'Escape') {
                            setDraftSelection(null);
                            setDraftBody('');
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between border-t border-border px-3 py-2 text-muted-foreground">
                      <div className="flex items-center gap-3 text-[11px]">
                        <button type="button" className="hover:text-foreground" aria-label="Add">
                          <Plus className="size-4" />
                        </button>
                        <button type="button" className="hover:text-foreground" aria-label="Image">
                          <ImageIcon className="size-4" />
                        </button>
                        <span className="h-4 w-px bg-border" />
                        <button type="button" className="hover:text-foreground" aria-label="Type">
                          <TypeIcon className="size-4" />
                        </button>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleSubmitComment}
                        disabled={!draftBody.trim() || commentSaving}
                      >
                        <Send className="size-3.5" />
                        {dict.projects.codebaseCommentSubmit}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{dict.projects.codebaseMarkdownHint}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDraftSelection(null);
                        setDraftBody('');
                      }}
                    >
                      {dict.common.cancel}
                    </Button>
                  </div>
                  {commentSaving && (
                    <div className="mt-2 text-xs text-muted-foreground">{dict.common.loading}</div>
                  )}
                  {commentError && (
                    <div className="mt-2 text-xs text-danger">{dict.common.error}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {filePath && (
            <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
              <span>
                {dict.projects.codebaseCommentsCount.replace('{{count}}', String(comments.length))}
              </span>
              {commentsLoading && <span>{dict.common.loading}</span>}
              {!commentsLoading && commentError && <span className="text-danger">{dict.common.error}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function initialsFromEmail(email: string) {
  if (!email) return 'U';
  const name = email.split('@')[0] ?? '';
  const parts = name.split(/[._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? name[0] ?? 'U';
  const second = parts[1]?.[0] ?? name[1] ?? '';
  return `${first}${second}`.toUpperCase();
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function findLineElement(node: Node | null): HTMLElement | null {
  if (!node) return null;
  if (node instanceof HTMLElement) {
    return node.closest('[data-line]');
  }
  const parent = node.parentElement;
  return parent ? parent.closest('[data-line]') : null;
}

function normalizeSelectionText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.length <= MAX_SELECTION_TEXT) return trimmed;
  return `${trimmed.slice(0, MAX_SELECTION_TEXT)}...`;
}
