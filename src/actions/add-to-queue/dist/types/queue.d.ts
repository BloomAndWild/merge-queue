/**
 * Core type definitions for the merge queue system
 */
/**
 * Status of the currently processing PR
 */
export type ProcessingStatus = 'validating' | 'updating_branch' | 'waiting_for_tests' | 'merging';
/**
 * Result of a completed PR merge attempt
 */
export type MergeResult = 'merged' | 'failed' | 'conflict' | 'removed';
/**
 * GitHub merge methods
 */
export type MergeMethod = 'merge' | 'squash' | 'rebase';
/**
 * Current PR being processed
 */
export interface CurrentPR {
    pr_number: number;
    status: ProcessingStatus;
    started_at: string;
    updated_at: string | null;
}
/**
 * PR in the queue waiting to be processed
 */
export interface QueuedPR {
    pr_number: number;
    added_at: string;
    added_by: string;
    sha: string;
    priority: number;
}
/**
 * Historical record of a processed PR
 */
export interface HistoryEntry {
    pr_number: number;
    result: MergeResult;
    completed_at: string;
    duration_seconds: number;
    error_message?: string;
}
/**
 * Queue statistics
 */
export interface QueueStats {
    total_processed: number;
    total_merged: number;
    total_failed: number;
}
/**
 * Complete queue state structure
 */
export interface QueueState {
    version: string;
    updated_at: string;
    current: CurrentPR | null;
    queue: QueuedPR[];
    history: HistoryEntry[];
    stats: QueueStats;
}
/**
 * Repository identification
 */
export interface RepositoryInfo {
    owner: string;
    repo: string;
}
/**
 * Queue configuration options
 */
export interface QueueConfig {
    queueLabel: string;
    failedLabel: string;
    conflictLabel: string;
    processingLabel: string;
    updatingLabel: string;
    queuedLabel: string;
    requiredApprovals: number;
    requireAllChecks: boolean;
    allowDraft: boolean;
    blockLabels: string[];
    autoUpdateBranch: boolean;
    updateTimeoutMinutes: number;
    mergeMethod: MergeMethod;
    deleteBranchAfterMerge: boolean;
}
/**
 * PR validation result
 */
export interface ValidationResult {
    valid: boolean;
    reason?: string;
    checks?: {
        hasApprovals: boolean;
        checksPass: boolean;
        notDraft: boolean;
        noBlockLabels: boolean;
        upToDate: boolean;
        noConflicts: boolean;
    };
}
/**
 * GitHub check status
 */
export interface CheckStatus {
    name: string;
    status: 'success' | 'failure' | 'pending' | 'neutral' | 'cancelled' | 'skipped';
    conclusion?: string;
}
/**
 * PR update result after merging base branch
 */
export interface UpdateResult {
    success: boolean;
    conflict: boolean;
    sha?: string;
    error?: string;
}
//# sourceMappingURL=queue.d.ts.map