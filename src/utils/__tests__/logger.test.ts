/**
 * Tests for logger
 */

import { Logger, LogLevel, createLogger } from '../logger';
import * as core from '@actions/core';

// Mock @actions/core
jest.mock('@actions/core');

describe('Logger', () => {
  let mockCore: jest.Mocked<typeof core>;

  beforeEach(() => {
    mockCore = core as jest.Mocked<typeof core>;
    jest.clearAllMocks();
  });

  describe('createLogger', () => {
    it('should create a logger with context', () => {
      const logger = createLogger({ component: 'test' });
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create a logger without context', () => {
      const logger = createLogger();
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('Logger methods', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ component: 'test' });
    });

    describe('debug', () => {
      it('should log debug messages', () => {
        logger.debug('test message');

        expect(mockCore.debug).toHaveBeenCalledWith(
          expect.stringContaining('test message')
        );
      });

      it('should include context in message', () => {
        logger.debug('test message', { key: 'value' });

        expect(mockCore.debug).toHaveBeenCalledWith(
          expect.stringContaining('key=value')
        );
      });
    });

    describe('info', () => {
      it('should log info messages', () => {
        logger.info('test message');

        expect(mockCore.info).toHaveBeenCalledWith(
          expect.stringContaining('test message')
        );
      });
    });

    describe('warning', () => {
      it('should log warning messages', () => {
        logger.warning('test message');

        expect(mockCore.warning).toHaveBeenCalledWith(
          expect.stringContaining('test message')
        );
      });
    });

    describe('error', () => {
      it('should log error messages', () => {
        logger.error('test message');

        expect(mockCore.error).toHaveBeenCalledWith(
          expect.stringContaining('test message')
        );
      });

      it('should include error details', () => {
        const error = new Error('test error');
        logger.error('test message', error);

        expect(mockCore.error).toHaveBeenCalledWith(
          expect.stringContaining('test error')
        );
      });
    });

    describe('child', () => {
      it('should create child logger with merged context', () => {
        const child = logger.child({ additional: 'context' });

        child.info('test');

        expect(mockCore.info).toHaveBeenCalledWith(
          expect.stringContaining('component=test')
        );
        expect(mockCore.info).toHaveBeenCalledWith(
          expect.stringContaining('additional=context')
        );
      });
    });

    describe('groups', () => {
      it('should start log group', () => {
        logger.startGroup('test group');

        expect(mockCore.startGroup).toHaveBeenCalledWith('test group');
      });

      it('should end log group', () => {
        logger.endGroup();

        expect(mockCore.endGroup).toHaveBeenCalled();
      });
    });
  });

  describe('context formatting', () => {
    it('should format simple values', () => {
      const logger = new Logger();
      logger.info('test', { string: 'value', number: 42, boolean: true });

      expect(mockCore.info).toHaveBeenCalledWith(
        expect.stringContaining('string=value')
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        expect.stringContaining('number=42')
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        expect.stringContaining('boolean=true')
      );
    });

    it('should format object values as JSON', () => {
      const logger = new Logger();
      logger.info('test', { obj: { nested: 'value' } });

      expect(mockCore.info).toHaveBeenCalledWith(
        expect.stringContaining('obj=')
      );
      expect(mockCore.info).toHaveBeenCalledWith(
        expect.stringContaining('nested')
      );
    });

    it('should handle empty context', () => {
      const logger = new Logger();
      logger.info('test message');

      expect(mockCore.info).toHaveBeenCalledWith('test message');
    });
  });

  describe('LogLevel enum', () => {
    it('should have correct values', () => {
      expect(LogLevel.DEBUG).toBe('debug');
      expect(LogLevel.INFO).toBe('info');
      expect(LogLevel.WARNING).toBe('warning');
      expect(LogLevel.ERROR).toBe('error');
    });
  });
});
