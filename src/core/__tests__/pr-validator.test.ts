/**
 * Tests for PR validator
 */

import { PRValidator } from '../pr-validator';
import { GitHubAPI } from '../github-api';
import type { QueueConfig } from '../../types/queue';
import { DEFAULT_CONFIG } from '../../utils/constants';
import { createMockGitHubAPI, makePR, makeCheck, type ValidatorAPIMethods } from './mock-helpers';

// Mock GitHubAPI
jest.mock('../github-api');

describe('PRValidator', () => {
  let mockAPI: jest.Mocked<ValidatorAPIMethods>;
  let validator: PRValidator;
  let config: QueueConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };

    mockAPI = createMockGitHubAPI<ValidatorAPIMethods>([
      'getPullRequest',
      'getPRReviews',
      'getCommitStatus',
      'isBranchBehind',
    ]);

    validator = new PRValidator(mockAPI as unknown as GitHubAPI, config);
  });

  /** Helper: set up mocks for a PR that passes all checks */
  function mockValidPR() {
    mockAPI.getPullRequest.mockResolvedValue(makePR() as never);
    mockAPI.getPRReviews.mockResolvedValue([
      { user: { login: 'reviewer1' }, state: 'APPROVED' },
    ] as never);
    mockAPI.getCommitStatus.mockResolvedValue([makeCheck('test', 'success')] as never);
    mockAPI.isBranchBehind.mockResolvedValue(false as never);
  }

  describe('validate', () => {
    it('should reject closed PRs', async () => {
      mockAPI.getPullRequest.mockResolvedValue(makePR({ state: 'closed' }) as never);

      const result = await validator.validate(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('closed');
    });

    it('should reject draft PRs when not allowed', async () => {
      config.allowDraft = false;
      mockAPI.getPullRequest.mockResolvedValue(makePR({ draft: true }) as never);

      const result = await validator.validate(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('draft');
    });

    it('should reject PRs with blocking labels', async () => {
      mockAPI.getPullRequest.mockResolvedValue(
        makePR({ labels: [{ name: 'do-not-merge' }] }) as never
      );
      mockAPI.getPRReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: 'APPROVED' },
      ] as never);

      const result = await validator.validate(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('blocking label');
    });

    it('should reject PRs with merge conflicts', async () => {
      mockAPI.getPullRequest.mockResolvedValue(makePR({ mergeable: false }) as never);
      mockAPI.getPRReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: 'APPROVED' },
      ] as never);
      mockAPI.getCommitStatus.mockResolvedValue([makeCheck('test', 'success')] as never);
      mockAPI.isBranchBehind.mockResolvedValue(false as never);

      const result = await validator.validate(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('merge conflicts');
    });

    it('should accept valid PRs', async () => {
      mockValidPR();

      const result = await validator.validate(123);

      expect(result.valid).toBe(true);
      expect(result.checks).toBeDefined();
      expect(result.checks?.approved).toBe(true);
      expect(result.checks?.checksPass).toBe(true);
      expect(result.checks?.noConflicts).toBe(true);
    });
  });

  describe('checkApproval', () => {
    it('should reject PRs with no reviews', async () => {
      mockAPI.getPRReviews.mockResolvedValue([] as never);

      const result = await validator.checkApproval(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('no approving reviews');
    });

    it('should reject PRs with only comment reviews (no approval)', async () => {
      mockAPI.getPRReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: 'COMMENTED' },
      ] as never);

      const result = await validator.checkApproval(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('no approving reviews');
    });

    it('should reject PRs with outstanding changes requested', async () => {
      mockAPI.getPRReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: 'APPROVED' },
        { user: { login: 'reviewer2' }, state: 'CHANGES_REQUESTED' },
      ] as never);

      const result = await validator.checkApproval(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('changes requested');
    });

    it('should accept PRs with at least one approval', async () => {
      mockAPI.getPRReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: 'APPROVED' },
      ] as never);

      const result = await validator.checkApproval(123);

      expect(result.valid).toBe(true);
    });

    it('should use latest review per reviewer', async () => {
      // reviewer1 initially requested changes, then approved
      mockAPI.getPRReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: 'CHANGES_REQUESTED' },
        { user: { login: 'reviewer1' }, state: 'APPROVED' },
      ] as never);

      const result = await validator.checkApproval(123);

      expect(result.valid).toBe(true);
    });

    it('should reject when latest review is changes requested even after prior approval', async () => {
      mockAPI.getPRReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: 'APPROVED' },
        { user: { login: 'reviewer1' }, state: 'CHANGES_REQUESTED' },
      ] as never);

      const result = await validator.checkApproval(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('changes requested');
    });

    it('should accept when one reviewer approves and another has a dismissed review', async () => {
      mockAPI.getPRReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: 'APPROVED' },
        { user: { login: 'reviewer2' }, state: 'DISMISSED' },
      ] as never);

      const result = await validator.checkApproval(123);

      expect(result.valid).toBe(true);
    });

    it('should ignore reviews from users with null login', async () => {
      mockAPI.getPRReviews.mockResolvedValue([{ user: null, state: 'APPROVED' }] as never);

      const result = await validator.checkApproval(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('no approving reviews');
    });

    it('should reject PRs via validate when not approved', async () => {
      mockAPI.getPullRequest.mockResolvedValue(makePR() as never);
      mockAPI.getPRReviews.mockResolvedValue([] as never);

      const result = await validator.validate(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('no approving reviews');
      expect(result.checks?.approved).toBe(false);
    });
  });

  describe('checkStatusChecks', () => {
    it('should return valid when all checks pass', async () => {
      mockAPI.getCommitStatus.mockResolvedValue([
        makeCheck('build', 'success'),
        makeCheck('lint', 'success'),
      ] as never);

      const result = await validator.checkStatusChecks('sha123');

      expect(result.valid).toBe(true);
    });

    it('should return invalid with failed checks', async () => {
      mockAPI.getCommitStatus.mockResolvedValue([
        makeCheck('build', 'success'),
        makeCheck('lint', 'failure'),
      ] as never);

      const result = await validator.checkStatusChecks('sha123');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Failed checks');
      expect(result.reason).toContain('lint');
    });

    it('should return invalid with cancelled checks', async () => {
      mockAPI.getCommitStatus.mockResolvedValue([makeCheck('build', 'cancelled')] as never);

      const result = await validator.checkStatusChecks('sha123');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Failed checks');
      expect(result.reason).toContain('build');
    });

    it('should return invalid with pending checks', async () => {
      mockAPI.getCommitStatus.mockResolvedValue([
        makeCheck('build', 'success'),
        makeCheck('deploy', 'pending'),
      ] as never);

      const result = await validator.checkStatusChecks('sha123');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Pending checks');
      expect(result.reason).toContain('deploy');
    });

    it('should exclude ignored checks', async () => {
      config.ignoreChecks = ['merge-queue'];

      mockAPI.getCommitStatus.mockResolvedValue([
        makeCheck('build', 'success'),
        makeCheck('merge-queue', 'failure'),
      ] as never);

      const result = await validator.checkStatusChecks('sha123');

      expect(result.valid).toBe(true);
    });

    it('should fail when non-ignored checks fail', async () => {
      config.ignoreChecks = ['merge-queue'];

      mockAPI.getCommitStatus.mockResolvedValue([
        makeCheck('build', 'failure'),
        makeCheck('merge-queue', 'failure'),
      ] as never);

      const result = await validator.checkStatusChecks('sha123');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('build');
      expect(result.reason).not.toContain('merge-queue');
    });

    it('should allow pending checks when allowPendingChecks is true', async () => {
      config.allowPendingChecks = true;

      mockAPI.getCommitStatus.mockResolvedValue([
        makeCheck('build', 'success'),
        makeCheck('deploy', 'pending'),
      ] as never);

      const result = await validator.checkStatusChecks('sha123');

      expect(result.valid).toBe(true);
    });

    it('should still reject failed checks when allowPendingChecks is true', async () => {
      config.allowPendingChecks = true;

      mockAPI.getCommitStatus.mockResolvedValue([
        makeCheck('build', 'failure'),
        makeCheck('deploy', 'pending'),
      ] as never);

      const result = await validator.checkStatusChecks('sha123');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Failed checks');
      expect(result.reason).toContain('build');
    });
  });

  describe('isBehind', () => {
    it('should delegate to api.isBranchBehind', async () => {
      mockAPI.isBranchBehind.mockResolvedValue(true as never);

      const result = await validator.isBehind(42);

      expect(result).toBe(true);
      expect(mockAPI.isBranchBehind).toHaveBeenCalledWith(42);
    });

    it('should return false when branch is up to date', async () => {
      mockAPI.isBranchBehind.mockResolvedValue(false as never);

      const result = await validator.isBehind(42);

      expect(result).toBe(false);
    });
  });

  describe('validate error handling', () => {
    it('should re-throw errors from API calls', async () => {
      const apiError = new Error('API failure');
      mockAPI.getPullRequest.mockRejectedValue(apiError);

      await expect(validator.validate(123)).rejects.toThrow('API failure');
    });

    it('should reject via validate when status checks fail', async () => {
      mockAPI.getPullRequest.mockResolvedValue(makePR() as never);
      mockAPI.getPRReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: 'APPROVED' },
      ] as never);
      mockAPI.getCommitStatus.mockResolvedValue([makeCheck('build', 'failure')] as never);

      const result = await validator.validate(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Failed checks');
      expect(result.checks?.checksPass).toBe(false);
    });
  });
});
