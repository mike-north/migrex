/**
 * Init command - Initialize project structure.
 *
 * @packageDocumentation
 */
import { ExitCode } from '../utils/exit-codes.js';
/**
 * Options for the init command.
 * @public
 */
export interface InitOptions {
    /** Plugin to use (zod or json-schema) */
    plugin?: 'zod' | 'json-schema';
    /** Initial version */
    version?: string;
}
/**
 * Result of the init command.
 * @public
 */
export interface InitResult {
    /** Exit code to return */
    exitCode: ExitCode;
    /** Files that were created */
    filesCreated?: string[];
    /** Error message if init failed */
    error?: string;
}
/**
 * Execute the init command.
 * Creates project structure with config file, example schema, and directories.
 *
 * @param options - Init command options
 * @returns Init result with exit code
 * @public
 */
export declare function initCommand(options: InitOptions): Promise<InitResult>;
//# sourceMappingURL=init.d.ts.map