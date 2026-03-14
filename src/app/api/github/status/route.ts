import { NextResponse } from 'next/server';
import { getGitHubAuthStatus } from '@/services/github';

export async function GET() {
  try {
    const status = await getGitHubAuthStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
