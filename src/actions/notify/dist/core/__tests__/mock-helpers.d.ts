/**
 * Shared typed mock factories for core tests.
 *
 * These helpers replace the `as any` pattern used previously.
 * Each factory returns a properly typed partial mock — mock methods
 * are type-checked against the real class signatures so that
 * refactors break tests at compile time rather than silently.
 *
 * The `as unknown as FullType` cast is applied once at the call site
 * (the class constructor), making the intent explicit.
 */
import type { GitHubAPI } from '../github-api';
import type { PRValidator } from '../pr-validator';
import type { CheckStatus, UpdateResult } from '../../types/queue';
/** Methods used by BranchUpdater tests */
export type BranchUpdaterAPIMethods = Pick<GitHubAPI, 'updateBranch' | 'getPullRequest' | 'getCommitStatus'>;
/** Methods used by PRValidator tests */
export type ValidatorAPIMethods = Pick<GitHubAPI, 'getPullRequest' | 'getPRReviews' | 'getCommitStatus' | 'isBranchBehind'>;
export declare function createMockGitHubAPI<T extends Partial<GitHubAPI>>(methods: (keyof T)[]): jest.Mocked<T>;
/** Methods used by BranchUpdater tests */
export type BranchUpdaterValidatorMethods = Pick<PRValidator, 'isBehind' | 'checkStatusChecks'>;
export declare function createMockValidator<T extends Partial<PRValidator>>(methods: (keyof T)[]): jest.Mocked<T>;
/** The subset of PullRequest fields used across tests */
export interface PRFixture {
    state: string;
    draft?: boolean;
    labels?: {
        name?: string;
    }[];
    head?: {
        sha: string;
        ref?: string;
    };
    base?: {
        ref?: string;
    };
    mergeable?: boolean | null;
    user?: {
        login: string;
    } | null;
}
/**
 * Build a minimal PR fixture with sensible defaults.
 * Overrides are merged shallowly.
 */
export declare function makePR(overrides?: Partial<PRFixture>): PRFixture;
export declare function makeCheck(name: string, status: CheckStatus['status']): CheckStatus;
export declare function makeUpdateResult(overrides?: Partial<UpdateResult>): UpdateResult;
//# sourceMappingURL=mock-helpers.d.ts.map