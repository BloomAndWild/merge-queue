/**
 * Tests for constants
 */

import {
  STATE_BRANCH,
  QUEUE_VERSION,
  DEFAULT_CONFIG,
  RETRY_CONFIG,
  TIMEOUTS,
  COMMENT_TEMPLATES,
  LABEL_COLORS,
} from '../constants';

describe('Constants', () => {
  describe('STATE_BRANCH', () => {
    it('should be defined', () => {
      expect(STATE_BRANCH).toBe('merge-queue-state');
    });
  });

  describe('QUEUE_VERSION', () => {
    it('should be a valid semver', () => {
      expect(QUEUE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have all required fields', () => {
      expect(DEFAULT_CONFIG).toHaveProperty('queueLabel');
      expect(DEFAULT_CONFIG).toHaveProperty('requiredApprovals');
      expect(DEFAULT_CONFIG).toHaveProperty('mergeMethod');
      expect(DEFAULT_CONFIG).toHaveProperty('autoUpdateBranch');
    });

    it('should have reasonable defaults', () => {
      expect(DEFAULT_CONFIG.requiredApprovals).toBe(1);
      expect(DEFAULT_CONFIG.requireAllChecks).toBe(true);
      expect(DEFAULT_CONFIG.allowDraft).toBe(false);
      expect(DEFAULT_CONFIG.autoUpdateBranch).toBe(true);
    });
  });

  describe('RETRY_CONFIG', () => {
    it('should have retry settings', () => {
      expect(RETRY_CONFIG.maxRetries).toBeGreaterThan(0);
      expect(RETRY_CONFIG.initialDelayMs).toBeGreaterThan(0);
      expect(RETRY_CONFIG.backoffMultiplier).toBeGreaterThan(1);
    });
  });

  describe('TIMEOUTS', () => {
    it('should have timeout settings', () => {
      expect(TIMEOUTS.checkStatusPollMs).toBeGreaterThan(0);
      expect(TIMEOUTS.maxTestWaitMs).toBeGreaterThan(0);
      expect(TIMEOUTS.apiTimeoutMs).toBeGreaterThan(0);
    });
  });

  describe('COMMENT_TEMPLATES', () => {
    it('should have template functions', () => {
      expect(typeof COMMENT_TEMPLATES.addedToQueue).toBe('function');
      expect(typeof COMMENT_TEMPLATES.buildSummary).toBe('function');
    });

    it('should generate correct addedToQueue message', () => {
      expect(COMMENT_TEMPLATES.addedToQueue(3)).toContain('position 3');
    });

    it('should build a summary with success steps', () => {
      const summary = COMMENT_TEMPLATES.buildSummary('Merged Successfully', [
        { label: 'Validation passed', status: 'success' },
        { label: 'Branch updated with latest master', status: 'success' },
        { label: 'Tests passed after update', status: 'success' },
        { label: 'Merged successfully', status: 'success' },
      ]);

      expect(summary).toContain('Merged Successfully');
      expect(summary).toContain('✅ Validation passed');
      expect(summary).toContain('✅ Merged successfully');
    });

    it('should build a summary with failure steps and details', () => {
      const summary = COMMENT_TEMPLATES.buildSummary('Removed from Queue', [
        { label: 'Validation passed', status: 'success' },
        {
          label: 'Tests failed after branch update',
          status: 'failure',
          detail: 'CI check "build" failed',
        },
      ]);

      expect(summary).toContain('Removed from Queue');
      expect(summary).toContain('✅ Validation passed');
      expect(summary).toContain('❌ Tests failed after branch update');
      expect(summary).toContain('CI check "build" failed');
    });
  });

  describe('LABEL_COLORS', () => {
    it('should have hex colors', () => {
      Object.values(LABEL_COLORS).forEach(color => {
        expect(color).toMatch(/^[0-9a-f]{6}$/i);
      });
    });

    it('should have all required labels', () => {
      expect(LABEL_COLORS).toHaveProperty('ready');
      expect(LABEL_COLORS).toHaveProperty('queued');
      expect(LABEL_COLORS).toHaveProperty('processing');
      expect(LABEL_COLORS).toHaveProperty('failed');
      expect(LABEL_COLORS).toHaveProperty('conflict');
    });
  });
});
