'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ElementType } from 'react';
import {
  BarChart3,
  Code2,
  FileText,
  FolderOpen,
  GitBranch,
  GitCommit,
  Home,
  Settings,
  Shield,
} from 'lucide-react';
import type { Dictionary } from '@/i18n';
import { stripOrgPrefix, withOrgPrefix } from '@/lib/orgPath';
import { cn } from '@/lib/utils';

type NavItem = {
  base: string;
  label: string;
  icon: ElementType;
};

export default function MobileBottomNav({ dict }: { dict: Dictionary }) {
  const pathname = usePathname();
  const basePath = stripOrgPrefix(pathname);
  const projectMatch = basePath.match(/^\/projects\/([^/]+)(\/|$)/);
  const currentProjectId = projectMatch?.[1] ?? null;

  const items: NavItem[] = currentProjectId
    ? [
      { base: `/projects/${currentProjectId}/commits`, label: dict.nav.project.commits, icon: GitCommit },
      { base: `/projects/${currentProjectId}/reports`, label: dict.nav.project.reports, icon: FileText },
      { base: `/projects/${currentProjectId}/pipelines`, label: dict.nav.project.pipelines, icon: GitBranch },
      { base: `/projects/${currentProjectId}/codebase`, label: dict.nav.project.codebase, icon: Code2 },
      { base: `/projects/${currentProjectId}/settings`, label: dict.nav.project.settings, icon: Settings },
    ]
    : [
      { base: '/', label: dict.nav.home, icon: Home },
      { base: '/projects', label: dict.nav.projects, icon: FolderOpen },
      { base: '/analytics', label: dict.nav.analytics, icon: BarChart3 },
      { base: '/rules', label: dict.nav.rules, icon: Shield },
      { base: '/settings', label: dict.nav.settings, icon: Settings },
    ];

  function isActive(base: string) {
    if (base === '/') return basePath === '/';
    return basePath === base || basePath.startsWith(`${base}/`);
  }

  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-background-2))/0.96] backdrop-blur">
      <div className="grid grid-cols-5 px-1.5 pt-1 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const active = isActive(item.base);
          const Icon = item.icon;
          return (
            <Link
              key={item.base}
              href={withOrgPrefix(pathname, item.base)}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center rounded-[8px] px-1 py-1.5 text-[11px] transition-colors duration-150',
                active
                  ? 'bg-[hsl(var(--ds-surface-2))] text-foreground'
                  : 'text-[hsl(var(--ds-text-2))] hover:bg-[hsl(var(--ds-surface-1))] hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
              title={item.label}
            >
              <Icon className="size-4 shrink-0" />
              <span className="mt-1 max-w-full truncate leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
