'use client';

import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import type { ThemeMode } from '@/components/theme/ThemeProvider';

export function Providers({
  children,
  defaultTheme,
}: {
  children: React.ReactNode;
  defaultTheme: ThemeMode;
}) {
  return (
    <ThemeProvider defaultTheme={defaultTheme}>
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
