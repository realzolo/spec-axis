import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireUser, unauthorized } from '@/services/auth';
import { getOrgMemberRole } from '@/services/orgs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> },
) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { orgId, inviteId } = await params;
  const requesterRole = await getOrgMemberRole(orgId, user.id);
  if (!requesterRole || (requesterRole !== 'owner' && requesterRole !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from('org_invites')
    .delete()
    .eq('id', inviteId)
    .eq('org_id', orgId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete invite' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
