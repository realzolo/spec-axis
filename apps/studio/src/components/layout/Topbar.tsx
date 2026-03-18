'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Dictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { extractOrgFromPath, stripOrgPrefix, withOrgPrefix } from '@/lib/orgPath';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
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
      .catch(() => {
        if (!alive) return;
        setProjects([]);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/projects/${currentProjectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (alive && data) setCurrentProject(data); })
      .catch(() => {
        if (!alive) return;
        setCurrentProject(null);
      });
    return () => { alive = false; };
  }, [currentProjectId]);

  function navigateTo(projectId: string) {
    router.push(withOrgPrefix(pathname, `/projects/${projectId}/commits`));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-1 text-[13px] font-medium text-foreground hover:text-foreground/80 transition-colors duration-100 outline-none">
          <span>{currentProject?.name ?? dict.common.loading}</span>
          <ChevronDown className="size-3 text-[hsl(var(--ds-text-2))] mt-px" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel className="text-[11px] text-[hsl(var(--ds-text-2))] font-normal uppercase tracking-wider px-2 py-1.5">
          {dict.nav.project.switchProject}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projects.length === 0 ? (
          <DropdownMenuItem disabled className="text-[13px]">{dict.nav.project.noProjects}</DropdownMenuItem>
        ) : (
          projects.map(p => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => navigateTo(p.id)}
              className="gap-2 text-[13px]"
            >
              <span className="flex-1 truncate">{p.name}</span>
              {p.id === currentProjectId && (
                <Check className="size-3.5 text-[hsl(var(--ds-text-2))]" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Topbar({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const pathname = usePathname();
  const { orgId } = extractOrgFromPath(pathname);
  const basePath = stripOrgPrefix(pathname);

  const projectMatch = basePath.match(/^\/projects\/([^/]+)(\/|$)/);
  const currentProjectId = projectMatch?.[1] ?? null;

  // Determine current top-level section label
  let sectionLabel: string | null = null;
  let sectionHref: string | null = null;

  if (basePath.startsWith('/projects')) {
    sectionLabel = dict.nav.projects;
    sectionHref = orgId ? `/o/${orgId}/projects` : '/projects';
  } else if (basePath.startsWith('/analytics')) {
    sectionLabel = dict.nav.analytics;
    sectionHref = orgId ? `/o/${orgId}/analytics` : '/analytics';
  } else if (basePath.startsWith('/rules')) {
    sectionLabel = dict.nav.rules;
  } else if (basePath.startsWith('/settings')) {
    sectionLabel = dict.nav.settings;
  } else if (basePath === '/') {
    sectionLabel = dict.nav.home;
  }

  return (
    <header className="h-11 flex items-center px-4 border-b border-border bg-[hsl(var(--ds-background-2))] shrink-0 gap-3">
      <div className="flex min-w-0 items-center gap-1">
        {/* Section breadcrumb */}
        {sectionLabel && sectionHref ? (
          <Link
            href={sectionHref}
            className="text-[13px] text-[hsl(var(--ds-text-2))] hover:text-foreground transition-colors duration-100"
          >
            {sectionLabel}
          </Link>
        ) : sectionLabel ? (
          <span className={cn(
            'text-[13px]',
            currentProjectId ? 'text-[hsl(var(--ds-text-2))]' : 'text-foreground font-medium',
          )}>
            {sectionLabel}
          </span>
        ) : null}

        {/* Project switcher segment */}
        {currentProjectId && (
          <>
            <span className="text-[hsl(var(--ds-border-3))] text-sm select-none">/</span>
            <ProjectSwitcher
              currentProjectId={currentProjectId}
              pathname={pathname}
              dict={dict}
            />
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <LanguageSwitcher
          currentLocale={locale}
          compact
          className="border-[hsl(var(--ds-border-2))] bg-[hsl(var(--ds-background-2))] text-foreground hover:bg-[hsl(var(--ds-surface-1))]"
        />
        <ThemeToggle className="h-7 w-7 border-[hsl(var(--ds-border-2))] bg-[hsl(var(--ds-background-2))] text-foreground hover:bg-[hsl(var(--ds-surface-1))]" />
      </div>
    </header>
  );
}
