/**
 * Diff command - Show diff between two versions.
 *
 * @packageDocumentation
 */
import { ExitCode } from '../utils/exit-codes.js';
/**
 * Options for the diff command.
 * @public
 */
export interface DiffOptions {
    /** Source version */
    from: string;
    /** Target version */
    to: string;
    /** Path to migration graph or config file */
    graph?: string;
    /** Output format (json or text) */
    format?: 'json' | 'text';
}
/**
 * Result of the diff command.
 * @public
 */
export interface DiffResult {
    /** Exit code to return */
    exitCode: ExitCode;
    /** Error message if diff failed */
    error?: string;
}
/**
 * Execute the diff command.
 * Shows the differences between two schema versions.
 *
 * Note: This is a placeholder implementation. Full schema diff
 * functionality would require schema introspection APIs from
 * `@migrex/core` that are not yet available.
 *
 * @param options - Diff command options
 * @returns Diff result with exit code
 * @public
 */
export declare function diffCommand(options: DiffOptions): Promise<DiffResult>;
//# sourceMappingURL=diff.d.ts.map