'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check, ChevronDown, Code2, FolderOpen, FileText, Shield, Settings, LogOut, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

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

export default function Sidebar({ locale, dict }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  const navItems = [
    { href: '/projects', label: dict.nav.projects, icon: FolderOpen, countKey: 'projects' as const },
    { href: '/reports',  label: dict.nav.reports,  icon: FileText,   countKey: 'reports' as const },
    { href: '/rules',    label: dict.nav.rules,    icon: Shield,     countKey: null },
    { href: '/settings', label: dict.nav.settings,  icon: Settings,   countKey: null },
  ];

  const activeHref = navItems.find(item => pathname.startsWith(item.href))?.href ?? '/projects';

  useEffect(() => {
    let alive = true;

    async function loadOrgs() {
      try {
        const [orgRes, activeRes] = await Promise.all([
          fetch('/api/orgs'),
          fetch('/api/orgs/active'),
        ]);
        const orgData = orgRes.ok ? await orgRes.json() : [];
        const activeData = activeRes.ok ? await activeRes.json() : null;

        if (!alive) return;
        setOrgs(Array.isArray(orgData) ? orgData : []);
        setActiveOrgId(activeData?.orgId ?? orgData?.[0]?.id ?? null);
      } catch {}
    }

    loadOrgs();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    Promise.all([
      fetch('/api/projects').then(r => r.json()).then((d: unknown[]) => ({ projects: Array.isArray(d) ? d.length : 0 })).catch(() => ({ projects: 0 })),
      fetch('/api/reports').then(r => r.json()).then((d: unknown[]) => ({ reports: Array.isArray(d) ? d.length : 0 })).catch(() => ({ reports: 0 })),
    ]).then(([p, r]) => setCounts({ ...p, ...r }));
  }, [activeOrgId]);

  const activeOrg = orgs.find((org) => org.id === activeOrgId) ?? orgs[0];

  async function setActiveOrg(orgId: string) {
    if (orgId === activeOrgId) return;
    try {
      const res = await fetch('/api/orgs/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      if (!res.ok) throw new Error('Failed to switch org');
      setActiveOrgId(orgId);
      router.refresh();
    } catch {}
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="w-[240px] h-screen flex flex-col shrink-0 border-r border-sidebar bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar shrink-0">
        <div className="w-8 h-8 rounded-md bg-foreground/10 flex items-center justify-center shrink-0">
          <Code2 className="text-foreground size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 text-left w-full">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold leading-none truncate">
                    {activeOrg?.name ?? dict.nav.workspaceDefault}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 truncate">
                    {activeOrg?.is_personal ? 'Personal' : activeOrg?.slug ?? dict.nav.planDefault}
                  </div>
                </div>
                <ChevronDown className="size-4 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
              {orgs.length === 0 && (
                <DropdownMenuItem disabled>No organizations</DropdownMenuItem>
              )}
              {orgs.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => setActiveOrg(org.id)}
                  className="gap-2"
                >
                  <span className="flex-1 truncate">{org.name}</span>
                  {org.id === activeOrg?.id && <Check className="size-3.5 text-muted-foreground" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings/organizations')}>
                Manage organizations
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder={dict.nav.searchPlaceholder}
            className="h-8 pl-8 bg-muted/40 border-border text-xs"
          />
        </div>
      </div>

      <nav className="flex-1 px-2 pb-3 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const active = activeHref === item.href;
          const count = item.countKey ? counts[item.countKey] : null;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-2.5 h-8 px-3 rounded-md text-[13px] w-full transition-colors',
                active
                  ? 'bg-secondary/70 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
              ].join(' ')}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {count != null && count > 0 && (
                <Badge variant={active ? 'secondary' : 'muted'} size="sm">{count}</Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar shrink-0 space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground">{dict.settings.language}</span>
          <LanguageSwitcher currentLocale={locale} />
        </div>
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground">{dict.settings.theme}</span>
          <ThemeToggle />
        </div>
        <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start gap-2 h-9 text-sm">
          <LogOut className="size-4" />
          {dict.nav.logout}
        </Button>
      </div>
    </div>
  );
}
