/**
 * \@migrex/testing - Test utilities for migrex
 *
 * This package provides helpers for testing migration graphs and pipelines.
 *
 * @packageDocumentation
 */

import type {
  MigrationResult,
  MigrationGraph,
  FieldProfile,
  AnyMigration,
  MigrationContext,
  PreservedFieldSummary,
  DeprecatedVersionInfo,
} from '@migrex/core';
import {
  analyzeGraph,
  getDeprecatedVersions,
  createMigrationGraph,
  semverStrategy,
} from '@migrex/core';

/**
 * Assert that a migration result is lossless (no unconsumed preserved fields).
 *
 * @template T - The type of the migration result data
 * @param result - Migration result to check
 * @throws {Error} If the migration has unconsumed preserved fields
 *
 * @example
 * ```typescript
 * const result = graph.migrate(data, '1.0.0', '2.0.0');
 * assertLossless(result); // Throws if any fields were preserved but not consumed
 * ```
 *
 * @public
 */
export function assertLossless<T>(result: MigrationResult<T>): void {
  if (!result.stash.lossless) {
    const unconsumed = result.stash.unconsumed
      .map((f: PreservedFieldSummary) => f.path)
      .join(', ');
    throw new Error(`Migration was lossy. Unconsumed fields: ${unconsumed}`);
  }
}

/**
 * Assert that a migration graph is fully connected.
 *
 * A fully connected graph means every version can reach every other version
 * through migration paths. This is essential for flexible version transitions.
 *
 * @param graph - Migration graph to check
 * @throws {Error} If the graph has disconnected components
 *
 * @example
 * ```typescript
 * const graph = createMigrationGraph('semver');
 * graph.registerSchema({ version: '1.0.0', schema: () => ({ success: true }) });
 * graph.registerSchema({ version: '2.0.0', schema: () => ({ success: true }) });
 * // Missing migration between versions
 * assertConnected(graph); // Throws because no path exists
 * ```
 *
 * @public
 */
export function assertConnected(graph: MigrationGraph): void {
  const analysis = analyzeGraph(graph);

  if (!analysis.connectivity.fullyConnected) {
    const components = analysis.connectivity.components
      .map((c: readonly string[]) => `[${c.join(', ')}]`)
      .join(', ');
    const unreachable = analysis.connectivity.unreachablePairs
      .map((p: { from: string; to: string }) => `${p.from} <-> ${p.to}`)
      .join(', ');

    throw new Error(
      `Graph is not fully connected. ` +
        `Found ${String(analysis.connectivity.components.length)} components: ${components}. ` +
        `Unreachable pairs: ${unreachable}`
    );
  }
}

/**
 * Assert that no deprecated versions are used in critical paths.
 *
 * This checks that migrations can be performed between current (non-deprecated)
 * versions without routing through deprecated versions. This is important for
 * planning deprecation timelines and ensuring users can migrate away from
 * deprecated versions cleanly.
 *
 * @param graph - Migration graph to check
 * @throws {Error} If any deprecated versions are in critical paths
 *
 * @example
 * ```typescript
 * // Will throw if any paths between non-deprecated versions
 * // must go through deprecated versions
 * assertNoDeprecatedPaths(graph);
 * ```
 *
 * @public
 */
export function assertNoDeprecatedPaths(graph: MigrationGraph): void {
  const deprecatedVersions = getDeprecatedVersions(graph);

  if (deprecatedVersions.length === 0) {
    // No deprecated versions, nothing to check
    return;
  }

  const deprecatedSet = new Set(
    deprecatedVersions.map((d: DeprecatedVersionInfo) => d.version)
  );
  const allVersions = graph.getVersions();
  const currentVersions = allVersions.filter(
    (v: string) => !deprecatedSet.has(v)
  );

  // Check if current versions can reach each other without using deprecated versions
  for (const from of currentVersions) {
    for (const to of currentVersions) {
      if (from === to) continue;

      if (!graph.hasPath(from, to)) {
        // No path exists at all, not related to deprecation
        continue;
      }

      const path = graph.getPath(from, to);
      const deprecatedInPath = new Set<string>();

      for (const step of path.steps) {
        if (deprecatedSet.has(step.fromVersion)) {
          deprecatedInPath.add(step.fromVersion);
        }
        if (deprecatedSet.has(step.toVersion)) {
          deprecatedInPath.add(step.toVersion);
        }
      }

      if (deprecatedInPath.size > 0) {
        const deprecated = Array.from(deprecatedInPath).join(', ');
        throw new Error(
          `Path from ${from} to ${to} goes through deprecated versions: ${deprecated}. ` +
            `This prevents clean migration away from deprecated versions.`
        );
      }
    }
  }
}

/**
 * Assert that a field has a specific preservation profile.
 *
 * Field profiles track how many times a field can be preserved across
 * different migration paths:
 * - `always-single`: Field is preserved at most once on any path
 * - `sometimes-multi`: Field can be preserved multiple times on some paths
 *
 * @param graph - Migration graph to analyze
 * @param field - Field path to check
 * @param expectedProfile - Expected field profile
 * @throws {Error} If field has a different profile than expected
 *
 * @example
 * ```typescript
 * // Assert that 'theme' field is only preserved once on any path
 * assertFieldProfile(graph, 'theme', 'always-single');
 *
 * // This would throw if 'theme' can be preserved multiple times
 * ```
 *
 * @public
 */
export function assertFieldProfile(
  graph: MigrationGraph,
  field: string,
  expectedProfile: FieldProfile
): void {
  const analysis = analyzeGraph(graph);
  const actualProfile = analysis.profiles[field];

  if (actualProfile === undefined) {
    throw new Error(
      `Field "${field}" is not preserved in any migration path. ` +
        `Cannot verify profile.`
    );
  }

  if (actualProfile !== expectedProfile) {
    throw new Error(
      `Field "${field}" has profile "${actualProfile}" but expected "${expectedProfile}".`
    );
  }
}

/**
 * Test pipeline that executes migrations sequentially with profile analysis.
 *
 * @template TProfile - Field profile map for type inference
 * @public
 */
export interface TestPipeline<TProfile extends Record<string, FieldProfile>> {
  /** Field profile map for TypeScript type inference */
  readonly _profile: TProfile;

  /**
   * Get the computed field profiles.
   * @returns Map of field names to their preservation profiles
   */
  getProfile(): TProfile;

  /**
   * Execute the pipeline on input data.
   * @param input - Initial data
   * @param callback - Optional callback invoked with migration context at each step
   * @returns Final migrated data
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  execute<TInput, TOutput>(
    input: TInput,
    callback?: (ctx: MigrationContext) => void
  ): TOutput;
}

/**
 * Create a test pipeline from a sequence of migrations.
 *
 * The pipeline computes field profiles from the migrations and provides
 * a typed execution context. This is useful for testing migration chains
 * and ensuring type safety across version transitions.
 *
 * @template TProfile - Field profile map type for type inference
 * @param migrations - Ordered array of migrations to execute
 * @returns Test pipeline with profile analysis and execution
 *
 * @example
 * ```typescript
 * const pipeline = testPipeline([
 *   {
 *     fromVersion: '1.0.0',
 *     toVersion: '2.0.0',
 *     up: (data, ctx) => {
 *       ctx.preserve('theme', data.theme);
 *       return { ...data, theme: undefined };
 *     },
 *     down: (data, ctx) => {
 *       const theme = ctx.consume('theme');
 *       return { ...data, theme: theme?.value };
 *     },
 *   },
 *   {
 *     fromVersion: '2.0.0',
 *     toVersion: '3.0.0',
 *     up: (data, ctx) => {
 *       const theme = ctx.consume('theme');
 *       return { ...data, appearance: theme?.value };
 *     },
 *     down: (data, ctx) => {
 *       ctx.preserve('theme', data.appearance);
 *       return { ...data, appearance: undefined };
 *     },
 *   },
 * ]);
 *
 * const profile = pipeline.getProfile();
 * console.log(profile); // { theme: 'always-single' }
 *
 * const result = pipeline.execute({ theme: 'dark' });
 * console.log(result); // { appearance: 'dark' }
 * ```
 *
 * @public
 */
export function testPipeline<
  TProfile extends Record<string, FieldProfile> = Record<string, FieldProfile>,
>(
  migrations: readonly AnyMigration<unknown, unknown>[]
): TestPipeline<TProfile> {
  // Build a temporary graph to compute profiles
  const graph = createMigrationGraph({
    id: 'test-pipeline',
    versionStrategy: semverStrategy,
  });

  // Register all versions mentioned in migrations
  const versions = new Set<string>();
  for (const migration of migrations) {
    versions.add(migration.fromVersion);
    versions.add(migration.toVersion);
  }

  // Register schemas (with trivial validation)
  for (const version of versions) {
    graph.registerSchema({
      version,
      schema: (data: unknown) => ({ success: true, data }),
    });
  }

  // Register all migrations
  for (const migration of migrations) {
    graph.registerMigration(migration);
  }

  // Compute profiles
  const analysis = analyzeGraph(graph);
  const profiles = analysis.profiles as TProfile;

  return {
    _profile: profiles,

    getProfile() {
      return profiles;
    },

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    execute<TInput, TOutput>(
      input: TInput,
      callback?: (ctx: MigrationContext) => void
    ): TOutput {
      if (migrations.length === 0) {
        return input as unknown as TOutput;
      }

      // Create a simple migration context manually
      // We track preserved fields and provide the context API
      const preservedFields = new Map<string, unknown>();
      const history: Array<{
        type: 'preserved' | 'consumed';
        field: string;
        version: string;
      }> = [];

      const ctx: MigrationContext = {
        preserve(field: string, value: unknown) {
          preservedFields.set(field, value);
          history.push({ type: 'preserved', field, version: 'unknown' });
          return {
            status: 'preserved',
            field: {
              kind: 'single',
              path: field,
              value,
              history: [],
            },
          };
        },
        hasPreserved(field: string) {
          return preservedFields.has(field);
        },
        consume(field: string) {
          const value = preservedFields.get(field);
          if (value === undefined) {
            return undefined;
          }
          preservedFields.delete(field);
          history.push({ type: 'consumed', field, version: 'unknown' });
          return {
            kind: 'single',
            path: field,
            value,
            history: [],
          };
        },
        peek(field: string) {
          const value = preservedFields.get(field);
          if (value === undefined) {
            return undefined;
          }
          return {
            kind: 'single',
            path: field,
            value,
            history: [],
          };
        },
        listPreserved() {
          const result = [];
          for (const [path, value] of preservedFields) {
            result.push({
              kind: 'single' as const,
              path,
              value,
              history: [],
            });
          }
          return result;
        },
        getAuditLog() {
          return history
            .map((h) => `${h.type} ${h.field} at ${h.version}`)
            .join('\n');
        },
        currentStep: {
          from: '',
          to: '',
          direction: 'up',
          index: 0,
          totalSteps: migrations.length,
        },
      };

      let current: unknown = input;

      // Execute migrations sequentially
      for (let i = 0; i < migrations.length; i++) {
        const migration = migrations[i]!;

        // Update context's current step info (using type assertion to modify readonly property)
        (
          ctx as {
            currentStep: {
              from: string;
              to: string;
              direction: 'up' | 'down';
              index: number;
              totalSteps: number;
            };
          }
        ).currentStep = {
          from: migration.fromVersion,
          to: migration.toVersion,
          direction: 'up',
          index: i,
          totalSteps: migrations.length,
        };

        // Execute migration
        current = migration.up(current, ctx);

        // Invoke callback if provided
        if (callback) {
          callback(ctx);
        }
      }

      return current as TOutput;
    },
  };
}

/**
 * Test fixture for migration testing.
 *
 * @template T - The type of the test data
 * @public
 */
export interface TestFixture<T = unknown> {
  /** Version identifier */
  readonly version: string;
  /** Test data */
  readonly data: T;
}

/**
 * Create a test fixture with version and data.
 *
 * Test fixtures provide a consistent structure for setting up test cases
 * with version-tagged data. This is useful for parameterized tests across
 * multiple versions.
 *
 * @template T - The type of the test data
 * @param options - Fixture options
 * @returns Test fixture with version and data
 *
 * @example
 * ```typescript
 * const fixtures = [
 *   createTestFixture({ version: '1.0.0', data: { name: 'Alice' } }),
 *   createTestFixture({ version: '2.0.0', data: { name: 'Bob', email: 'bob@example.com' } }),
 * ];
 *
 * for (const fixture of fixtures) {
 *   it(`should validate ${fixture.version}`, () => {
 *     const result = schema.schema(fixture.data);
 *     expect(result.success).toBe(true);
 *   });
 * }
 * ```
 *
 * @public
 */
export function createTestFixture<T = unknown>(options: {
  version: string;
  data: T;
}): TestFixture<T> {
  return {
    version: options.version,
    data: options.data,
  };
}

/**
 * Generate sample test data for a schema.
 *
 * **Note:** This is currently a placeholder that returns an empty object.
 * Future versions may support schema introspection for automatic test data generation.
 *
 * @param _schema - Schema to generate data for (currently unused)
 * @returns Empty object as sample data
 *
 * @example
 * ```typescript
 * const schema = { version: '1.0.0', schema: (data) => ({ success: true, data }) };
 * const sampleData = generateTestData(schema);
 * // Returns: {}
 * ```
 *
 * @beta This function is a placeholder and may change significantly in future versions.
 */
export function generateTestData(_schema: unknown): Record<string, never> {
  return {};
}
