'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Dictionary } from '@/i18n';
import { extractOrgFromPath, stripOrgPrefix, withOrgPrefix } from '@/lib/orgPath';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
}

interface BreadcrumbSegment {
  label: string;
  href?: string;
  isProjectSwitcher?: boolean;
}

function usePageInfo(basePath: string, dict: Dictionary): BreadcrumbSegment[] {
  const projectMatch = basePath.match(/^\/projects\/([^/]+)(\/(.+))?$/);

  if (projectMatch) {
    const tab = projectMatch[3] ?? 'commits';
    const tabLabels: Record<string, string> = {
      commits: dict.nav.project.commits,
      reports: dict.nav.project.reports,
      pipelines: dict.nav.project.pipelines,
      codebase: dict.nav.project.codebase,
      settings: dict.nav.project.settings,
    };
    // Segments: Projects > [Project switcher] > Tab
    return [
      { label: dict.nav.projects, href: 'projects' },
      { label: '', isProjectSwitcher: true },
      { label: tabLabels[tab.split('/')[0]] ?? tab },
    ];
  }

  if (basePath.startsWith('/rules')) {
    return [{ label: dict.nav.rules }];
  }

  if (basePath.startsWith('/settings')) {
    return [{ label: dict.nav.settings }];
  }

  if (basePath === '/') {
    return [{ label: dict.nav.home }];
  }

  return [];
}

function ProjectSwitcher({
  currentProjectId,
  pathname,
  dict,
}: {
  currentProjectId: string;
  pathname: string;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (alive) setProjects(Array.isArray(data) ? data : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/projects/${currentProjectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (alive && data) setCurrentProject(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [currentProjectId]);

  function navigateTo(projectId: string) {
    router.push(withOrgPrefix(pathname, `/projects/${projectId}/commits`));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors outline-none group">
          <span>{currentProject?.name ?? '...'}</span>
          <ChevronDown className="size-3.5 text-muted-foreground group-hover:text-foreground/70 transition-colors" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {dict.nav.project.switchProject}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projects.length === 0 ? (
          <DropdownMenuItem disabled>{dict.nav.project.noProjects}</DropdownMenuItem>
        ) : (
          projects.map(p => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => navigateTo(p.id)}
              className="gap-2"
            >
              <span className="flex-1 truncate">{p.name}</span>
              {p.id === currentProjectId && (
                <Check className="size-3.5 text-muted-foreground" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Topbar({ dict }: { dict: Dictionary }) {
  const pathname = usePathname();
  const { orgId } = extractOrgFromPath(pathname);
  const basePath = stripOrgPrefix(pathname);

  const projectMatch = basePath.match(/^\/projects\/([^/]+)(\/|$)/);
  const currentProjectId = projectMatch?.[1] ?? null;

  const segments = usePageInfo(basePath, dict);

  if (segments.length === 0) return null;

  return (
    <header className="h-12 flex items-center gap-1.5 px-4 border-b border-border bg-background shrink-0">
      {/* Org name — static, no link (org switching is in sidebar) */}
      {/* Breadcrumb */}
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const sep = i > 0 && (
          <span key={`sep-${i}`} className="text-muted-foreground/40 text-sm select-none mx-0.5">
            /
          </span>
        );

        if (seg.isProjectSwitcher && currentProjectId) {
          return (
            <span key="project-switcher" className="flex items-center gap-1.5">
              {sep}
              <ProjectSwitcher
                currentProjectId={currentProjectId}
                pathname={pathname}
                dict={dict}
              />
            </span>
          );
        }

        if (seg.href && !isLast) {
          return (
            <span key={seg.href} className="flex items-center gap-1.5">
              {sep}
              <a
                href={orgId ? `/o/${orgId}/${seg.href}` : `/${seg.href}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {seg.label}
              </a>
            </span>
          );
        }

        return (
          <span key={`${seg.label}-${i}`} className="flex items-center gap-1.5">
            {sep}
            <span
              className={cn(
                'text-sm',
                isLast ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {seg.label}
            </span>
          </span>
        );
      })}
    </header>
  );
}
