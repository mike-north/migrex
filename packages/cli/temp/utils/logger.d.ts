/**
 * Simple logger utilities for CLI output.
 * Provides colored console output for different message types.
 *
 * @packageDocumentation
 */
/**
 * Logger for CLI output.
 * @public
 */
export declare const logger: {
    /**
     * Log an informational message.
     */
    info(message: string): void;
    /**
     * Log a success message.
     */
    success(message: string): void;
    /**
     * Log a warning message.
     */
    warn(message: string): void;
    /**
     * Log an error message.
     */
    error(message: string): void;
    /**
     * Log a plain message without color.
     */
    log(message: string): void;
    /**
     * Log a debug message (gray, dimmed).
     */
    debug(message: string): void;
    /**
     * Log a bold message.
     */
    bold(message: string): void;
};
//# sourceMappingURL=logger.d.ts.map