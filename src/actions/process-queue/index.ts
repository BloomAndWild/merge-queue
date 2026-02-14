/**
 * Process Queue Action
 * Main queue processor that validates, updates, and merges PRs
 */

import * as core from '@actions/core';
import { GitHubAPI } from '../../core/github-api';
import { QueueStateManager } from '../../core/queue-state';
import { PRValidator } from '../../core/pr-validator';
import { BranchUpdater } from '../../core/branch-updater';
import { createLogger } from '../../utils/logger';
import { COMMENT_TEMPLATES } from '../../utils/constants';
import type { ProcessingStep } from '../../utils/constants';
import { parseRepository, getConfig } from '../../utils/action-helpers';
import type {
  RepositoryInfo,
  HistoryEntry,
  MergeResult,
} from '../../types/queue';

/**
 * Process a single PR from the queue
 */
async function processPR(
  api: GitHubAPI,
  stateManager: QueueStateManager,
  validator: PRValidator,
  updater: BranchUpdater,
  prNumber: number,
  config: ReturnType<typeof getConfig>,
  logger: ReturnType<typeof createLogger>
): Promise<MergeResult> {
  const startTime = Date.now();
  let result: MergeResult = 'failed';
  const steps: ProcessingStep[] = [];
  let summaryTitle = 'Removed from Queue';

  try {
    logger.info('Processing PR', { prNumber });

    // Set as current PR
    await stateManager.setCurrentPR({
      pr_number: prNumber,
      status: 'validating',
      started_at: new Date().toISOString(),
      updated_at: null,
    });

    // Add processing label
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

    // Check if branch needs updating
    if (
      validation.checks &&
      !validation.checks.upToDate &&
      config.autoUpdateBranch
    ) {
      logger.info('PR branch is behind, updating...', { prNumber });

      // Update status
      await stateManager.updateCurrentStatus(
        'updating_branch',
        new Date().toISOString()
      );

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
          detail:
            'Please resolve conflicts and add the ready label again to re-queue.',
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
        label: 'Branch updated with latest master',
        status: 'success',
      });
      steps.push({ label: 'Tests passed after update', status: 'success' });
    } else {
      steps.push({ label: 'Branch already up to date', status: 'success' });
    }

    // Merge the PR
    logger.info('Merging PR', { prNumber, method: config.mergeMethod });

    await stateManager.updateCurrentStatus('merging');

    const pr = await api.getPullRequest(prNumber);
    const mergeCommitSha = await api.mergePullRequest(
      prNumber,
      config.mergeMethod
    );

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

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
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
      await api.addComment(
        prNumber,
        COMMENT_TEMPLATES.buildSummary(summaryTitle, steps)
      );
    } catch (commentError) {
      logger.error(
        'Failed to post summary comment',
        commentError as Error,
        { prNumber }
      );
    }

    // Record in history — wrapped so history errors don't mask earlier ones
    try {
      const duration = Math.round((Date.now() - startTime) / 1000);

      const historyEntry: HistoryEntry = {
        pr_number: prNumber,
        result,
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
      };

      await stateManager.completeCurrentPR(historyEntry);
    } catch (historyError) {
      logger.error('Failed to record history entry', historyError as Error, {
        prNumber,
      });
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
    const mergeQueueRepo: RepositoryInfo = {
      owner: core.getInput('merge-queue-owner'),
      repo: core.getInput('merge-queue-repo'),
    };
    const config = getConfig();

    const logger = createLogger({
      action: 'process-queue',
      repo: `${targetRepo.owner}/${targetRepo.repo}`,
    });

    logger.info('Starting process-queue action', {
      targetRepo: `${targetRepo.owner}/${targetRepo.repo}`,
      mergeQueueRepo: `${mergeQueueRepo.owner}/${mergeQueueRepo.repo}`,
    });

    // Initialize clients
    const api = new GitHubAPI(token, targetRepo, logger);
    const stateManager = new QueueStateManager(
      token,
      mergeQueueRepo,
      targetRepo,
      logger
    );
    const validator = new PRValidator(api, config, logger);
    const updater = new BranchUpdater(api, validator, config, logger);

    // Get next PR from queue
    const nextPR = await stateManager.getNextPR();

    if (!nextPR) {
      logger.info('Queue is empty, nothing to process');
      core.setOutput('processed', 'false');
      core.setOutput('result', 'none');
      return;
    }

    logger.info('Found PR in queue', {
      prNumber: nextPR.pr_number,
      addedAt: nextPR.added_at,
    });

    // Check if PR still exists and is open
    try {
      const pr = await api.getPullRequest(nextPR.pr_number);
      if (pr.state !== 'open') {
        logger.warning('PR is no longer open, removing from queue', {
          prNumber: nextPR.pr_number,
          state: pr.state,
        });

        await stateManager.removeFromQueue(nextPR.pr_number);

        core.setOutput('processed', 'false');
        core.setOutput('pr-number', nextPR.pr_number.toString());
        core.setOutput('result', 'removed');
        return;
      }
    } catch (_error) {
      logger.warning('PR not found, removing from queue', {
        prNumber: nextPR.pr_number,
      });

      await stateManager.removeFromQueue(nextPR.pr_number);

      core.setOutput('processed', 'false');
      core.setOutput('pr-number', nextPR.pr_number.toString());
      core.setOutput('result', 'removed');
      return;
    }

    // Process the PR
    const result = await processPR(
      api,
      stateManager,
      validator,
      updater,
      nextPR.pr_number,
      config,
      logger
    );

    logger.info('PR processing complete', {
      prNumber: nextPR.pr_number,
      result,
    });

    core.setOutput('processed', 'true');
    core.setOutput('pr-number', nextPR.pr_number.toString());
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
