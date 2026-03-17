'use client';

import { useProject } from '@/lib/projectContext';
import ProjectConfigPanel from '@/components/project/ProjectConfigPanel';
import type { Dictionary } from '@/i18n';

export default function ProjectSettingsView({
  projectId,
  dict,
}: {
  projectId: string;
  dict: Dictionary;
}) {
  const { project } = useProject();

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border bg-background shrink-0">
        <div className="text-heading-md text-foreground">{dict.projects.projectConfig}</div>
        {project && (
          <div className="text-copy-sm text-muted-foreground">{project.name}</div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-8">
        <ProjectConfigPanel projectId={projectId} dict={dict} />
      </div>
    </div>
  );
}
