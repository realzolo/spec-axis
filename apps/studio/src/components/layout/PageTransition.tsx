'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-enter flex h-full min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
