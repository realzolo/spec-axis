'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  Home,
  FolderOpen,
  Shield,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  GitCommit,
  FileText,
  GitBranch,
  Code2,
  Sliders,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';
import {
  extractOrgFromPath,
  replaceOrgInPath,
  stripOrgPrefix,
  withOrgPrefix,
} from '@/lib/orgPath';
import { cn } from '@/lib/utils';

interface SidebarProps {
  locale: Locale;
  dict: Dictionary;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
}

interface Project {
  id: string;
  name: string;
}

const COLLAPSED_WIDTH = 52;
const MIN_WIDTH = 200;
const MAX_WIDTH = 280;

function NavItem({
  href,
  active,
  icon: Icon,
  label,
  compact,
}: {
  href: string;
  active: boolean;
  icon: React.ElementType;
  label: string;
  compact: boolean;
}) {
  return (
    <Link
      href={href}
      title={compact ? label : undefined}
      className={cn(
        'group flex items-center gap-2 h-8 px-2 rounded-md text-sm w-full transition-colors',
        compact ? 'justify-center' : '',
        active
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="size-4 shrink-0" />
      {!compact && <span className="truncate">{label}</span>}
    </Link>
  );
}

function SectionLabel({ label, compact }: { label: string; compact: boolean }) {
  if (compact) return <div className="h-px bg-border mx-2 my-1" />;
  return (
    <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
      {label}
    </div>
  );
}

export default function Sidebar({ locale, dict }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [dragging, setDragging] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const { orgId: pathOrgId } = extractOrgFromPath(pathname);
  const basePath = stripOrgPrefix(pathname);

  // Extract project id from /projects/:id/... paths
  const projectMatch = basePath.match(/^\/projects\/([^/]+)(\/|$)/);
  const currentProjectId = projectMatch?.[1] ?? null;

  useEffect(() => {
    let alive = true;
    Promise.all([fetch('/api/orgs'), fetch('/api/orgs/active')])
      .then(([orgRes, activeRes]) =>
        Promise.all([
          orgRes.ok ? orgRes.json() : [],
          activeRes.ok ? activeRes.json() : null,
        ]),
      )
      .then(([orgData, activeData]) => {
        if (!alive) return;
        const list = Array.isArray(orgData) ? orgData : [];
        setOrgs(list);
        setActiveOrgId(activeData?.orgId ?? list[0]?.id ?? null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Sync org cookie when URL org changes
  useEffect(() => {
    if (!activeOrgId || !pathOrgId || pathOrgId === activeOrgId) return;
    router.replace(replaceOrgInPath(pathname, activeOrgId));
  }, [activeOrgId, pathOrgId, pathname, router]);

  // Fetch current project name when inside a project
  useEffect(() => {
    if (!currentProjectId) {
      setCurrentProject(null);
      return;
    }
    let alive = true;
    fetch(`/api/projects/${currentProjectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (alive && data) setCurrentProject({ id: data.id, name: data.name });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [currentProjectId]);

  // Persist sidebar state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = Number(localStorage.getItem('sidebar-width'));
    const c = localStorage.getItem('sidebar-collapsed');
    if (!Number.isNaN(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) setSidebarWidth(w);
    if (c != null) setCollapsed(c === 'true');
    else if (window.innerWidth < 1024) setCollapsed(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('sidebar-width', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  // Drag to resize
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX)));
    const onUp = () => setDragging(false);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const activeOrg = orgs.find(o => o.id === activeOrgId) ?? orgs[0];
  const orgLabel = activeOrg?.name ?? dict.nav.workspaceDefault;
  const orgInitial = orgLabel.slice(0, 1).toUpperCase();
  const compact = collapsed;
  const width = collapsed ? COLLAPSED_WIDTH : sidebarWidth;

  async function switchOrg(orgId: string) {
    if (orgId === activeOrgId) return;
    try {
      await fetch('/api/orgs/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      setActiveOrgId(orgId);
      router.push(replaceOrgInPath(pathname, orgId));
      router.refresh();
    } catch {}
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function orgHref(path: string) {
    return withOrgPrefix(pathname, path);
  }

  // Active state helpers
  const isActive = (base: string) => {
    if (base === '/') return basePath === '/';
    // When inside a project, don't mark /projects as active for the top nav
    if (base === '/projects' && currentProjectId) return false;
    return basePath === base || basePath.startsWith(`${base}/`);
  };

  const isProjectTabActive = (tab: string) =>
    currentProjectId !== null && basePath === `/projects/${currentProjectId}/${tab}`;

  // Org nav items (no Pipelines at org level — all pipelines belong to projects)
  const orgNav = [
    { base: '/', label: dict.nav.home, icon: Home },
    { base: '/projects', label: dict.nav.projects, icon: FolderOpen },
    { base: '/rules', label: dict.nav.rules, icon: Shield },
    { base: '/settings', label: dict.nav.settings, icon: Settings },
  ];

  // Project sub-nav items
  const projectNav = currentProjectId
    ? [
        { tab: 'commits', label: dict.nav.project.commits, icon: GitCommit },
        { tab: 'reports', label: dict.nav.project.reports, icon: FileText },
        { tab: 'pipelines', label: dict.nav.project.pipelines, icon: GitBranch },
        { tab: 'codebase', label: dict.nav.project.codebase, icon: Code2 },
        { tab: 'settings', label: dict.nav.project.settings, icon: Sliders },
      ]
    : [];

  const orgSwitcherTrigger = compact ? (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
      <span className="flex h-5 w-5 items-center justify-center rounded bg-foreground/10 text-[11px] font-semibold">
        {orgInitial}
      </span>
    </Button>
  ) : (
    <button className="flex items-center gap-2 w-full min-w-0 text-left hover:opacity-80 transition-opacity outline-none">
      <span className="flex h-6 w-6 items-center justify-center rounded bg-foreground/10 text-[11px] font-bold shrink-0">
        {orgInitial}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium leading-none truncate">{orgLabel}</span>
      </span>
      <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
    </button>
  );

  return (
    <div
      className="relative h-screen flex flex-col shrink-0 border-r border-border bg-sidebar text-sidebar-foreground"
      style={{ width, transition: dragging ? 'none' : 'width 150ms ease' }}
    >
      {/* Org header */}
      <div className="flex items-center gap-1.5 px-2.5 h-12 border-b border-border shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex-1 min-w-0">{orgSwitcherTrigger}</div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Organizations
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {orgs.map(org => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => switchOrg(org.id)}
                className="gap-2"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-foreground/10 text-[11px] font-bold shrink-0">
                  {org.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1 truncate text-sm">{org.name}</span>
                {org.id === activeOrg?.id && <Check className="size-3.5 text-muted-foreground" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(orgHref('/settings/organizations'))}>
              Manage organizations
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={() => setCollapsed(p => !p)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {/* Org-level nav */}
        {orgNav.map(item => (
          <NavItem
            key={item.base}
            href={orgHref(item.base)}
            active={isActive(item.base)}
            icon={item.icon}
            label={item.label}
            compact={compact}
          />
        ))}

        {/* Project context section */}
        {currentProjectId && (
          <>
            <div className="pt-3 pb-1">
              <SectionLabel label={compact ? '' : 'Project'} compact={compact} />
            </div>

            {/* Project switcher */}
            {!compact && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 w-full h-8 px-2 rounded-md text-sm text-foreground hover:bg-accent/50 transition-colors outline-none">
                    <span className="flex-1 text-left truncate font-medium">
                      {currentProject?.name ?? '...'}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    {dict.nav.project.switchProject}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <ProjectSwitcherItems
                    currentProjectId={currentProjectId}
                    orgHref={orgHref}
                    noProjectsLabel={dict.nav.project.noProjects}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Project sub-nav */}
            {projectNav.map(item => (
              <NavItem
                key={item.tab}
                href={orgHref(`/projects/${currentProjectId}/${item.tab}`)}
                active={isProjectTabActive(item.tab)}
                icon={item.icon}
                label={item.label}
                compact={compact}
              />
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-3 pt-2 border-t border-border shrink-0 space-y-1">
        <div className={cn('flex items-center', compact ? 'justify-center' : 'justify-between px-1')}>
          {!compact && <span className="text-xs text-muted-foreground">{dict.settings.language}</span>}
          <LanguageSwitcher currentLocale={locale} compact={compact} />
        </div>
        <div className={cn('flex items-center', compact ? 'justify-center' : 'justify-between px-1')}>
          {!compact && <span className="text-xs text-muted-foreground">{dict.settings.theme}</span>}
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn('w-full gap-2 h-8 text-sm', compact ? 'justify-center px-0' : 'justify-start')}
        >
          <LogOut className="size-4" />
          {!compact && dict.nav.logout}
        </Button>
      </div>

      {/* Resize handle */}
      {!collapsed && (
        <div
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-border/60 transition-colors"
          onMouseDown={e => { e.preventDefault(); setDragging(true); }}
        />
      )}
    </div>
  );
}

function ProjectSwitcherItems({
  currentProjectId,
  orgHref,
  noProjectsLabel,
}: {
  currentProjectId: string;
  orgHref: (path: string) => string;
  noProjectsLabel: string;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then(data => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const others = projects.filter(p => p.id !== currentProjectId);

  if (others.length === 0) {
    return <DropdownMenuItem disabled>{noProjectsLabel}</DropdownMenuItem>;
  }

  return (
    <>
      {others.map(p => (
        <DropdownMenuItem
          key={p.id}
          onClick={() => router.push(orgHref(`/projects/${p.id}/commits`))}
        >
          {p.name}
        </DropdownMenuItem>
      ))}
    </>
  );
}
