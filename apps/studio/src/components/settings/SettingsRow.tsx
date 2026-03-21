'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  left: ReactNode;
  right?: ReactNode;
  align?: 'center' | 'start';
  className?: string;
};

export default function SettingsRow({ left, right, align = 'center', className }: Props) {
  return (
    <div
      data-settings-row
      className={cn(
        'grid gap-3 px-0 py-4 md:grid-cols-[minmax(0,1fr)_auto]',
        align === 'start' ? 'items-start' : 'items-start md:items-center',
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">{left}</div>
      {right && <div className="shrink-0 md:justify-self-end">{right}</div>}
    </div>
  );
}
