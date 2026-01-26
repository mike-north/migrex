/**
 * Example configuration migration graph
 *
 * This package demonstrates how to use migrex to manage versioned configuration
 * files with automatic migration support.
 *
 * @packageDocumentation
 */

import { createMigrationGraph, semverStrategy } from '@migrex/core';
import {
  schemaV1,
  schemaV2,
  schemaV3,
  schemaV4,
  type ConfigV1,
  type ConfigV2,
  type ConfigV3,
  type ConfigV4,
} from './schemas.js';
import {
  migrationV1ToV2,
  migrationV2ToV3,
  migrationV3ToV4,
} from './migrations.js';

// Export types for consumers
export type {
  ConfigV1,
  ConfigV2,
  ConfigV3,
  ConfigV4,
};

// Export schemas for advanced use cases
export {
  schemaV1,
  schemaV2,
  schemaV3,
  schemaV4,
  ConfigV1Schema,
  ConfigV2Schema,
  ConfigV3Schema,
  ConfigV4Schema,
} from './schemas.js';

// Export migrations for advanced use cases
export {
  migrationV1ToV2,
  migrationV2ToV3,
  migrationV3ToV4,
} from './migrations.js';

/**
 * Create and configure the migration graph for application configuration.
 *
 * @example
 * ```typescript
 * import { createConfigGraph } from '@migrex/example-config';
 *
 * const graph = createConfigGraph();
 *
 * // Migrate from v1 to v4
 * const v1Config = {
 *   version: '1.0.0',
 *   appName: 'My App',
 *   port: 3000,
 *   debug: true,
 * };
 *
 * const result = graph.migrate(v1Config, '1.0.0', '4.0.0');
 * console.log(result.data);
 * ```
 *
 * @returns Configured migration graph ready to use
 */
export function createConfigGraph() {
  const graph = createMigrationGraph({
    id: 'example-config',
    versionStrategy: semverStrategy,
  });

  // Register all schemas
  graph.registerSchema(schemaV1);
  graph.registerSchema(schemaV2);
  graph.registerSchema(schemaV3);
  graph.registerSchema(schemaV4);

  // Register all migrations
  graph.registerMigration(migrationV1ToV2);
  graph.registerMigration(migrationV2ToV3);
  graph.registerMigration(migrationV3ToV4);

  return graph;
}

/**
 * Helper to get the latest configuration version.
 * This is useful when you want to auto-migrate to the latest version.
 */
export const LATEST_VERSION = '4.0.0';
