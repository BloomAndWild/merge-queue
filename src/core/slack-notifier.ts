/**
 * Slack notification module for merge queue events.
 *
 * Builds Block Kit payloads and sends them to a Slack incoming webhook.
 * Uses Node 20's built-in fetch — no additional dependencies required.
 */

import type { MergeResult } from '../types/queue';

/**
 * Information about the PR being notified on
 */
export interface PRDetails {
  number: number;
  title: string;
  author: string;
  url: string;
  repository: string;
}

/**
 * Parameters for building a Slack notification payload
 */
export interface SlackNotificationParams {
  result: MergeResult;
  pr: PRDetails;
}

/**
 * Slack attachment colour per result type
 */
const RESULT_COLOURS: Record<string, string> = {
  merged: '#2ea44f',
  failed: '#d73a4a',
  conflict: '#b60205',
};

/**
 * Human-readable header text per result type
 */
const RESULT_HEADERS: Record<string, string> = {
  merged: 'PR Merged Successfully',
  failed: 'PR Failed to Merge',
  conflict: 'PR Has Merge Conflicts',
};

/**
 * Icon per result type
 */
const RESULT_ICONS: Record<string, string> = {
  merged: ':white_check_mark:',
  failed: ':x:',
  conflict: ':warning:',
};

/**
 * Slack Block Kit payload shape (subset relevant to incoming webhooks)
 */
export interface SlackPayload {
  attachments: SlackAttachment[];
}

interface SlackAttachment {
  color: string;
  blocks: SlackBlock[];
  fallback: string;
}

type SlackBlock =
  | { type: 'section'; text: SlackText; fields?: SlackText[] }
  | { type: 'actions'; elements: SlackActionElement[] }
  | { type: 'context'; elements: SlackText[] };

interface SlackText {
  type: 'mrkdwn' | 'plain_text';
  text: string;
}

interface SlackActionElement {
  type: 'button';
  text: SlackText;
  url: string;
}

/**
 * Build a Slack Block Kit payload for a merge queue event.
 *
 * Returns `null` for result types that should not trigger a notification
 * (e.g. `none`, `removed`).
 */
export function buildSlackPayload(params: SlackNotificationParams): SlackPayload | null {
  const { result, pr } = params;

  const color = RESULT_COLOURS[result];
  if (!color) {
    // Result type is not notification-worthy (e.g. 'none', 'removed')
    return null;
  }

  const header = RESULT_HEADERS[result] ?? result;
  const icon = RESULT_ICONS[result] ?? ':grey_question:';
  const fallback = `${header}: #${pr.number} ${pr.title} (${pr.repository})`;

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${icon} *${header}*`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*PR:*\n<${pr.url}|#${pr.number} ${pr.title}>` },
        { type: 'mrkdwn', text: `*Repository:*\n${pr.repository}` },
        { type: 'mrkdwn', text: `*Author:*\n${pr.author}` },
      ],
      text: {
        type: 'mrkdwn',
        text: ' ',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Pull Request' },
          url: pr.url,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Merge Queue | ${new Date().toISOString()}`,
        },
      ],
    },
  ];

  return {
    attachments: [{ color, blocks, fallback }],
  };
}

/**
 * Send a Slack notification via incoming webhook.
 *
 * Returns `true` if the webhook accepted the payload (HTTP 200),
 * `false` otherwise. Never throws — callers should log failures
 * but not let them block the workflow.
 */
export async function sendSlackNotification(
  webhookUrl: string,
  payload: SlackPayload
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch {
    // Network errors (DNS failure, connection refused, etc.)
    // Return false to honour the "never throws" contract.
    return false;
  }
}
