import { Octokit } from '@octokit/rest';
import { encrypt, decrypt } from './crypto';

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  url: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  url: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface RepositoryData {
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  issues: GitHubIssue[];
  branches: GitHubBranch[];
}

export class GitHubServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'GitHubServiceError';
  }
}

/**
 * GitHub API client service wrapping Octokit
 */
export class GitHubService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
  }

  /**
   * Create a GitHub service instance with encrypted token
   */
  static fromEncryptedToken(encryptedToken: string): GitHubService {
    const decryptedToken = decrypt(encryptedToken);
    return new GitHubService(decryptedToken);
  }

  /**
   * Get authenticated user profile
   */
  async getAuthenticatedUser(): Promise<{ login: string; name: string | null; avatarUrl: string; htmlUrl: string }> {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return {
        login: data.login,
        name: data.name,
        avatarUrl: data.avatar_url,
        htmlUrl: data.html_url,
      };
    } catch (error: any) {
      console.error('GitHub getAuthenticatedUser error:', error.message, error.status);
      throw new GitHubServiceError(
        'Failed to get authenticated user',
        'GET_USER_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * List all repositories for the authenticated user
   */
  async listUserRepositories(): Promise<GitHubRepository[]> {
    try {
      const allRepos: any[] = [];

      // Fetch up to 3 pages (300 repos) to cover "numerous" repositories
      for (let page = 1; page <= 3; page++) {
        const { data } = await this.octokit.repos.listForAuthenticatedUser({
          per_page: 100,
          page,
          sort: 'pushed',
          direction: 'desc',
          visibility: 'all',
          affiliation: 'owner,collaborator,organization_member',
        });

        if (data.length === 0) break;
        allRepos.push(...data);
        if (data.length < 100) break;
      }

      return allRepos.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        description: repo.description,
        private: repo.private,
        defaultBranch: repo.default_branch,
      }));
    } catch (error: any) {
      console.error('GitHub listUserRepositories error:', error.message, error.status);
      throw new GitHubServiceError(
        'Failed to list user repositories',
        'LIST_REPOS_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Create a new repository for the authenticated user
   */
  async createRepo(name: string, description?: string, isPrivate: boolean = true): Promise<GitHubRepository> {
    try {
      const { data } = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: true,
      });

      return {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        url: data.html_url,
        description: data.description,
        private: data.private,
        defaultBranch: data.default_branch,
      };
    } catch (error: any) {
      throw new GitHubServiceError(
        'Failed to create repository',
        'CREATE_REPO_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Delete a repository
   */
  async deleteRepo(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.repos.delete({
        owner,
        repo,
      });
      return true;
    } catch (error: any) {
      throw new GitHubServiceError(
        'Failed to delete repository',
        'DELETE_REPO_FAILED',
        error.status || 500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Validate repository access by attempting to fetch repository data
   */
  async validateRepositoryAccess(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.repos.get({
        owner,
        repo,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        throw new GitHubServiceError(
          'Repository not found or access denied',
          'REPOSITORY_NOT_FOUND',
          404
        );
      }
      if (error.status === 401 || error.status === 403) {
        throw new GitHubServiceError(
          'Invalid or expired GitHub access token',
          'INVALID_TOKEN',
          401
        );
      }
      throw new GitHubServiceError(
        'Failed to validate repository access',
        'VALIDATION_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Get repository metadata
   */
  async getRepositoryMetadata(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      const { data } = await this.octokit.repos.get({
        owner,
        repo,
      });

      return {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        url: data.html_url,
        description: data.description,
        private: data.private,
        defaultBranch: data.default_branch,
      };
    } catch (error: any) {
      throw new GitHubServiceError(
        'Failed to fetch repository metadata',
        'FETCH_METADATA_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Get recent commits from repository
   */
  async getCommits(owner: string, repo: string, limit: number = 20): Promise<GitHubCommit[]> {
    try {
      const { data } = await this.octokit.repos.listCommits({
        owner,
        repo,
        per_page: limit,
      });

      return data.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || 'Unknown',
          email: commit.commit.author?.email || '',
          date: commit.commit.author?.date || new Date().toISOString(),
        },
        url: commit.html_url,
      }));
    } catch (error: any) {
      throw new GitHubServiceError(
        'Failed to fetch commits',
        'FETCH_COMMITS_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Get pull requests from repository
   */
  async getPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    limit: number = 20
  ): Promise<GitHubPullRequest[]> {
    try {
      const { data } = await this.octokit.pulls.list({
        owner,
        repo,
        state,
        per_page: limit,
        sort: 'updated',
        direction: 'desc',
      });

      return data.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        author: pr.user?.login || 'Unknown',
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha,
        },
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha,
        },
      }));
    } catch (error: any) {
      throw new GitHubServiceError(
        'Failed to fetch pull requests',
        'FETCH_PRS_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Get issues from repository
   */
  async getIssues(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    limit: number = 20
  ): Promise<GitHubIssue[]> {
    try {
      const { data } = await this.octokit.issues.listForRepo({
        owner,
        repo,
        state,
        per_page: limit,
        sort: 'updated',
        direction: 'desc',
      });

      // Filter out pull requests (GitHub API returns PRs as issues)
      const issues = data.filter(issue => !issue.pull_request);

      return issues.map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
        author: issue.user?.login || 'Unknown',
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        labels: issue.labels.map(label =>
          typeof label === 'string' ? label : label.name || ''
        ),
      }));
    } catch (error: any) {
      throw new GitHubServiceError(
        'Failed to fetch issues',
        'FETCH_ISSUES_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Get branches from repository
   */
  async getBranches(owner: string, repo: string, limit: number = 20): Promise<GitHubBranch[]> {
    try {
      const { data } = await this.octokit.repos.listBranches({
        owner,
        repo,
        per_page: limit,
      });

      return data.map(branch => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url,
        },
        protected: branch.protected,
      }));
    } catch (error: any) {
      throw new GitHubServiceError(
        'Failed to fetch branches',
        'FETCH_BRANCHES_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Get comprehensive repository data (commits, PRs, issues, branches)
   */
  async getRepositoryData(owner: string, repo: string): Promise<RepositoryData> {
    try {
      const [commits, pullRequests, issues, branches] = await Promise.all([
        this.getCommits(owner, repo),
        this.getPullRequests(owner, repo),
        this.getIssues(owner, repo),
        this.getBranches(owner, repo),
      ]);

      return {
        commits,
        pullRequests,
        issues,
        branches,
      };
    } catch (error: any) {
      if (error instanceof GitHubServiceError) {
        throw error;
      }
      throw new GitHubServiceError(
        'Failed to fetch repository data',
        'FETCH_DATA_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Create a webhook for the repository
   */
  async createWebhook(
    owner: string,
    repo: string,
    webhookUrl: string,
    secret: string
  ): Promise<{ id: number; url: string }> {
    try {
      const { data } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret,
          insecure_ssl: '0',
        },
        events: ['push', 'pull_request', 'issues'],
        active: true,
      });

      return {
        id: data.id,
        url: data.url,
      };
    } catch (error: any) {
      throw new GitHubServiceError(
        'Failed to create webhook',
        'CREATE_WEBHOOK_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Delete a webhook from the repository
   */
  async deleteWebhook(owner: string, repo: string, webhookId: number): Promise<void> {
    try {
      await this.octokit.repos.deleteWebhook({
        owner,
        repo,
        hook_id: webhookId,
      });
    } catch (error: any) {
      throw new GitHubServiceError(
        'Failed to delete webhook',
        'DELETE_WEBHOOK_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }
}

/**
 * Helper function to parse GitHub repository URL
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Support formats:
  // - https://github.com/owner/repo
  // - https://github.com/owner/repo.git
  // - git@github.com:owner/repo.git
  const httpsMatch = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2],
    };
  }

  const sshMatch = url.match(/github\.com:([^\/]+)\/([^\/\.]+)/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
    };
  }

  return null;
}
