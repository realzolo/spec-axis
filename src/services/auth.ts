import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type AuthUser = {
  id: string;
  email?: string | null;
};

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email } as AuthUser;
}

export function unauthorized() {
  return NextResponse.json({ error: '未授权' }, { status: 401 });
}
