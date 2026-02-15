/**
 * Structured logging utilities for the merge queue
 */
/**
 * Log levels
 */
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}
/**
 * Logger class for structured logging
 */
export declare class Logger {
    private context;
    constructor(context?: Record<string, unknown>);
    /**
     * Create a child logger with additional context
     */
    child(additionalContext: Record<string, unknown>): Logger;
    /**
     * Log a debug message
     */
    debug(message: string, context?: Record<string, unknown>): void;
    /**
     * Log an info message
     */
    info(message: string, context?: Record<string, unknown>): void;
    /**
     * Log a warning message
     */
    warning(message: string, context?: Record<string, unknown>): void;
    /**
     * Log an error message
     */
    error(message: string, error?: Error, context?: Record<string, unknown>): void;
    /**
     * Format a log message with context
     */
    private formatMessage;
    /**
     * Internal log method (can be extended for custom logging backends)
     */
    private log;
    /**
     * Start a log group
     */
    startGroup(name: string): void;
    /**
     * End a log group
     */
    endGroup(): void;
}
/**
 * Create a default logger instance
 */
export declare function createLogger(context?: Record<string, unknown>): Logger;
//# sourceMappingURL=logger.d.ts.map