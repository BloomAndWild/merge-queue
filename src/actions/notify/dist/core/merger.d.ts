/**
 * PR merger logic for merge queue
 */
import { GitHubAPI } from './github-api';
import { PRValidator } from './pr-validator';
import { Logger } from '../utils/logger';
import type { QueueConfig } from '../types/queue';
/**
 * Merge result interface
 */
export interface MergeResultDetails {
    success: boolean;
    sha?: string;
    error?: string;
}
/**
 * PR Merger class
 *
 * Provides a standalone merge-with-validation flow.
 * For more complex orchestration (label management, state tracking),
 * the process-queue action drives the merge directly via GitHubAPI.
 */
export declare class PRMerger {
    private api;
    private validator;
    private config;
    private logger?;
    constructor(api: GitHubAPI, validator: PRValidator, config: QueueConfig, logger?: Logger | undefined);
    /**
     * Merge a pull request with pre-merge validation
     */
    merge(prNumber: number): Promise<MergeResultDetails>;
    /**
     * Post-merge cleanup
     */
    cleanup(prNumber: number, branchName: string | null, labels: string[]): Promise<void>;
}
//# sourceMappingURL=merger.d.ts.map