/**
 * GitHub API wrapper for merge queue operations
 */

import { getOctokit } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import type { components } from '@octokit/openapi-types';
import { GitHubAPIError, isGitHubError } from '../utils/errors';
import { Logger, createLogger } from '../utils/logger';
import type { RepositoryInfo, MergeMethod, CheckStatus, UpdateResult } from '../types/queue';

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

  constructor(
    token: string,
    private repo: RepositoryInfo,
    logger?: Logger
  ) {
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
   * Get combined status for a commit.
   *
   * Fetches both check-runs and commit-statuses (first page only).
   * Logs a warning when the response size equals the default page limit,
   * which may indicate truncated results.
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

      if (checkRuns.total_count > checkRuns.check_runs.length) {
        this.logger.warning('Check runs response may be truncated', {
          ref,
          returned: checkRuns.check_runs.length,
          total: checkRuns.total_count,
        });
      }

      // Get commit statuses
      const { data: statuses } = await this.octokit.rest.repos.getCombinedStatusForRef({
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
      const comparison = await this.octokit.rest.repos.compareCommitsWithBasehead({
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
   * Update PR branch with base branch using GitHub's dedicated update-branch API.
   *
   * Uses `PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch`
   * which is the same mechanism as the "Update branch" button in the GitHub UI.
   * This endpoint returns HTTP 202 (Accepted) because the merge happens
   * asynchronously, so we poll the PR for the new head SHA afterwards.
   */
  async updateBranch(prNumber: number): Promise<UpdateResult> {
    this.logger.info('Updating PR branch with base', { prNumber });

    try {
      const pr = await this.getPullRequest(prNumber);
      const previousSha = pr.head.sha;

      this.logger.debug('Current head SHA before update', {
        prNumber,
        sha: previousSha,
        base: pr.base.ref,
        head: pr.head.ref,
      });

      // Use GitHub's dedicated PR branch update API (same as "Update branch" button)
      await this.octokit.rest.pulls.updateBranch({
        owner: this.repo.owner,
        repo: this.repo.repo,
        pull_number: prNumber,
        expected_head_sha: previousSha,
      });

      // The API returns 202 Accepted — the merge happens asynchronously.
      // Poll until the head SHA changes to confirm the update completed.
      const newSha = await this.waitForBranchUpdate(prNumber, previousSha);

      this.logger.info('Branch updated successfully', {
        prNumber,
        previousSha,
        sha: newSha,
      });

      return {
        success: true,
        conflict: false,
        sha: newSha,
      };
    } catch (error: unknown) {
      const statusCode = isGitHubError(error) ? error.status : undefined;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 409 or message containing "conflict" → merge conflict
      if (isGitHubError(error) && (error.status === 409 || error.message?.includes('conflict'))) {
        this.logger.warning('Merge conflict detected during branch update', {
          prNumber,
          statusCode,
          errorMessage,
        });

        return {
          success: false,
          conflict: true,
          error: 'Merge conflict detected',
        };
      }

      // 422 Validation Failed — often indicates a merge conflict or
      // that the branch cannot be updated (e.g. head SHA mismatch)
      if (isGitHubError(error) && error.status === 422) {
        this.logger.warning('Branch update validation failed', {
          prNumber,
          statusCode,
          errorMessage,
        });

        return {
          success: false,
          conflict: errorMessage.toLowerCase().includes('conflict'),
          error: `Branch update validation failed: ${errorMessage}`,
        };
      }

      // Any other error — log full details for easier debugging
      this.logger.error('Branch update failed', error as Error, {
        prNumber,
        statusCode,
        errorMessage,
      });

      throw new GitHubAPIError(
        `Failed to update branch for PR #${prNumber} (HTTP ${statusCode ?? 'unknown'}): ${errorMessage}`,
        statusCode,
        error
      );
    }
  }

  /**
   * Poll the PR until its head SHA changes, confirming the async branch
   * update has completed.  Returns the new SHA.
   */
  private async waitForBranchUpdate(
    prNumber: number,
    previousSha: string,
    maxAttempts: number = 10,
    intervalMs: number = 3000
  ): Promise<string> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));

      const pr = await this.getPullRequest(prNumber);
      if (pr.head.sha !== previousSha) {
        return pr.head.sha;
      }

      this.logger.debug('Waiting for branch update to complete', {
        prNumber,
        attempt,
        maxAttempts,
      });
    }

    // Final check
    const pr = await this.getPullRequest(prNumber);
    if (pr.head.sha !== previousSha) {
      return pr.head.sha;
    }

    throw new Error(
      `Branch update did not complete within ${(maxAttempts * intervalMs) / 1000}s for PR #${prNumber}`
    );
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
   * List open PR numbers that have the given label, sorted by creation date
   * (oldest first).
   *
   * Uses the Issues API with a label filter, then keeps only pull requests.
   * Fetches up to 100 results (first page). Logs a warning when the
   * response is full, which may indicate additional results exist.
   */
  async listPRsWithLabel(label: string): Promise<number[]> {
    this.logger.debug('Listing PRs with label', { label });

    const perPage = 100;

    try {
      const { data } = await this.octokit.rest.issues.listForRepo({
        owner: this.repo.owner,
        repo: this.repo.repo,
        labels: label,
        state: 'open',
        sort: 'created',
        direction: 'asc',
        per_page: perPage,
      });

      if (data.length >= perPage) {
        this.logger.warning(
          'listPRsWithLabel response may be truncated — results equal page size',
          { label, count: data.length, perPage }
        );
      }

      // issues.listForRepo returns both issues and PRs — keep only PRs
      const prNumbers = data.filter(issue => issue.pull_request != null).map(issue => issue.number);

      this.logger.debug('Found PRs with label', { label, count: prNumbers.length, prNumbers });
      return prNumbers;
    } catch (error) {
      throw new GitHubAPIError(
        `Failed to list PRs with label "${label}"`,
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
