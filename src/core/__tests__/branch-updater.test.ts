/**
 * Tests for branch updater
 */

import { BranchUpdater } from '../branch-updater';
import { GitHubAPI } from '../github-api';
import { PRValidator } from '../pr-validator';
import type { QueueConfig } from '../../types/queue';
import { DEFAULT_CONFIG } from '../../utils/constants';

// Mock dependencies
jest.mock('../github-api');
jest.mock('../pr-validator');

describe('BranchUpdater', () => {
  let mockAPI: jest.Mocked<GitHubAPI>;
  let mockValidator: jest.Mocked<PRValidator>;
  let updater: BranchUpdater;
  let config: QueueConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };

    mockAPI = {
      updateBranch: jest.fn(),
      getPullRequest: jest.fn(),
      getCommitStatus: jest.fn(),
    } as any;

    mockValidator = {
      isBehind: jest.fn(),
      checkStatusChecks: jest.fn(),
    } as any;

    updater = new BranchUpdater(mockAPI, mockValidator, config);
  });

  describe('updateIfBehind', () => {
    it('should return success if branch is up to date', async () => {
      mockValidator.isBehind.mockResolvedValue(false);

      const result = await updater.updateIfBehind(123);

      expect(result.success).toBe(true);
      expect(result.conflict).toBe(false);
      expect(mockAPI.updateBranch).not.toHaveBeenCalled();
    });

    it('should update branch if behind', async () => {
      mockValidator.isBehind.mockResolvedValue(true);
      mockAPI.updateBranch.mockResolvedValue({
        success: true,
        conflict: false,
        sha: 'new-sha',
      });
      mockAPI.getPullRequest.mockResolvedValue({ state: 'open' } as any);
      mockValidator.checkStatusChecks.mockResolvedValue({ valid: true });

      const result = await updater.updateIfBehind(123);

      expect(mockAPI.updateBranch).toHaveBeenCalledWith(123);
      expect(result.success).toBe(true);
      expect(result.sha).toBe('new-sha');
    });

    it('should return conflict if update has conflict', async () => {
      mockValidator.isBehind.mockResolvedValue(true);
      mockAPI.updateBranch.mockResolvedValue({
        success: false,
        conflict: true,
        error: 'Merge conflict',
      });

      const result = await updater.updateIfBehind(123);

      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
    });

    it('should wait for tests and return success if they pass', async () => {
      // Mock timers to avoid real delays
      jest.useFakeTimers();

      mockValidator.isBehind.mockResolvedValue(true);
      mockAPI.updateBranch.mockResolvedValue({
        success: true,
        conflict: false,
        sha: 'new-sha',
      });
      mockAPI.getPullRequest.mockResolvedValue({ state: 'open' } as any);

      // First call returns pending, second returns valid
      let checkCallCount = 0;
      mockValidator.checkStatusChecks.mockImplementation(async () => {
        checkCallCount++;
        return checkCallCount === 1
          ? { valid: false }
          : { valid: true };
      });

      mockAPI.getCommitStatus.mockResolvedValue([
        { name: 'test', status: 'pending' },
      ] as any);

      // Start the update
      const resultPromise = updater.updateIfBehind(123);

      // Fast-forward time to trigger the polling
      await jest.advanceTimersByTimeAsync(30000);

      const result = await resultPromise;

      expect(result.success).toBe(true);

      jest.useRealTimers();
    });

    it('should return failure if tests fail after update', async () => {
      mockValidator.isBehind.mockResolvedValue(true);
      mockAPI.updateBranch.mockResolvedValue({
        success: true,
        conflict: false,
        sha: 'new-sha',
      });
      mockAPI.getPullRequest.mockResolvedValue({ state: 'open' } as any);
      mockValidator.checkStatusChecks.mockResolvedValue({ valid: false });
      mockAPI.getCommitStatus.mockResolvedValue([
        { name: 'test', status: 'failure' },
      ] as any);

      const result = await updater.updateIfBehind(123);

      expect(result.success).toBe(false);
      expect(result.error).toContain('failed after branch update');
    });
  });

  describe('waitForTests', () => {
    it('should return false if PR is closed', async () => {
      mockAPI.getPullRequest.mockResolvedValue({ state: 'closed' } as any);

      const result = await updater.waitForTests(123, 'sha123');

      expect(result).toBe(false);
    });

    it('should return true when all checks pass', async () => {
      mockAPI.getPullRequest.mockResolvedValue({ state: 'open' } as any);
      mockValidator.checkStatusChecks.mockResolvedValue({ valid: true });

      const result = await updater.waitForTests(123, 'sha123');

      expect(result).toBe(true);
    });

    it('should return false when checks fail', async () => {
      mockAPI.getPullRequest.mockResolvedValue({ state: 'open' } as any);
      mockValidator.checkStatusChecks.mockResolvedValue({ valid: false });
      mockAPI.getCommitStatus.mockResolvedValue([
        { name: 'test', status: 'failure' },
      ] as any);

      const result = await updater.waitForTests(123, 'sha123');

      expect(result).toBe(false);
    });
  });
});
