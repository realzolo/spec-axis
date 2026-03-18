'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AddVCSIntegrationModal from '@/components/settings/AddVCSIntegrationModal';
import AddAIIntegrationModal from '@/components/settings/AddAIIntegrationModal';
import EditVCSIntegrationModal from '@/components/settings/EditVCSIntegrationModal';
import EditAIIntegrationModal from '@/components/settings/EditAIIntegrationModal';
import SettingsNav from '@/components/settings/SettingsNav';
import { useOrgRole } from '@/lib/useOrgRole';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useClientDictionary } from '@/i18n/client';

interface Integration {
  id: string;
  type: 'vcs' | 'ai';
  provider: string;
  name: string;
  is_default: boolean;
  config: { baseUrl?: string; model?: string } & Record<string, unknown>;
  created_at: string;
}

function IntegrationsSkeleton() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl px-6 py-6">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={`settings-nav-skeleton-${index}`} className="h-4 w-28" />
            ))}
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-8 w-28 rounded-[6px]" />
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={`vcs-card-skeleton-${index}`} className="rounded-[8px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-background-2))] p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-12 rounded-[4px]" />
                      </div>
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-56" />
                      <div className="flex gap-2">
                        <Skeleton className="h-7 w-16 rounded-[6px]" />
                        <Skeleton className="h-7 w-7 rounded-[6px]" />
                        <Skeleton className="h-7 w-20 rounded-[6px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-52" />
                  </div>
                  <Skeleton className="h-8 w-28 rounded-[6px]" />
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={`ai-card-skeleton-${index}`} className="rounded-[8px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-background-2))] p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-12 rounded-[4px]" />
                      </div>
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-3 w-44" />
                      <div className="flex gap-2">
                        <Skeleton className="h-7 w-16 rounded-[6px]" />
                        <Skeleton className="h-7 w-7 rounded-[6px]" />
                        <Skeleton className="h-7 w-20 rounded-[6px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [vcsIntegrations, setVcsIntegrations] = useState<Integration[]>([]);
  const [aiIntegrations, setAiIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVCSModal, setShowVCSModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [editingVCS, setEditingVCS] = useState<Integration | null>(null);
  const [editingAI, setEditingAI] = useState<Integration | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingIntegration, setDeletingIntegration] = useState<Integration | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { isAdmin } = useOrgRole();
  const dict = useClientDictionary();
  const i18n = dict.settings.integrationsPage;

  const loadIntegrations = useCallback(async () => {
    try {
      const [vcsRes, aiRes] = await Promise.all([
        fetch('/api/integrations?type=vcs'),
        fetch('/api/integrations?type=ai'),
      ]);

      if (vcsRes.ok) {
        setVcsIntegrations(await vcsRes.json());
      }
      if (aiRes.ok) {
        setAiIntegrations(await aiRes.json());
      }
    } catch {
      toast.error(i18n.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [i18n.loadFailed]);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  async function handleDelete(integration: Integration) {
    const type = integration.type;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || i18n.deleteFailed);
      }

      toast.success(i18n.deleteSuccess);
      if (type === 'vcs') {
        setVcsIntegrations((prev) => prev.filter((item) => item.id !== integration.id));
      } else {
        setAiIntegrations((prev) => prev.filter((item) => item.id !== integration.id));
      }
      setDeletingIntegration(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : i18n.deleteFailed);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const res = await fetch(`/api/integrations/${id}/set-default`, { method: 'POST' });
      if (!res.ok) throw new Error(i18n.defaultFailed);

      toast.success(i18n.defaultUpdated);
      await loadIntegrations();
    } catch {
      toast.error(i18n.defaultFailed);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/integrations/${id}/test`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        toast.success(i18n.testSuccess);
      } else {
        toast.error(data.error || i18n.testFailed);
      }
    } catch {
      toast.error(i18n.testFailed);
    } finally {
      setTestingId(null);
    }
  }

  function renderIntegrationCard(integration: Integration, type: 'vcs' | 'ai') {
    return (
      <Card key={integration.id}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-[13px] font-medium">{integration.name}</h3>
                {integration.is_default && (
                  <Badge size="sm" variant="accent">
                    {i18n.defaultBadge}
                  </Badge>
                )}
              </div>
              <p className="text-[12px] text-[hsl(var(--ds-text-2))] mb-2">
                {i18n.providerLabel}: {integration.provider}
              </p>
              {integration.config.baseUrl && (
                <p className="text-[12px] text-[hsl(var(--ds-text-2))]">
                  {i18n.urlLabel}: {integration.config.baseUrl}
                </p>
              )}
              {integration.config.model && (
                <p className="text-[12px] text-[hsl(var(--ds-text-2))]">
                  {i18n.modelLabel}: {integration.config.model}
                </p>
              )}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleTest(integration.id)}
                  disabled={testingId === integration.id}
                >
                  {testingId === integration.id ? i18n.testing : i18n.test}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (type === 'vcs') {
                      setEditingVCS(integration);
                    } else {
                      setEditingAI(integration);
                    }
                  }}
                  aria-label={dict.common.edit}
                >
                  <Edit className="size-4" />
                </Button>

                {!integration.is_default && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSetDefault(integration.id)}
                  >
                    {i18n.setDefault}
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeletingIntegration(integration)}
                  aria-label={dict.common.delete}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <IntegrationsSkeleton />;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl px-6 py-6">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <SettingsNav />

          <div className="space-y-6">
            <div>
              <h1 className="text-[15px] font-semibold">{i18n.title}</h1>
              <p className="text-[13px] text-[hsl(var(--ds-text-2))] mt-0.5">
                {i18n.description}
              </p>
            </div>

            <div className="space-y-8">
              {/* VCS Integrations */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[13px] font-semibold">{i18n.repositoriesTitle}</h2>
                    <p className="text-[13px] text-[hsl(var(--ds-text-2))]">
                      {i18n.repositoriesDescription}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button size="sm" onClick={() => setShowVCSModal(true)} className="gap-1.5">
                      <Plus className="size-4" />
                      {i18n.addRepository}
                    </Button>
                  )}
                </div>

                {vcsIntegrations.length === 0 ? (
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-[13px] text-[hsl(var(--ds-text-2))] text-center">
                        {i18n.noRepositories}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {vcsIntegrations.map((integration) =>
                      renderIntegrationCard(integration, 'vcs')
                    )}
                  </div>
                )}
              </div>

              {/* AI Integrations */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[13px] font-semibold">{i18n.aiModelsTitle}</h2>
                    <p className="text-[13px] text-[hsl(var(--ds-text-2))]">
                      {i18n.aiModelsDescription}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button size="sm" onClick={() => setShowAIModal(true)} className="gap-1.5">
                      <Plus className="size-4" />
                      {i18n.addAiModel}
                    </Button>
                  )}
                </div>

                {aiIntegrations.length === 0 ? (
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-[13px] text-[hsl(var(--ds-text-2))] text-center">
                        {i18n.noAiModels}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {aiIntegrations.map((integration) => renderIntegrationCard(integration, 'ai'))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isAdmin && showVCSModal && (
        <AddVCSIntegrationModal
          onClose={() => setShowVCSModal(false)}
          onSuccess={() => {
            setShowVCSModal(false);
            loadIntegrations();
          }}
        />
      )}

      {isAdmin && showAIModal && (
        <AddAIIntegrationModal
          onClose={() => setShowAIModal(false)}
          onSuccess={() => {
            setShowAIModal(false);
            loadIntegrations();
          }}
        />
      )}

      {isAdmin && editingVCS && (
        <EditVCSIntegrationModal
          integration={editingVCS}
          onClose={() => setEditingVCS(null)}
          onSuccess={() => {
            setEditingVCS(null);
            loadIntegrations();
          }}
        />
      )}

      {isAdmin && editingAI && (
        <EditAIIntegrationModal
          integration={editingAI}
          onClose={() => setEditingAI(null)}
          onSuccess={() => {
            setEditingAI(null);
            loadIntegrations();
          }}
        />
      )}

      <ConfirmDialog
        open={deletingIntegration !== null}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeletingIntegration(null);
        }}
        icon={<AlertTriangle className="size-4 text-warning" />}
        title={i18n.deleteDialogTitle}
        description={i18n.deleteDialogDescription.replace('{{name}}', deletingIntegration?.name ?? '')}
        confirmLabel={deleteLoading ? i18n.deleting : i18n.deleteAction}
        cancelLabel={dict.common.cancel}
        onConfirm={() => {
          if (!deletingIntegration || deleteLoading) return;
          void handleDelete(deletingIntegration);
        }}
        loading={deleteLoading}
        danger
      />
    </div>
  );
}
