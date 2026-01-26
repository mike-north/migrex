/**
 * Analyze command - Full analysis report.
 *
 * @packageDocumentation
 */
import { ExitCode } from '../utils/exit-codes.js';
/**
 * Options for the analyze command.
 * @public
 */
export interface AnalyzeOptions {
    /** Path to migration graph or config file */
    graph?: string;
    /** Output format (json or text) */
    format?: 'json' | 'text';
}
/**
 * Result of the analyze command.
 * @public
 */
export interface AnalyzeResult {
    /** Exit code to return */
    exitCode: ExitCode;
    /** Error message if analyze failed */
    error?: string;
}
/**
 * Execute the analyze command.
 * Performs comprehensive analysis and displays results.
 *
 * @param options - Analyze command options
 * @returns Analyze result with exit code
 * @public
 */
export declare function analyzeCommand(options: AnalyzeOptions): Promise<AnalyzeResult>;
//# sourceMappingURL=analyze.d.ts.map