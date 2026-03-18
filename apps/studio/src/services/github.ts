/**
 * GitHub service - uses the new integration system
 * All functions now require a projectId to resolve the correct VCS integration
 */

import { resolveVCSIntegration } from './integrations';
import type { VCSClient } from './integrations';
import { GitHubClient } from './integrations';

function parseRepoFullName(repo: string): { owner: string; repoName: string } {
  const [owner, repoName, ...rest] = repo.split('/');
  if (!owner || !repoName || rest.length > 0) {
    throw new Error(`Invalid repository name: "${repo}". Expected "owner/repo".`);
  }
  return { owner, repoName };
}

function firstLine(text: string): string {
  const [line] = text.split('\n');
  return line ?? text;
}

async function getVCSClient(projectId: string): Promise<VCSClient> {
  const { client } = await resolveVCSIntegration(projectId);
  return client;
}

export async function validateRepo(repo: string, projectId: string): Promise<boolean> {
  try {
    const client = await getVCSClient(projectId);
    const { owner, repoName } = parseRepoFullName(repo);
    const repos = await client.getRepositories(owner);
    return repos.some((r) => r.name === repoName);
  } catch {
    return false;
  }
}

export async function getGitHubAuthStatus(projectId: string) {
  const client = await getVCSClient(projectId);

  if (!(client instanceof GitHubClient)) {
    throw new Error('This function only works with GitHub integrations');
  }

  return client.getAuthenticatedUser();
}

export async function listAccessibleRepos(projectId: string) {
  const client = await getVCSClient(projectId);
  const repos = await client.getRepositories();

  return repos.map((repo) => ({
    full_name: repo.fullName,
    name: repo.name,
    description: repo.description || null,
    default_branch: repo.defaultBranch,
    private: false,
    language: null,
    updated_at: null,
  }));
}

export async function getRepoBranches(repo: string, projectId: string): Promise<string[]> {
  const client = await getVCSClient(projectId);

  if (!(client instanceof GitHubClient)) {
    throw new Error('Branch listing is only supported for GitHub');
  }

  const { owner, repoName } = parseRepoFullName(repo);
  return client.listBranches(owner, repoName);
}

export async function getRepoCommits(repo: string, branch: string, perPage = 30, _page = 1, projectId: string) {
  void _page;
  const client = await getVCSClient(projectId);
  const { owner, repoName } = parseRepoFullName(repo);
  const commits = await client.getCommits(owner, repoName, branch, perPage);

  return commits.map((c) => ({
    sha: c.sha,
    message: firstLine(c.message),
    author: c.author.name,
    date: c.author.date,
    url: c.url,
  }));
}

export async function getCommitsDiff(repo: string, hashes: string[], projectId: string): Promise<string> {
  const client = await getVCSClient(projectId);
  const { owner, repoName } = parseRepoFullName(repo);
  const diffs: string[] = [];

  for (const sha of hashes) {
    const diff = await client.getCommitDiff(owner, repoName, sha);
    diffs.push(`\n\n### Commit: ${sha}\n${diff}`);
  }

  return diffs.join('');
}

export async function getCommitDiff(repo: string, sha: string, projectId: string): Promise<string> {
  const client = await getVCSClient(projectId);
  const { owner, repoName } = parseRepoFullName(repo);
  return client.getCommitDiff(owner, repoName, sha);
}

export async function getCommitBySha(repo: string, sha: string, projectId: string) {
  const client = await getVCSClient(projectId);
  const { owner, repoName } = parseRepoFullName(repo);
  const commits = await client.getCommits(owner, repoName, sha, 1);

  const commit = commits.at(0);
  if (!commit) {
    throw new Error('Commit not found');
  }

  return {
    sha: commit.sha,
    message: firstLine(commit.message),
    author: commit.author.name,
    date: commit.author.date,
    url: commit.url,
  };
}

export async function getCommitsBySha(repo: string, hashes: string[], projectId: string) {
  const commits = [];
  for (const sha of hashes) {
    commits.push(await getCommitBySha(repo, sha, projectId));
  }
  return commits;
}
