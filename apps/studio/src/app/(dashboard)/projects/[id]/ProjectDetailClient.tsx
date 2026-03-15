'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import EnhancedProjectDetail from './EnhancedProjectDetail';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Dictionary } from '@/i18n';
import { withOrgPrefix } from '@/lib/orgPath';

type Project = {
  id: string;
  name: string;
  repo: string;
  default_branch: string;
  org_id: string;
  ruleset_id?: string;
};

function ProjectDetailSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background shrink-0 px-4">
        <div className="flex items-center gap-3 h-11">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-5 h-16 border-b border-border bg-card shrink-0">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-7 w-28 rounded-md" />
          </div>
          <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-border bg-card/50 shrink-0">
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md" />
            <Skeleton className="h-3 w-24 ml-auto" />
          </div>
          <div className="flex-1 overflow-auto bg-muted/30 p-4">
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={`commit-skeleton-${index}`} className="rounded-xl border border-border bg-card px-4 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded-md" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-28" />
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

export default function ProjectDetailClient({
  projectId,
  dict,
}: {
  projectId: string;
  dict: Dictionary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [project, setProject] = useState<Project | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const projectRes = await fetch(`/api/projects/${projectId}`);
        if (!projectRes.ok) throw new Error('project_fetch_failed');
        const projectData = (await projectRes.json()) as Project;

        let branchList: string[] = [];
        const branchesRes = await fetch(`/api/projects/${projectId}/branches?sync=0`);
        if (branchesRes.ok) {
          const data = await branchesRes.json();
          if (Array.isArray(data)) branchList = data;
        }

        if (!branchList.length) branchList = [projectData.default_branch];

        if (!active) return;
        setProject(projectData);
        setBranches(branchList);
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
  }, [projectId]);

  if (loading) {
    return <ProjectDetailSkeleton />;
  }

  if (!project || loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="text-sm text-muted-foreground">{dict.common.error}</div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(withOrgPrefix(pathname, '/projects'))}
        >
          {dict.common.back}
        </Button>
      </div>
    );
  }

  return <EnhancedProjectDetail project={project} branches={branches} dict={dict} />;
}
