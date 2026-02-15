/**
 * Custom error types for the merge queue system
 */
/**
 * Base error class for all queue-related errors
 */
export declare class QueueError extends Error {
    constructor(message: string);
}
/**
 * Error when PR validation fails
 */
export declare class ValidationError extends QueueError {
    reason: string;
    constructor(message: string, reason: string);
}
/**
 * Error when GitHub API operations fail
 */
export declare class GitHubAPIError extends QueueError {
    statusCode?: number | undefined;
    response?: unknown | undefined;
    constructor(message: string, statusCode?: number | undefined, response?: unknown | undefined);
}
/**
 * Error when operations timeout
 */
export declare class TimeoutError extends QueueError {
    timeoutMs: number;
    constructor(message: string, timeoutMs: number);
}
/**
 * Type guard for errors returned by the GitHub/Octokit API.
 * These errors carry a numeric `status` property (HTTP status code).
 */
export declare function isGitHubError(error: unknown): error is {
    status: number;
    message: string;
};
//# sourceMappingURL=errors.d.ts.map