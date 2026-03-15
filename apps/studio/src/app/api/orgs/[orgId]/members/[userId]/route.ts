import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { exec, queryOne } from '@/lib/db';
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

  const target = await queryOne<{ role: string }>(
    `select role from org_members where org_id = $1 and user_id = $2`,
    [orgId, userId]
  );

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (target.role === 'owner' && requesterRole !== 'owner') {
    return NextResponse.json({ error: 'Only owners can remove other owners' }, { status: 403 });
  }

  await exec(
    `delete from org_members where org_id = $1 and user_id = $2`,
    [orgId, userId]
  );

  return NextResponse.json({ success: true });
}
