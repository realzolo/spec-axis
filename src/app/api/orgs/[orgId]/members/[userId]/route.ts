import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireUser, unauthorized } from '@/services/auth';
import { getOrgMemberRole } from '@/services/orgs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { orgId, userId } = await params;
  const requesterRole = await getOrgMemberRole(orgId, user.id);
  if (!requesterRole || (requesterRole !== 'owner' && requesterRole !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
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
    return NextResponse.json({ error: 'Only owners can remove other owners' }, { status: 403 });
  }

  const { error: deleteError } = await db
    .from('org_members')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
