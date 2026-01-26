/**
 * Check command - CI health check with exit codes.
 *
 * @packageDocumentation
 */
import type { AnalysisResult } from '@migrex/core';
import { ExitCode } from '../utils/exit-codes.js';
/**
 * Options for the check command.
 * @public
 */
export interface CheckOptions {
    /** Path to migration graph or config file */
    graph?: string;
    /** Treat warnings as errors */
    strict?: boolean;
    /** Output as JSON instead of text */
    json?: boolean;
}
/**
 * Result of the check command.
 * @public
 */
export interface CheckResult {
    /** Exit code to return */
    exitCode: ExitCode;
    /** Analysis result */
    analysis?: AnalysisResult;
    /** Error message if check failed */
    error?: string;
}
/**
 * Execute the check command.
 * Validates the migration graph and returns appropriate exit codes for CI.
 *
 * @param options - Check command options
 * @returns Check result with exit code
 * @public
 */
export declare function checkCommand(options: CheckOptions): Promise<CheckResult>;
//# sourceMappingURL=check.d.ts.map