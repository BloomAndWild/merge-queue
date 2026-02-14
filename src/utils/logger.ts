/**
 * Structured logging utilities for the merge queue
 */

import * as core from '@actions/core';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Logger class for structured logging
 */
export class Logger {
  constructor(private context: Record<string, unknown> = {}) {}

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Record<string, unknown>): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
    core.debug(this.formatMessage(message, context));
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
    core.info(this.formatMessage(message, context));
  }

  /**
   * Log a warning message
   */
  warning(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARNING, message, context);
    core.warning(this.formatMessage(message, context));
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const errorContext = error
      ? {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : context;

    this.log(LogLevel.ERROR, message, errorContext);
    core.error(this.formatMessage(message, errorContext));
  }

  /**
   * Format a log message with context
   */
  private formatMessage(message: string, context?: Record<string, unknown>): string {
    const allContext = { ...this.context, ...context };

    if (Object.keys(allContext).length === 0) {
      return message;
    }

    const contextStr = Object.entries(allContext)
      .map(([key, value]) => {
        const valueStr =
          typeof value === 'object' && value !== null
            ? JSON.stringify(value)
            : String(value as string | number | boolean | null | undefined);
        return `${key}=${valueStr}`;
      })
      .join(' ');

    return `${message} [${contextStr}]`;
  }

  /**
   * Internal log method (can be extended for custom logging backends)
   */
  private log(_level: LogLevel, _message: string, _context?: Record<string, unknown>): void {
    // Future: could create structured log entry and send to external logging services
    // Currently relies on GitHub Actions core logging only
  }

  /**
   * Start a log group
   */
  startGroup(name: string): void {
    core.startGroup(name);
  }

  /**
   * End a log group
   */
  endGroup(): void {
    core.endGroup();
  }
}

/**
 * Create a default logger instance
 */
export function createLogger(context?: Record<string, unknown>): Logger {
  return new Logger(context);
}
