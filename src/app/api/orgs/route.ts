import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { ensurePersonalOrg, getUserOrgs } from '@/services/orgs';
import { auditLogger, extractClientInfo } from '@/services/audit';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  await ensurePersonalOrg(user.id, user.email ?? undefined);
  const orgs = await getUserOrgs(user.id);
  return NextResponse.json(orgs);
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const name = String(body?.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const db = createAdminClient();
  const baseSlug = slugify(body?.slug || name) || `org-${user.id.slice(0, 8)}`;
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const { data: org, error } = await db
    .from('organizations')
    .insert({
      name,
      slug,
      is_personal: false,
      owner_id: user.id,
    })
    .select()
    .single();

  if (error || !org) {
    return NextResponse.json({ error: 'Failed to create org' }, { status: 500 });
  }

  await db.from('org_members').insert({
    org_id: org.id,
    user_id: user.id,
    role: 'owner',
    status: 'active',
  });

  const clientInfo = extractClientInfo(request);
  await auditLogger.log({
    action: 'create',
    entityType: 'user',
    entityId: org.id,
    userId: user.id,
    changes: { name, slug },
    ...clientInfo,
  });

  return NextResponse.json(org, { status: 201 });
}
