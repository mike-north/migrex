/**
 * Template for generating migration files.
 *
 * @packageDocumentation
 */
/**
 * Options for generating a migration template.
 * @public
 */
export interface MigrationTemplateOptions {
    /** Source version */
    from: string;
    /** Target version */
    to: string;
    /** Plugin to use (zod or json-schema) */
    plugin: 'zod' | 'json-schema';
}
/**
 * Generate a migration template file content.
 * @param options - Template options
 * @returns Generated file content
 * @public
 */
export declare function generateMigrationTemplate(options: MigrationTemplateOptions): string;
//# sourceMappingURL=migration.template.d.ts.map