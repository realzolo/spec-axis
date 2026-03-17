'use client';

import { useState, useEffect } from 'react';
import { useProject } from '@/lib/projectContext';
import CodebaseClient from '@/app/(dashboard)/projects/[id]/CodebaseClient';
import type { Dictionary } from '@/i18n';

export default function ProjectCodebaseView({ projectId, dict }: { projectId: string; dict: Dictionary }) {
  const { project } = useProject();
  const [branches, setBranches] = useState<string[]>([]);

  useEffect(() => {
    if (!project) return;
    fetch(`/api/projects/${projectId}/branches?sync=0`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setBranches(Array.isArray(data) && data.length ? data : [project.default_branch]))
      .catch(() => setBranches([project.default_branch]));
  }, [projectId, project]);

  if (!project) return null;

  return <CodebaseClient project={project} branches={branches} dict={dict} />;
}
