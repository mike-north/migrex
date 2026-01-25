/**
 * Template for generating schema files.
 *
 * @packageDocumentation
 */
/**
 * Options for generating a schema template.
 * @public
 */
export interface SchemaTemplateOptions {
    /** Schema version */
    version: string;
    /** Plugin to use (zod or json-schema) */
    plugin: 'zod' | 'json-schema';
}
/**
 * Generate a schema template file content.
 * @param options - Template options
 * @returns Generated file content
 * @public
 */
export declare function generateSchemaTemplate(options: SchemaTemplateOptions): string;
//# sourceMappingURL=schema.template.d.ts.map