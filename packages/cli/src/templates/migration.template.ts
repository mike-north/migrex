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
export function generateMigrationTemplate(
  options: MigrationTemplateOptions
): string {
  const fromIdentifier = options.from.replace(/\./g, '_');
  const toIdentifier = options.to.replace(/\./g, '_');

  return `import type { ReversibleMigration } from '@migrex/core';
import type { Schema as V${fromIdentifier} } from './v${fromIdentifier}.js';
import type { Schema as V${toIdentifier} } from './v${toIdentifier}.js';

/**
 * Migration from ${options.from} to ${options.to}.
 */
export const migration: ReversibleMigration<V${fromIdentifier}, V${toIdentifier}> = {
  from: '${options.from}',
  to: '${options.to}',
  traits: {
    lossy: false,
    partial: false,
    requiresContext: false,
  },

  up(data) {
    // TODO: Implement forward migration
    return {
      version: '${options.to}',
      // Map fields from v${options.from} to v${options.to}
    };
  },

  down(data) {
    // TODO: Implement backward migration
    return {
      version: '${options.from}',
      // Map fields from v${options.to} to v${options.from}
    };
  },
};
`;
}
