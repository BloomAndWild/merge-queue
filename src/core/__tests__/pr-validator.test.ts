/**
 * Tests for PR validator
 */

import { PRValidator } from '../pr-validator';
import { GitHubAPI } from '../github-api';
import type { QueueConfig } from '../../types/queue';
import { DEFAULT_CONFIG } from '../../utils/constants';

// Mock GitHubAPI
jest.mock('../github-api');

describe('PRValidator', () => {
  let mockAPI: jest.Mocked<GitHubAPI>;
  let validator: PRValidator;
  let config: QueueConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };

    mockAPI = {
      getPullRequest: jest.fn(),
      getPRReviews: jest.fn(),
      getCommitStatus: jest.fn(),
      isBranchBehind: jest.fn(),
    } as any;

    validator = new PRValidator(mockAPI, config);
  });

  describe('validate', () => {
    it('should reject closed PRs', async () => {
      mockAPI.getPullRequest.mockResolvedValue({
        state: 'closed',
        draft: false,
        labels: [],
        head: { sha: 'abc123' },
        mergeable: true,
      } as any);

      const result = await validator.validate(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('closed');
    });

    it('should reject draft PRs when not allowed', async () => {
      config.allowDraft = false;

      mockAPI.getPullRequest.mockResolvedValue({
        state: 'open',
        draft: true,
        labels: [],
        head: { sha: 'abc123' },
        mergeable: true,
      } as any);

      const result = await validator.validate(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('draft');
    });

    it('should reject PRs with blocking labels', async () => {
      mockAPI.getPullRequest.mockResolvedValue({
        state: 'open',
        draft: false,
        labels: [{ name: 'do-not-merge' }],
        head: { sha: 'abc123' },
        mergeable: true,
      } as any);

      const result = await validator.validate(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('blocking label');
    });

    it('should reject PRs with merge conflicts', async () => {
      mockAPI.getPullRequest.mockResolvedValue({
        state: 'open',
        draft: false,
        labels: [],
        head: { sha: 'abc123' },
        mergeable: false,
      } as any);

      mockAPI.getPRReviews.mockResolvedValue([
        { state: 'APPROVED', user: { login: 'user1' } },
      ] as any);

      mockAPI.getCommitStatus.mockResolvedValue([
        { name: 'test', status: 'success' },
      ] as any);

      mockAPI.isBranchBehind.mockResolvedValue(false);

      const result = await validator.validate(123);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('merge conflicts');
    });

    it('should accept valid PRs', async () => {
      mockAPI.getPullRequest.mockResolvedValue({
        state: 'open',
        draft: false,
        labels: [],
        head: { sha: 'abc123' },
        mergeable: true,
      } as any);

      mockAPI.getPRReviews.mockResolvedValue([
        { state: 'APPROVED', user: { login: 'user1' } },
      ] as any);

      mockAPI.getCommitStatus.mockResolvedValue([
        { name: 'test', status: 'success' },
      ] as any);

      mockAPI.isBranchBehind.mockResolvedValue(false);

      const result = await validator.validate(123);

      expect(result.valid).toBe(true);
      expect(result.checks).toBeDefined();
      expect(result.checks?.hasApprovals).toBe(true);
      expect(result.checks?.checksPass).toBe(true);
      expect(result.checks?.noConflicts).toBe(true);
    });
  });

  describe('checkApprovals', () => {
    it('should count approvals correctly', async () => {
      mockAPI.getPRReviews.mockResolvedValue([
        { state: 'APPROVED', user: { login: 'user1' } },
        { state: 'APPROVED', user: { login: 'user2' } },
      ] as any);

      const hasApprovals = await validator.checkApprovals(123);

      expect(hasApprovals).toBe(true);
    });

    it('should reject when changes requested', async () => {
      mockAPI.getPRReviews.mockResolvedValue([
        { state: 'APPROVED', user: { login: 'user1' } },
        { state: 'CHANGES_REQUESTED', user: { login: 'user2' } },
      ] as any);

      const hasApprovals = await validator.checkApprovals(123);

      expect(hasApprovals).toBe(false);
    });
  });
});
