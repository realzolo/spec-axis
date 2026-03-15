'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plug, Users } from 'lucide-react';

const items = [
  { href: '/settings/organizations', label: 'Organizations', icon: Users },
  { href: '/settings/integrations', label: 'Integrations', icon: Plug },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 pb-2">
        Settings
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              ].join(' ')}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
