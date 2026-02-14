/**
 * Constants used throughout the merge queue system
 */

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
  requireAllChecks: true,
  allowDraft: false,
  blockLabels: ['do-not-merge', 'wip'],
  autoUpdateBranch: true,
  updateTimeoutMinutes: 30,
  mergeMethod: 'squash' as const,
  deleteBranchAfterMerge: true,
  ignoreChecks: [] as string[],
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
 * A single step recorded during queue processing, used to build summary comments
 */
export interface ProcessingStep {
  label: string;
  status: 'success' | 'failure';
  detail?: string;
}

/**
 * Comment templates for PR communication
 */
export const COMMENT_TEMPLATES = {
  addedToQueue: '✅ Added to merge queue',

  removedChecksFailure: (details: string) =>
    `❌ Removed from queue: checks no longer passing\n\n${details}`,

  positionUpdate: (position: number) =>
    `📍 Queue position: ${position}`,

  /**
   * Build a single summary comment from the collected processing steps.
   * Posted once at the end of process-queue instead of multiple comments.
   */
  buildSummary: (title: string, steps: ProcessingStep[]) => {
    const lines: string[] = [`## 🔀 Merge Queue — ${title}`, ''];

    for (const step of steps) {
      const icon = step.status === 'success' ? '✅' : '❌';
      lines.push(`- ${icon} ${step.label}`);
      if (step.detail) {
        lines.push(`  > ${step.detail.split('\n').join('\n  > ')}`);
      }
    }

    return lines.join('\n');
  },
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
