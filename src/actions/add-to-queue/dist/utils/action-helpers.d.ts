/**
 * Shared helper utilities for GitHub Action entry points
 */
import type { QueueConfig, RepositoryInfo } from '../types/queue';
/**
 * Parse a repository string in "owner/repo" format into a RepositoryInfo object.
 * Rejects strings with more or fewer than exactly one slash.
 */
export declare function parseRepository(repoString: string): RepositoryInfo;
/**
 * Parse and validate a PR number string.
 * Throws if the value is not a positive integer.
 */
export declare function parsePRNumber(input: string): number;
/**
 * Build a QueueConfig from GitHub Action inputs.
 * Validates numeric fields and the merge-method enum.
 */
export declare function getConfig(): QueueConfig;
//# sourceMappingURL=action-helpers.d.ts.map