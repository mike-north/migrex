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
export function generateConfigTemplate(options: ConfigTemplateOptions): string {
  const version = options.initialVersion ?? '1.0.0';
  const versionIdentifier = version.replace(/\./g, '_');

  return `import { createMigrationGraph, semverStrategy } from '@migrex/core';
import { v${versionIdentifier} } from './schemas/v${versionIdentifier}.js';

/**
 * Migration graph for your project.
 * Register all schemas and migrations here.
 */
export const graph = createMigrationGraph({
  id: 'my-project',
  versionStrategy: semverStrategy,
});

// Register schemas
graph.registerSchema(v${versionIdentifier});

// Register migrations
// Example:
// import { migration as v1_0_0_to_v1_1_0 } from './migrations/v1_0_0_to_v1_1_0.js';
// graph.registerMigration(v1_0_0_to_v1_1_0);
`;
}

/**
 * Generate a gitignore template for migrex projects.
 * @public
 */
export function generateGitignoreTemplate(): string {
  return `# Generated types
migrex-types.d.ts

# Node modules
node_modules/
`;
}

/**
 * Generate a README template for migrex projects.
 * @param options - Template options
 * @public
 */
export function generateReadmeTemplate(
  options: ConfigTemplateOptions
): string {
  const plugin = options.plugin === 'zod' ? 'Zod' : 'JSON Schema';

  return `# Migrex Project

This project uses [migrex](https://github.com/migrex/migrex) for versioned data contracts with ${plugin}.

## Structure

- \`schemas/\` - Schema definitions for each version
- \`migrations/\` - Migration definitions between versions
- \`migrex.config.ts\` - Migration graph configuration

## Commands

- \`migrex check\` - Validate the migration graph (CI integration)
- \`migrex analyze\` - Generate comprehensive analysis report
- \`migrex generate-types\` - Generate TypeScript types from analysis
- \`migrex path --from X --to Y\` - Show migration path between versions
- \`migrex new schema --version X\` - Create a new schema file
- \`migrex new migration --from X --to Y\` - Create a new migration file

## Getting Started

1. Define your first schema in \`schemas/\`
2. Register it in \`migrex.config.ts\`
3. Run \`migrex check\` to validate
4. Create migrations as your schema evolves

## Learn More

- [Migrex Documentation](https://github.com/migrex/migrex)
- [Migration Best Practices](https://github.com/migrex/migrex/docs/best-practices.md)
`;
}
