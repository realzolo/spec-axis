import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser, unauthorized } from '@/services/auth';
import { getActiveOrgId, isOrgMember, ORG_COOKIE } from '@/services/orgs';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const orgId = await getActiveOrgId(user.id, user.email ?? undefined, request);
  return NextResponse.json({ orgId });
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

  const response = NextResponse.json({ success: true, orgId });
  response.cookies.set(ORG_COOKIE, orgId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  });
  return response;
}
