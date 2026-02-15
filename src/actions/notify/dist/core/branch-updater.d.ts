/**
 * Branch updater logic for merge queue
 * Handles automatic branch updates when PR is behind master
 */
import { GitHubAPI } from './github-api';
import { PRValidator } from './pr-validator';
import { Logger } from '../utils/logger';
import type { QueueConfig, UpdateResult } from '../types/queue';
/**
 * Branch Updater class
 */
export declare class BranchUpdater {
    private api;
    private validator;
    private config;
    private logger?;
    constructor(api: GitHubAPI, validator: PRValidator, config: QueueConfig, logger?: Logger | undefined);
    /**
     * Update PR branch with base branch if it's behind
     * Returns true if update was successful and tests passed
     */
    updateIfBehind(prNumber: number): Promise<UpdateResult>;
    /**
     * Wait for status checks to complete after branch update
     * Polls every 30 seconds up to the configured timeout
     */
    waitForTests(prNumber: number, sha: string): Promise<boolean>;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
}
//# sourceMappingURL=branch-updater.d.ts.map