/**
 * Constants used throughout the merge queue system
 */

/**
 * Name of the branch that stores queue state
 */
export const STATE_BRANCH = 'merge-queue-state';

/**
 * Current version of the queue state schema
 */
export const QUEUE_VERSION = '1.0.0';

/**
 * Default queue configuration
 */
export const DEFAULT_CONFIG = {
  queueLabel: 'ready',
  failedLabel: 'merge-queue-failed',
  conflictLabel: 'merge-queue-conflict',
  processingLabel: 'merge-processing',
  updatingLabel: 'merge-updating',
  queuedLabel: 'queued-for-merge',
  requiredApprovals: 1,
  requireAllChecks: true,
  allowDraft: false,
  blockLabels: ['do-not-merge', 'wip'],
  autoUpdateBranch: true,
  updateTimeoutMinutes: 30,
  mergeMethod: 'squash' as const,
  deleteBranchAfterMerge: true,
};

/**
 * Retry configuration for API calls
 */
export const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Timeout configurations (in milliseconds)
 */
export const TIMEOUTS = {
  checkStatusPollMs: 30000, // 30 seconds between status check polls
  maxTestWaitMs: 30 * 60 * 1000, // 30 minutes max wait for tests
  apiTimeoutMs: 30000, // 30 seconds for API calls
};

/**
 * Comment templates for PR communication
 */
export const COMMENT_TEMPLATES = {
  addedToQueue: (position: number) =>
    `✅ Added to merge queue at position ${position}`,

  processing: () =>
    `🔄 Processing merge...`,

  updatingBranch: () =>
    `🔄 Updating branch with latest master...`,

  waitingForTests: () =>
    `⏳ Waiting for tests to complete after branch update...`,

  testsPassedMerging: () =>
    `✅ Tests passed, merging now...`,

  mergedSuccessfully: () =>
    `✅ Merged successfully`,

  removedChecksFailure: (details: string) =>
    `❌ Removed from queue: checks no longer passing\n\n${details}`,

  removedTestsFailedAfterUpdate: (details: string) =>
    `❌ Removed from queue: tests failed after branch update\n\n${details}`,

  removedConflict: () =>
    `❌ Removed from queue: merge conflict detected during update\n\nPlease resolve conflicts and add the ready label again to re-queue.`,

  removedError: (error: string) =>
    `❌ Removed from queue: error occurred\n\n\`\`\`\n${error}\n\`\`\``,

  positionUpdate: (position: number) =>
    `📍 Queue position: ${position}`,
};

/**
 * Label colors for queue-related labels (GitHub hex format)
 */
export const LABEL_COLORS = {
  ready: '0e8a16',
  queued: 'fbca04',
  processing: '1d76db',
  updating: '5319e7',
  failed: 'd73a4a',
  conflict: 'b60205',
};
