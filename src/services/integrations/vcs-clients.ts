/**
 * VCS Client implementations
 */

import { Octokit } from 'octokit';
import type {
  VCSClient,
  VCSConfigWithSecret,
  Repository,
  Commit,
  VCSProvider,
} from './types';

/**
 * GitHub VCS Client
 */
export class GitHubClient implements VCSClient {
  provider: VCSProvider = 'github';
  private octokit: Octokit;
  private config: VCSConfigWithSecret;

  constructor(config: VCSConfigWithSecret) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
      baseUrl: config.baseUrl || 'https://api.github.com',
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.octokit.rest.users.getAuthenticated();
      return true;
    } catch (error) {
      console.error('GitHub connection test failed:', error);
      return false;
    }
  }

  async getRepositories(owner?: string): Promise<Repository[]> {
    try {
      const targetOwner = owner || this.config.org;

      if (!targetOwner) {
        // Get user's repositories
        const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
          per_page: 100,
          sort: 'updated',
        });

        return data.map((repo) => ({
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
          description: repo.description || undefined,
          url: repo.html_url,
        }));
      }

      // Get organization repositories
      const { data } = await this.octokit.rest.repos.listForOrg({
        org: targetOwner,
        per_page: 100,
        sort: 'updated',
      });

      return data.map((repo) => ({
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch || 'main',
        description: repo.description || undefined,
        url: repo.html_url,
      }));
    } catch (error) {
      console.error('Failed to get repositories:', error);
      throw new Error('Failed to fetch repositories from GitHub');
    }
  }

  async getCommits(owner: string, repo: string, branch: string, limit = 50): Promise<Commit[]> {
    try {
      const { data } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: branch,
        per_page: limit,
      });

      return data.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || 'Unknown',
          email: commit.commit.author?.email || '',
          date: commit.commit.author?.date || new Date().toISOString(),
        },
        url: commit.html_url,
      }));
    } catch (error) {
      console.error('Failed to get commits:', error);
      throw new Error('Failed to fetch commits from GitHub');
    }
  }

  async getCommitDiff(owner: string, repo: string, sha: string): Promise<string> {
    try {
      const { data } = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: sha,
        mediaType: {
          format: 'diff',
        },
      });

      return data as unknown as string;
    } catch (error) {
      console.error('Failed to get commit diff:', error);
      throw new Error('Failed to fetch commit diff from GitHub');
    }
  }
}

/**
 * GitLab VCS Client
 */
export class GitLabClient implements VCSClient {
  provider: VCSProvider = 'gitlab';
  private config: VCSConfigWithSecret;
  private baseUrl: string;

  constructor(config: VCSConfigWithSecret) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://gitlab.com';
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/api/v4${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'PRIVATE-TOKEN': this.config.token,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.statusText}`);
    }

    return response.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetch('/user');
      return true;
    } catch (error) {
      console.error('GitLab connection test failed:', error);
      return false;
    }
  }

  async getRepositories(owner?: string): Promise<Repository[]> {
    try {
      const endpoint = owner ? `/groups/${owner}/projects` : '/projects';
      const data = await this.fetch(`${endpoint}?per_page=100&order_by=updated_at`);

      return data.map((project: any) => ({
        owner: project.namespace.path,
        name: project.path,
        fullName: project.path_with_namespace,
        defaultBranch: project.default_branch,
        description: project.description || undefined,
        url: project.web_url,
      }));
    } catch (error) {
      console.error('Failed to get repositories:', error);
      throw new Error('Failed to fetch repositories from GitLab');
    }
  }

  async getCommits(owner: string, repo: string, branch: string, limit = 50): Promise<Commit[]> {
    try {
      const projectPath = encodeURIComponent(`${owner}/${repo}`);
      const data = await this.fetch(
        `/projects/${projectPath}/repository/commits?ref_name=${branch}&per_page=${limit}`
      );

      return data.map((commit: any) => ({
        sha: commit.id,
        message: commit.message,
        author: {
          name: commit.author_name,
          email: commit.author_email,
          date: commit.created_at,
        },
        url: commit.web_url,
      }));
    } catch (error) {
      console.error('Failed to get commits:', error);
      throw new Error('Failed to fetch commits from GitLab');
    }
  }

  async getCommitDiff(owner: string, repo: string, sha: string): Promise<string> {
    try {
      const projectPath = encodeURIComponent(`${owner}/${repo}`);
      const data = await this.fetch(`/projects/${projectPath}/repository/commits/${sha}/diff`);

      // Convert GitLab diff format to unified diff
      return data
        .map((diff: any) => {
          return `diff --git a/${diff.old_path} b/${diff.new_path}\n${diff.diff}`;
        })
        .join('\n');
    } catch (error) {
      console.error('Failed to get commit diff:', error);
      throw new Error('Failed to fetch commit diff from GitLab');
    }
  }
}

/**
 * Generic Git Client (for custom Git services)
 */
export class GenericGitClient implements VCSClient {
  provider: VCSProvider = 'git';
  private config: VCSConfigWithSecret;

  constructor(config: VCSConfigWithSecret) {
    this.config = config;
  }

  async testConnection(): Promise<boolean> {
    // For generic Git, we can't test without a specific repository
    // Return true if token is provided
    return !!this.config.token;
  }

  async getRepositories(): Promise<Repository[]> {
    throw new Error('Generic Git client does not support repository listing');
  }

  async getCommits(): Promise<Commit[]> {
    throw new Error('Generic Git client requires specific implementation');
  }

  async getCommitDiff(): Promise<string> {
    throw new Error('Generic Git client requires specific implementation');
  }
}
