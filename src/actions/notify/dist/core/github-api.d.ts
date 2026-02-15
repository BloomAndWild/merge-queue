/**
 * GitHub API wrapper for merge queue operations
 */
import type { components } from '@octokit/openapi-types';
import { Logger } from '../utils/logger';
import type { RepositoryInfo, MergeMethod, CheckStatus, UpdateResult } from '../types/queue';
type PullRequest = components['schemas']['pull-request'];
type Review = components['schemas']['pull-request-review'];
/**
 * GitHub API client for merge queue operations
 */
export declare class GitHubAPI {
    private repo;
    private octokit;
    private logger;
    constructor(token: string, repo: RepositoryInfo, logger?: Logger);
    /**
     * Get PR details
     */
    getPullRequest(prNumber: number): Promise<PullRequest>;
    /**
     * Get PR reviews
     */
    getPRReviews(prNumber: number): Promise<Review[]>;
    /**
     * Get combined status for a commit.
     *
     * Fetches both check-runs and commit-statuses (first page only).
     * Logs a warning when the response size equals the default page limit,
     * which may indicate truncated results.
     */
    getCommitStatus(ref: string): Promise<CheckStatus[]>;
    /**
     * Check if PR branch is behind base branch.
     *
     * Compares base_ref (e.g. main) → head_ref (PR branch).
     * `behind_by` then tells us how many commits the PR branch
     * is missing from the base branch.
     */
    isBranchBehind(prNumber: number): Promise<boolean>;
    /**
     * Update PR branch with base branch using GitHub's dedicated update-branch API.
     *
     * Uses `PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch`
     * which is the same mechanism as the "Update branch" button in the GitHub UI.
     * This endpoint returns HTTP 202 (Accepted) because the merge happens
     * asynchronously, so we poll the PR for the new head SHA afterwards.
     */
    updateBranch(prNumber: number): Promise<UpdateResult>;
    /**
     * Poll the PR until its head SHA changes, confirming the async branch
     * update has completed.  Returns the new SHA.
     */
    private waitForBranchUpdate;
    /**
     * Merge a pull request
     */
    mergePullRequest(prNumber: number, method?: MergeMethod, commitTitle?: string, commitMessage?: string): Promise<string>;
    /**
     * Delete a branch
     */
    deleteBranch(ref: string): Promise<void>;
    /**
     * Add a comment to a PR
     */
    addComment(prNumber: number, body: string): Promise<void>;
    /**
     * Add labels to a PR
     */
    addLabels(prNumber: number, labels: string[]): Promise<void>;
    /**
     * List open PR numbers that have the given label, sorted by creation date
     * (oldest first).
     *
     * Uses the Issues API with a label filter, then keeps only pull requests.
     * Fetches up to 100 results (first page). Logs a warning when the
     * response is full, which may indicate additional results exist.
     */
    listPRsWithLabel(label: string): Promise<number[]>;
    /**
     * Remove a label from a PR
     */
    removeLabel(prNumber: number, label: string): Promise<void>;
}
export {};
//# sourceMappingURL=github-api.d.ts.map