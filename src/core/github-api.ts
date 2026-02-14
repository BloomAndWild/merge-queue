/**
 * GitHub API wrapper for merge queue operations
 */

import { getOctokit } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import type { components } from '@octokit/openapi-types';
import { GitHubAPIError, isGitHubError } from '../utils/errors';
import { Logger, createLogger } from '../utils/logger';
import type {
  RepositoryInfo,
  MergeMethod,
  CheckStatus,
  UpdateResult,
} from '../types/queue';

type Octokit = InstanceType<typeof GitHub>;
type PullRequest = components['schemas']['pull-request'];
type Review = components['schemas']['pull-request-review'];

/**
 * Map a GitHub check-run conclusion + status to our CheckStatus type
 */
function mapCheckRunStatus(
  conclusion: string | null | undefined,
  status: string
): CheckStatus['status'] {
  if (conclusion) {
    const map: Record<string, CheckStatus['status']> = {
      success: 'success',
      failure: 'failure',
      cancelled: 'cancelled',
      neutral: 'neutral',
      skipped: 'skipped',
      timed_out: 'failure',
      action_required: 'failure',
      stale: 'pending',
    };
    return map[conclusion] ?? 'pending';
  }
  // No conclusion yet — derive from the run status
  return status === 'completed' ? 'success' : 'pending';
}

/**
 * Map a GitHub commit-status state to our CheckStatus type
 */
function mapCommitStatusState(state: string): CheckStatus['status'] {
  const map: Record<string, CheckStatus['status']> = {
    success: 'success',
    failure: 'failure',
    error: 'failure',
    pending: 'pending',
  };
  return map[state] ?? 'pending';
}

/**
 * GitHub API client for merge queue operations
 */
export class GitHubAPI {
  private octokit: Octokit;
  private logger: Logger;

  constructor(token: string, private repo: RepositoryInfo, logger?: Logger) {
    this.octokit = getOctokit(token);
    this.logger = logger || createLogger({ component: 'GitHubAPI', ...repo });
  }

  /**
   * Get PR details
   */
  async getPullRequest(prNumber: number): Promise<PullRequest> {
    this.logger.debug('Fetching PR details', { prNumber });

    try {
      const { data } = await this.octokit.rest.pulls.get({
        owner: this.repo.owner,
        repo: this.repo.repo,
        pull_number: prNumber,
      });

      return data;
    } catch (error) {
      throw new GitHubAPIError(
        `Failed to fetch PR #${prNumber}`,
        isGitHubError(error) ? error.status : undefined,
        error
      );
    }
  }

  /**
   * Get PR reviews
   */
  async getPRReviews(prNumber: number): Promise<Review[]> {
    this.logger.debug('Fetching PR reviews', { prNumber });

    try {
      const { data } = await this.octokit.rest.pulls.listReviews({
        owner: this.repo.owner,
        repo: this.repo.repo,
        pull_number: prNumber,
      });

      return data;
    } catch (error) {
      throw new GitHubAPIError(
        `Failed to fetch reviews for PR #${prNumber}`,
        isGitHubError(error) ? error.status : undefined,
        error
      );
    }
  }

  /**
   * Get combined status for a commit
   */
  async getCommitStatus(ref: string): Promise<CheckStatus[]> {
    this.logger.debug('Fetching commit status', { ref });

    try {
      // Get check runs
      const { data: checkRuns } = await this.octokit.rest.checks.listForRef({
        owner: this.repo.owner,
        repo: this.repo.repo,
        ref,
      });

      // Get commit statuses
      const { data: statuses } =
        await this.octokit.rest.repos.getCombinedStatusForRef({
          owner: this.repo.owner,
          repo: this.repo.repo,
          ref,
        });

      // Combine check runs and statuses with proper status mapping
      const checkStatuses: CheckStatus[] = [
        ...checkRuns.check_runs.map(check => ({
          name: check.name,
          status: mapCheckRunStatus(check.conclusion, check.status),
          conclusion: check.conclusion || undefined,
        })),
        ...statuses.statuses.map(status => ({
          name: status.context,
          status: mapCommitStatusState(status.state),
          conclusion: status.state,
        })),
      ];

      return checkStatuses;
    } catch (error) {
      throw new GitHubAPIError(
        `Failed to fetch commit status for ${ref}`,
        isGitHubError(error) ? error.status : undefined,
        error
      );
    }
  }

  /**
   * Check if PR branch is behind base branch.
   *
   * Compares base_ref (e.g. main) → head_ref (PR branch).
   * `behind_by` then tells us how many commits the PR branch
   * is missing from the base branch.
   */
  async isBranchBehind(prNumber: number): Promise<boolean> {
    this.logger.debug('Checking if branch is behind', { prNumber });

    try {
      const pr = await this.getPullRequest(prNumber);
      const comparison =
        await this.octokit.rest.repos.compareCommitsWithBasehead({
          owner: this.repo.owner,
          repo: this.repo.repo,
          basehead: `${pr.base.ref}...${pr.head.ref}`,
        });

      // behind_by = commits in base that are NOT in head (PR is behind)
      return comparison.data.behind_by > 0;
    } catch (error) {
      throw new GitHubAPIError(
        `Failed to check if PR #${prNumber} is behind`,
        isGitHubError(error) ? error.status : undefined,
        error
      );
    }
  }

  /**
   * Update PR branch with base branch (merge base into head)
   */
  async updateBranch(prNumber: number): Promise<UpdateResult> {
    this.logger.info('Updating PR branch with base', { prNumber });

    try {
      const pr = await this.getPullRequest(prNumber);

      // Merge base branch into PR branch
      const { data: merge } = await this.octokit.rest.repos.merge({
        owner: this.repo.owner,
        repo: this.repo.repo,
        base: pr.head.ref,
        head: pr.base.ref,
        commit_message: `Merge ${pr.base.ref} into ${pr.head.ref} (merge queue auto-update)`,
      });

      if (!merge.sha) {
        throw new Error('Merge did not return a commit SHA');
      }

      this.logger.info('Branch updated successfully', {
        prNumber,
        sha: merge.sha,
      });

      return {
        success: true,
        conflict: false,
        sha: merge.sha,
      };
    } catch (error: unknown) {
      // Check if it's a merge conflict
      if (
        isGitHubError(error) &&
        (error.status === 409 || error.message?.includes('conflict'))
      ) {
        this.logger.warning('Merge conflict detected during branch update', {
          prNumber,
        });

        return {
          success: false,
          conflict: true,
          error: 'Merge conflict detected',
        };
      }

      throw new GitHubAPIError(
        `Failed to update branch for PR #${prNumber}`,
        isGitHubError(error) ? error.status : undefined,
        error
      );
    }
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(
    prNumber: number,
    method: MergeMethod = 'squash',
    commitTitle?: string,
    commitMessage?: string
  ): Promise<string> {
    this.logger.info('Merging pull request', { prNumber, method });

    try {
      const { data } = await this.octokit.rest.pulls.merge({
        owner: this.repo.owner,
        repo: this.repo.repo,
        pull_number: prNumber,
        merge_method: method,
        commit_title: commitTitle,
        commit_message: commitMessage,
      });

      if (!data.merged) {
        throw new Error('PR was not merged');
      }

      this.logger.info('PR merged successfully', {
        prNumber,
        sha: data.sha,
      });

      return data.sha;
    } catch (error) {
      throw new GitHubAPIError(
        `Failed to merge PR #${prNumber}`,
        isGitHubError(error) ? error.status : undefined,
        error
      );
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(ref: string): Promise<void> {
    this.logger.info('Deleting branch', { ref });

    try {
      await this.octokit.rest.git.deleteRef({
        owner: this.repo.owner,
        repo: this.repo.repo,
        ref: `heads/${ref}`,
      });

      this.logger.info('Branch deleted successfully', { ref });
    } catch (error) {
      // Log but don't throw - branch deletion is not critical
      this.logger.warning('Failed to delete branch', { ref, error });
    }
  }

  /**
   * Add a comment to a PR
   */
  async addComment(prNumber: number, body: string): Promise<void> {
    this.logger.debug('Adding comment to PR', { prNumber });

    try {
      await this.octokit.rest.issues.createComment({
        owner: this.repo.owner,
        repo: this.repo.repo,
        issue_number: prNumber,
        body,
      });
    } catch (error) {
      throw new GitHubAPIError(
        `Failed to add comment to PR #${prNumber}`,
        isGitHubError(error) ? error.status : undefined,
        error
      );
    }
  }

  /**
   * Add labels to a PR
   */
  async addLabels(prNumber: number, labels: string[]): Promise<void> {
    if (labels.length === 0) return;

    this.logger.debug('Adding labels to PR', { prNumber, labels });

    try {
      await this.octokit.rest.issues.addLabels({
        owner: this.repo.owner,
        repo: this.repo.repo,
        issue_number: prNumber,
        labels,
      });
    } catch (error) {
      throw new GitHubAPIError(
        `Failed to add labels to PR #${prNumber}`,
        isGitHubError(error) ? error.status : undefined,
        error
      );
    }
  }

  /**
   * Remove a label from a PR
   */
  async removeLabel(prNumber: number, label: string): Promise<void> {
    this.logger.debug('Removing label from PR', { prNumber, label });

    try {
      await this.octokit.rest.issues.removeLabel({
        owner: this.repo.owner,
        repo: this.repo.repo,
        issue_number: prNumber,
        name: label,
      });
    } catch (error: unknown) {
      // Ignore 404 errors (label doesn't exist)
      if (isGitHubError(error) && error.status === 404) {
        return;
      }
      throw new GitHubAPIError(
        `Failed to remove label from PR #${prNumber}`,
        isGitHubError(error) ? error.status : undefined,
        error
      );
    }
  }
}
