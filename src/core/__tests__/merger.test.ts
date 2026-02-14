/**
 * Tests for PR merger
 */

import { PRMerger } from '../merger';
import { GitHubAPI } from '../github-api';
import { PRValidator } from '../pr-validator';
import type { QueueConfig } from '../../types/queue';
import { DEFAULT_CONFIG } from '../../utils/constants';

// Mock dependencies
jest.mock('../github-api');
jest.mock('../pr-validator');

describe('PRMerger', () => {
  let mockAPI: jest.Mocked<GitHubAPI>;
  let mockValidator: jest.Mocked<PRValidator>;
  let merger: PRMerger;
  let config: QueueConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };

    mockAPI = {
      getPullRequest: jest.fn(),
      mergePullRequest: jest.fn(),
      removeLabel: jest.fn(),
      deleteBranch: jest.fn(),
    } as any;

    mockValidator = {
      validate: jest.fn(),
    } as any;

    merger = new PRMerger(mockAPI, mockValidator, config);
  });

  describe('merge', () => {
    it('should successfully merge a valid PR', async () => {
      mockValidator.validate.mockResolvedValue({ valid: true });
      mockAPI.getPullRequest.mockResolvedValue({
        state: 'open',
        mergeable: true,
        user: { login: 'testuser' },
      } as any);
      mockAPI.mergePullRequest.mockResolvedValue('merge-sha-123');

      const result = await merger.merge(123);

      expect(result.success).toBe(true);
      expect(result.sha).toBe('merge-sha-123');
      expect(mockAPI.mergePullRequest).toHaveBeenCalledWith(
        123,
        config.mergeMethod,
        undefined,
        expect.stringContaining('testuser')
      );
    });

    it('should fail if validation fails', async () => {
      mockValidator.validate.mockResolvedValue({
        valid: false,
        reason: 'Missing approvals',
      });

      const result = await merger.merge(123);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing approvals');
      expect(mockAPI.mergePullRequest).not.toHaveBeenCalled();
    });

    it('should fail if PR is not open', async () => {
      mockValidator.validate.mockResolvedValue({ valid: true });
      mockAPI.getPullRequest.mockResolvedValue({
        state: 'closed',
        mergeable: true,
      } as any);

      const result = await merger.merge(123);

      expect(result.success).toBe(false);
      expect(result.error).toContain('closed');
    });

    it('should fail if PR has conflicts', async () => {
      mockValidator.validate.mockResolvedValue({ valid: true });
      mockAPI.getPullRequest.mockResolvedValue({
        state: 'open',
        mergeable: false,
      } as any);

      const result = await merger.merge(123);

      expect(result.success).toBe(false);
      expect(result.error).toContain('merge conflicts');
    });

    it('should handle merge API errors', async () => {
      mockValidator.validate.mockResolvedValue({ valid: true });
      mockAPI.getPullRequest.mockResolvedValue({
        state: 'open',
        mergeable: true,
        user: { login: 'testuser' },
      } as any);
      mockAPI.mergePullRequest.mockRejectedValue(new Error('API error'));

      const result = await merger.merge(123);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('cleanup', () => {
    it('should remove labels and delete branch', async () => {
      config.deleteBranchAfterMerge = true;

      await merger.cleanup(123, 'feature-branch', ['label1', 'label2']);

      expect(mockAPI.removeLabel).toHaveBeenCalledWith(123, 'label1');
      expect(mockAPI.removeLabel).toHaveBeenCalledWith(123, 'label2');
      expect(mockAPI.deleteBranch).toHaveBeenCalledWith('feature-branch');
    });

    it('should not delete branch if configured not to', async () => {
      config.deleteBranchAfterMerge = false;

      await merger.cleanup(123, 'feature-branch', ['label1']);

      expect(mockAPI.removeLabel).toHaveBeenCalledWith(123, 'label1');
      expect(mockAPI.deleteBranch).not.toHaveBeenCalled();
    });

    it('should not fail if cleanup errors occur', async () => {
      mockAPI.removeLabel.mockRejectedValue(new Error('Label error'));

      // Should not throw
      await expect(
        merger.cleanup(123, 'feature-branch', ['label1'])
      ).resolves.not.toThrow();
    });
  });

});
