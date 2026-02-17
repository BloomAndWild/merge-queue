/**
 * PR validation logic for merge queue
 *
 * Approval validation is always enforced — the validator requires at least
 * one approving review with no outstanding "changes requested" reviews.
 * This provides defense in depth: even if the PAT used by the merge queue
 * has admin privileges that could bypass branch protection rules, the
 * merge queue itself will refuse to merge unapproved PRs.
 */

import { GitHubAPI } from './github-api';
import { Logger, createLogger } from '../utils/logger';
import type { QueueConfig, ValidationResult } from '../types/queue';

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
            approved: false,
            checksPass: false,
            notDraft: false,
            noBlockLabels: false,
            upToDate: false,
            noConflicts: false,
          },
        };
      }
      const notDraft = true;

      // Check for at least one approving review with no outstanding changes requested
      const approvalResult = await this.checkApproval(prNumber);
      if (!approvalResult.valid) {
        return {
          valid: false,
          reason: approvalResult.reason,
          checks: {
            approved: false,
            checksPass: false,
            notDraft,
            noBlockLabels: false,
            upToDate: false,
            noConflicts: false,
          },
        };
      }
      const approved = true;

      // Check for blocking labels (filter undefined label names for type safety)
      const prLabels = pr.labels.map(l => l.name).filter((name): name is string => name != null);
      const blockingLabels = this.config.blockLabels.filter(label => prLabels.includes(label));

      if (blockingLabels.length > 0) {
        return {
          valid: false,
          reason: `PR has blocking label: ${blockingLabels.join(', ')}`,
          checks: {
            approved,
            checksPass: false,
            notDraft,
            noBlockLabels: false,
            upToDate: false,
            noConflicts: false,
          },
        };
      }
      const noBlockLabels = true;

      // Check status checks
      const checksPass = await this.checkStatusChecks(pr.head.sha);
      if (!checksPass.valid) {
        return {
          valid: false,
          reason: checksPass.reason,
          checks: {
            approved,
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
            approved,
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
          approved,
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
   * Check that the PR has at least one approving review and no outstanding
   * "changes requested" reviews.  Only the latest review per reviewer is
   * considered (a reviewer who requested changes and later approved counts
   * as approved).
   */
  async checkApproval(prNumber: number): Promise<{ valid: boolean; reason?: string }> {
    const reviews = await this.api.getPRReviews(prNumber);

    // Keep only the latest review per reviewer (reviews come chronologically)
    const latestByUser = new Map<string, string>();
    for (const review of reviews) {
      const user = review.user?.login;
      if (!user) continue;
      // Only track meaningful review states
      if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) {
        latestByUser.set(user, review.state);
      }
    }

    const hasApproval = [...latestByUser.values()].some(state => state === 'APPROVED');
    const hasChangesRequested = [...latestByUser.values()].some(
      state => state === 'CHANGES_REQUESTED'
    );

    if (hasChangesRequested) {
      return {
        valid: false,
        reason: 'PR has outstanding "changes requested" reviews',
      };
    }

    if (!hasApproval) {
      return {
        valid: false,
        reason: 'PR has no approving reviews',
      };
    }

    return { valid: true };
  }

  /**
   * Check if all required status checks pass.
   *
   * Checks whose name appears in `config.ignoreChecks` are excluded from
   * evaluation.  This prevents the merge queue's own workflow checks from
   * creating a circular dependency where a previous failed run blocks the
   * PR from being re-queued.
   */
  async checkStatusChecks(sha: string): Promise<{ valid: boolean; reason?: string }> {
    const allChecks = await this.api.getCommitStatus(sha);

    // Exclude checks the user has explicitly asked to ignore
    const ignored = this.config.ignoreChecks;
    const checks =
      ignored.length > 0 ? allChecks.filter(c => !ignored.includes(c.name)) : allChecks;

    if (ignored.length > 0) {
      const skipped = allChecks.length - checks.length;
      if (skipped > 0) {
        this.logger?.debug('Ignored checks during validation', {
          sha,
          skippedCount: skipped,
          ignoredNames: ignored,
        });
      }
    }

    // Filter for failed checks
    const failedChecks = checks.filter(c => c.status === 'failure' || c.status === 'cancelled');

    if (failedChecks.length > 0) {
      return {
        valid: false,
        reason: `Failed checks: ${failedChecks.map(c => c.name).join(', ')}`,
      };
    }

    // Filter for pending checks
    if (!this.config.allowPendingChecks) {
      const pendingChecks = checks.filter(c => c.status === 'pending');

      if (pendingChecks.length > 0) {
        return {
          valid: false,
          reason: `Pending checks: ${pendingChecks.map(c => c.name).join(', ')}`,
        };
      }
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
