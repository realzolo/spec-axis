import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireUser, unauthorized } from '@/services/auth';
import { getOrgMemberRole } from '@/services/orgs';

const roles = ['owner', 'admin', 'reviewer', 'member'] as const;
type OrgRole = (typeof roles)[number];

function isValidRole(value: string): value is OrgRole {
  return roles.includes(value as OrgRole);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { orgId } = await params;
  const requesterRole = await getOrgMemberRole(orgId, user.id);
  if (!requesterRole) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('org_members')
    .select('user_id, role, status, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
  }

  const members = await Promise.all(
    (data || []).map(async (member) => {
      let email: string | null = null;
      try {
        const { data: userData } = await db.auth.admin.getUserById(member.user_id);
        email = userData?.user?.email ?? null;
      } catch {}

      return {
        ...member,
        email,
      };
    }),
  );

  return NextResponse.json(members);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { orgId } = await params;
  const requesterRole = await getOrgMemberRole(orgId, user.id);
  if (!requesterRole || (requesterRole !== 'owner' && requesterRole !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const userId = String(body?.userId || '').trim();
  const nextRole = String(body?.role || '').trim();

  if (!userId || !isValidRole(nextRole)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (requesterRole !== 'owner' && nextRole === 'owner') {
    return NextResponse.json({ error: 'Only owners can assign owner role' }, { status: 403 });
  }

  const db = createAdminClient();
  const { data: target, error } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (target.role === 'owner' && requesterRole !== 'owner') {
    return NextResponse.json({ error: 'Only owners can update other owners' }, { status: 403 });
  }

  if (userId === user.id && target.role === 'owner' && nextRole !== 'owner') {
    return NextResponse.json({ error: 'Cannot change your own owner role' }, { status: 400 });
  }

  const { data: updated, error: updateError } = await db
    .from('org_members')
    .update({ role: nextRole })
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }

  return NextResponse.json(updated);
}
