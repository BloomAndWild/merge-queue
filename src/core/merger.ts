/**
 * PR merger logic for merge queue
 */

import { GitHubAPI } from './github-api';
import { PRValidator } from './pr-validator';
import { Logger, createLogger } from '../utils/logger';
import type { QueueConfig } from '../types/queue';

/**
 * Merge result interface
 */
export interface MergeResultDetails {
  success: boolean;
  sha?: string;
  error?: string;
}

/**
 * PR Merger class
 *
 * Provides a standalone merge-with-validation flow.
 * For more complex orchestration (label management, state tracking),
 * the process-queue action drives the merge directly via GitHubAPI.
 */
export class PRMerger {
  constructor(
    private api: GitHubAPI,
    private validator: PRValidator,
    private config: QueueConfig,
    private logger?: Logger
  ) {
    this.logger = logger || createLogger({ component: 'PRMerger' });
  }

  /**
   * Merge a pull request with pre-merge validation
   */
  async merge(prNumber: number): Promise<MergeResultDetails> {
    this.logger?.info('Attempting to merge PR', {
      prNumber,
      method: this.config.mergeMethod,
    });

    try {
      // Final validation before merge
      this.logger?.debug('Performing final validation', { prNumber });
      const validation = await this.validator.validate(prNumber);

      if (!validation.valid) {
        this.logger?.warning('Pre-merge validation failed', {
          prNumber,
          reason: validation.reason,
        });

        return {
          success: false,
          error: `Validation failed: ${validation.reason}`,
        };
      }

      // Get PR details
      const pr = await this.api.getPullRequest(prNumber);

      // Double-check PR is still open
      if (pr.state !== 'open') {
        return {
          success: false,
          error: `PR is ${pr.state}`,
        };
      }

      // Double-check mergeable
      if (pr.mergeable === false) {
        return {
          success: false,
          error: 'PR has merge conflicts',
        };
      }

      // Perform the merge
      this.logger?.info('Executing merge', { prNumber });

      const mergeCommitSha = await this.api.mergePullRequest(
        prNumber,
        this.config.mergeMethod,
        undefined, // Use default commit title
        `Merged via merge queue\n\nCo-authored-by: ${pr.user?.login || 'unknown'}`
      );

      this.logger?.info('PR merged successfully', {
        prNumber,
        sha: mergeCommitSha,
      });

      return {
        success: true,
        sha: mergeCommitSha,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger?.error('Merge failed', error as Error, { prNumber });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Post-merge cleanup
   */
  async cleanup(
    prNumber: number,
    branchName: string | null,
    labels: string[]
  ): Promise<void> {
    this.logger?.info('Performing post-merge cleanup', {
      prNumber,
      branchName,
      labels,
    });

    try {
      // Remove queue-related labels
      for (const label of labels) {
        await this.api.removeLabel(prNumber, label);
      }

      // Delete branch if configured
      if (this.config.deleteBranchAfterMerge && branchName) {
        await this.api.deleteBranch(branchName);
      }

      this.logger?.info('Post-merge cleanup complete', { prNumber });
    } catch (error) {
      // Log but don't throw - cleanup failures shouldn't fail the merge
      this.logger?.warning('Post-merge cleanup had errors', {
        prNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
