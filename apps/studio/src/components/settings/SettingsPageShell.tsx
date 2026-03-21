"use client";

import type { ReactNode } from "react";

import SettingsNav from "@/components/settings/SettingsNav";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function SettingsPageShell({
  title,
  description,
  actions,
  children,
  className,
}: Props) {
  return (
    <div className={cn("h-full min-h-0 overflow-y-auto", className)}>
      <div className="mx-auto w-full max-w-[1180px] px-6 py-6">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[720px] space-y-1.5">
              <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-foreground">{title}</h1>
              <p className="text-[14px] leading-6 text-[hsl(var(--ds-text-2))]">{description}</p>
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>

          <div className="grid items-start gap-12 lg:grid-cols-[180px_minmax(0,760px)] xl:grid-cols-[190px_minmax(0,800px)]">
            <aside className="hidden lg:block">
              <div className="sticky top-6">
                <SettingsNav />
              </div>
            </aside>

            <div className="min-w-0 space-y-6">
              <div className="lg:hidden">
                <SettingsNav />
              </div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
