/**
 * PR validation logic for merge queue
 */
import { GitHubAPI } from './github-api';
import { Logger } from '../utils/logger';
import type { QueueConfig, ValidationResult } from '../types/queue';
/**
 * PR Validator class
 */
export declare class PRValidator {
    private api;
    private config;
    private logger?;
    constructor(api: GitHubAPI, config: QueueConfig, logger?: Logger | undefined);
    /**
     * Validate PR meets all merge requirements
     */
    validate(prNumber: number): Promise<ValidationResult>;
    /**
     * Check if PR has required approvals (public convenience method).
     * Fetches reviews from the API and delegates to evaluateReviews.
     */
    checkApprovals(prNumber: number): Promise<boolean>;
    /**
     * Evaluate reviews to determine approval count and change-request status.
     *
     * Uses a non-mutating reverse so the original array is untouched.
     * Iterates newest-first and keeps only the latest review per user.
     */
    private evaluateReviews;
    /**
     * Check if all required status checks pass
     */
    checkStatusChecks(sha: string): Promise<{
        valid: boolean;
        reason?: string;
    }>;
    /**
     * Check if PR branch is behind base branch
     */
    isBehind(prNumber: number): Promise<boolean>;
}
//# sourceMappingURL=pr-validator.d.ts.map