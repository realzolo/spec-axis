'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function SettingsEmptyState({
  title,
  description,
  icon,
  action,
  className,
}: Props) {
  return (
    <div className={cn('rounded-[10px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-background-2))] px-5 py-5', className)}>
      <div className="flex flex-col items-start gap-3">
        {icon && (
          <div className="flex size-9 items-center justify-center rounded-[8px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-surface-1))] text-[hsl(var(--ds-text-2))]">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <div className="text-[13px] font-medium text-foreground">{title}</div>
          {description && (
            <p className="text-[12px] leading-5 text-[hsl(var(--ds-text-2))]">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
