/**
 * Graph loading utilities for CLI commands.
 * Handles loading MigrationGraph instances from config files.
 *
 * @packageDocumentation
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MigrationGraph } from '@migrex/core';

/**
 * Result of loading a migration graph.
 * @public
 */
export interface LoadResult {
  /** The loaded migration graph */
  graph: MigrationGraph;
  /** Absolute path to the config file that was loaded */
  path: string;
}

/**
 * Config file module export format.
 * The config file should export a `graph` property.
 */
interface ConfigModule {
  graph?: MigrationGraph;
  default?: MigrationGraph | { graph?: MigrationGraph };
}

/**
 * Possible config file names to search for.
 */
const CONFIG_FILE_NAMES = [
  'migrex.config.ts',
  'migrex.config.js',
  'migrex.config.mjs',
] as const;

/**
 * Load a migration graph from a config file or explicit path.
 *
 * @param graphPath - Optional explicit path to graph file or config file.
 *                    If not provided, searches for standard config files.
 * @returns Load result with graph and path, or undefined if not found.
 * @throws {Error} If config file exists but cannot be loaded or has invalid format.
 * @public
 */
export async function loadGraph(
  graphPath?: string
): Promise<LoadResult | undefined> {
  const configPath = graphPath
    ? resolve(process.cwd(), graphPath)
    : await findConfigFile();

  if (!configPath) {
    return undefined;
  }

  // Import the config file
  const fileUrl = pathToFileURL(configPath).href;
  let module: ConfigModule;

  try {
    module = (await import(fileUrl)) as ConfigModule;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load config file "${configPath}": ${message}`);
  }

  // Extract the graph from the module
  const graph = extractGraph(module);

  if (!graph) {
    throw new Error(
      `Config file "${configPath}" does not export a migration graph. ` +
        'Expected export { graph } or export default graph.'
    );
  }

  return { graph, path: configPath };
}

/**
 * Find the config file in the current directory.
 * Searches for standard config file names in order.
 */
async function findConfigFile(): Promise<string | undefined> {
  const cwd = process.cwd();

  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = resolve(cwd, fileName);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return undefined;
}

/**
 * Extract the MigrationGraph from a config module.
 * Handles different export formats: named export, default export, or default with named property.
 */
function extractGraph(module: ConfigModule): MigrationGraph | undefined {
  // Try named export first: export { graph }
  if (module.graph) {
    return module.graph;
  }

  // Try default export
  if (module.default) {
    // Default export is the graph directly: export default graph
    if (isGraph(module.default)) {
      return module.default;
    }

    // Default export is an object with graph property: export default { graph }
    if (
      typeof module.default === 'object' &&
      'graph' in module.default &&
      isGraph(module.default.graph)
    ) {
      return module.default.graph;
    }
  }

  return undefined;
}

/**
 * Type guard to check if a value is a MigrationGraph.
 * Checks for the presence of required methods.
 */
function isGraph(value: unknown): value is MigrationGraph {
  return (
    typeof value === 'object' &&
    value !== null &&
    'registerSchema' in value &&
    'registerMigration' in value &&
    'hasPath' in value &&
    'getPath' in value &&
    'migrate' in value &&
    'migrateAsync' in value
  );
}
