import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDefaultOrgId, ORG_COOKIE } from '@/services/orgs';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
  }

  try {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(requestUrl.toString());
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (user) {
      const orgId = await getDefaultOrgId(user.id, user.email ?? undefined);
      const response = NextResponse.redirect(new URL(`/o/${orgId}/projects`, requestUrl.origin));
      response.cookies.set(ORG_COOKIE, orgId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });
      return response;
    }
  } catch {}

  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
