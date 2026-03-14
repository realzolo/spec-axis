import { NextResponse } from 'next/server';
import { getRepoCommits } from '@/services/github';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repo = searchParams.get('repo');
  const branch = searchParams.get('branch') ?? 'main';
  const perPage = Number(searchParams.get('per_page') ?? '30');
  const page = Number(searchParams.get('page') ?? '1');

  if (!repo) {
    return NextResponse.json({ error: 'repo is required' }, { status: 400 });
  }

  const commits = await getRepoCommits(repo, branch, perPage, page);
  return NextResponse.json(commits);
}
