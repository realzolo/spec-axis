'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Dictionary } from '@/i18n';

export type ProjectData = {
  id: string;
  name: string;
  repo: string;
  default_branch: string;
  org_id: string;
  ruleset_id?: string;
};

type ProjectContextValue = {
  project: ProjectData;
  dict: Dictionary;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectDataProvider({
  project,
  dict,
  children,
}: {
  project: ProjectData;
  dict: Dictionary;
  children: ReactNode;
}) {
  return (
    <ProjectContext.Provider value={{ project, dict }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside ProjectDataProvider');
  return ctx;
}
