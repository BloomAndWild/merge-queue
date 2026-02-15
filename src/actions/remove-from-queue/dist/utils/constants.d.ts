/**
 * Constants used throughout the merge queue system
 */
import type { ProcessingStep } from '../types/queue';
export type { ProcessingStep } from '../types/queue';
/**
 * Default queue configuration
 */
export declare const DEFAULT_CONFIG: {
    queueLabel: string;
    failedLabel: string;
    conflictLabel: string;
    processingLabel: string;
    updatingLabel: string;
    queuedLabel: string;
    requireAllChecks: boolean;
    allowDraft: boolean;
    blockLabels: string[];
    autoUpdateBranch: boolean;
    updateTimeoutMinutes: number;
    mergeMethod: "squash";
    deleteBranchAfterMerge: boolean;
    ignoreChecks: string[];
};
/**
 * Timeout configurations (in milliseconds)
 */
export declare const TIMEOUTS: {
    checkStatusPollMs: number;
    maxTestWaitMs: number;
    apiTimeoutMs: number;
};
/**
 * Comment templates for PR communication
 */
export declare const COMMENT_TEMPLATES: {
    addedToQueue: string;
    removedChecksFailure: (details: string) => string;
    positionUpdate: (position: number) => string;
    /**
     * Build a single summary comment from the collected processing steps.
     * Posted once at the end of process-queue instead of multiple comments.
     */
    buildSummary: (title: string, steps: ProcessingStep[]) => string;
};
/**
 * Label colors for queue-related labels (GitHub hex format)
 */
export declare const LABEL_COLORS: {
    ready: string;
    queued: string;
    processing: string;
    updating: string;
    failed: string;
    conflict: string;
};
//# sourceMappingURL=constants.d.ts.map