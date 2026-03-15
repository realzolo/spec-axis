import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createRateLimiter, RATE_LIMITS } from '@/middleware/rateLimit';
import { requireUser, unauthorized } from '@/services/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { getOrgMemberRole } from '@/services/orgs';
import { auditLogger, extractClientInfo } from '@/services/audit';

export const dynamic = 'force-dynamic';

const rateLimiter = createRateLimiter(RATE_LIMITS.general);

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  const { orgId } = await params;
  const role = await getOrgMemberRole(orgId, user.id);
  if (!role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('org_invites')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const rateLimitResponse = rateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await requireUser();
  if (!user) return unauthorized();

  const { orgId } = await params;
  const role = await getOrgMemberRole(orgId, user.id);
  if (!role || (role !== 'owner' && role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const email = String(body?.email || '').trim().toLowerCase();
  const inviteRole = String(body?.role || 'member') as 'owner' | 'admin' | 'reviewer' | 'member';

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  if (!['owner', 'admin', 'reviewer', 'member'].includes(inviteRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const db = createAdminClient();
  const { data: invite, error } = await db
    .from('org_invites')
    .insert({
      org_id: orgId,
      email,
      role: inviteRole,
      token,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }

  const clientInfo = extractClientInfo(request);
  await auditLogger.log({
    action: 'create',
    entityType: 'org',
    entityId: orgId,
    userId: user.id,
    changes: { email, role: inviteRole },
    ...clientInfo,
  });

  return NextResponse.json(invite, { status: 201 });
}
