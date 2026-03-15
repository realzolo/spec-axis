'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { FolderOpen } from 'lucide-react';
import ProjectCard from '@/components/project/ProjectCard';
import AddProjectModal from '@/components/project/AddProjectModal';
import DashboardStats from '@/components/dashboard/DashboardStats';
import { t } from '@/lib/i18n-utils';
import type { Dictionary } from '@/i18n';
import { useOrgRole } from '@/lib/useOrgRole';

type Project = {
  id: string; name: string; repo: string;
  description?: string; default_branch: string; ruleset_id?: string;
};

export default function ProjectsClient({ initialProjects, dict }: { initialProjects?: Project[]; dict: Dictionary }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects ?? []);
  const [loading, setLoading] = useState(!initialProjects);
  const [loadError, setLoadError] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const searchParams = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const view = searchParams.get('view') === 'list' ? 'list' : 'grid';
  const { isAdmin } = useOrgRole();

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(p => p.name.toLowerCase().includes(q) || p.repo.toLowerCase().includes(q));
  }, [projects, search]);

  async function refresh() {
    const res = await fetch('/api/projects');
    setProjects(await res.json());
  }

  async function handleDelete(id: string) {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    toast.success(dict.projects.projectDeleted);
    setProjects(prev => prev.filter(p => p.id !== id));
  }

  function handleUpdate(updated: Project) {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  }

  useEffect(() => {
    function handleOpen() {
      if (!isAdmin) return;
      setShowAdd(true);
    }
    window.addEventListener('open-add-project', handleOpen);
    return () => window.removeEventListener('open-add-project', handleOpen);
  }, [isAdmin]);

  useEffect(() => {
    if (initialProjects) return;
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('projects_fetch_failed');
        const data = await res.json();
        if (!active) return;
        setProjects(Array.isArray(data) ? data : []);
      } catch {
        if (!active) return;
        setLoadError(true);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [initialProjects]);

  if (loading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto w-full px-6 py-6">
          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-4 shadow-elevation-1 space-y-3">
                <Skeleton className="h-3 w-24" />
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={`stats-skeleton-${idx}`} className="space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-elevation-1 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`project-skeleton-${index}`} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError && projects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="text-sm text-muted-foreground">{dict.common.error}</div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          {dict.common.refresh}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[1200px] mx-auto w-full px-6 py-6">
          {projects.length === 0 ? (
            <div className="flex flex-col items-start justify-center gap-3 py-20">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-medium">{dict.projects.noProjectsEmpty}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{dict.projects.noProjectsEmptyDescription}</p>
              </div>
              {isAdmin && (
                <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1.5 mt-1">
                  <Plus className="h-4 w-4" />
                  {dict.projects.addProject}
                </Button>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20">
              <p className="text-sm text-muted-foreground">{dict.projects.noMatchingProjects.replace('{{search}}', search)}</p>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
              <div className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-4 shadow-elevation-1">
                  <div className="text-[12px] text-muted-foreground uppercase tracking-wide mb-2">{dict.projects.usage}</div>
                  <DashboardStats dict={dict} />
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-elevation-1">
                  <div className="text-[12px] text-muted-foreground uppercase tracking-wide mb-2">{dict.projects.alerts}</div>
                  <div className="text-sm text-muted-foreground">
                    {dict.projects.alertsDescription}
                  </div>
                  <Button variant="outline" className="mt-3 h-8 text-sm">
                    {dict.projects.upgradePlan}
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium">{dict.projects.title}</div>
                  <div className="text-sm text-muted-foreground">{t(dict.projects.projectsCount, { count: filtered.length })}</div>
                </div>
                {view === 'grid' ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filtered.map(p => (
                      <ProjectCard key={p.id} project={p} onDelete={handleDelete} onUpdate={handleUpdate} dict={dict} view="grid" canManage={isAdmin} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card divide-y divide-border">
                    {filtered.map(p => (
                      <ProjectCard key={p.id} project={p} onDelete={handleDelete} onUpdate={handleUpdate} dict={dict} view="list" canManage={isAdmin} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
      </div>

      {isAdmin && (
        <AddProjectModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); refresh(); }}
          dict={dict}
        />
      )}
    </div>
  );
}
