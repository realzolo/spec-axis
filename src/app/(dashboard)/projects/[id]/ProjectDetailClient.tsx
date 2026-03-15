'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import EnhancedProjectDetail from './EnhancedProjectDetail';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/page-loading';
import type { Dictionary } from '@/i18n';
import { withOrgPrefix } from '@/lib/orgPath';

type Project = {
  id: string;
  name: string;
  repo: string;
  default_branch: string;
  ruleset_id?: string;
};

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
        const branchesRes = await fetch(`/api/projects/${projectId}/branches`);
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
    return <PageLoading label={dict.common.loading} />;
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
