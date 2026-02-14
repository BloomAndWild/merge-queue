/**
 * PR validation logic for merge queue
 */

import { GitHubAPI } from './github-api';
import { Logger, createLogger } from '../utils/logger';
import type { QueueConfig, ValidationResult } from '../types/queue';

/**
 * Result of evaluating PR reviews (approvals and change requests)
 */
interface ReviewEvaluation {
  approvalCount: number;
  hasChangeRequests: boolean;
}

/**
 * PR Validator class
 */
export class PRValidator {
  constructor(
    private api: GitHubAPI,
    private config: QueueConfig,
    private logger?: Logger
  ) {
    this.logger = logger || createLogger({ component: 'PRValidator' });
  }

  /**
   * Validate PR meets all merge requirements
   */
  async validate(prNumber: number): Promise<ValidationResult> {
    this.logger?.info('Validating PR', { prNumber });

    try {
      const pr = await this.api.getPullRequest(prNumber);

      // Check if PR is still open
      if (pr.state !== 'open') {
        return {
          valid: false,
          reason: `PR is ${pr.state}`,
        };
      }

      // Check if draft
      if (pr.draft && !this.config.allowDraft) {
        return {
          valid: false,
          reason: 'PR is in draft state',
          checks: {
            hasApprovals: false,
            checksPass: false,
            notDraft: false,
            noBlockLabels: false,
            upToDate: false,
            noConflicts: false,
          },
        };
      }
      const notDraft = true;

      // Check for blocking labels (filter undefined label names for type safety)
      const prLabels = pr.labels
        .map(l => l.name)
        .filter((name): name is string => name != null);
      const blockingLabels = this.config.blockLabels.filter(label =>
        prLabels.includes(label)
      );

      if (blockingLabels.length > 0) {
        return {
          valid: false,
          reason: `PR has blocking label: ${blockingLabels.join(', ')}`,
          checks: {
            hasApprovals: false,
            checksPass: false,
            notDraft,
            noBlockLabels: false,
            upToDate: false,
            noConflicts: false,
          },
        };
      }
      const noBlockLabels = true;

      // Fetch reviews ONCE for all review-related checks
      const reviews = await this.api.getPRReviews(prNumber);
      const { approvalCount, hasChangeRequests } =
        this.evaluateReviews(reviews);
      const hasEnoughApprovals =
        approvalCount >= this.config.requiredApprovals;

      // Check for change requests first (more actionable than "insufficient approvals")
      if (hasChangeRequests) {
        return {
          valid: false,
          reason: 'Changes requested on PR',
          checks: {
            hasApprovals: hasEnoughApprovals,
            checksPass: false,
            notDraft,
            noBlockLabels,
            upToDate: false,
            noConflicts: false,
          },
        };
      }

      // Check approvals
      if (!hasEnoughApprovals) {
        return {
          valid: false,
          reason: `Insufficient approvals: ${approvalCount}/${this.config.requiredApprovals}`,
          checks: {
            hasApprovals: false,
            checksPass: false,
            notDraft,
            noBlockLabels,
            upToDate: false,
            noConflicts: false,
          },
        };
      }

      // Check status checks
      const checksPass = await this.checkStatusChecks(pr.head.sha);
      if (!checksPass.valid) {
        return {
          valid: false,
          reason: checksPass.reason,
          checks: {
            hasApprovals: true,
            checksPass: false,
            notDraft,
            noBlockLabels,
            upToDate: false,
            noConflicts: false,
          },
        };
      }

      // Check if branch is up to date (not behind base)
      const upToDate = !(await this.api.isBranchBehind(prNumber));

      // Check if mergeable (no conflicts)
      const noConflicts = pr.mergeable !== false;
      if (!noConflicts) {
        return {
          valid: false,
          reason: 'PR has merge conflicts',
          checks: {
            hasApprovals: true,
            checksPass: true,
            notDraft,
            noBlockLabels,
            upToDate,
            noConflicts: false,
          },
        };
      }

      this.logger?.info('PR validation passed', { prNumber });

      return {
        valid: true,
        checks: {
          hasApprovals: true,
          checksPass: true,
          notDraft,
          noBlockLabels,
          upToDate,
          noConflicts,
        },
      };
    } catch (error) {
      this.logger?.error('PR validation error', error as Error, { prNumber });
      throw error;
    }
  }

  /**
   * Check if PR has required approvals (public convenience method).
   * Fetches reviews from the API and delegates to evaluateReviews.
   */
  async checkApprovals(prNumber: number): Promise<boolean> {
    const reviews = await this.api.getPRReviews(prNumber);
    const { approvalCount, hasChangeRequests } = this.evaluateReviews(reviews);
    return !hasChangeRequests && approvalCount >= this.config.requiredApprovals;
  }

  /**
   * Evaluate reviews to determine approval count and change-request status.
   *
   * Uses a non-mutating reverse so the original array is untouched.
   * Iterates newest-first and keeps only the latest review per user.
   */
  private evaluateReviews(
    reviews: Array<{ state: string; user: { login: string } | null }>
  ): ReviewEvaluation {
    const latestReviews = new Map<string, string>();

    // Iterate newest → oldest (non-mutating copy) and keep first entry per user
    for (const review of [...reviews].reverse()) {
      if (review.user && !latestReviews.has(review.user.login)) {
        latestReviews.set(review.user.login, review.state);
      }
    }

    const approvalCount = Array.from(latestReviews.values()).filter(
      state => state === 'APPROVED'
    ).length;

    const hasChangeRequests = Array.from(latestReviews.values()).some(
      state => state === 'CHANGES_REQUESTED'
    );

    return { approvalCount, hasChangeRequests };
  }

  /**
   * Check if all required status checks pass
   */
  async checkStatusChecks(
    sha: string
  ): Promise<{ valid: boolean; reason?: string }> {
    if (!this.config.requireAllChecks) {
      return { valid: true };
    }

    const checks = await this.api.getCommitStatus(sha);

    // Filter for failed checks
    const failedChecks = checks.filter(
      c => c.status === 'failure' || c.status === 'cancelled'
    );

    if (failedChecks.length > 0) {
      return {
        valid: false,
        reason: `Failed checks: ${failedChecks.map(c => c.name).join(', ')}`,
      };
    }

    // Filter for pending checks
    const pendingChecks = checks.filter(c => c.status === 'pending');

    if (pendingChecks.length > 0) {
      return {
        valid: false,
        reason: `Pending checks: ${pendingChecks.map(c => c.name).join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Check if PR branch is behind base branch
   */
  async isBehind(prNumber: number): Promise<boolean> {
    return this.api.isBranchBehind(prNumber);
  }
}
