/**
 * Generate-types command - Generate TypeScript types from analysis.
 *
 * @packageDocumentation
 */
import { ExitCode } from '../utils/exit-codes.js';
/**
 * Options for the generate-types command.
 * @public
 */
export interface GenerateTypesOptions {
    /** Path to migration graph or config file */
    graph?: string;
    /** Output path for generated types */
    output?: string;
}
/**
 * Result of the generate-types command.
 * @public
 */
export interface GenerateTypesResult {
    /** Exit code to return */
    exitCode: ExitCode;
    /** Path where types were written */
    outputPath?: string;
    /** Error message if generation failed */
    error?: string;
}
/**
 * Execute the generate-types command.
 * Analyzes the graph and generates TypeScript type definitions for field profiles.
 *
 * @param options - Generate-types command options
 * @returns Generate-types result with exit code
 * @public
 */
export declare function generateTypesCommand(options: GenerateTypesOptions): Promise<GenerateTypesResult>;
//# sourceMappingURL=generate-types.d.ts.map