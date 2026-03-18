'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { locales, localeNames, type Locale } from '@/i18n/config';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  currentLocale: Locale;
  compact?: boolean;
  className?: string;
}

export function LanguageSwitcher({ currentLocale, compact = false, className }: LanguageSwitcherProps) {
  const router = useRouter();

  const handleLocaleChange = async (key: string) => {
    const newLocale = key as Locale;

    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: newLocale }),
    });

    router.refresh();
  };

  const items = locales.map((locale) => ({
    id: locale,
    label: localeNames[locale],
  }));

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-[6px] border border-transparent px-2 text-[12px] font-medium text-[hsl(var(--ds-text-2))] transition-colors duration-100 hover:bg-[hsl(var(--ds-surface-1))] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ds-accent-7))/0.45]',
              className,
            )}
            aria-label="Switch language"
          >
            <span className="leading-none">{currentLocale.toUpperCase()}</span>
            <ChevronDown className="size-3 text-[hsl(var(--ds-text-2))]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[170px]">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => void handleLocaleChange(item.id)}
              className="gap-2 text-[13px]"
            >
              <span className="flex-1">{item.label}</span>
              {item.id === currentLocale && (
                <Check className="size-3.5 text-[hsl(var(--ds-text-2))]" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Select value={currentLocale} onValueChange={(value) => handleLocaleChange(value)}>
      <SelectTrigger className="h-8 w-40 text-xs">
        <div className="flex items-center gap-1.5">
          <Languages className="size-3.5" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
