/**
 * Process Queue Action
 * Main queue processor that validates, updates, and merges PRs.
 *
 * Uses GitHub labels as the source of truth instead of a state file:
 * - `queued-for-merge` label = PR is waiting in the queue
 * - `merge-processing` label = PR is currently being processed
 */

import * as core from '@actions/core';
import { GitHubAPI } from '../../core/github-api';
import { PRValidator } from '../../core/pr-validator';
import { BranchUpdater } from '../../core/branch-updater';
import { createLogger } from '../../utils/logger';
import { COMMENT_TEMPLATES } from '../../utils/constants';
import type { ProcessingStep } from '../../utils/constants';
import { parseRepository, getConfig } from '../../utils/action-helpers';
import type { MergeResult } from '../../types/queue';

/**
 * Process a single PR from the queue
 */
export async function processPR(
  api: GitHubAPI,
  validator: PRValidator,
  updater: BranchUpdater,
  prNumber: number,
  config: ReturnType<typeof getConfig>,
  logger: ReturnType<typeof createLogger>
): Promise<MergeResult> {
  let result: MergeResult = 'failed';
  const steps: ProcessingStep[] = [];
  let summaryTitle = 'Removed from Queue';

  try {
    logger.info('Processing PR', { prNumber });

    // Add processing label, remove queued label
    await api.addLabels(prNumber, [config.processingLabel]);
    await api.removeLabel(prNumber, config.queuedLabel);

    // Validate PR
    logger.info('Validating PR', { prNumber });
    const validation = await validator.validate(prNumber);

    if (!validation.valid) {
      logger.warning('PR validation failed', {
        prNumber,
        reason: validation.reason,
      });

      steps.push({
        label: 'Validation failed — checks no longer passing',
        status: 'failure',
        detail: validation.reason || 'Unknown reason',
      });

      // Add failed label
      await api.addLabels(prNumber, [config.failedLabel]);
      await api.removeLabel(prNumber, config.processingLabel);
      await api.removeLabel(prNumber, config.queueLabel);

      result = 'failed';
      return result;
    }

    steps.push({ label: 'Validation passed', status: 'success' });

    // Check staleness and update branch in a retry loop.
    // If the base branch advances while we wait for CI (e.g. someone manually
    // merges another PR), we re-update and re-test before merging.
    let isBehind = validation.checks?.upToDate === false;
    let updateAttempts = 0;

    if (!isBehind) {
      steps.push({ label: 'Branch already up to date', status: 'success' });
    }

    while (isBehind && config.autoUpdateBranch) {
      updateAttempts++;

      if (updateAttempts > config.maxUpdateRetries) {
        logger.warning('Exceeded max update retries — base branch keeps advancing', {
          prNumber,
          attempts: updateAttempts - 1,
          maxRetries: config.maxUpdateRetries,
        });

        steps.push({
          label: `Branch update retries exhausted (${config.maxUpdateRetries}/${config.maxUpdateRetries})`,
          status: 'failure',
          detail: 'The base branch kept advancing while waiting for CI. Please re-queue.',
        });

        await api.addLabels(prNumber, [config.failedLabel]);
        await api.removeLabel(prNumber, config.processingLabel);
        await api.removeLabel(prNumber, config.queueLabel);

        result = 'failed';
        return result;
      }

      if (updateAttempts > 1) {
        logger.info('Base branch advanced during CI wait, re-updating...', {
          prNumber,
          attempt: updateAttempts,
          maxRetries: config.maxUpdateRetries,
        });

        steps.push({
          label: `Branch went stale, re-updating (attempt ${updateAttempts}/${config.maxUpdateRetries})`,
          status: 'success',
        });
      }

      logger.info('PR branch is behind, updating...', { prNumber, attempt: updateAttempts });

      // Add updating label
      await api.addLabels(prNumber, [config.updatingLabel]);

      // Update the branch
      const updateResult = await updater.updateIfBehind(prNumber);

      // Remove updating label
      await api.removeLabel(prNumber, config.updatingLabel);

      if (updateResult.conflict) {
        logger.warning('Merge conflict detected', { prNumber });

        steps.push({
          label: 'Branch update failed — merge conflict detected',
          status: 'failure',
          detail: 'Please resolve conflicts and add the ready label again to re-queue.',
        });

        // Add conflict label
        await api.addLabels(prNumber, [config.conflictLabel]);
        await api.removeLabel(prNumber, config.processingLabel);
        await api.removeLabel(prNumber, config.queueLabel);

        summaryTitle = 'Merge Conflict';
        result = 'conflict';
        return result;
      }

      if (!updateResult.success) {
        logger.warning('Branch update failed', {
          prNumber,
          error: updateResult.error,
        });

        steps.push({
          label: 'Tests failed after branch update',
          status: 'failure',
          detail: updateResult.error || 'Unknown error',
        });

        // Add failed label
        await api.addLabels(prNumber, [config.failedLabel]);
        await api.removeLabel(prNumber, config.processingLabel);
        await api.removeLabel(prNumber, config.queueLabel);

        result = 'failed';
        return result;
      }

      logger.info('Branch updated and tests passed', { prNumber });
      steps.push({
        label: 'Branch updated with latest base',
        status: 'success',
      });
      steps.push({ label: 'Tests passed after update', status: 'success' });

      // Re-check staleness before proceeding to merge — the base branch
      // may have advanced again while we were waiting for CI.
      isBehind = await validator.isBehind(prNumber);
    }

    // If the branch is behind and auto-update is disabled, we cannot merge safely.
    if (isBehind && !config.autoUpdateBranch) {
      logger.warning('Branch is behind base and auto-update is disabled', { prNumber });

      steps.push({
        label: 'Branch is behind base branch',
        status: 'failure',
        detail: 'Auto-update is disabled. Please update the branch manually and re-queue.',
      });

      await api.addLabels(prNumber, [config.failedLabel]);
      await api.removeLabel(prNumber, config.processingLabel);
      await api.removeLabel(prNumber, config.queueLabel);

      result = 'failed';
      return result;
    }

    // Final staleness gate — catches the case where the branch was initially
    // up-to-date but main advanced before we reached the merge call.
    const finalBehindCheck = await validator.isBehind(prNumber);
    if (finalBehindCheck) {
      logger.warning('Branch became stale just before merge', { prNumber });

      steps.push({
        label: 'Branch became stale before merge — base branch advanced',
        status: 'failure',
        detail: 'The base branch advanced after validation. Please re-queue.',
      });

      await api.addLabels(prNumber, [config.failedLabel]);
      await api.removeLabel(prNumber, config.processingLabel);
      await api.removeLabel(prNumber, config.queueLabel);

      result = 'failed';
      return result;
    }

    // Merge the PR
    logger.info('Merging PR', { prNumber, method: config.mergeMethod });

    const pr = await api.getPullRequest(prNumber);
    const mergeCommitSha = await api.mergePullRequest(prNumber, config.mergeMethod);

    logger.info('PR merged successfully', {
      prNumber,
      sha: mergeCommitSha,
    });

    // Delete branch if configured
    if (config.deleteBranchAfterMerge && pr.head.ref) {
      await api.deleteBranch(pr.head.ref);
    }

    // Remove labels
    await api.removeLabel(prNumber, config.processingLabel);
    await api.removeLabel(prNumber, config.queueLabel);

    steps.push({ label: 'Merged successfully', status: 'success' });
    summaryTitle = 'Merged Successfully';
    result = 'merged';
    return result;
  } catch (error) {
    logger.error('Error processing PR', error as Error, { prNumber });
    result = 'failed';

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    steps.push({
      label: 'Error occurred',
      status: 'failure',
      detail: errorMessage,
    });
    summaryTitle = 'Error';

    try {
      // Attempt cleanup on error — wrapped so cleanup failures don't mask
      // the original error
      await api.addLabels(prNumber, [config.failedLabel]);
      await api.removeLabel(prNumber, config.processingLabel);
      await api.removeLabel(prNumber, config.queueLabel);
    } catch (cleanupError) {
      logger.error('Failed to clean up after error', cleanupError as Error, {
        prNumber,
      });
    }

    return result;
  } finally {
    // Post a single summary comment with all processing steps
    try {
      await api.addComment(prNumber, COMMENT_TEMPLATES.buildSummary(summaryTitle, steps));
    } catch (commentError) {
      logger.error('Failed to post summary comment', commentError as Error, { prNumber });
    }
  }
}

/**
 * Main action logic
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const targetRepo = parseRepository(core.getInput('repository'));
    const config = getConfig();

    const logger = createLogger({
      action: 'process-queue',
      repo: `${targetRepo.owner}/${targetRepo.repo}`,
    });

    logger.info('Starting process-queue action', {
      targetRepo: `${targetRepo.owner}/${targetRepo.repo}`,
    });

    // Initialize clients
    const api = new GitHubAPI(token, targetRepo, logger);
    const validator = new PRValidator(api, config, logger);
    const updater = new BranchUpdater(api, validator, config, logger);

    // Check if a PR is already being processed (resume after crash)
    const processingPRs = await api.listPRsWithLabel(config.processingLabel);
    let prNumber: number | undefined;

    if (processingPRs.length > 0) {
      prNumber = processingPRs[0];
      logger.info('Resuming previously processing PR', { prNumber });
    } else {
      // Get next PR from queue (oldest first)
      const queuedPRs = await api.listPRsWithLabel(config.queuedLabel);

      if (queuedPRs.length === 0) {
        logger.info('Queue is empty, nothing to process');
        core.setOutput('processed', 'false');
        core.setOutput('result', 'none');
        return;
      }

      prNumber = queuedPRs[0];
      logger.info('Found PR in queue', { prNumber });
    }

    // Check if PR still exists and is open
    try {
      const pr = await api.getPullRequest(prNumber);
      if (pr.state !== 'open') {
        logger.warning('PR is no longer open, removing from queue', {
          prNumber,
          state: pr.state,
        });

        await api.removeLabel(prNumber, config.queuedLabel);
        await api.removeLabel(prNumber, config.processingLabel);

        core.setOutput('processed', 'false');
        core.setOutput('pr-number', prNumber.toString());
        core.setOutput('result', 'removed');
        return;
      }
    } catch (_error) {
      logger.warning('PR not found, cleaning up labels', { prNumber });

      await api.removeLabel(prNumber, config.queuedLabel);
      await api.removeLabel(prNumber, config.processingLabel);

      core.setOutput('processed', 'false');
      core.setOutput('pr-number', prNumber.toString());
      core.setOutput('result', 'removed');
      return;
    }

    // Process the PR
    const result = await processPR(api, validator, updater, prNumber, config, logger);

    logger.info('PR processing complete', {
      prNumber,
      result,
    });

    core.setOutput('processed', 'true');
    core.setOutput('pr-number', prNumber.toString());
    core.setOutput('result', result);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

// Run the action
void run();
