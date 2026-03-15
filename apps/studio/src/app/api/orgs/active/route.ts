import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser, unauthorized } from '@/services/auth';
import { getActiveOrgId, getOrgMemberRole, isOrgMember, ORG_COOKIE } from '@/services/orgs';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);
  const role = await getOrgMemberRole(orgId, user.id);
  const response = NextResponse.json({ orgId, role });
  response.cookies.set(ORG_COOKIE, orgId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  });
  return response;
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const orgId = String(body?.orgId || '').trim();
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const member = await isOrgMember(orgId, user.id);
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const role = await getOrgMemberRole(orgId, user.id);
  const response = NextResponse.json({ success: true, orgId, role });
  response.cookies.set(ORG_COOKIE, orgId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  });
  return response;
}
