'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from './ThemeProvider';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isDark = theme === 'dark';

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={hydrated ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'}
      onClick={toggle}
      className={cn(
        'h-7 w-7 border border-transparent text-[hsl(var(--ds-text-2))] hover:bg-[hsl(var(--ds-surface-1))] hover:text-foreground focus-visible:ring-1 focus-visible:ring-[hsl(var(--ds-accent-7))/0.45]',
        className,
      )}
    >
      {hydrated && isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </Button>
  );
}
