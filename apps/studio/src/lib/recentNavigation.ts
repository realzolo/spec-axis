export type RecentNavigationItem = {
  path: string;
  timestamp: number;
};

const STORAGE_KEY = 'studio.recent-navigation.v1';
const MAX_RECENTS = 24;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizePath(path: string) {
  const value = path.trim();
  if (!value) return '/';
  return value.split('?')[0] ?? '/';
}

function isTrackablePath(path: string) {
  if (!path.startsWith('/o/')) return false;
  if (path.includes('/api/')) return false;
  return true;
}

export function readRecentNavigation(limit = 8): RecentNavigationItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .filter((item): item is { path?: unknown; timestamp?: unknown } => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        path: normalizePath(typeof item.path === 'string' ? item.path : '/'),
        timestamp: typeof item.timestamp === 'number' ? item.timestamp : 0,
      }))
      .filter((item) => isTrackablePath(item.path))
      .sort((a, b) => b.timestamp - a.timestamp);
    return normalized.slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}

export function recordRecentNavigation(path: string) {
  if (!canUseStorage()) return;
  const normalizedPath = normalizePath(path);
  if (!isTrackablePath(normalizedPath)) return;
  const nextItem: RecentNavigationItem = {
    path: normalizedPath,
    timestamp: Date.now(),
  };
  const previous = readRecentNavigation(MAX_RECENTS);
  const merged = [nextItem, ...previous.filter((item) => item.path !== normalizedPath)].slice(0, MAX_RECENTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore storage errors
  }
}

