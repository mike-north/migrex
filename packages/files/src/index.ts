/**
 * \@migrex/files - File-based versioned data integration for migrex
 *
 * This package provides utilities for loading, saving, watching,
 * and upgrading versioned files with automatic migration support.
 * Supports JSON, YAML, and TOML file formats with automatic detection.
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
import { load as yamlLoad, dump as yamlDump, JSON_SCHEMA } from 'js-yaml';
import { parse as tomlParse, stringify as tomlStringify } from 'smol-toml';

/**
 * Options for loading a versioned file.
 *
 * @public
 */
export interface LoadOptions {
  /**
   * Target version to migrate to.
   * If not specified, uses the latest version from the graph.
   */
  targetVersion?: string;

  /**
   * File format to use for parsing.
   * If not specified, detected from file extension (.json, .yaml, or .toml).
   */
  format?: 'json' | 'yaml' | 'toml';
}

/**
 * Result of loading a versioned file.
 *
 * @template T - The type of the loaded data
 * @public
 */
export interface LoadResult<T> {
  /** The loaded and migrated data */
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
 * Options for upgrading a versioned file in place.
 *
 * @public
 */
export interface UpgradeOptions {
  /**
   * Target version to upgrade to.
   * If not specified, upgrades to the latest version from the graph.
   */
  targetVersion?: string;

  /**
   * File format to use for reading/writing.
   * If not specified, detected from file extension (.json, .yaml, or .toml).
   */
  format?: 'json' | 'yaml' | 'toml';

  /**
   * Whether to pretty-print the output (default: true).
   */
  pretty?: boolean;

  /**
   * If true, skip writing if the file is already at the target version.
   * Default: true
   */
  skipIfCurrent?: boolean;
}

/**
 * Result of upgrading a versioned file.
 *
 * @public
 */
export interface UpgradeResult {
  /** The version found in the source file */
  sourceVersion: string;

  /** The version after upgrade */
  targetVersion: string;

  /** Whether the file was actually written (false if already at target version and skipIfCurrent is true) */
  wasWritten: boolean;

  /** Whether a migration was performed */
  wasMigrated: boolean;

  /** The migration path that was executed (if any) */
  migrationPath?: MigrationPath;
}

/**
 * Options for saving a versioned file.
 *
 * @public
 */
export interface SaveOptions {
  /**
   * Version to set in the saved file.
   * If not specified, attempts to detect from data or uses latest from graph.
   */
  version?: string;

  /**
   * File format to use for serialization.
   * If not specified, detected from file extension (.json, .yaml, or .toml).
   */
  format?: 'json' | 'yaml' | 'toml';

  /**
   * Whether to pretty-print the output (default: true).
   */
  pretty?: boolean;
}

/**
 * Options for watching a versioned file.
 *
 * @public
 */
export interface WatchOptions {
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
   * Callback invoked when the file is successfully reloaded and migrated.
   */
  onUpdate?: (result: LoadResult<unknown>) => void;

  /**
   * Callback invoked when an error occurs during reload or migration.
   */
  onError?: (error: Error) => void;
}

/**
 * Handle for a versioned file watcher.
 *
 * @public
 */
export interface FileWatcher {
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
 * Error thrown when a versioned file cannot be loaded, parsed, or written.
 *
 * @public
 */
export class VersionedFileError extends Error {
  public override readonly cause?: unknown;

  constructor(
    message: string,
    public readonly filePath: string,
    cause?: unknown
  ) {
    super(message);
    this.name = 'VersionedFileError';
    this.cause = cause;
  }
}

/**
 * Load a versioned file and automatically migrate to target version.
 *
 * @template T - The type of the loaded data
 * @param graph - Migration graph containing schemas and migrations
 * @param filePath - Path to versioned file
 * @param options - Loading options
 * @returns Promise resolving to loaded data with migration info
 * @throws {VersionedFileError} If file cannot be read or parsed
 * @throws {MigrationError} If migration fails
 *
 * @example
 * ```typescript
 * const result = await loadVersionedFile(graph, './data.json', {
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
export async function loadVersionedFile<T>(
  graph: MigrationGraph,
  filePath: string,
  options: LoadOptions = {}
): Promise<LoadResult<T>> {
  // Read file
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error) {
    throw new VersionedFileError(
      `Failed to read file: ${filePath}`,
      filePath,
      error
    );
  }

  // Detect format
  const format = options.format ?? detectFormat(filePath);

  // Parse file
  let rawData: unknown;
  try {
    rawData = parseContent(content, format);
  } catch (error) {
    throw new VersionedFileError(
      `Failed to parse file as ${format.toUpperCase()}: ${filePath}`,
      filePath,
      error
    );
  }

  // Extract source version
  const sourceVersion = extractVersion(rawData);
  if (!sourceVersion) {
    throw new VersionedFileError(
      `File missing 'version' field: ${filePath}`,
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
      throw new VersionedFileError(
        `Failed to migrate from ${sourceVersion} to ${targetVersion}: ${result.error?.message}`,
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
      throw new VersionedFileError(
        `No schema registered for version ${sourceVersion}`,
        filePath
      );
    }

    const validationResult = schema.schema(rawData);
    if (!validationResult.success) {
      throw new VersionedFileError(
        `Validation failed: ${formatValidationErrors(validationResult.errors ?? [])}`,
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
 * Save data to a versioned file.
 *
 * @param graph - Migration graph (used to determine version if not specified)
 * @param filePath - Path to file
 * @param data - Data to save
 * @param options - Save options
 * @returns Promise that resolves when file is written
 * @throws {VersionedFileError} If file cannot be written or validation fails
 *
 * @example
 * ```typescript
 * await saveVersionedFile(graph, './data.json', {
 *   version: '2.0.0',
 *   name: 'My App',
 *   port: 3000
 * });
 * ```
 *
 * @public
 */
export async function saveVersionedFile(
  graph: MigrationGraph,
  filePath: string,
  data: unknown,
  options: SaveOptions = {}
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
      throw new VersionedFileError(
        `Cannot save invalid data: ${formatValidationErrors(validationResult.errors ?? [])}`,
        filePath
      );
    }
  }

  // Serialize
  const content = serializeContent(
    dataWithVersion,
    format,
    options.pretty ?? true
  );

  // Write file
  try {
    await writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new VersionedFileError(
      `Failed to write file: ${filePath}`,
      filePath,
      error
    );
  }
}

/**
 * Upgrade a versioned file in place to a target version.
 *
 * This function reads the file, migrates it to the target version,
 * and writes it back to disk. The file is updated in place with the new
 * version and migrated data.
 *
 * @param graph - Migration graph containing schemas and migrations
 * @param filePath - Path to versioned file
 * @param options - Upgrade options
 * @returns Promise resolving to upgrade result with migration info
 * @throws {VersionedFileError} If file cannot be read, parsed, or written
 * @throws {MigrationError} If migration fails
 *
 * @example
 * ```typescript
 * // Upgrade a file to the latest version
 * const result = await upgradeVersionedFile(graph, './data.json');
 * if (result.wasMigrated) {
 *   console.log(`Upgraded from ${result.sourceVersion} to ${result.targetVersion}`);
 * }
 *
 * // Upgrade to a specific version
 * const result = await upgradeVersionedFile(graph, './data.json', {
 *   targetVersion: '2.0.0'
 * });
 * ```
 *
 * @public
 */
export async function upgradeVersionedFile(
  graph: MigrationGraph,
  filePath: string,
  options: UpgradeOptions = {}
): Promise<UpgradeResult> {
  const skipIfCurrent = options.skipIfCurrent ?? true;
  const targetVersion = options.targetVersion ?? getLatestVersion(graph);

  // Load and migrate the file
  const loadOptions: LoadOptions = { targetVersion };
  if (options.format !== undefined) {
    loadOptions.format = options.format;
  }
  const loadResult = await loadVersionedFile(graph, filePath, loadOptions);

  const wasMigrated = loadResult.wasUpgraded;

  // If already at target version and skipIfCurrent is true, don't write
  if (!wasMigrated && skipIfCurrent) {
    return {
      sourceVersion: loadResult.sourceVersion,
      targetVersion: loadResult.targetVersion,
      wasWritten: false,
      wasMigrated: false,
    };
  }

  // Write the migrated data back to disk
  const saveOptions: SaveOptions = {
    version: targetVersion,
    pretty: options.pretty ?? true,
  };
  if (options.format !== undefined) {
    saveOptions.format = options.format;
  }
  await saveVersionedFile(graph, filePath, loadResult.data, saveOptions);

  return {
    sourceVersion: loadResult.sourceVersion,
    targetVersion: loadResult.targetVersion,
    wasWritten: true,
    wasMigrated,
    ...(loadResult.migrationPath !== undefined
      ? { migrationPath: loadResult.migrationPath }
      : {}),
  };
}

/**
 * Watch a versioned file for changes and automatically reload/migrate.
 *
 * @param graph - Migration graph for loading and migrating
 * @param filePath - Path to file to watch
 * @param options - Watch options
 * @returns Watcher handle with stop() method
 *
 * @example
 * ```typescript
 * const watcher = watchVersionedFile(graph, './data.json', {
 *   targetVersion: '2.0.0',
 *   onUpdate: (result) => {
 *     console.log('File updated:', result.data);
 *   },
 *   onError: (error) => {
 *     console.error('Error:', error);
 *   }
 * });
 *
 * // Later, stop watching
 * watcher.stop();
 * ```
 *
 * @public
 */
export function watchVersionedFile(
  graph: MigrationGraph,
  filePath: string,
  options: WatchOptions = {}
): FileWatcher {
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
          const loadOptions: LoadOptions =
            options.targetVersion !== undefined
              ? { targetVersion: options.targetVersion }
              : {};
          const result = await loadVersionedFile(graph, filePath, loadOptions);
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
 * Detect file format from file extension.
 */
function detectFormat(filePath: string): 'json' | 'yaml' | 'toml' {
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    return 'yaml';
  }
  if (filePath.endsWith('.toml')) {
    return 'toml';
  }
  return 'json';
}

/**
 * Parse file content based on format.
 */
function parseContent(
  content: string,
  format: 'json' | 'yaml' | 'toml'
): unknown {
  if (format === 'yaml') {
    // Use JSON_SCHEMA to prevent YAML-specific type coercion (e.g., yes/no -> boolean)
    // and avoid code execution vulnerabilities from custom tags
    return yamlLoad(content, { schema: JSON_SCHEMA });
  }

  if (format === 'toml') {
    return tomlParse(content);
  }

  return JSON.parse(content) as unknown;
}

/**
 * Serialize data to string based on format.
 */
function serializeContent(
  data: unknown,
  format: 'json' | 'yaml' | 'toml',
  pretty: boolean
): string {
  if (format === 'yaml') {
    return yamlDump(data, { indent: pretty ? 2 : 0, lineWidth: pretty ? 80 : -1 });
  }

  if (format === 'toml') {
    // TOML requires root to be a table (object), not an array or primitive
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error(
        'TOML format requires data to be a non-null object (not an array or primitive)'
      );
    }
    return tomlStringify(data as Record<string, unknown>);
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
