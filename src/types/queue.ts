/**
 * Core type definitions for the merge queue system
 */

/**
 * Result of a completed PR merge attempt
 */
export type MergeResult = 'merged' | 'failed' | 'conflict' | 'removed';

/**
 * GitHub merge methods
 */
export type MergeMethod = 'merge' | 'squash' | 'rebase';

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
  requireAllChecks: boolean;
  allowDraft: boolean;
  blockLabels: string[];
  autoUpdateBranch: boolean;
  updateTimeoutMinutes: number;
  maxUpdateRetries: number;
  mergeMethod: MergeMethod;
  deleteBranchAfterMerge: boolean;
  ignoreChecks: string[];
}

/**
 * PR validation result
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  checks?: {
    approved: boolean;
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

/**
 * A single step recorded during queue processing, used to build summary comments
 */
export interface ProcessingStep {
  label: string;
  status: 'success' | 'failure';
  detail?: string;
}
