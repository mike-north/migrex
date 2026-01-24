import type {
  VersionedSchema,
  Migration,
  ReversibleMigration,
  OneWayMigration,
  MigrationResult,
} from '../../src/index.js';

/**
 * Create a test schema with simple validation.
 * This helper reduces boilerplate when creating schemas for tests.
 *
 * @param version - The version string for this schema
 * @param validator - A type guard function that validates the data
 * @returns A VersionedSchema that can be registered with a migration graph
 *
 * @example
 * ```ts
 * const schemaV1 = createTestSchema('1.0.0', (data): data is V1Data => {
 *   return typeof data === 'object' && data !== null && 'name' in data;
 * });
 * ```
 */
export function createTestSchema<T>(
  version: string,
  validator: (data: unknown) => data is T
): VersionedSchema<T> {
  return {
    version,
    schema: (data: unknown) => {
      if (validator(data)) {
        return { success: true, data };
      }
      return {
        success: false,
        errors: [{ path: [], message: 'Validation failed', code: 'INVALID' }],
      };
    },
  };
}

/**
 * Create a reversible test migration.
 * This helper reduces boilerplate when creating bidirectional migrations.
 *
 * @param fromVersion - Source version
 * @param toVersion - Target version
 * @param up - Function to transform data from source to target
 * @param down - Function to transform data from target to source
 * @returns A ReversibleMigration that can be registered with a migration graph
 *
 * @example
 * ```ts
 * const migration = createReversibleMigration(
 *   '1.0.0',
 *   '2.0.0',
 *   (data) => ({ ...data, newField: 'default' }),
 *   (data) => { const { newField, ...rest } = data; return rest; }
 * );
 * ```
 */
export function createReversibleMigration<From, To>(
  fromVersion: string,
  toVersion: string,
  up: (data: From) => To,
  down: (data: To) => From
): ReversibleMigration<From, To> {
  return {
    fromVersion,
    toVersion,
    up: (data) => up(data),
    down: (data) => down(data),
  };
}

/**
 * Create a one-way test migration.
 * This helper reduces boilerplate when creating irreversible migrations.
 *
 * @param fromVersion - Source version
 * @param toVersion - Target version
 * @param up - Function to transform data from source to target
 * @param reason - Explanation of why the migration cannot be reversed
 * @returns A OneWayMigration that can be registered with a migration graph
 *
 * @example
 * ```ts
 * const migration = createOneWayMigration(
 *   '1.0.0',
 *   '2.0.0',
 *   (data) => ({ ...data, email: 'unknown@example.com' }),
 *   'Email cannot be recovered'
 * );
 * ```
 */
export function createOneWayMigration<From, To>(
  fromVersion: string,
  toVersion: string,
  up: (data: From) => To,
  reason: string
): OneWayMigration<From, To> {
  return {
    fromVersion,
    toVersion,
    up: (data) => up(data),
    irreversibleReason: reason,
  };
}

/**
 * Assert that a migration succeeded and return the typed data.
 * Throws an error if the migration failed.
 *
 * @param result - The migration result to check
 * @returns The successfully migrated data
 * @throws If the migration failed
 *
 * @example
 * ```ts
 * const result = graph.migrate(data, '1.0.0', '2.0.0');
 * const migrated = assertSuccess(result);
 * expect(migrated.version).toBe('2.0.0');
 * ```
 */
export function assertSuccess<T>(result: MigrationResult<T>): T {
  if (!result.success) {
    throw new Error(
      `Expected migration to succeed but got error: ${result.error?.message || 'Unknown error'}`
    );
  }
  if (!result.data) {
    throw new Error('Expected data to be present on successful result');
  }
  return result.data;
}

/**
 * Assert that a migration failed with an optional specific error code.
 * Throws an error if the migration succeeded.
 *
 * @param result - The migration result to check
 * @param expectedCode - Optional error code to verify
 * @throws If the migration succeeded or has wrong error code
 *
 * @example
 * ```ts
 * const result = graph.migrate(invalidData, '1.0.0', '2.0.0');
 * assertFailure(result, 'VALIDATION_FAILED');
 * ```
 */
export function assertFailure(
  result: MigrationResult<unknown>,
  expectedCode?: string
): void {
  if (result.success) {
    throw new Error('Expected migration to fail but it succeeded');
  }
  if (expectedCode && result.error && 'code' in result.error) {
    const actualCode = (result.error as { code?: string }).code;
    if (actualCode !== expectedCode) {
      throw new Error(
        `Expected error code '${expectedCode}' but got '${actualCode}'`
      );
    }
  }
}
