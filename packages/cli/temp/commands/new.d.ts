/**
 * New command - Create new schema or migration files.
 *
 * @packageDocumentation
 */
import { ExitCode } from '../utils/exit-codes.js';
/**
 * Options for creating a new schema.
 * @public
 */
export interface NewSchemaOptions {
    /** Schema version */
    version: string;
    /** Plugin to use (zod or json-schema) */
    plugin?: 'zod' | 'json-schema';
}
/**
 * Options for creating a new migration.
 * @public
 */
export interface NewMigrationOptions {
    /** Source version */
    from: string;
    /** Target version */
    to: string;
    /** Plugin to use (zod or json-schema) */
    plugin?: 'zod' | 'json-schema';
}
/**
 * Result of the new command.
 * @public
 */
export interface NewResult {
    /** Exit code to return */
    exitCode: ExitCode;
    /** File that was created */
    fileCreated?: string;
    /** Error message if new failed */
    error?: string;
}
/**
 * Execute the new schema command.
 * Creates a new schema file from template.
 *
 * @param options - New schema options
 * @returns New result with exit code
 * @public
 */
export declare function newSchemaCommand(options: NewSchemaOptions): Promise<NewResult>;
/**
 * Execute the new migration command.
 * Creates a new migration file from template.
 *
 * @param options - New migration options
 * @returns New result with exit code
 * @public
 */
export declare function newMigrationCommand(options: NewMigrationOptions): Promise<NewResult>;
//# sourceMappingURL=new.d.ts.map