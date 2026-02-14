/**
 * Tests for queue state management
 */

import { getStateFileName, createEmptyState } from '../queue-state';
import { QUEUE_VERSION } from '../../utils/constants';
import type { RepositoryInfo } from '../../types/queue';

describe('Queue State', () => {
  describe('getStateFileName', () => {
    it('should generate correct state file name', () => {
      const repo: RepositoryInfo = {
        owner: 'testorg',
        repo: 'testrepo',
      };

      const fileName = getStateFileName(repo);
      expect(fileName).toBe('testorg-testrepo-queue.json');
    });

    it('should handle different repository names', () => {
      const repo1: RepositoryInfo = {
        owner: 'bloomandwild',
        repo: 'bloomandwild',
      };

      const repo2: RepositoryInfo = {
        owner: 'bloomandwild',
        repo: 'frontend',
      };

      expect(getStateFileName(repo1)).toBe('bloomandwild-bloomandwild-queue.json');
      expect(getStateFileName(repo2)).toBe('bloomandwild-frontend-queue.json');
    });
  });

  describe('createEmptyState', () => {
    it('should create a valid empty state', () => {
      const state = createEmptyState();

      expect(state.version).toBe(QUEUE_VERSION);
      expect(state.updated_at).toBeDefined();
      expect(new Date(state.updated_at)).toBeInstanceOf(Date);
      expect(state.current).toBeNull();
      expect(state.queue).toEqual([]);
      expect(state.history).toEqual([]);
      expect(state.stats).toEqual({
        total_processed: 0,
        total_merged: 0,
        total_failed: 0,
      });
    });

    it('should create states with different timestamps', async () => {
      const state1 = createEmptyState();
      await new Promise(resolve => setTimeout(resolve, 10));
      const state2 = createEmptyState();

      expect(state1.updated_at).not.toBe(state2.updated_at);
    });
  });
});
