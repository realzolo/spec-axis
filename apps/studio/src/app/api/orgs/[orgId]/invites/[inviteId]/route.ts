import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { exec } from '@/lib/db';
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

  await exec(
    `delete from org_invites where id = $1 and org_id = $2`,
    [inviteId, orgId]
  );

  return NextResponse.json({ success: true });
}
