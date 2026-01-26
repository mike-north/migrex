/**
 * Template for generating config files.
 *
 * @packageDocumentation
 */
/**
 * Options for generating a config template.
 * @public
 */
export interface ConfigTemplateOptions {
    /** Plugin to use (zod or json-schema) */
    plugin: 'zod' | 'json-schema';
    /** Initial version */
    initialVersion?: string;
}
/**
 * Generate a config template file content.
 * @param options - Template options
 * @returns Generated file content
 * @public
 */
export declare function generateConfigTemplate(options: ConfigTemplateOptions): string;
/**
 * Generate a gitignore template for migrex projects.
 * @public
 */
export declare function generateGitignoreTemplate(): string;
/**
 * Generate a README template for migrex projects.
 * @param options - Template options
 * @public
 */
export declare function generateReadmeTemplate(options: ConfigTemplateOptions): string;
//# sourceMappingURL=config.template.d.ts.map