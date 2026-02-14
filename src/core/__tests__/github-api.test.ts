/**
 * Tests for GitHubAPI — listPRsWithLabel
 */

import { GitHubAPI } from '../github-api';

// Mock @actions/github
const mockListForRepo = jest.fn();

jest.mock('@actions/github', () => ({
  getOctokit: () => ({
    rest: {
      issues: {
        listForRepo: mockListForRepo,
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
      mockListForRepo.mockRejectedValue(
        Object.assign(new Error('API error'), { status: 500 })
      );

      await expect(api.listPRsWithLabel('queued-for-merge')).rejects.toThrow(
        'Failed to list PRs with label'
      );
    });
  });
});
