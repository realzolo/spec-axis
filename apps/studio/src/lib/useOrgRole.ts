'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { extractOrgFromPath } from '@/lib/orgPath';

export type OrgRole = 'owner' | 'admin' | 'reviewer' | 'member';

const roleCache = new Map<string, OrgRole | null>();
const rolePromiseCache = new Map<string, Promise<OrgRole | null>>();

async function fetchActiveRole(): Promise<OrgRole | null> {
  try {
    const res = await fetch('/api/orgs/active');
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.role ?? null) as OrgRole | null;
  } catch {
    return null;
  }
}

export function useOrgRole() {
  const pathname = usePathname();
  const orgId = extractOrgFromPath(pathname).orgId;
  const cacheKey = orgId ?? 'active';

  const [role, setRole] = useState<OrgRole | null>(() => roleCache.get(cacheKey) ?? null);
  const [loading, setLoading] = useState<boolean>(() => !roleCache.has(cacheKey));

  useEffect(() => {
    let alive = true;
    const cached = roleCache.get(cacheKey);
    if (cached !== undefined) {
      queueMicrotask(() => {
        if (!alive) return;
        setRole(cached);
        setLoading(false);
      });
      return () => {
        alive = false;
      };
    }

    queueMicrotask(() => {
      if (!alive) return;
      setLoading(true);
    });
    let pending = rolePromiseCache.get(cacheKey);
    if (!pending) {
      pending = fetchActiveRole()
        .then((value) => {
          roleCache.set(cacheKey, value);
          rolePromiseCache.delete(cacheKey);
          return value;
        })
        .catch(() => {
          roleCache.set(cacheKey, null);
          rolePromiseCache.delete(cacheKey);
          return null;
        });
      rolePromiseCache.set(cacheKey, pending);
    }

    pending.then((value) => {
      if (!alive) return;
      setRole(value);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [cacheKey]);

  const isAdmin = role === 'owner' || role === 'admin';

  return { role, isAdmin, loading };
}
