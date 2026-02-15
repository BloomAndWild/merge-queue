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
export {};
//# sourceMappingURL=index.d.ts.map