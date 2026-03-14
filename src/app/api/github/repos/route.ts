import { NextResponse } from 'next/server';
import { listAccessibleRepos } from '@/services/github';

export async function GET() {
  try {
    const repos = await listAccessibleRepos();
    return NextResponse.json(repos);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch repos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
