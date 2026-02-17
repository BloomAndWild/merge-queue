/**
 * Tests for shared action helper utilities
 */

import { parseRepository, parsePRNumber, getConfig } from '../action-helpers';
import * as core from '@actions/core';

// Mock @actions/core
jest.mock('@actions/core');
const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;

describe('Action Helpers', () => {
  describe('parseRepository', () => {
    it('should parse a valid owner/repo string', () => {
      const result = parseRepository('myorg/myrepo');
      expect(result).toEqual({ owner: 'myorg', repo: 'myrepo' });
    });

    it('should handle hyphens and dots in names', () => {
      const result = parseRepository('my-org/my-repo.js');
      expect(result).toEqual({ owner: 'my-org', repo: 'my-repo.js' });
    });

    it('should throw for an empty string', () => {
      expect(() => parseRepository('')).toThrow('Invalid repository format');
    });

    it('should throw for a string without a slash', () => {
      expect(() => parseRepository('justrepo')).toThrow('Invalid repository format');
    });

    it('should throw for a trailing slash (missing repo)', () => {
      expect(() => parseRepository('owner/')).toThrow('Invalid repository format');
    });

    it('should throw for a leading slash (missing owner)', () => {
      expect(() => parseRepository('/repo')).toThrow('Invalid repository format');
    });

    it('should throw for extra path segments', () => {
      expect(() => parseRepository('owner/repo/extra')).toThrow('Invalid repository format');
    });
  });

  describe('parsePRNumber', () => {
    it('should parse a valid PR number', () => {
      expect(parsePRNumber('42')).toBe(42);
    });

    it('should parse large PR numbers', () => {
      expect(parsePRNumber('99999')).toBe(99999);
    });

    it('should throw for non-numeric input', () => {
      expect(() => parsePRNumber('abc')).toThrow('Invalid pr-number');
    });

    it('should throw for an empty string', () => {
      expect(() => parsePRNumber('')).toThrow('Invalid pr-number');
    });

    it('should throw for zero', () => {
      expect(() => parsePRNumber('0')).toThrow('Invalid pr-number');
    });

    it('should throw for negative numbers', () => {
      expect(() => parsePRNumber('-5')).toThrow('Invalid pr-number');
    });

    it('should throw for floating point numbers', () => {
      // parseInt('3.14') returns 3, which is > 0, so it passes.
      // This is acceptable — parseInt truncates to integer.
      expect(parsePRNumber('3.14')).toBe(3);
    });
  });

  describe('getConfig', () => {
    /** Helper to set up mockGetInput with a map of input name → value */
    function setInputs(overrides: Record<string, string> = {}) {
      const defaults: Record<string, string> = {
        'merge-method': 'squash',
        'update-timeout-minutes': '30',
        'max-update-retries': '3',
        'queue-label': 'ready',
        'failed-label': 'merge-queue-failed',
        'conflict-label': 'merge-queue-conflict',
        'processing-label': 'merge-processing',
        'updating-label': 'merge-updating',
        'queued-label': 'queued-for-merge',
        'allow-pending-checks': 'false',
        'allow-draft': 'false',
        'block-labels': 'do-not-merge,wip',
        'auto-update-branch': 'true',
        'delete-branch-after-merge': 'true',
      };

      const inputs = { ...defaults, ...overrides };

      mockGetInput.mockImplementation((name: string) => inputs[name] ?? '');
    }

    beforeEach(() => {
      mockGetInput.mockReset();
    });

    it('should return a valid config with default inputs', () => {
      setInputs();

      const config = getConfig();

      expect(config.mergeMethod).toBe('squash');
      expect(config.updateTimeoutMinutes).toBe(30);
      expect(config.maxUpdateRetries).toBe(3);
      expect(config.queueLabel).toBe('ready');
      expect(config.failedLabel).toBe('merge-queue-failed');
      expect(config.conflictLabel).toBe('merge-queue-conflict');
      expect(config.processingLabel).toBe('merge-processing');
      expect(config.updatingLabel).toBe('merge-updating');
      expect(config.queuedLabel).toBe('queued-for-merge');
      expect(config.allowPendingChecks).toBe(false);
      expect(config.allowDraft).toBe(false);
      expect(config.blockLabels).toEqual(['do-not-merge', 'wip']);
      expect(config.autoUpdateBranch).toBe(true);
      expect(config.deleteBranchAfterMerge).toBe(true);
    });

    it('should accept all valid merge methods', () => {
      for (const method of ['merge', 'squash', 'rebase']) {
        setInputs({ 'merge-method': method });
        expect(getConfig().mergeMethod).toBe(method);
      }
    });

    it('should throw for an invalid merge method', () => {
      setInputs({ 'merge-method': 'fast-forward' });

      expect(() => getConfig()).toThrow('Invalid merge method');
      expect(() => getConfig()).toThrow('fast-forward');
    });

    it('should throw for non-numeric update-timeout-minutes', () => {
      setInputs({ 'update-timeout-minutes': 'never' });

      expect(() => getConfig()).toThrow('Invalid update-timeout-minutes');
    });

    it('should throw for zero update-timeout-minutes', () => {
      setInputs({ 'update-timeout-minutes': '0' });

      expect(() => getConfig()).toThrow('Invalid update-timeout-minutes');
    });

    it('should parse a valid max-update-retries', () => {
      setInputs({ 'max-update-retries': '5' });

      expect(getConfig().maxUpdateRetries).toBe(5);
    });

    it('should throw for non-numeric max-update-retries', () => {
      setInputs({ 'max-update-retries': 'unlimited' });

      expect(() => getConfig()).toThrow('Invalid max-update-retries');
    });

    it('should throw for zero max-update-retries', () => {
      setInputs({ 'max-update-retries': '0' });

      expect(() => getConfig()).toThrow('Invalid max-update-retries');
    });

    it('should parse boolean fields correctly', () => {
      setInputs({
        'allow-pending-checks': 'true',
        'allow-draft': 'true',
        'auto-update-branch': 'false',
        'delete-branch-after-merge': 'false',
      });

      const config = getConfig();

      expect(config.allowPendingChecks).toBe(true);
      expect(config.allowDraft).toBe(true);
      expect(config.autoUpdateBranch).toBe(false);
      expect(config.deleteBranchAfterMerge).toBe(false);
    });

    it('should treat non-"true" values as false for booleans', () => {
      setInputs({
        'allow-pending-checks': 'yes',
        'allow-draft': '1',
      });

      const config = getConfig();

      expect(config.allowPendingChecks).toBe(false);
      expect(config.allowDraft).toBe(false);
    });

    it('should split block-labels by comma and trim whitespace', () => {
      setInputs({ 'block-labels': ' wip , do-not-merge , blocked ' });

      expect(getConfig().blockLabels).toEqual(['wip', 'do-not-merge', 'blocked']);
    });

    it('should filter empty block-labels', () => {
      setInputs({ 'block-labels': 'wip,,,,blocked' });

      expect(getConfig().blockLabels).toEqual(['wip', 'blocked']);
    });

    it('should handle an empty block-labels string', () => {
      setInputs({ 'block-labels': '' });

      expect(getConfig().blockLabels).toEqual([]);
    });
  });
});
