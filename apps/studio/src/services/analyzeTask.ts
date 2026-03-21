import { getCommitsBySha } from './github';

export async function buildReportCommits(repo: string, hashes: string[], projectId: string) {
  const commits = await getCommitsBySha(repo, hashes, projectId);
  if (!commits || commits.length === 0) {
    throw new Error('Specified commits not found');
  }
  return commits;
}
