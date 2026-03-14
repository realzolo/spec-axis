'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Code2, FolderOpen, FileText, Shield, Settings, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/projects', label: '项目', icon: FolderOpen, countKey: 'projects' as const },
  { href: '/reports',  label: '报告',  icon: FileText,   countKey: 'reports' as const },
  { href: '/rules',    label: '规则集', icon: Shield,     countKey: null },
  { href: '/settings', label: '设置',  icon: Settings,   countKey: null },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const activeHref = navItems.find(item => pathname.startsWith(item.href))?.href ?? '/projects';

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()).then((d: unknown[]) => ({ projects: Array.isArray(d) ? d.length : 0 })).catch(() => ({ projects: 0 })),
      fetch('/api/reports').then(r => r.json()).then((d: unknown[]) => ({ reports: Array.isArray(d) ? d.length : 0 })).catch(() => ({ reports: 0 })),
    ]).then(([p, r]) => setCounts({ ...p, ...r }));
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="w-64 h-screen flex flex-col shrink-0 border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shrink-0 shadow-md">
          <Code2 className="text-white size-4" />
        </div>
        <span className="font-bold text-lg tracking-tight">代码审查</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map(item => {
          const active = activeHref === item.href;
          const count = item.countKey ? counts[item.countKey] : null;
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm w-full text-left transition-all duration-200 cursor-pointer font-medium',
                active
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {count != null && count > 0 && (
                <span className={cn(
                  'text-xs font-semibold px-2 py-1 rounded-full',
                  active ? 'bg-white/20' : 'bg-muted text-muted-foreground'
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm w-full text-foreground hover:bg-muted transition-all duration-200 cursor-pointer font-medium"
        >
          <LogOut className="size-5" />
          退出登录
        </button>
      </div>
    </div>
  );
}
