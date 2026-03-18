export const ORG_PATH_PREFIX = '/o';

const ORG_PREFIX_RE = /^\/o\/([^/]+)(\/.*)?$/;

export function extractOrgFromPath(pathname: string): { orgId: string | null; restPath: string } {
  const match = pathname.match(ORG_PREFIX_RE);
  if (!match) {
    return { orgId: null, restPath: pathname };
  }

  const orgId = match[1] ?? null;
  const rest = match[2] || '/';
  return { orgId, restPath: rest === '' ? '/' : rest };
}

export function getOrgPrefix(pathname: string): string {
  const { orgId } = extractOrgFromPath(pathname);
  return orgId ? `${ORG_PATH_PREFIX}/${orgId}` : '';
}

export function stripOrgPrefix(pathname: string): string {
  return extractOrgFromPath(pathname).restPath;
}

export function withOrgPrefix(pathname: string, target: string): string {
  if (!target.startsWith('/')) return target;
  if (target.startsWith(`${ORG_PATH_PREFIX}/`)) return target;

  const prefix = getOrgPrefix(pathname);
  if (!prefix) return target;

  if (target === '/') return prefix;
  return `${prefix}${target}`;
}

export function replaceOrgInPath(pathname: string, orgId: string): string {
  const { restPath } = extractOrgFromPath(pathname);
  const suffix = restPath === '/' ? '' : restPath;
  return `${ORG_PATH_PREFIX}/${orgId}${suffix}`;
}
