/**
 * Path command - Show migration path between versions.
 *
 * @packageDocumentation
 */
import { ExitCode } from '../utils/exit-codes.js';
/**
 * Options for the path command.
 * @public
 */
export interface PathOptions {
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
 * Result of the path command.
 * @public
 */
export interface PathResult {
    /** Exit code to return */
    exitCode: ExitCode;
    /** Error message if path failed */
    error?: string;
}
/**
 * Execute the path command.
 * Shows the migration path between two versions.
 *
 * @param options - Path command options
 * @returns Path result with exit code
 * @public
 */
export declare function pathCommand(options: PathOptions): Promise<PathResult>;
//# sourceMappingURL=path.d.ts.map