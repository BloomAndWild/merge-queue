/**
 * Add to Queue Action
 * Validates a PR and adds it to the merge queue
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { GitHubAPI } from '../../core/github-api';
import { QueueStateManager } from '../../core/queue-state';
import { PRValidator } from '../../core/pr-validator';
import { createLogger } from '../../utils/logger';
import { COMMENT_TEMPLATES } from '../../utils/constants';
import { parseRepository, getConfig } from '../../utils/action-helpers';
import type { RepositoryInfo, QueuedPR } from '../../types/queue';

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
    const priority = parseInt(core.getInput('priority') || '0', 10);
    const config = getConfig();

    const logger = createLogger({
      action: 'add-to-queue',
      repo: `${targetRepo.owner}/${targetRepo.repo}`,
      pr: prNumber,
    });

    logger.info('Starting add-to-queue action', {
      targetRepo: `${targetRepo.owner}/${targetRepo.repo}`,
      mergeQueueRepo: `${mergeQueueRepo.owner}/${mergeQueueRepo.repo}`,
      prNumber,
    });

    // Initialize API clients
    const api = new GitHubAPI(token, targetRepo, logger);
    const stateManager = new QueueStateManager(
      token,
      mergeQueueRepo,
      targetRepo,
      logger
    );

    // Validate PR using the shared PRValidator (single source of truth)
    const validator = new PRValidator(api, config, logger);
    const validation = await validator.validate(prNumber);

    if (!validation.valid) {
      logger.warning('PR validation failed', {
        prNumber,
        reason: validation.reason,
      });

      // Add failed label
      await api.addLabels(prNumber, [config.failedLabel]);

      // Remove queue label
      await api.removeLabel(prNumber, config.queueLabel);

      // Add comment
      await api.addComment(
        prNumber,
        COMMENT_TEMPLATES.removedChecksFailure(
          validation.reason || 'Unknown reason'
        )
      );

      core.setOutput('valid', 'false');
      core.setOutput('validation-reason', validation.reason);
      core.setFailed(`PR validation failed: ${validation.reason}`);
      return;
    }

    // Get PR details for queue entry
    const pr = await api.getPullRequest(prNumber);

    // Create queue entry
    const queueEntry: QueuedPR = {
      pr_number: prNumber,
      added_at: new Date().toISOString(),
      added_by: github.context.actor,
      sha: pr.head.sha,
      priority,
    };

    // Add to queue
    const position = await stateManager.addToQueue(queueEntry);

    // Add queued label
    await api.addLabels(prNumber, [config.queuedLabel]);

    // Remove any failure labels
    await api.removeLabel(prNumber, config.failedLabel);
    await api.removeLabel(prNumber, config.conflictLabel);

    // Add comment with position
    await api.addComment(prNumber, COMMENT_TEMPLATES.addedToQueue(position));

    logger.info('PR added to queue successfully', { prNumber, position });

    core.setOutput('position', position.toString());
    core.setOutput('valid', 'true');
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
