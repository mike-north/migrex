/**
 * Template system for generating project structures.
 *
 * @packageDocumentation
 */
/**
 * Options for generating a template.
 * @public
 */
export interface TemplateOptions {
    /** Name of the project (used for IDs and identifiers) */
    projectName: string;
    /** Plugin to use (zod or json-schema) */
    plugin: 'zod' | 'json-schema';
    /** Output directory for generated files */
    outputDir: string;
}
/**
 * Represents a file to be generated.
 * @public
 */
export interface GeneratedFile {
    /** Relative path from output directory */
    path: string;
    /** File content */
    content: string;
}
/**
 * A template that can generate multiple files.
 * @public
 */
export interface Template {
    /** Template identifier */
    name: string;
    /** Human-readable description */
    description: string;
    /** Generate files based on options */
    generate(options: TemplateOptions): Promise<GeneratedFile[]> | GeneratedFile[];
}
export { configTemplate } from './config-template.js';
export { restApiTemplate } from './rest-api-template.js';
//# sourceMappingURL=index.d.ts.map