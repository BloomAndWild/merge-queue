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
type SlackBlock = {
    type: 'section';
    text: SlackText;
    fields?: SlackText[];
} | {
    type: 'actions';
    elements: SlackActionElement[];
} | {
    type: 'context';
    elements: SlackText[];
};
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
export declare function buildSlackPayload(params: SlackNotificationParams): SlackPayload | null;
/**
 * Send a Slack notification via incoming webhook.
 *
 * Returns `true` if the webhook accepted the payload (HTTP 200),
 * `false` otherwise. Never throws — callers should log failures
 * but not let them block the workflow.
 */
export declare function sendSlackNotification(webhookUrl: string, payload: SlackPayload): Promise<boolean>;
export {};
//# sourceMappingURL=slack-notifier.d.ts.map