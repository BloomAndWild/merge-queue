/**
 * Shared helper utilities for GitHub Action entry points
 */
import type { QueueConfig, RepositoryInfo } from '../types/queue';
/**
 * Parse a repository string in "owner/repo" format into a RepositoryInfo object
 */
export declare function parseRepository(repoString: string): RepositoryInfo;
/**
 * Build a QueueConfig from GitHub Action inputs.
 * Validates numeric fields and the merge-method enum.
 */
export declare function getConfig(): QueueConfig;
//# sourceMappingURL=action-helpers.d.ts.map