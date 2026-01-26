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
export const ExitCode = {
  /** Operation completed successfully */
  SUCCESS: 0,
  /** General error (unspecified failure) */
  GENERAL_ERROR: 1,
  /** Configuration file error (missing, invalid, etc.) */
  CONFIG_ERROR: 2,
  /** Validation error (graph validation failed) */
  VALIDATION_ERROR: 3,
  /** File not found error */
  FILE_NOT_FOUND: 4,
} as const;

/**
 * Type representing valid exit codes.
 * @public
 */
export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
