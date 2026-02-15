/**
 * Constants used throughout the merge queue system
 */
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
 * Retry configuration for API calls
 */
export declare const RETRY_CONFIG: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
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