'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AlertTriangle, Copy, Check, Plus, Trash2, Key } from 'lucide-react';
import SettingsNav from '@/components/settings/SettingsNav';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useClientDictionary } from '@/i18n/client';
import { formatLocalDateTime } from '@/lib/dateFormat';

type Session = {
  id: string;
  createdAt: string;
  lastUsedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: string;
  isCurrent: boolean;
};

type ApiToken = {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

const SCOPE_VALUES = ['read', 'write', 'pipeline:trigger'] as const;

function formatDate(value?: string | null) {
  if (!value) return '-';
  return formatLocalDateTime(value);
}

function ScopeChip({ scope }: { scope: string }) {
  return (
    <span className="inline-flex items-center rounded-[4px] bg-[hsl(var(--ds-surface-2))] px-1.5 py-0.5 text-[10px] font-mono font-medium text-foreground">
      {scope}
    </span>
  );
}

function PageSkeleton() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl px-6 py-6">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-28" />
            ))}
          </div>
          <div className="space-y-6">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-[8px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-background-2))] p-4 space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SecurityPage() {
  const dict = useClientDictionary();
  const i18n = dict.settings.securityPage;
  const scopeOptions = [
    { value: SCOPE_VALUES[0], label: i18n.scopeReadLabel, description: i18n.scopeReadDescription },
    { value: SCOPE_VALUES[1], label: i18n.scopeWriteLabel, description: i18n.scopeWriteDescription },
    { value: SCOPE_VALUES[2], label: i18n.scopeTriggerLabel, description: i18n.scopeTriggerDescription },
  ] as const;
  const router = useRouter();

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // API Tokens
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenScopes, setNewTokenScopes] = useState<string[]>(['read']);
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sessionToRevoke, setSessionToRevoke] = useState<Session | null>(null);
  const [tokenToRevoke, setTokenToRevoke] = useState<ApiToken | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/sessions');
      if (!res.ok) throw new Error(i18n.loadSessionsFailed);
      const data = await res.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : i18n.loadSessionsFailed);
    } finally {
      setSessionsLoading(false);
    }
  }, [i18n.loadSessionsFailed]);

  const loadTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/tokens');
      if (!res.ok) {
        if (res.status === 404) {
          setTokens([]);
          return;
        }
        throw new Error(i18n.loadTokensFailed);
      }
      const data = await res.json();
      setTokens(Array.isArray(data.tokens) ? data.tokens : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : i18n.loadTokensFailed);
    } finally {
      setTokensLoading(false);
    }
  }, [i18n.loadTokensFailed]);

  useEffect(() => {
    void loadSessions();
    void loadTokens();
  }, [loadSessions, loadTokens]);

  async function handleRevokeSession(session: Session) {
    setRevokingId(session.id);
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      if (!res.ok) throw new Error(i18n.revokeSessionFailed);
      toast.success(i18n.revokeSessionSuccess);
      if (session.isCurrent) {
        router.push('/login');
        router.refresh();
        return;
      }
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : i18n.revokeSessionFailed);
    } finally {
      setRevokingId(null);
      setSessionToRevoke(null);
    }
  }

  function toggleScope(scope: string) {
    setNewTokenScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  }

  async function handleCreateToken() {
    if (!newTokenName.trim()) {
      toast.error(i18n.tokenNameRequired);
      return;
    }
    if (newTokenScopes.length === 0) {
      toast.error(i18n.scopeRequired);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.trim(), scopes: newTokenScopes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? i18n.createTokenFailed);
      setCreatedToken(data.token);
      setNewTokenName('');
      setNewTokenScopes(['read']);
      await loadTokens();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : i18n.createTokenFailed);
    } finally {
      setCreating(false);
    }
  }

  async function handleCopyToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    toast.success(i18n.tokenCopied);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDeleteToken(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(i18n.revokeTokenFailed);
      toast.success(i18n.revokeTokenSuccess);
      setTokens(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : i18n.revokeTokenFailed);
    } finally {
      setDeletingId(null);
      setTokenToRevoke(null);
    }
  }

  if (sessionsLoading && tokensLoading) return <PageSkeleton />;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl px-6 py-6">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <SettingsNav />

          <div className="space-y-10">

            {/* ── Sessions ─────────────────────────────────────── */}
            <section className="space-y-4">
              <div>
                <h1 className="text-[15px] font-semibold">{i18n.title}</h1>
                <p className="text-[13px] text-[hsl(var(--ds-text-2))] mt-0.5">
                  {i18n.description}
                </p>
              </div>

              {sessions.length === 0 ? (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-[13px] text-[hsl(var(--ds-text-2))] text-center">{i18n.noSessions}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {sessions.map(session => (
                    <Card key={session.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-[13px] font-medium">{i18n.sessionLabel}</h3>
                              {session.isCurrent && <Badge size="sm" variant="accent">{i18n.currentBadge}</Badge>}
                            </div>
                            <p className="text-[12px] text-[hsl(var(--ds-text-2))]">
                              {i18n.ipLabel}: {session.ipAddress || i18n.unknown}
                              {' | '}
                              {i18n.lastUsedLabel}: {formatDate(session.lastUsedAt)}
                            </p>
                            <p className="text-[12px] text-[hsl(var(--ds-text-2))]">
                              {i18n.createdLabel}: {formatDate(session.createdAt)}
                              {' | '}
                              {i18n.expiresLabel}: {formatDate(session.expiresAt)}
                            </p>
                            {session.userAgent && (
                              <p className="text-[12px] text-[hsl(var(--ds-text-2))] break-words">{session.userAgent}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={revokingId === session.id}
                            onClick={() => setSessionToRevoke(session)}
                          >
                            {revokingId === session.id ? i18n.revoking : i18n.revokeAction}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* ── API Tokens ────────────────────────────────────── */}
            <section className="space-y-4">
              <div>
                <h2 className="text-[15px] font-semibold flex items-center gap-2">
                  <Key className="size-4" />
                  {i18n.apiTokensTitle}
                </h2>
                <p className="text-[13px] text-[hsl(var(--ds-text-2))] mt-0.5">
                  {i18n.apiTokensDescription}
                </p>
              </div>

              {/* Newly created token banner */}
              {createdToken && (
                <div className="rounded-[8px] border border-success/40 bg-success/5 p-4 space-y-2">
                  <p className="text-[13px] font-medium text-success">{i18n.tokenCreatedHint}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[12px] font-mono bg-[hsl(var(--ds-background-2))] border border-[hsl(var(--ds-border-1))] rounded-[6px] px-3 py-2 break-all">
                      {createdToken}
                    </code>
                    <Button size="sm" variant="outline" onClick={handleCopyToken} className="shrink-0 gap-1.5">
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? dict.common.copied : dict.common.copy}
                    </Button>
                  </div>
                  <Button size="sm" variant="ghost" className="text-[12px]" onClick={() => setCreatedToken(null)}>
                    {i18n.dismiss}
                  </Button>
                </div>
              )}

              {/* Create form */}
              <div className="rounded-[8px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-background-2))] p-4 space-y-4">
                <p className="text-[13px] font-medium">{i18n.createTokenTitle}</p>
                <div className="flex gap-2">
                  <Input
                    placeholder={i18n.tokenNamePlaceholder}
                    value={newTokenName}
                    onChange={e => setNewTokenName(e.target.value)}
                    className="h-8 text-[13px] max-w-xs"
                    onKeyDown={e => { if (e.key === 'Enter') void handleCreateToken(); }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-[12px] text-[hsl(var(--ds-text-2))] font-medium">{i18n.scopesTitle}</p>
                  <div className="flex flex-wrap gap-2">
                    {scopeOptions.map((opt) => {
                      const active = newTokenScopes.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          onClick={() => toggleScope(opt.value)}
                          className={[
                            'flex items-start gap-2 rounded-[6px] border px-3 py-2 text-left text-[12px] transition-colors duration-100',
                            active
                              ? 'border-foreground bg-[hsl(var(--ds-surface-2))] text-foreground'
                              : 'border-[hsl(var(--ds-border-1))] text-[hsl(var(--ds-text-2))] hover:border-[hsl(var(--ds-border-2))] hover:text-foreground',
                          ].join(' ')}
                          >
                          <div>
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-[11px] opacity-70">{opt.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateToken}
                  disabled={creating || !newTokenName.trim() || newTokenScopes.length === 0}
                  className="gap-1.5"
                >
                  <Plus className="size-3.5" />
                  {creating ? i18n.creating : i18n.createTokenAction}
                </Button>
              </div>

              {/* Token list */}
              {tokensLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-[8px] border border-[hsl(var(--ds-border-1))] p-4">
                      <Skeleton className="h-4 w-40 mb-2" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                  ))}
                </div>
              ) : tokens.length === 0 ? (
                <p className="text-[13px] text-[hsl(var(--ds-text-2))]">{i18n.noTokens}</p>
              ) : (
                <div className="space-y-2">
                  {tokens.map(token => (
                    <div
                      key={token.id}
                      className="flex items-center gap-3 rounded-[8px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-background-2))] px-4 py-3"
                    >
                      <Key className="size-4 text-[hsl(var(--ds-text-2))] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-foreground">{token.name}</span>
                          <code className="text-[11px] font-mono text-[hsl(var(--ds-text-2))]">{token.token_prefix}…</code>
                          {token.scopes.map(s => <ScopeChip key={s} scope={s} />)}
                        </div>
                        <p className="text-[12px] text-[hsl(var(--ds-text-2))] mt-0.5">
                          {i18n.createdPrefix} {formatDate(token.created_at)}
                          {token.last_used_at
                            ? ` · ${i18n.lastUsedPrefix} ${formatDate(token.last_used_at)}`
                            : ` · ${i18n.neverUsed}`}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-[hsl(var(--ds-text-2))] hover:text-danger shrink-0"
                        disabled={deletingId === token.id}
                        onClick={() => setTokenToRevoke(token)}
                        aria-label={i18n.revokeTokenAria}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        </div>
      </div>

      <ConfirmDialog
        open={sessionToRevoke !== null}
        onOpenChange={(open) => {
          if (!open && !revokingId) setSessionToRevoke(null);
        }}
        icon={<AlertTriangle className="size-4 text-warning" />}
        title={i18n.revokeSessionDialogTitle}
        description={i18n.revokeSessionDialogDescription}
        confirmLabel={revokingId ? i18n.revoking : i18n.revokeAction}
        cancelLabel={dict.common.cancel}
        onConfirm={() => {
          if (!sessionToRevoke || revokingId) return;
          void handleRevokeSession(sessionToRevoke);
        }}
        loading={revokingId !== null}
        danger
      />

      <ConfirmDialog
        open={tokenToRevoke !== null}
        onOpenChange={(open) => {
          if (!open && !deletingId) setTokenToRevoke(null);
        }}
        icon={<AlertTriangle className="size-4 text-warning" />}
        title={i18n.revokeTokenDialogTitle}
        description={i18n.revokeTokenDialogDescription}
        confirmLabel={deletingId ? i18n.revoking : i18n.revokeAction}
        cancelLabel={dict.common.cancel}
        onConfirm={() => {
          if (!tokenToRevoke || deletingId) return;
          void handleDeleteToken(tokenToRevoke.id);
        }}
        loading={deletingId !== null}
        danger
      />
    </div>
  );
}
