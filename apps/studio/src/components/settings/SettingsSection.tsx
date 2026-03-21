"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export default function SettingsSection({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: Props) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3 px-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-[14px] font-medium tracking-[-0.01em] text-foreground">{title}</h2>
            {description && (
              <p className="max-w-[680px] text-[13px] leading-5 text-[hsl(var(--ds-text-2))]">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-background-2))]">
        <div className={cn("space-y-3 px-5 py-5", contentClassName)}>{children}</div>
      </div>
    </section>
  );
}
