/**
 * GitHub service - uses the new integration system
 * All functions now require a projectId to resolve the correct VCS integration
 */

import { resolveVCSIntegration } from './integrations';
import type { VCSClient } from './integrations';

async function getVCSClient(projectId: string): Promise<VCSClient> {
  const { client } = await resolveVCSIntegration(projectId);
  return client;
}

export async function validateRepo(repo: string, projectId: string): Promise<boolean> {
  try {
    const client = await getVCSClient(projectId);
    const [owner, repoName] = repo.split('/');
    const repos = await client.getRepositories(owner);
    return repos.some((r) => r.name === repoName);
  } catch {
    return false;
  }
}

export async function getGitHubAuthStatus(projectId: string) {
  const client = await getVCSClient(projectId);

  if (client.provider !== 'github') {
    throw new Error('This function only works with GitHub integrations');
  }

  const githubClient = client as any;
  const { data } = await githubClient.octokit.rest.users.getAuthenticated();

  return {
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
    public_repos: data.public_repos,
    total_private_repos: (data as Record<string, unknown>).total_private_repos ?? 0,
    html_url: data.html_url,
  };
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

  if (client.provider !== 'github') {
    throw new Error('Branch listing is only supported for GitHub');
  }

  const [owner, repoName] = repo.split('/');
  const githubClient = client as any;
  const { data } = await githubClient.octokit.rest.repos.listBranches({
    owner,
    repo: repoName,
    per_page: 50,
  });

  return data.map((b: any) => b.name);
}

export async function getRepoCommits(repo: string, branch: string, perPage = 30, page = 1, projectId: string) {
  const client = await getVCSClient(projectId);
  const [owner, repoName] = repo.split('/');
  const commits = await client.getCommits(owner, repoName, branch, perPage);

  return commits.map((c) => ({
    sha: c.sha,
    message: c.message.split('\n')[0],
    author: c.author.name,
    date: c.author.date,
    url: c.url,
  }));
}

export async function getCommitsDiff(repo: string, hashes: string[], projectId: string): Promise<string> {
  const client = await getVCSClient(projectId);
  const [owner, repoName] = repo.split('/');
  const diffs: string[] = [];

  for (const sha of hashes) {
    const diff = await client.getCommitDiff(owner, repoName, sha);
    diffs.push(`\n\n### Commit: ${sha}\n${diff}`);
  }

  return diffs.join('');
}

export async function getCommitBySha(repo: string, sha: string, projectId: string) {
  const client = await getVCSClient(projectId);
  const [owner, repoName] = repo.split('/');
  const commits = await client.getCommits(owner, repoName, sha, 1);

  if (commits.length === 0) {
    throw new Error('Commit not found');
  }

  const commit = commits[0];
  return {
    sha: commit.sha,
    message: commit.message.split('\n')[0],
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
