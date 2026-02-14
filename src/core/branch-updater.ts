/**
 * Branch updater logic for merge queue
 * Handles automatic branch updates when PR is behind master
 */

import { GitHubAPI } from './github-api';
import { PRValidator } from './pr-validator';
import { Logger, createLogger } from '../utils/logger';
import { TimeoutError } from '../utils/errors';
import { TIMEOUTS } from '../utils/constants';
import type { QueueConfig, UpdateResult } from '../types/queue';

/**
 * Branch Updater class
 */
export class BranchUpdater {
  constructor(
    private api: GitHubAPI,
    private validator: PRValidator,
    private config: QueueConfig,
    private logger?: Logger
  ) {
    this.logger = logger || createLogger({ component: 'BranchUpdater' });
  }

  /**
   * Update PR branch with base branch if it's behind
   * Returns true if update was successful and tests passed
   */
  async updateIfBehind(prNumber: number): Promise<UpdateResult> {
    this.logger?.info('Checking if PR branch is behind', { prNumber });

    const isBehind = await this.validator.isBehind(prNumber);

    if (!isBehind) {
      this.logger?.info('PR branch is up to date', { prNumber });
      return {
        success: true,
        conflict: false,
      };
    }

    this.logger?.info('PR branch is behind, updating...', { prNumber });

    // Update the branch (merge base into head)
    const updateResult = await this.api.updateBranch(prNumber);

    if (!updateResult.success) {
      this.logger?.warning('Branch update failed', {
        prNumber,
        conflict: updateResult.conflict,
        error: updateResult.error,
      });
      return updateResult;
    }

    this.logger?.info('Branch updated successfully, waiting for tests...', {
      prNumber,
      sha: updateResult.sha,
    });

    // Wait for status checks to complete
    const testsPass = await this.waitForTests(prNumber, updateResult.sha!);

    if (!testsPass) {
      this.logger?.warning('Tests failed after branch update', { prNumber });
      return {
        success: false,
        conflict: false,
        error: 'Tests failed after branch update',
      };
    }

    this.logger?.info('Tests passed after branch update', { prNumber });

    return {
      success: true,
      conflict: false,
      sha: updateResult.sha,
    };
  }

  /**
   * Wait for status checks to complete after branch update
   * Polls every 30 seconds up to the configured timeout
   */
  async waitForTests(prNumber: number, sha: string): Promise<boolean> {
    const startTime = Date.now();
    const timeoutMs = this.config.updateTimeoutMinutes * 60 * 1000;
    const pollInterval = TIMEOUTS.checkStatusPollMs;

    this.logger?.info('Waiting for tests to complete', {
      prNumber,
      sha,
      timeoutMinutes: this.config.updateTimeoutMinutes,
    });

    while (Date.now() - startTime < timeoutMs) {
      // Check if PR is still open
      const pr = await this.api.getPullRequest(prNumber);
      if (pr.state !== 'open') {
        this.logger?.warning('PR is no longer open', { prNumber, state: pr.state });
        return false;
      }

      // Check status of the new commit
      const checkResult = await this.validator.checkStatusChecks(sha);

      if (checkResult.valid) {
        // All checks passed
        this.logger?.info('All tests passed', { prNumber, sha });
        return true;
      }

      // Check if any checks failed (not just pending)
      const checks = await this.api.getCommitStatus(sha);
      const hasFailures = checks.some(
        c => c.status === 'failure' || c.status === 'cancelled'
      );

      if (hasFailures) {
        this.logger?.warning('Tests failed', {
          prNumber,
          sha,
          failedChecks: checks
            .filter(c => c.status === 'failure' || c.status === 'cancelled')
            .map(c => c.name),
        });
        return false;
      }

      // Still pending, wait and retry
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      this.logger?.debug('Tests still pending, waiting...', {
        prNumber,
        sha,
        elapsedSeconds: elapsed,
      });

      await this.sleep(pollInterval);
    }

    // Timeout reached
    this.logger?.error(
      'Timeout waiting for tests',
      new TimeoutError('Test timeout', timeoutMs),
      { prNumber, sha, timeoutMs }
    );

    throw new TimeoutError(
      `Tests did not complete within ${this.config.updateTimeoutMinutes} minutes`,
      timeoutMs
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
