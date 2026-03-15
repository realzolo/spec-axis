'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Folder, FolderUp, MessageSquarePlus, RefreshCcw } from 'lucide-react';

import type { Dictionary } from '@/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
  body: string;
  author_email: string;
  created_at: string;
};

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

  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileResponse | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [comments, setComments] = useState<CodebaseComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const treeRequestId = useRef(0);
  const fileRequestId = useRef(0);
  const commentRequestId = useRef(0);

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

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    return currentPath.split('/').filter(Boolean);
  }, [currentPath]);

  const handleSelectBranch = (value: string) => {
    setBranch(value);
    setCurrentPath('');
    setEntries([]);
    setFilePath(null);
    setFileData(null);
    setFileError(null);
    setComments([]);
    setActiveLine(null);
    setCommentBody('');
    setCommentError(null);
  };

  const handleSelectEntry = (entry: TreeEntry) => {
    if (entry.type === 'tree') {
      setCurrentPath(entry.path);
      setFilePath(null);
      setFileData(null);
      setFileError(null);
      return;
    }
    loadFile(entry.path);
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
      setActiveLine(null);
      setCommentBody('');
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
    loadComments(filePath);
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
    if (!filePath || !activeLine || !commentBody.trim()) return;
    setCommentSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/codebase/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: branch,
          path: filePath,
          line: activeLine,
          body: commentBody.trim(),
        }),
      });
      if (!res.ok) throw new Error('comment_create_failed');
      setCommentBody('');
      setActiveLine(null);
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

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background px-6 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
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
          {syncMessage && (
            <span className="text-xs text-muted-foreground">{syncMessage}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{dict.projects.codebaseRoot}</span>
          {breadcrumbs.map((segment, index) => {
            const nextPath = breadcrumbs.slice(0, index + 1).join('/');
            return (
              <button
                key={nextPath}
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setCurrentPath(nextPath)}
                type="button"
              >
                / {segment}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        <div className="md:w-72 border-r border-border bg-background/60 overflow-auto">
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

          {currentPath && (
            <button
              className="w-full px-4 py-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center gap-2"
              onClick={() => {
                setCurrentPath(parentPath);
                setFilePath(null);
                setFileData(null);
                setFileError(null);
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

          {!treeLoading && !treeError && entries.length === 0 && (
            <div className="px-4 py-6 text-xs text-muted-foreground">{dict.projects.codebaseEmpty}</div>
          )}

          {!treeLoading && !treeError && entries.length > 0 && (
            <div className="flex flex-col">
              {entries.map((entry) => {
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

        <div className="flex-1 overflow-auto bg-background">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="text-xs text-muted-foreground truncate">
              {filePath ? filePath : dict.projects.codebaseSelectFile}
            </div>
            {filePath && (
              <div className="text-xs text-muted-foreground">
                {dict.projects.codebaseCommentsCount.replace('{{count}}', String(comments.length))}
              </div>
            )}
          </div>

          <div className="p-6">
            {fileLoading && (
              <div className="text-xs text-muted-foreground">{dict.common.loading}</div>
            )}

            {!fileLoading && fileError && (
              <div className="text-xs text-danger">{dict.common.error}</div>
            )}

            {!fileLoading && !fileError && fileData && fileData.truncated && (
              <div className="text-xs text-muted-foreground">{dict.projects.codebaseFileTooLarge}</div>
            )}

            {!fileLoading && !fileError && fileData && fileData.isBinary && (
              <div className="text-xs text-muted-foreground">{dict.projects.codebaseBinaryFile}</div>
            )}

            {!fileLoading && !fileError && fileData && !fileData.isBinary && !fileData.truncated && (
              <div className="space-y-4">
                {filePath && (
                  <div className="border border-border rounded-md p-4 bg-muted/30">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      {activeLine
                        ? `${dict.projects.codebaseAddComment} · ${dict.projects.codebaseLine} ${activeLine}`
                        : dict.projects.codebaseAddComment}
                    </div>
                    <textarea
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      placeholder={dict.projects.codebaseCommentPlaceholder}
                      className="w-full min-h-[90px] rounded-md border border-border bg-background px-3 py-2 text-xs"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSubmitComment}
                        disabled={!activeLine || !commentBody.trim() || commentSaving}
                      >
                        {dict.projects.codebaseCommentSubmit}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveLine(null);
                          setCommentBody('');
                        }}
                      >
                        {dict.common.cancel}
                      </Button>
                      {commentSaving && (
                        <span className="text-xs text-muted-foreground">{dict.common.loading}</span>
                      )}
                    </div>
                    {commentError && (
                      <div className="text-xs text-danger mt-2">{dict.common.error}</div>
                    )}
                  </div>
                )}

                <div className="border border-border rounded-md overflow-hidden">
                  {lines.map((line, index) => {
                    const lineNo = index + 1;
                    const lineComments = commentsByLine.get(lineNo) || [];
                    return (
                      <div key={lineNo} className="border-b border-border last:border-b-0">
                        <div className="group flex gap-3 px-3 py-1.5 hover:bg-muted/30">
                          <button
                            type="button"
                            onClick={() => setActiveLine(lineNo)}
                            className="w-10 text-right text-[11px] text-muted-foreground hover:text-foreground"
                            aria-label={`${dict.projects.codebaseAddComment} ${lineNo}`}
                          >
                            {lineNo}
                          </button>
                          <pre className="flex-1 text-xs font-mono leading-relaxed whitespace-pre overflow-auto">
                            {line || ' '}
                          </pre>
                          <div className="min-w-[48px] flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                            {lineComments.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-muted/60">
                                {lineComments.length}
                              </span>
                            )}
                            <MessageSquarePlus className="size-3 opacity-0 group-hover:opacity-100" />
                          </div>
                        </div>
                        {lineComments.length > 0 && (
                          <div className="px-6 pb-3">
                            {lineComments.map((comment) => (
                              <div
                                key={comment.id}
                                className="mt-2 rounded-md border border-border bg-background p-2 text-xs"
                              >
                                <div className="text-[11px] text-muted-foreground">
                                  {comment.author_email} · {formatDate(comment.created_at)}
                                </div>
                                <div className="mt-1 whitespace-pre-wrap">{comment.body}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {commentsLoading && (
                  <div className="text-xs text-muted-foreground">{dict.common.loading}</div>
                )}

                {!commentsLoading && !commentError && comments.length === 0 && (
                  <div className="text-xs text-muted-foreground">{dict.projects.codebaseNoComments}</div>
                )}

                {!commentsLoading && commentError && (
                  <div className="text-xs text-danger">{dict.common.error}</div>
                )}
              </div>
            )}

            {!fileLoading && !fileError && !fileData && (
              <div className="text-xs text-muted-foreground">{dict.projects.codebaseSelectFile}</div>
            )}
          </div>
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
