import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
  }

  try {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(requestUrl.toString());
  } catch {}

  return NextResponse.redirect(new URL('/projects', requestUrl.origin));
}
