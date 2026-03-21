'use client';

import { useProject } from '@/lib/projectContext';
import { useProjectBranches } from '@/lib/useProjectBranches';
import CommitsClient from '@/app/(dashboard)/projects/[id]/CommitsClient';
import type { Dictionary } from '@/i18n';

export default function ProjectCommitsView({ projectId, dict }: { projectId: string; dict: Dictionary }) {
  const { project } = useProject();
  const branches = useProjectBranches(projectId, project?.default_branch);

  if (!project) return null;

  return <CommitsClient project={project} branches={branches} dict={dict} />;
}
