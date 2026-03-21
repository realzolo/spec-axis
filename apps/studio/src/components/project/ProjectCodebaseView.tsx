'use client';

import { useProject } from '@/lib/projectContext';
import { useProjectBranches } from '@/lib/useProjectBranches';
import CodebaseClient from '@/app/(dashboard)/projects/[id]/CodebaseClient';
import type { Dictionary } from '@/i18n';

export default function ProjectCodebaseView({ projectId, dict }: { projectId: string; dict: Dictionary }) {
  const { project } = useProject();
  const branches = useProjectBranches(projectId, project?.default_branch);

  if (!project) return null;

  return <CodebaseClient project={project} branches={branches} dict={dict} />;
}
