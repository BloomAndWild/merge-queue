/**
 * Tests for custom error types
 */

import {
  QueueError,
  ValidationError,
  GitHubAPIError,
  MergeConflictError,
  TimeoutError,
  isGitHubError,
} from '../errors';

describe('Custom Errors', () => {
  describe('QueueError', () => {
    it('should create a QueueError with message', () => {
      const error = new QueueError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('QueueError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(QueueError);
    });

    it('should capture stack trace', () => {
      const error = new QueueError('Test error');
      expect(error.stack).toBeDefined();
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with message and reason', () => {
      const error = new ValidationError('Validation failed', 'Missing approvals');
      expect(error.message).toBe('Validation failed');
      expect(error.reason).toBe('Missing approvals');
      expect(error.name).toBe('ValidationError');
      expect(error).toBeInstanceOf(QueueError);
    });
  });

  describe('GitHubAPIError', () => {
    it('should create a GitHubAPIError with status code', () => {
      const error = new GitHubAPIError('API call failed', 404, { data: 'not found' });
      expect(error.message).toBe('API call failed');
      expect(error.statusCode).toBe(404);
      expect(error.response).toEqual({ data: 'not found' });
      expect(error.name).toBe('GitHubAPIError');
    });

    it('should work without status code and response', () => {
      const error = new GitHubAPIError('API call failed');
      expect(error.message).toBe('API call failed');
      expect(error.statusCode).toBeUndefined();
      expect(error.response).toBeUndefined();
    });
  });

  describe('MergeConflictError', () => {
    it('should create a MergeConflictError', () => {
      const error = new MergeConflictError('Merge conflict detected');
      expect(error.message).toBe('Merge conflict detected');
      expect(error.name).toBe('MergeConflictError');
      expect(error).toBeInstanceOf(QueueError);
    });
  });

  describe('TimeoutError', () => {
    it('should create a TimeoutError with timeout value', () => {
      const error = new TimeoutError('Operation timed out', 30000);
      expect(error.message).toBe('Operation timed out');
      expect(error.timeoutMs).toBe(30000);
      expect(error.name).toBe('TimeoutError');
    });
  });

  describe('isGitHubError', () => {
    it('should return true for objects with numeric status', () => {
      expect(isGitHubError({ status: 404, message: 'Not found' })).toBe(true);
      expect(isGitHubError({ status: 409, message: 'Conflict' })).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isGitHubError(null)).toBe(false);
      expect(isGitHubError(undefined)).toBe(false);
      expect(isGitHubError('string')).toBe(false);
      expect(isGitHubError(42)).toBe(false);
    });

    it('should return false for objects without numeric status', () => {
      expect(isGitHubError({ message: 'oops' })).toBe(false);
      expect(isGitHubError({ status: 'bad' })).toBe(false);
      expect(isGitHubError({})).toBe(false);
    });

    it('should return true for standard Error with added status', () => {
      const err = Object.assign(new Error('fail'), { status: 500 });
      expect(isGitHubError(err)).toBe(true);
    });
  });
});
