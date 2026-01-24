import type {
  VersionedSchema,
  ReversibleMigration,
  AsyncReversibleMigration,
  AnyMigration,
  MigrationPath,
  MigrateOptions,
  MigrationResult,
  MigrationGraphOptions,
  VersionStrategy,
  BatchMigrateOptions,
  BatchMigrationResult,
  MigrationTelemetry,
} from './types.js';
import {
  NoPathError,
  MigrationError,
  SchemaValidationError,
} from './errors.js';
import { createMigrationContext } from './context.js';
import { findPath } from './path-finder.js';

// Node.js performance API for timing
declare const performance: { now: () => number };

/**
 * Core interface for the migration graph.
 * Manages schemas, migrations, path finding, and execution.
 */
export interface MigrationGraph {
  /**
   * Register a schema for a specific version.
   * @throws {MigrationError} If schema is already registered for this version
   */
  registerSchema<T>(schema: VersionedSchema<T>): void;

  /**
   * Register a migration between two versions (sync or async).
   * @throws {MigrationError} If migration is already registered
   */
  registerMigration<From, To>(migration: AnyMigration<From, To>): void;

  /**
   * Check if a migration path exists between two versions.
   */
  hasPath(fromVersion: string, toVersion: string): boolean;

  /**
   * Get the migration path between two versions.
   * @throws {NoPathError} If no path exists
   */
  getPath(fromVersion: string, toVersion: string): MigrationPath;

  /**
   * Execute a migration from one version to another.
   * @param data - Data to migrate
   * @param fromVersion - Source version
   * @param toVersion - Target version
   * @param options - Migration options
   * @returns Migration result with success status and data or error
   */
  migrate<T>(
    data: unknown,
    fromVersion: string,
    toVersion: string,
    options?: MigrateOptions
  ): MigrationResult<T>;

  /**
   * Execute an async migration from one version to another.
   * Use this when any migration in the path might be async.
   * @param data - Data to migrate
   * @param fromVersion - Source version
   * @param toVersion - Target version
   * @param options - Migration options
   * @returns Promise of migration result with success status and data or error
   */
  migrateAsync<T>(
    data: unknown,
    fromVersion: string,
    toVersion: string,
    options?: MigrateOptions
  ): Promise<MigrationResult<T>>;

  /**
   * Execute migrations for multiple data items.
   * The path is computed once and reused for all items.
   *
   * @example
   * ```typescript
   * const results = graph.migrateMany(
   *   users,
   *   '1.0.0',
   *   '2.0.0',
   *   {
   *     continueOnError: true,
   *     onProgress: (done, total) => console.log(`${done}/${total}`)
   *   }
   * );
   * console.log(`Migrated ${results.succeeded}/${results.total}`);
   * ```
   */
  migrateMany<T>(
    data: Iterable<unknown>,
    fromVersion: string,
    toVersion: string,
    options?: BatchMigrateOptions
  ): BatchMigrationResult<T>;

  /**
   * Get all registered versions in sorted order.
   */
  getVersions(): readonly string[];

  /**
   * Get the schema for a specific version.
   */
  getSchema(version: string): VersionedSchema<unknown> | undefined;

  /**
   * Get all registered migrations (both sync and async).
   */
  getMigrations(): readonly AnyMigration<unknown, unknown>[];

  // Analysis methods (to be implemented by analysis agent)
  // analyzeConnectivity(): ConnectivityAnalysis;
  // computeFieldProfiles(): FieldProfileMap;
  // findLossyPaths(): LossyPathReport;
  // suggestMigrations(): MigrationSuggestion[];
  // getDeprecatedVersions(): DeprecatedVersionInfo[];
}

/**
 * Implementation of MigrationGraph.
 */
class MigrationGraphImpl implements MigrationGraph {
  private readonly schemas = new Map<string, VersionedSchema<unknown>>();
  private readonly migrations = new Map<string, AnyMigration<unknown, unknown>>();
  private readonly adjacencyList = new Map<string, Set<string>>();
  private readonly versionStrategy: VersionStrategy;
  private readonly telemetry?: MigrationTelemetry;
  readonly id: string;

  constructor(options: MigrationGraphOptions) {
    this.id = options.id;
    this.versionStrategy = options.versionStrategy;
    this.telemetry = options.telemetry;
  }

  registerSchema<T>(schema: VersionedSchema<T>): void {
    const version = this.normalizeVersion(schema.version);

    if (this.schemas.has(version)) {
      throw new MigrationError(
        `Schema for version "${version}" already registered`,
        'DUPLICATE_SCHEMA',
        { version }
      );
    }

    this.schemas.set(version, schema as VersionedSchema<unknown>);

    // Ensure version exists in adjacency list
    if (!this.adjacencyList.has(version)) {
      this.adjacencyList.set(version, new Set());
    }
  }

  registerMigration<From, To>(migration: AnyMigration<From, To>): void {
    const fromVersion = this.normalizeVersion(migration.fromVersion);
    const toVersion = this.normalizeVersion(migration.toVersion);
    const key = this.getMigrationKey(fromVersion, toVersion);

    if (this.migrations.has(key)) {
      throw new MigrationError(
        `Migration from "${fromVersion}" to "${toVersion}" already registered`,
        'DUPLICATE_MIGRATION',
        { fromVersion, toVersion }
      );
    }

    this.migrations.set(key, migration as AnyMigration<unknown, unknown>);

    // Update adjacency list (bidirectional edges for graph traversal)
    if (!this.adjacencyList.has(fromVersion)) {
      this.adjacencyList.set(fromVersion, new Set());
    }
    if (!this.adjacencyList.has(toVersion)) {
      this.adjacencyList.set(toVersion, new Set());
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- We just created these if they didn't exist
    this.adjacencyList.get(fromVersion)!.add(toVersion);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- We just created these if they didn't exist
    this.adjacencyList.get(toVersion)!.add(fromVersion);
  }

  hasPath(fromVersion: string, toVersion: string): boolean {
    try {
      this.getPath(fromVersion, toVersion);
      return true;
    } catch {
      return false;
    }
  }

  getPath(fromVersion: string, toVersion: string): MigrationPath {
    const normalizedFrom = this.normalizeVersion(fromVersion);
    const normalizedTo = this.normalizeVersion(toVersion);

    // Same version requires no migration
    if (normalizedFrom === normalizedTo) {
      return {
        steps: [],
        direction: 'up',
        hasIrreversibleStep: false,
      };
    }

    const path = findPath(
      normalizedFrom,
      normalizedTo,
      this.adjacencyList,
      this.migrations,
      this.versionStrategy,
      (from, to) => this.getMigrationKey(from, to)
    );

    if (!path) {
      throw new NoPathError(fromVersion, toVersion);
    }

    return path;
  }

  migrate<T>(
    data: unknown,
    fromVersion: string,
    toVersion: string,
    options: MigrateOptions = {}
  ): MigrationResult<T> {
    const startTime = performance.now();
    const normalizedFrom = this.normalizeVersion(fromVersion);
    const normalizedTo = this.normalizeVersion(toVersion);

    // Validate source data if we have a schema
    const sourceSchema = this.schemas.get(normalizedFrom);
    if (sourceSchema && !options.skipValidation) {
      const validation = sourceSchema.schema(data);
      if (!validation.success) {
        const error = new SchemaValidationError(
          normalizedFrom,
          validation.errors ?? []
        );

        // Create a minimal context for telemetry
        const dummyContext = createMigrationContext(0, options.initialStash);
        this.telemetry?.onError?.(error, null, dummyContext);

        const result: MigrationResult<T> = {
          success: false,
          path: { steps: [], direction: 'up', hasIrreversibleStep: false },
          stash: { consumed: [], unconsumed: [], lossless: true },
          preservedFields: options.initialStash ?? [],
          error,
        };

        const totalDuration = performance.now() - startTime;
        this.telemetry?.onMigrationComplete?.(result, totalDuration);

        return result;
      }
      data = validation.data;
    }

    // Get the migration path
    let path: MigrationPath;
    try {
      const pathStartTime = performance.now();
      path = this.getPath(normalizedFrom, normalizedTo);
      const pathDuration = performance.now() - pathStartTime;
      this.telemetry?.onPathComputed?.(path, pathDuration);
    } catch (err) {
      return {
        success: false,
        path: { steps: [], direction: 'up', hasIrreversibleStep: false },
        stash: { consumed: [], unconsumed: [], lossless: true },
        preservedFields: options.initialStash ?? [],
        error: err as MigrationError,
      } as MigrationResult<T>;
    }

    // No migration needed if same version
    if (path.steps.length === 0) {
      return {
        success: true,
        data: data as T,
        path,
        stash: { consumed: [], unconsumed: [], lossless: true },
        preservedFields: options.initialStash ?? [],
      };
    }

    // Create migration context with optional initial stash
    const context = createMigrationContext(path.steps.length, options.initialStash);

    // Execute migrations
    let currentData = data;
    for (let i = 0; i < path.steps.length; i++) {
      const step = path.steps[i];
      context.setCurrentStep({
        from: step.fromVersion,
        to: step.toVersion,
        direction: step.direction,
        index: i,
        totalSteps: path.steps.length,
      });

      this.telemetry?.onStepStart?.(step, i, path.steps.length);
      const stepStartTime = performance.now();

      try {
        if (step.direction === 'up') {
          currentData = step.migration.up(currentData, context);
        } else {
          const reversibleMigration =
            step.migration as ReversibleMigration<unknown, unknown>;
          currentData = reversibleMigration.down(currentData, context);
        }

        const stepDuration = performance.now() - stepStartTime;
        this.telemetry?.onStepComplete?.(step, i, stepDuration);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        const error = new MigrationError(
          `Migration failed at step ${i + 1}: ${errorMessage}`,
          'MIGRATION_FAILED',
          {
            step: i,
            fromVersion: step.fromVersion,
            toVersion: step.toVersion,
          }
        );

        this.telemetry?.onError?.(error, step, context);

        return {
          success: false,
          path,
          stash: context.getSummary(),
          preservedFields: context.getPreservedFields(),
          error,
        } as MigrationResult<T>;
      }

      // Validate intermediate if requested
      if (options.validateIntermediate && i < path.steps.length - 1) {
        const intermediateSchema = this.schemas.get(step.toVersion);
        if (intermediateSchema) {
          const validation = intermediateSchema.schema(currentData);
          if (!validation.success) {
            return {
              success: false,
              path,
              stash: context.getSummary(),
              preservedFields: context.getPreservedFields(),
              error: new SchemaValidationError(
                step.toVersion,
                validation.errors ?? []
              ),
            } as MigrationResult<T>;
          }
        }
      }
    }

    // Validate destination
    const destSchema = this.schemas.get(normalizedTo);
    let validation;
    if (destSchema && !options.skipValidation) {
      validation = destSchema.schema(currentData);
      if (!validation.success) {
        const error = new SchemaValidationError(
          normalizedTo,
          validation.errors ?? []
        );
        this.telemetry?.onError?.(error, null, context);

        const result: MigrationResult<T> = {
          success: false,
          path,
          stash: context.getSummary(),
          preservedFields: context.getPreservedFields(),
          validation: validation as MigrationResult<T>['validation'],
          error,
        };

        const totalDuration = performance.now() - startTime;
        this.telemetry?.onMigrationComplete?.(result, totalDuration);

        return result;
      }

      // Run additional validate() if present
      if (destSchema.validate) {
        validation = destSchema.validate(validation.data as T);
        if (!validation.success) {
          const error = new SchemaValidationError(
            normalizedTo,
            validation.errors ?? []
          );
          this.telemetry?.onError?.(error, null, context);

          const result: MigrationResult<T> = {
            success: false,
            path,
            stash: context.getSummary(),
            preservedFields: context.getPreservedFields(),
            validation: validation as MigrationResult<T>['validation'],
            error,
          };

          const totalDuration = performance.now() - startTime;
          this.telemetry?.onMigrationComplete?.(result, totalDuration);

          return result;
        }
      }

      currentData = validation.data;
    }

    const result: MigrationResult<T> = {
      success: true,
      data: currentData as T,
      path,
      validation: validation as MigrationResult<T>['validation'],
      stash: context.getSummary(),
      preservedFields: context.getPreservedFields(),
    };

    const totalDuration = performance.now() - startTime;
    this.telemetry?.onMigrationComplete?.(result, totalDuration);

    return result;
  }

  async migrateAsync<T>(
    data: unknown,
    fromVersion: string,
    toVersion: string,
    options: MigrateOptions = {}
  ): Promise<MigrationResult<T>> {
    const startTime = performance.now();
    const normalizedFrom = this.normalizeVersion(fromVersion);
    const normalizedTo = this.normalizeVersion(toVersion);

    // Validate source data if we have a schema
    const sourceSchema = this.schemas.get(normalizedFrom);
    if (sourceSchema && !options.skipValidation) {
      const validation = sourceSchema.schema(data);
      if (!validation.success) {
        const result: MigrationResult<T> = {
          success: false,
          path: { steps: [], direction: 'up', hasIrreversibleStep: false },
          stash: { consumed: [], unconsumed: [], lossless: true },
          preservedFields: options.initialStash ?? [],
          error: new SchemaValidationError(
            normalizedFrom,
            validation.errors ?? []
          ),
        };
        this.telemetry?.onMigrationComplete?.(result, performance.now() - startTime);
        return result;
      }
      data = validation.data;
    }

    // Get the migration path
    let path: MigrationPath;
    try {
      const pathStartTime = performance.now();
      path = this.getPath(normalizedFrom, normalizedTo);
      this.telemetry?.onPathComputed?.(path, performance.now() - pathStartTime);
    } catch (err) {
      const result: MigrationResult<T> = {
        success: false,
        path: { steps: [], direction: 'up', hasIrreversibleStep: false },
        stash: { consumed: [], unconsumed: [], lossless: true },
        preservedFields: options.initialStash ?? [],
        error: err as MigrationError,
      };
      this.telemetry?.onMigrationComplete?.(result, performance.now() - startTime);
      return result;
    }

    // No migration needed if same version
    if (path.steps.length === 0) {
      const result: MigrationResult<T> = {
        success: true,
        data: data as T,
        path,
        stash: { consumed: [], unconsumed: [], lossless: true },
        preservedFields: options.initialStash ?? [],
      };
      this.telemetry?.onMigrationComplete?.(result, performance.now() - startTime);
      return result;
    }

    // Create migration context with optional initial stash
    const context = createMigrationContext(path.steps.length, options.initialStash);

    // Execute migrations (awaiting each step)
    let currentData = data;
    for (let i = 0; i < path.steps.length; i++) {
      const step = path.steps[i];
      context.setCurrentStep({
        from: step.fromVersion,
        to: step.toVersion,
        direction: step.direction,
        index: i,
        totalSteps: path.steps.length,
      });

      const stepStartTime = performance.now();
      this.telemetry?.onStepStart?.(step, i, path.steps.length);

      try {
        if (step.direction === 'up') {
          // Execute migration and await if it's async
          const result = step.migration.up(currentData, context);
          currentData = result instanceof Promise ? await result : result;
        } else {
          // Type cast for reversible migration
          const reversibleMigration = step.migration as
            | ReversibleMigration<unknown, unknown>
            | AsyncReversibleMigration<unknown, unknown>;
          const result = reversibleMigration.down(currentData, context);
          currentData = result instanceof Promise ? await result : result;
        }

        this.telemetry?.onStepComplete?.(step, i, performance.now() - stepStartTime);
      } catch (err) {
        this.telemetry?.onError?.(err as Error, step, context);
        const result: MigrationResult<T> = {
          success: false,
          path,
          stash: context.getSummary(),
          preservedFields: context.getPreservedFields(),
          error: new MigrationError(
            `Migration failed at step ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
            'MIGRATION_FAILED',
            {
              step: i,
              fromVersion: step.fromVersion,
              toVersion: step.toVersion,
            }
          ),
        };
        this.telemetry?.onMigrationComplete?.(result, performance.now() - startTime);
        return result;
      }

      // Validate intermediate if requested
      if (options.validateIntermediate && i < path.steps.length - 1) {
        const intermediateSchema = this.schemas.get(step.toVersion);
        if (intermediateSchema) {
          const validation = intermediateSchema.schema(currentData);
          if (!validation.success) {
            const result: MigrationResult<T> = {
              success: false,
              path,
              stash: context.getSummary(),
              preservedFields: context.getPreservedFields(),
              error: new SchemaValidationError(
                step.toVersion,
                validation.errors ?? []
              ),
            };
            this.telemetry?.onMigrationComplete?.(result, performance.now() - startTime);
            return result;
          }
        }
      }
    }

    // Validate destination
    const destSchema = this.schemas.get(normalizedTo);
    let validation;
    if (destSchema && !options.skipValidation) {
      validation = destSchema.schema(currentData);
      if (!validation.success) {
        const result: MigrationResult<T> = {
          success: false,
          path,
          stash: context.getSummary(),
          preservedFields: context.getPreservedFields(),
          validation: validation as MigrationResult<T>['validation'],
          error: new SchemaValidationError(
            normalizedTo,
            validation.errors ?? []
          ),
        };
        this.telemetry?.onMigrationComplete?.(result, performance.now() - startTime);
        return result;
      }

      // Run additional validate() if present
      if (destSchema.validate) {
        validation = destSchema.validate(validation.data as T);
        if (!validation.success) {
          const result: MigrationResult<T> = {
            success: false,
            path,
            stash: context.getSummary(),
            preservedFields: context.getPreservedFields(),
            validation: validation as MigrationResult<T>['validation'],
            error: new SchemaValidationError(
              normalizedTo,
              validation.errors ?? []
            ),
          };
          this.telemetry?.onMigrationComplete?.(result, performance.now() - startTime);
          return result;
        }
      }

      currentData = validation.data;
    }

    const result: MigrationResult<T> = {
      success: true,
      data: currentData as T,
      path,
      validation: validation as MigrationResult<T>['validation'],
      stash: context.getSummary(),
      preservedFields: context.getPreservedFields(),
    };

    const totalDuration = performance.now() - startTime;
    this.telemetry?.onMigrationComplete?.(result, totalDuration);

    return result;
  }

  migrateMany<T>(
    data: Iterable<unknown>,
    fromVersion: string,
    toVersion: string,
    options: BatchMigrateOptions = {}
  ): BatchMigrationResult<T> {
    // Compute path once for all items
    const normalizedFrom = this.normalizeVersion(fromVersion);
    const normalizedTo = this.normalizeVersion(toVersion);

    let path: MigrationPath;
    try {
      const pathStartTime = performance.now();
      path = this.getPath(normalizedFrom, normalizedTo);
      const pathDuration = performance.now() - pathStartTime;
      this.telemetry?.onPathComputed?.(path, pathDuration);
    } catch {
      // If path computation fails, return early with no results
      return {
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [],
        path: { steps: [], direction: 'up', hasIrreversibleStep: false },
      };
    }

    // Convert iterable to array to get total count
    const items = Array.from(data);
    const results: MigrationResult<T>[] = [];
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const result = this.migrate<T>(item, fromVersion, toVersion, options);

      results.push(result);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
        // Stop if not continuing on error
        if (!options.continueOnError) {
          // Add remaining items as failed results
          for (let j = i + 1; j < items.length; j++) {
            results.push({
              success: false,
              path,
              stash: { consumed: [], unconsumed: [], lossless: true },
              preservedFields: [],
              error: new MigrationError(
                'Batch migration stopped due to previous error',
                'MIGRATION_FAILED',
                { skipped: true }
              ),
            } as MigrationResult<T>);
            failed++;
          }
          break;
        }
      }

      // Call progress callback
      options.onProgress?.(i + 1, items.length, result);
    }

    return {
      total: items.length,
      succeeded,
      failed,
      results,
      path,
    };
  }

  getVersions(): readonly string[] {
    // Include all versions from both schemas and migrations
    const allVersions = new Set<string>();

    // Add schema versions
    for (const version of this.schemas.keys()) {
      allVersions.add(version);
    }

    // Add migration versions (both from and to)
    for (const migration of this.migrations.values()) {
      allVersions.add(migration.fromVersion);
      allVersions.add(migration.toVersion);
    }

    return Array.from(allVersions).sort((a, b) =>
      this.versionStrategy.compare(a, b)
    );
  }

  getSchema(version: string): VersionedSchema<unknown> | undefined {
    return this.schemas.get(this.normalizeVersion(version));
  }

  getMigrations(): readonly AnyMigration<unknown, unknown>[] {
    return Array.from(this.migrations.values());
  }

  /**
   * Normalize a version string using the version strategy.
   * @throws {MigrationError} If version is invalid
   */
  private normalizeVersion(version: string): string {
    if (!this.versionStrategy.isValid(version)) {
      // Try normalizing first
      if (this.versionStrategy.normalize) {
        try {
          return this.versionStrategy.normalize(version);
        } catch {
          throw new MigrationError(
            `Invalid version "${version}" for strategy "${this.versionStrategy.id}"`,
            'INVALID_VERSION',
            { version, strategy: this.versionStrategy.id }
          );
        }
      }
      throw new MigrationError(
        `Invalid version "${version}" for strategy "${this.versionStrategy.id}"`,
        'INVALID_VERSION',
        { version, strategy: this.versionStrategy.id }
      );
    }
    return this.versionStrategy.normalize?.(version) ?? version;
  }

  /**
   * Generate a consistent key for looking up migrations.
   * Always uses the migration's registered direction (from -> to).
   */
  private getMigrationKey(from: string, to: string): string {
    // Migrations are stored by their registration direction
    // We need to check both directions when looking up
    const key1 = `${from}:${to}`;
    const key2 = `${to}:${from}`;

    // Return whichever exists
    if (this.migrations.has(key1)) {
      return key1;
    }
    if (this.migrations.has(key2)) {
      return key2;
    }

    // For new registrations, use canonical order
    return key1;
  }
}

/**
 * Create a new migration graph.
 *
 * @param options - Graph configuration options
 * @returns A new MigrationGraph instance
 *
 * @example
 * ```typescript
 * import { createMigrationGraph } from '@migrex/core';
 * import { semverStrategy } from '@migrex/core/strategies';
 *
 * const graph = createMigrationGraph({
 *   id: 'my-api',
 *   versionStrategy: semverStrategy,
 * });
 *
 * graph.registerSchema({
 *   version: '1.0.0',
 *   schema: (data) => // ... validation logic
 * });
 * ```
 */
export function createMigrationGraph(
  options: MigrationGraphOptions
): MigrationGraph {
  return new MigrationGraphImpl(options);
}
