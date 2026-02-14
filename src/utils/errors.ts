/**
 * Custom error types for the merge queue system
 */

/**
 * Base error class for all queue-related errors
 */
export class QueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error when PR validation fails
 */
export class ValidationError extends QueueError {
  constructor(message: string, public reason: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Error when GitHub API operations fail
 */
export class GitHubAPIError extends QueueError {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

/**
 * Error when merge conflicts are detected
 */
export class MergeConflictError extends QueueError {
  constructor(message: string) {
    super(message);
    this.name = 'MergeConflictError';
  }
}

/**
 * Error when operations timeout
 */
export class TimeoutError extends QueueError {
  constructor(message: string, public timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Type guard for errors returned by the GitHub/Octokit API.
 * These errors carry a numeric `status` property (HTTP status code).
 */
export function isGitHubError(
  error: unknown
): error is { status: number; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  );
}
