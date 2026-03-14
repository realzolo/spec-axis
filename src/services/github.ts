import { Octokit } from 'octokit';

function getOctokit() {
  return new Octokit({ auth: process.env.GITHUB_PAT });
}

export async function validateRepo(repo: string): Promise<boolean> {
  try {
    const [owner, repoName] = repo.split('/');
    await getOctokit().rest.repos.get({ owner, repo: repoName });
    return true;
  } catch {
    return false;
  }
}

export async function getGitHubAuthStatus() {
  const { data } = await getOctokit().rest.users.getAuthenticated();
  return {
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
    public_repos: data.public_repos,
    total_private_repos: (data as Record<string, unknown>).total_private_repos ?? 0,
    html_url: data.html_url,
  };
}

export async function listAccessibleRepos() {
  const octokit = getOctokit();
  const repos: Array<{
    full_name: string;
    name: string;
    description: string | null;
    default_branch: string;
    private: boolean;
    language: string | null;
    updated_at: string | null;
  }> = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.repos.listForAuthenticatedUser,
    { per_page: 100, sort: 'updated', direction: 'desc' }
  )) {
    for (const repo of response.data) {
      repos.push({
        full_name: repo.full_name,
        name: repo.name,
        description: repo.description,
        default_branch: repo.default_branch,
        private: repo.private,
        language: repo.language,
        updated_at: repo.updated_at,
      });
    }
    if (repos.length >= 300) break;
  }
  return repos;
}

export async function getRepoBranches(repo: string): Promise<string[]> {
  const [owner, repoName] = repo.split('/');
  const { data } = await getOctokit().rest.repos.listBranches({
    owner, repo: repoName, per_page: 50
  });
  return data.map((b) => b.name);
}

export async function getRepoCommits(repo: string, branch: string, perPage = 30, page = 1) {
  const [owner, repoName] = repo.split('/');
  const { data } = await getOctokit().rest.repos.listCommits({
    owner, repo: repoName, sha: branch, per_page: perPage, page
  });
  return data.map((c) => ({
    sha: c.sha,
    message: c.commit.message.split('\n')[0],
    author: c.commit.author?.name ?? c.author?.login ?? 'Unknown',
    date: c.commit.author?.date ?? '',
    url: c.html_url
  }));
}

export async function getCommitsDiff(repo: string, hashes: string[]): Promise<string> {
  const [owner, repoName] = repo.split('/');
  const octokit = getOctokit();
  const diffs: string[] = [];

  for (const sha of hashes) {
    const { data } = await octokit.rest.repos.getCommit({
      owner,
      repo: repoName,
      ref: sha,
      mediaType: { format: 'diff' }
    });
    diffs.push(`\n\n### Commit: ${sha}\n${data as unknown as string}`);
  }

  return diffs.join('');
}

export async function getCommitBySha(repo: string, sha: string) {
  const [owner, repoName] = repo.split('/');
  const { data } = await getOctokit().rest.repos.getCommit({
    owner,
    repo: repoName,
    ref: sha,
  });

  return {
    sha: data.sha,
    message: data.commit.message.split('\n')[0],
    author: data.commit.author?.name ?? data.author?.login ?? 'Unknown',
    date: data.commit.author?.date ?? '',
    url: data.html_url,
  };
}

export async function getCommitsBySha(repo: string, hashes: string[]) {
  const commits = [];
  for (const sha of hashes) {
    commits.push(await getCommitBySha(repo, sha));
  }
  return commits;
}
