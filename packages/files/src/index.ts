/**
 * @migrex/files - File-based configuration integration for migrex
 *
 * This package provides utilities for loading, saving, and watching
 * versioned configuration files.
 *
 * @packageDocumentation
 */

import { readFile, writeFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import type {
  MigrationGraph,
  MigrationPath,
  MigrationResult,
} from '@migrex/core';

/**
 * Options for loading a configuration file.
 *
 * @public
 */
export interface LoadConfigOptions {
  /**
   * Target version to migrate to.
   * If not specified, uses the latest version from the graph.
   */
  targetVersion?: string;

  /**
   * File format to use for parsing.
   * If not specified, detected from file extension (.json or .yaml).
   *
   * **Note:** YAML format is not yet supported. Attempting to load a YAML file
   * will throw an error. This limitation will be addressed in a future release.
   */
  format?: 'json' | 'yaml';
}

/**
 * Result of loading a configuration file.
 *
 * @template T - The type of the loaded configuration data
 * @public
 */
export interface LoadConfigResult<T> {
  /** The loaded and migrated configuration data */
  data: T;

  /** The version found in the source file */
  sourceVersion: string;

  /** The version after migration */
  targetVersion: string;

  /** The migration path that was executed (if any) */
  migrationPath?: MigrationPath;

  /** Whether the data was upgraded during loading */
  wasUpgraded: boolean;
}

/**
 * Options for saving a configuration file.
 *
 * @public
 */
export interface SaveConfigOptions {
  /**
   * Version to set in the saved file.
   * If not specified, attempts to detect from data or uses latest from graph.
   */
  version?: string;

  /**
   * File format to use for serialization.
   * If not specified, detected from file extension (.json or .yaml).
   *
   * **Note:** YAML format is not yet supported. Attempting to save as YAML
   * will throw an error. This limitation will be addressed in a future release.
   */
  format?: 'json' | 'yaml';

  /**
   * Whether to pretty-print the output (default: true).
   */
  pretty?: boolean;
}

/**
 * Options for watching a configuration file.
 *
 * @public
 */
export interface WatchConfigOptions {
  /**
   * Target version to migrate to when file changes.
   * If not specified, uses the latest version from the graph.
   */
  targetVersion?: string;

  /**
   * Debounce delay in milliseconds to wait before reloading after change (default: 100ms).
   */
  debounceMs?: number;

  /**
   * Callback invoked when the config is successfully reloaded and migrated.
   */
  onUpdate?: (config: LoadConfigResult<unknown>) => void;

  /**
   * Callback invoked when an error occurs during reload or migration.
   */
  onError?: (error: Error) => void;
}

/**
 * Handle for a configuration file watcher.
 *
 * @public
 */
export interface ConfigWatcher {
  /**
   * Stop watching the file and clean up resources.
   */
  stop(): void;
}

/**
 * Information about differences between two schema versions.
 *
 * @public
 */
export interface VersionDiff {
  /** Source version */
  from: string;

  /** Target version */
  to: string;

  /**
   * Field paths that exist in target but not in source.
   * Note: This is a simplified analysis based on schema comparison.
   */
  addedFields: string[];

  /**
   * Field paths that exist in source but not in target.
   * Note: This is a simplified analysis based on schema comparison.
   */
  removedFields: string[];

  /**
   * Field paths that exist in both but may have different types or constraints.
   * Note: This is a simplified analysis based on schema comparison.
   */
  modifiedFields: string[];
}

/**
 * Error thrown when a configuration file cannot be loaded or parsed.
 *
 * @public
 */
export class ConfigFileError extends Error {
  public override readonly cause?: unknown;

  constructor(
    message: string,
    public readonly filePath: string,
    cause?: unknown
  ) {
    super(message);
    this.name = 'ConfigFileError';
    this.cause = cause;
  }
}

/**
 * Load a configuration file and automatically migrate to target version.
 *
 * @template T - The type of the loaded configuration data
 * @param graph - Migration graph containing schemas and migrations
 * @param filePath - Path to configuration file
 * @param options - Loading options
 * @returns Promise resolving to loaded configuration with migration info
 * @throws {ConfigFileError} If file cannot be read or parsed
 * @throws {MigrationError} If migration fails
 *
 * @example
 * ```typescript
 * const result = await loadConfig(graph, './app.config.json', {
 *   targetVersion: '2.0.0'
 * });
 * console.log(result.data);
 * if (result.wasUpgraded) {
 *   console.log(`Upgraded from ${result.sourceVersion} to ${result.targetVersion}`);
 * }
 * ```
 *
 * @public
 */
export async function loadConfig<T>(
  graph: MigrationGraph,
  filePath: string,
  options: LoadConfigOptions = {}
): Promise<LoadConfigResult<T>> {
  // Read file
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error) {
    throw new ConfigFileError(
      `Failed to read config file: ${filePath}`,
      filePath,
      error
    );
  }

  // Detect format
  const format = options.format ?? detectFormat(filePath);

  // Parse file
  let rawData: unknown;
  try {
    rawData = parseConfig(content, format);
  } catch (error) {
    throw new ConfigFileError(
      `Failed to parse config file as ${format.toUpperCase()}: ${filePath}`,
      filePath,
      error
    );
  }

  // Extract source version
  const sourceVersion = extractVersion(rawData);
  if (!sourceVersion) {
    throw new ConfigFileError(
      `Config file missing 'version' field: ${filePath}`,
      filePath
    );
  }

  // Determine target version
  const targetVersion = options.targetVersion ?? getLatestVersion(graph);

  // Migrate if needed
  const wasUpgraded = sourceVersion !== targetVersion;
  let data: T;
  let migrationPath: MigrationPath | undefined;

  if (wasUpgraded) {
    const result: MigrationResult<T> = await graph.migrateAsync<T>(
      rawData,
      sourceVersion,
      targetVersion
    );

    if (!result.success) {
      throw new ConfigFileError(
        `Failed to migrate config from ${sourceVersion} to ${targetVersion}: ${result.error?.message}`,
        filePath,
        result.error
      );
    }

    data = result.data as T;
    migrationPath = result.path;
  } else {
    // No migration needed, validate only
    const schema = graph.getSchema(sourceVersion);
    if (!schema) {
      throw new ConfigFileError(
        `No schema registered for version ${sourceVersion}`,
        filePath
      );
    }

    const validationResult = schema.schema(rawData);
    if (!validationResult.success) {
      throw new ConfigFileError(
        `Config validation failed: ${formatValidationErrors(validationResult.errors ?? [])}`,
        filePath
      );
    }

    data = validationResult.data as T;
  }

  return {
    data,
    sourceVersion,
    targetVersion,
    ...(migrationPath !== undefined ? { migrationPath } : {}),
    wasUpgraded,
  };
}

/**
 * Save configuration to a file.
 *
 * @param graph - Migration graph (used to determine version if not specified)
 * @param filePath - Path to configuration file
 * @param data - Configuration data to save
 * @param options - Save options
 * @returns Promise that resolves when file is written
 * @throws {ConfigFileError} If file cannot be written
 *
 * @example
 * ```typescript
 * await saveConfig(graph, './app.config.json', {
 *   version: '2.0.0',
 *   name: 'My App',
 *   port: 3000
 * });
 * ```
 *
 * @public
 */
export async function saveConfig(
  graph: MigrationGraph,
  filePath: string,
  data: unknown,
  options: SaveConfigOptions = {}
): Promise<void> {
  // Determine version
  const version =
    options.version ?? extractVersion(data) ?? getLatestVersion(graph);

  // Ensure data has version field
  const dataWithVersion =
    typeof data === 'object' && data !== null
      ? { ...data, version }
      : { version, data };

  // Detect format
  const format = options.format ?? detectFormat(filePath);

  // Validate against schema
  const schema = graph.getSchema(version);
  if (schema) {
    const validationResult = schema.schema(dataWithVersion);
    if (!validationResult.success) {
      throw new ConfigFileError(
        `Cannot save invalid config: ${formatValidationErrors(validationResult.errors ?? [])}`,
        filePath
      );
    }
  }

  // Serialize
  const content = serializeConfig(
    dataWithVersion,
    format,
    options.pretty ?? true
  );

  // Write file
  try {
    await writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new ConfigFileError(
      `Failed to write config file: ${filePath}`,
      filePath,
      error
    );
  }
}

/**
 * Watch a configuration file for changes and automatically reload/migrate.
 *
 * @param graph - Migration graph for loading and migrating
 * @param filePath - Path to configuration file to watch
 * @param options - Watch options
 * @returns Watcher handle with stop() method
 *
 * @example
 * ```typescript
 * const watcher = watchConfig(graph, './app.config.json', {
 *   targetVersion: '2.0.0',
 *   onUpdate: (config) => {
 *     console.log('Config updated:', config.data);
 *   },
 *   onError: (error) => {
 *     console.error('Config error:', error);
 *   }
 * });
 *
 * // Later, stop watching
 * watcher.stop();
 * ```
 *
 * @public
 */
export function watchConfig(
  graph: MigrationGraph,
  filePath: string,
  options: WatchConfigOptions = {}
): ConfigWatcher {
  const debounceMs = options.debounceMs ?? 100;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const handleChange = (): void => {
    // Clear existing timer
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }

    // Set new timer
    debounceTimer = setTimeout(() => {
      void (async () => {
        try {
          const loadOptions: LoadConfigOptions =
            options.targetVersion !== undefined
              ? { targetVersion: options.targetVersion }
              : {};
          const result = await loadConfig(graph, filePath, loadOptions);
          options.onUpdate?.(result);
        } catch (error) {
          options.onError?.(error as Error);
        }
      })();
    }, debounceMs);
  };

  // Start watching
  const watcher = watch(
    filePath,
    { persistent: false },
    (eventType: string) => {
      if (eventType === 'change') {
        handleChange();
      }
    }
  );

  // Return handle
  return {
    stop: () => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      watcher.close();
    },
  };
}

/**
 * Compare two schema versions and return information about differences.
 *
 * This provides a simplified view of schema changes based on the migration path.
 * For detailed analysis, consider using the graph analysis utilities.
 *
 * @param graph - Migration graph containing schemas
 * @param fromVersion - Source version
 * @param toVersion - Target version
 * @returns Version diff information
 * @throws {Error} If schemas are not found
 *
 * @example
 * ```typescript
 * const diff = diffVersions(graph, '1.0.0', '2.0.0');
 * console.log('Added fields:', diff.addedFields);
 * console.log('Removed fields:', diff.removedFields);
 * ```
 *
 * @beta This function currently returns empty arrays for field changes due to
 * schema introspection limitations. Future versions may provide actual field diff.
 */
export function diffVersions(
  graph: MigrationGraph,
  fromVersion: string,
  toVersion: string
): VersionDiff {
  const fromSchema = graph.getSchema(fromVersion);
  const toSchema = graph.getSchema(toVersion);

  if (!fromSchema) {
    throw new Error(`Schema not found for version: ${fromVersion}`);
  }

  if (!toSchema) {
    throw new Error(`Schema not found for version: ${toVersion}`);
  }

  // Use sample data to extract field information
  // This is a simplified approach - a real implementation might use
  // schema introspection if the validation library supports it
  const fromFields = extractSchemaFields(fromSchema);
  const toFields = extractSchemaFields(toSchema);

  const addedFields = toFields.filter((field) => !fromFields.includes(field));
  const removedFields = fromFields.filter((field) => !toFields.includes(field));
  const commonFields = fromFields.filter((field) => toFields.includes(field));

  // For simplicity, we mark all common fields as potentially modified
  // A real implementation would do deeper comparison
  const modifiedFields = commonFields;

  return {
    from: fromVersion,
    to: toVersion,
    addedFields,
    removedFields,
    modifiedFields,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect configuration format from file extension.
 */
function detectFormat(filePath: string): 'json' | 'yaml' {
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    return 'yaml';
  }
  return 'json';
}

/**
 * Parse configuration content based on format.
 */
function parseConfig(content: string, format: 'json' | 'yaml'): unknown {
  if (format === 'yaml') {
    throw new Error(
      'YAML format not yet supported. Please install a YAML parser library and configure it.'
    );
  }

  return JSON.parse(content) as unknown;
}

/**
 * Serialize configuration to string based on format.
 */
function serializeConfig(
  data: unknown,
  format: 'json' | 'yaml',
  pretty: boolean
): string {
  if (format === 'yaml') {
    throw new Error(
      'YAML format not yet supported. Please install a YAML parser library and configure it.'
    );
  }

  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

/**
 * Extract version field from raw data.
 */
function extractVersion(data: unknown): string | undefined {
  if (typeof data === 'object' && data !== null && 'version' in data) {
    const version = (data as { version: unknown }).version;
    return typeof version === 'string' ? version : undefined;
  }
  return undefined;
}

/**
 * Get the latest version from the graph.
 */
function getLatestVersion(graph: MigrationGraph): string {
  const versions = graph.getVersions();
  if (versions.length === 0) {
    throw new Error('No versions registered in migration graph');
  }
  const lastVersion = versions[versions.length - 1];
  if (lastVersion === undefined) {
    throw new Error('No versions registered in migration graph');
  }
  return lastVersion;
}

/**
 * Format validation errors for display.
 */
function formatValidationErrors(
  errors: readonly { path: readonly string[]; message: string }[]
): string {
  return errors
    .map((err) => {
      const path = err.path.length > 0 ? err.path.join('.') : 'root';
      return `${path}: ${err.message}`;
    })
    .join('; ');
}

/**
 * Extract field names from a schema by attempting validation with sample data.
 * This is a simplified approach - ideally we'd use schema introspection.
 */
function extractSchemaFields(
  _schema: { schema: (data: unknown) => { success: boolean; data?: unknown } }
): string[] {
  // For now, return empty array - proper implementation would require
  // schema introspection capabilities from the validation library
  // This is marked as a limitation in the documentation
  return [];
}
