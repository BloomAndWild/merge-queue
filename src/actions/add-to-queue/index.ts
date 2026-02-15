/**
 * Add to Queue Action
 * Validates a PR and adds it to the merge queue by applying a label
 */

import * as core from '@actions/core';
import { GitHubAPI } from '../../core/github-api';
import { PRValidator } from '../../core/pr-validator';
import { createLogger } from '../../utils/logger';
import { COMMENT_TEMPLATES } from '../../utils/constants';
import { parseRepository, parsePRNumber, getConfig } from '../../utils/action-helpers';

/**
 * Main action logic
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const targetRepo = parseRepository(core.getInput('repository'));
    const prNumber = parsePRNumber(core.getInput('pr-number'));
    const config = getConfig();

    const logger = createLogger({
      action: 'add-to-queue',
      repo: `${targetRepo.owner}/${targetRepo.repo}`,
      pr: prNumber,
    });

    logger.info('Starting add-to-queue action', {
      targetRepo: `${targetRepo.owner}/${targetRepo.repo}`,
      prNumber,
    });

    // Initialize API client
    const api = new GitHubAPI(token, targetRepo, logger);

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
        COMMENT_TEMPLATES.removedChecksFailure(validation.reason || 'Unknown reason')
      );

      core.setOutput('valid', 'false');
      core.setOutput('validation-reason', validation.reason);
      core.setFailed(`PR validation failed: ${validation.reason}`);
      return;
    }

    // Add queued label
    await api.addLabels(prNumber, [config.queuedLabel]);

    // Remove any failure labels
    await api.removeLabel(prNumber, config.failedLabel);
    await api.removeLabel(prNumber, config.conflictLabel);

    // Add comment
    await api.addComment(prNumber, COMMENT_TEMPLATES.addedToQueue);

    logger.info('PR added to queue successfully', { prNumber });

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
