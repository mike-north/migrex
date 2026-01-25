/**
 * Exit codes for CLI operations.
 * Follows standard Unix conventions where 0 indicates success.
 *
 * @packageDocumentation
 */
/**
 * Standard exit codes for the CLI.
 * @public
 */
export declare const ExitCode: {
    /** Operation completed successfully */
    readonly SUCCESS: 0;
    /** General error (unspecified failure) */
    readonly GENERAL_ERROR: 1;
    /** Configuration file error (missing, invalid, etc.) */
    readonly CONFIG_ERROR: 2;
    /** Validation error (graph validation failed) */
    readonly VALIDATION_ERROR: 3;
    /** File not found error */
    readonly FILE_NOT_FOUND: 4;
};
/**
 * Type representing valid exit codes.
 * @public
 */
export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
//# sourceMappingURL=exit-codes.d.ts.map