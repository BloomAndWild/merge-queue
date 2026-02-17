/**
 * Notify Action
 * Sends a Slack notification with the result of merge queue processing.
 *
 * This action is designed to run as a step after process-queue and uses
 * its outputs (pr-number, result) to build a rich Block Kit message.
 *
 * Notification failures are logged as warnings — they never fail the
 * workflow so that queue processing is not blocked by Slack outages.
 */

import * as core from '@actions/core';
import { GitHubAPI } from '../../core/github-api';
import { buildSlackPayload, sendSlackNotification } from '../../core/slack-notifier';
import { createLogger } from '../../utils/logger';
import { parseRepository, parsePRNumber } from '../../utils/action-helpers';
import type { MergeResult } from '../../types/queue';

const VALID_RESULTS: MergeResult[] = ['merged', 'failed', 'conflict', 'removed', 'rejected'];

/**
 * Main action logic
 */
async function run(): Promise<void> {
  try {
    const webhookUrl = core.getInput('slack-webhook-url', { required: true });
    const token = core.getInput('github-token', { required: true });
    const targetRepo = parseRepository(core.getInput('repository'));
    const prNumber = parsePRNumber(core.getInput('pr-number'));
    const result = core.getInput('result') as MergeResult;
    const reason = core.getInput('reason') || undefined;

    const logger = createLogger({
      action: 'notify',
      repo: `${targetRepo.owner}/${targetRepo.repo}`,
      pr: prNumber,
    });

    // Validate result input
    if (!VALID_RESULTS.includes(result)) {
      logger.info('Skipping notification — result not recognised', { result });
      core.setOutput('notified', 'false');
      return;
    }

    // Build payload first to check if this result type is notification-worthy
    // (buildSlackPayload returns null for non-notifiable results like 'removed')
    // We need PR details for the payload, but avoid the API call if we won't notify.
    const payloadCheck = buildSlackPayload({
      result,
      pr: { number: prNumber, title: '', author: '', url: '', repository: '' },
      reason,
    });

    if (!payloadCheck) {
      logger.info('Skipping notification — result type not notifiable', {
        result,
      });
      core.setOutput('notified', 'false');
      return;
    }

    // Fetch PR details from GitHub
    logger.info('Fetching PR details for notification', { prNumber });
    const api = new GitHubAPI(token, targetRepo, logger);
    const pr = await api.getPullRequest(prNumber);

    const payload = buildSlackPayload({
      result,
      pr: {
        number: prNumber,
        title: pr.title,
        author: pr.user?.login ?? 'unknown',
        url: pr.html_url,
        repository: `${targetRepo.owner}/${targetRepo.repo}`,
      },
      reason,
    });

    if (!payload) {
      // Shouldn't happen given the check above, but guard defensively
      core.setOutput('notified', 'false');
      return;
    }

    // Send the notification
    logger.info('Sending Slack notification', { result, prNumber });

    const success = await sendSlackNotification(webhookUrl, payload);

    if (success) {
      logger.info('Slack notification sent successfully');
      core.setOutput('notified', 'true');
    } else {
      logger.warning(
        'Slack webhook returned a non-OK response — notification may not have been delivered'
      );
      core.setOutput('notified', 'false');
    }
  } catch (error) {
    // Never fail the workflow because of a notification error
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.warning(`Slack notification failed: ${message}`);
    core.setOutput('notified', 'false');
  }
}

// Run the action
void run();
