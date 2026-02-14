/**
 * Remove from Queue Action
 * Removes a PR from the merge queue
 */

import * as core from '@actions/core';
import { GitHubAPI } from '../../core/github-api';
import { QueueStateManager } from '../../core/queue-state';
import { createLogger } from '../../utils/logger';
import { parseRepository } from '../../utils/action-helpers';
import type { RepositoryInfo } from '../../types/queue';

/**
 * Main action logic
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const targetRepo = parseRepository(core.getInput('repository'));
    const prNumber = parseInt(core.getInput('pr-number'), 10);
    const mergeQueueRepo: RepositoryInfo = {
      owner: core.getInput('merge-queue-owner'),
      repo: core.getInput('merge-queue-repo'),
    };
    const reason = core.getInput('reason') || 'Manual removal';

    const queuedLabel = core.getInput('queued-label');
    const processingLabel = core.getInput('processing-label');
    const updatingLabel = core.getInput('updating-label');

    const logger = createLogger({
      action: 'remove-from-queue',
      repo: `${targetRepo.owner}/${targetRepo.repo}`,
      pr: prNumber,
    });

    logger.info('Starting remove-from-queue action', {
      targetRepo: `${targetRepo.owner}/${targetRepo.repo}`,
      mergeQueueRepo: `${mergeQueueRepo.owner}/${mergeQueueRepo.repo}`,
      prNumber,
      reason,
    });

    // Initialize API clients
    const api = new GitHubAPI(token, targetRepo, logger);
    const stateManager = new QueueStateManager(
      token,
      mergeQueueRepo,
      targetRepo,
      logger
    );

    // Remove from queue
    const removed = await stateManager.removeFromQueue(prNumber);

    if (removed) {
      logger.info('PR removed from queue', { prNumber, reason });

      // Remove queue-related labels
      await api.removeLabel(prNumber, queuedLabel);
      await api.removeLabel(prNumber, processingLabel);
      await api.removeLabel(prNumber, updatingLabel);

      core.setOutput('removed', 'true');
    } else {
      logger.warning('PR was not in queue', { prNumber });
      core.setOutput('removed', 'false');
    }
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
