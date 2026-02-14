/**
 * Remove from Queue Action
 * Removes a PR from the merge queue by removing its labels
 */

import * as core from '@actions/core';
import { GitHubAPI } from '../../core/github-api';
import { createLogger } from '../../utils/logger';
import { parseRepository } from '../../utils/action-helpers';

/**
 * Main action logic
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const targetRepo = parseRepository(core.getInput('repository'));
    const prNumber = parseInt(core.getInput('pr-number'), 10);
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
      prNumber,
      reason,
    });

    // Initialize API client
    const api = new GitHubAPI(token, targetRepo, logger);

    // Remove queue-related labels
    await api.removeLabel(prNumber, queuedLabel);
    await api.removeLabel(prNumber, processingLabel);
    await api.removeLabel(prNumber, updatingLabel);

    logger.info('PR removed from queue', { prNumber, reason });
    core.setOutput('removed', 'true');
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
