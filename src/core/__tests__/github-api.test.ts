/**
 * Tests for GitHubAPI
 */

import { GitHubAPI } from '../github-api';
import { GitHubAPIError } from '../../utils/errors';

// Mock functions for each Octokit REST endpoint
const mockListForRepo = jest.fn();
const mockPullsGet = jest.fn();
const mockPullsMerge = jest.fn();
const mockPullsUpdateBranch = jest.fn();
const mockChecksListForRef = jest.fn();
const mockGetCombinedStatusForRef = jest.fn();
const mockCompareCommitsWithBasehead = jest.fn();

jest.mock('@actions/github', () => ({
  getOctokit: () => ({
    rest: {
      issues: {
        listForRepo: mockListForRepo,
      },
      pulls: {
        get: mockPullsGet,
        merge: mockPullsMerge,
        updateBranch: mockPullsUpdateBranch,
      },
      checks: {
        listForRef: mockChecksListForRef,
      },
      repos: {
        getCombinedStatusForRef: mockGetCombinedStatusForRef,
        compareCommitsWithBasehead: mockCompareCommitsWithBasehead,
      },
    },
  }),
}));

describe('GitHubAPI', () => {
  let api: GitHubAPI;

  beforeEach(() => {
    jest.clearAllMocks();
    api = new GitHubAPI('fake-token', { owner: 'test-org', repo: 'test-repo' });
  });

  describe('listPRsWithLabel', () => {
    it('should return PR numbers sorted by creation date', async () => {
      mockListForRepo.mockResolvedValue({
        data: [
          { number: 10, pull_request: { url: 'https://...' } },
          { number: 20, pull_request: { url: 'https://...' } },
          { number: 30, pull_request: { url: 'https://...' } },
        ],
      });

      const result = await api.listPRsWithLabel('queued-for-merge');

      expect(result).toEqual([10, 20, 30]);
      expect(mockListForRepo).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        labels: 'queued-for-merge',
        state: 'open',
        sort: 'created',
        direction: 'asc',
        per_page: 100,
      });
    });

    it('should filter out non-PR issues', async () => {
      mockListForRepo.mockResolvedValue({
        data: [
          { number: 1, pull_request: { url: 'https://...' } },
          { number: 2 }, // plain issue, no pull_request key
          { number: 3, pull_request: { url: 'https://...' } },
        ],
      });

      const result = await api.listPRsWithLabel('queued-for-merge');

      expect(result).toEqual([1, 3]);
    });

    it('should return empty array when no PRs match', async () => {
      mockListForRepo.mockResolvedValue({ data: [] });

      const result = await api.listPRsWithLabel('queued-for-merge');

      expect(result).toEqual([]);
    });

    it('should throw GitHubAPIError on API failure', async () => {
      mockListForRepo.mockRejectedValue(Object.assign(new Error('API error'), { status: 500 }));

      await expect(api.listPRsWithLabel('queued-for-merge')).rejects.toThrow(
        'Failed to list PRs with label'
      );
    });
  });

  describe('getCommitStatus', () => {
    it('should combine check runs and commit statuses', async () => {
      mockChecksListForRef.mockResolvedValue({
        data: {
          check_runs: [
            { name: 'build', conclusion: 'success', status: 'completed' },
            { name: 'lint', conclusion: 'failure', status: 'completed' },
          ],
        },
      });
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: {
          statuses: [{ context: 'ci/deploy', state: 'pending' }],
        },
      });

      const result = await api.getCommitStatus('abc123');

      expect(result).toEqual([
        { name: 'build', status: 'success', conclusion: 'success' },
        { name: 'lint', status: 'failure', conclusion: 'failure' },
        { name: 'ci/deploy', status: 'pending', conclusion: 'pending' },
      ]);
    });

    it('should map check-run conclusions correctly', async () => {
      mockChecksListForRef.mockResolvedValue({
        data: {
          check_runs: [
            { name: 'cancelled-check', conclusion: 'cancelled', status: 'completed' },
            { name: 'neutral-check', conclusion: 'neutral', status: 'completed' },
            { name: 'skipped-check', conclusion: 'skipped', status: 'completed' },
            { name: 'timed-out-check', conclusion: 'timed_out', status: 'completed' },
            { name: 'action-required-check', conclusion: 'action_required', status: 'completed' },
            { name: 'stale-check', conclusion: 'stale', status: 'completed' },
          ],
        },
      });
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });

      const result = await api.getCommitStatus('sha1');

      expect(result).toEqual([
        { name: 'cancelled-check', status: 'cancelled', conclusion: 'cancelled' },
        { name: 'neutral-check', status: 'neutral', conclusion: 'neutral' },
        { name: 'skipped-check', status: 'skipped', conclusion: 'skipped' },
        { name: 'timed-out-check', status: 'failure', conclusion: 'timed_out' },
        { name: 'action-required-check', status: 'failure', conclusion: 'action_required' },
        { name: 'stale-check', status: 'pending', conclusion: 'stale' },
      ]);
    });

    it('should handle check runs with no conclusion (in progress)', async () => {
      mockChecksListForRef.mockResolvedValue({
        data: {
          check_runs: [
            { name: 'running', conclusion: null, status: 'in_progress' },
            { name: 'done', conclusion: null, status: 'completed' },
          ],
        },
      });
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });

      const result = await api.getCommitStatus('sha1');

      expect(result).toEqual([
        { name: 'running', status: 'pending', conclusion: undefined },
        { name: 'done', status: 'success', conclusion: undefined },
      ]);
    });

    it('should map commit-status states correctly', async () => {
      mockChecksListForRef.mockResolvedValue({
        data: { check_runs: [] },
      });
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: {
          statuses: [
            { context: 'success-status', state: 'success' },
            { context: 'failure-status', state: 'failure' },
            { context: 'error-status', state: 'error' },
            { context: 'pending-status', state: 'pending' },
          ],
        },
      });

      const result = await api.getCommitStatus('sha1');

      expect(result).toEqual([
        { name: 'success-status', status: 'success', conclusion: 'success' },
        { name: 'failure-status', status: 'failure', conclusion: 'failure' },
        { name: 'error-status', status: 'failure', conclusion: 'error' },
        { name: 'pending-status', status: 'pending', conclusion: 'pending' },
      ]);
    });

    it('should throw GitHubAPIError on failure', async () => {
      mockChecksListForRef.mockRejectedValue(
        Object.assign(new Error('API error'), { status: 500 })
      );

      await expect(api.getCommitStatus('sha1')).rejects.toThrow('Failed to fetch commit status');
    });

    it('should deduplicate check runs by name, keeping the latest (highest id)', async () => {
      mockChecksListForRef.mockResolvedValue({
        data: {
          check_runs: [
            { id: 100, name: 'UnitTests (1)', conclusion: 'success', status: 'completed' },
            { id: 101, name: 'UnitTests (2)', conclusion: 'failure', status: 'completed' },
            { id: 200, name: 'UnitTests (1)', conclusion: 'failure', status: 'completed' },
            { id: 201, name: 'UnitTests (2)', conclusion: 'success', status: 'completed' },
          ],
        },
      });
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });

      const result = await api.getCommitStatus('sha1');

      expect(result).toEqual([
        { name: 'UnitTests (1)', status: 'failure', conclusion: 'failure' },
        { name: 'UnitTests (2)', status: 'success', conclusion: 'success' },
      ]);
    });

    it('should keep in-progress re-run over stale failure', async () => {
      mockChecksListForRef.mockResolvedValue({
        data: {
          check_runs: [
            { id: 100, name: 'UnitTests (3)', conclusion: 'failure', status: 'completed' },
            { id: 200, name: 'UnitTests (3)', conclusion: null, status: 'in_progress' },
          ],
        },
      });
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });

      const result = await api.getCommitStatus('sha1');

      expect(result).toEqual([{ name: 'UnitTests (3)', status: 'pending', conclusion: undefined }]);
    });

    it('should keep latest failure over stale success', async () => {
      mockChecksListForRef.mockResolvedValue({
        data: {
          check_runs: [
            { id: 50, name: 'build', conclusion: 'success', status: 'completed' },
            { id: 150, name: 'build', conclusion: 'failure', status: 'completed' },
          ],
        },
      });
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });

      const result = await api.getCommitStatus('sha1');

      expect(result).toEqual([{ name: 'build', status: 'failure', conclusion: 'failure' }]);
    });

    it('should handle a full matrix re-run with mixed old and new check runs', async () => {
      mockChecksListForRef.mockResolvedValue({
        data: {
          check_runs: [
            // Attempt 1 results
            { id: 100, name: 'UnitTests (1)', conclusion: 'success', status: 'completed' },
            { id: 101, name: 'UnitTests (2)', conclusion: 'success', status: 'completed' },
            { id: 102, name: 'UnitTests (3)', conclusion: 'failure', status: 'completed' },
            { id: 103, name: 'UnitTestsCombined', conclusion: 'cancelled', status: 'completed' },
            // Attempt 2 results (re-run)
            { id: 200, name: 'UnitTests (1)', conclusion: null, status: 'in_progress' },
            { id: 201, name: 'UnitTests (2)', conclusion: null, status: 'in_progress' },
            { id: 202, name: 'UnitTests (3)', conclusion: null, status: 'in_progress' },
            { id: 203, name: 'UnitTestsCombined', conclusion: null, status: 'queued' },
          ],
        },
      });
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });

      const result = await api.getCommitStatus('sha1');

      expect(result).toHaveLength(4);
      expect(result).toEqual([
        { name: 'UnitTests (1)', status: 'pending', conclusion: undefined },
        { name: 'UnitTests (2)', status: 'pending', conclusion: undefined },
        { name: 'UnitTests (3)', status: 'pending', conclusion: undefined },
        { name: 'UnitTestsCombined', status: 'pending', conclusion: undefined },
      ]);
    });

    it('should not deduplicate across check runs and commit statuses', async () => {
      mockChecksListForRef.mockResolvedValue({
        data: {
          check_runs: [{ id: 1, name: 'ci/build', conclusion: 'success', status: 'completed' }],
        },
      });
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: {
          statuses: [{ context: 'ci/build', state: 'failure' }],
        },
      });

      const result = await api.getCommitStatus('sha1');

      expect(result).toEqual([
        { name: 'ci/build', status: 'success', conclusion: 'success' },
        { name: 'ci/build', status: 'failure', conclusion: 'failure' },
      ]);
    });
  });

  describe('mergePullRequest', () => {
    it('should merge a PR and return the SHA', async () => {
      mockPullsMerge.mockResolvedValue({
        data: { merged: true, sha: 'merge-sha-abc' },
      });

      const result = await api.mergePullRequest(42, 'squash');

      expect(result).toBe('merge-sha-abc');
      expect(mockPullsMerge).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        pull_number: 42,
        merge_method: 'squash',
        commit_title: undefined,
        commit_message: undefined,
      });
    });

    it('should pass commit title and message when provided', async () => {
      mockPullsMerge.mockResolvedValue({
        data: { merged: true, sha: 'sha123' },
      });

      await api.mergePullRequest(42, 'merge', 'My title', 'My message');

      expect(mockPullsMerge).toHaveBeenCalledWith(
        expect.objectContaining({
          commit_title: 'My title',
          commit_message: 'My message',
        })
      );
    });

    it('should throw when PR is not merged', async () => {
      mockPullsMerge.mockResolvedValue({
        data: { merged: false },
      });

      await expect(api.mergePullRequest(42)).rejects.toThrow('Failed to merge PR #42');
    });

    it('should throw GitHubAPIError on API failure', async () => {
      mockPullsMerge.mockRejectedValue(Object.assign(new Error('Conflict'), { status: 409 }));

      await expect(api.mergePullRequest(42)).rejects.toThrow(GitHubAPIError);
    });
  });

  describe('updateBranch', () => {
    it('should return success with new SHA after update', async () => {
      jest.useFakeTimers();

      // First getPullRequest call (before update) returns old SHA
      mockPullsGet
        .mockResolvedValueOnce({
          data: { head: { sha: 'old-sha', ref: 'feature' }, base: { ref: 'main' } },
        })
        // Second call (polling) returns new SHA
        .mockResolvedValueOnce({
          data: { head: { sha: 'new-sha', ref: 'feature' }, base: { ref: 'main' } },
        });

      mockPullsUpdateBranch.mockResolvedValue({});

      const resultPromise = api.updateBranch(1);
      await jest.advanceTimersByTimeAsync(3000);

      const result = await resultPromise;

      expect(result).toEqual({
        success: true,
        conflict: false,
        sha: 'new-sha',
      });

      expect(mockPullsUpdateBranch).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        pull_number: 1,
        expected_head_sha: 'old-sha',
      });

      jest.useRealTimers();
    });

    it('should return conflict on 409 error', async () => {
      mockPullsGet.mockResolvedValue({
        data: { head: { sha: 'old-sha', ref: 'feature' }, base: { ref: 'main' } },
      });
      mockPullsUpdateBranch.mockRejectedValue(
        Object.assign(new Error('Conflict'), { status: 409 })
      );

      const result = await api.updateBranch(1);

      expect(result).toEqual({
        success: false,
        conflict: true,
        error: 'Merge conflict detected',
      });
    });

    it('should detect conflict from error message even on non-409 status', async () => {
      // The 409 branch also catches any message containing "conflict",
      // so a 422 with "conflict" in the message is treated as a conflict
      mockPullsGet.mockResolvedValue({
        data: { head: { sha: 'old-sha', ref: 'feature' }, base: { ref: 'main' } },
      });
      mockPullsUpdateBranch.mockRejectedValue(
        Object.assign(new Error('Merge conflict in file.ts'), { status: 422 })
      );

      const result = await api.updateBranch(1);

      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
    });

    it('should return failure on 422 without conflict', async () => {
      mockPullsGet.mockResolvedValue({
        data: { head: { sha: 'old-sha', ref: 'feature' }, base: { ref: 'main' } },
      });
      mockPullsUpdateBranch.mockRejectedValue(
        Object.assign(new Error('SHA mismatch'), { status: 422 })
      );

      const result = await api.updateBranch(1);

      expect(result.success).toBe(false);
      expect(result.conflict).toBe(false);
      expect(result.error).toContain('SHA mismatch');
    });

    it('should throw for unexpected errors', async () => {
      mockPullsGet.mockResolvedValue({
        data: { head: { sha: 'old-sha', ref: 'feature' }, base: { ref: 'main' } },
      });
      mockPullsUpdateBranch.mockRejectedValue(
        Object.assign(new Error('Server error'), { status: 500 })
      );

      await expect(api.updateBranch(1)).rejects.toThrow(GitHubAPIError);
    });
  });

  describe('isBranchBehind', () => {
    it('should return true when branch is behind', async () => {
      mockPullsGet.mockResolvedValue({
        data: { base: { ref: 'main' }, head: { ref: 'feature' } },
      });
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: { behind_by: 3 },
      });

      const result = await api.isBranchBehind(42);

      expect(result).toBe(true);
      expect(mockCompareCommitsWithBasehead).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        basehead: 'main...feature',
      });
    });

    it('should return false when branch is up to date', async () => {
      mockPullsGet.mockResolvedValue({
        data: { base: { ref: 'main' }, head: { ref: 'feature' } },
      });
      mockCompareCommitsWithBasehead.mockResolvedValue({
        data: { behind_by: 0 },
      });

      const result = await api.isBranchBehind(42);

      expect(result).toBe(false);
    });

    it('should throw GitHubAPIError on failure', async () => {
      mockPullsGet.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }));

      await expect(api.isBranchBehind(42)).rejects.toThrow(GitHubAPIError);
    });
  });
});
