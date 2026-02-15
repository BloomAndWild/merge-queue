/**
 * PR validation logic for merge queue
 *
 * Approval validation is always enforced — the validator requires at least
 * one approving review with no outstanding "changes requested" reviews.
 * This provides defense in depth: even if the PAT used by the merge queue
 * has admin privileges that could bypass branch protection rules, the
 * merge queue itself will refuse to merge unapproved PRs.
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
     * Check that the PR has at least one approving review and no outstanding
     * "changes requested" reviews.  Only the latest review per reviewer is
     * considered (a reviewer who requested changes and later approved counts
     * as approved).
     */
    checkApproval(prNumber: number): Promise<{
        valid: boolean;
        reason?: string;
    }>;
    /**
     * Check if all required status checks pass.
     *
     * Checks whose name appears in `config.ignoreChecks` are excluded from
     * evaluation.  This prevents the merge queue's own workflow checks from
     * creating a circular dependency where a previous failed run blocks the
     * PR from being re-queued.
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