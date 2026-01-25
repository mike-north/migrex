/**
 * \@migrex/testing - Test utilities for migrex
 *
 * This package provides helpers for testing migration graphs and pipelines.
 *
 * @packageDocumentation
 */

import type { MigrationResult } from '@migrex/core';

/**
 * Assert that a migration result is lossless (no unconsumed preserved fields).
 */
export function assertLossless<T>(result: MigrationResult<T>): void {
  if (!result.stash.lossless) {
    const unconsumed = result.stash.unconsumed.map((f) => f.path).join(', ');
    throw new Error(`Migration was lossy. Unconsumed fields: ${unconsumed}`);
  }
}

/**
 * Assert that a migration graph is fully connected.
 */
export function assertConnected(_graph: unknown): void {
  // TODO: Implement using analyzeGraph
  throw new Error('Not implemented');
}

/**
 * Assert that no deprecated versions are used in critical paths.
 */
export function assertNoDeprecatedPaths(_graph: unknown): void {
  // TODO: Implement
  throw new Error('Not implemented');
}

/**
 * Assert that a field has a specific profile.
 */
export function assertFieldProfile(
  _graph: unknown,
  _field: string,
  _expectedProfile: 'always-single' | 'sometimes-multi'
): void {
  // TODO: Implement
  throw new Error('Not implemented');
}

/**
 * Create a test pipeline from migrations.
 */
export function testPipeline(_migrations: readonly unknown[]) {
  return {
    _profile: {} as Record<string, 'always-single' | 'sometimes-multi'>,
    getProfile() {
      // TODO: Compute profile from migrations
      return {};
    },
    execute(_input: unknown, _callback?: (ctx: unknown) => void) {
      // TODO: Execute pipeline
      throw new Error('Not implemented');
    },
  };
}

/**
 * Create a test fixture for migration testing.
 */
export function createTestFixture(_options: {
  version: string;
  data: unknown;
}): never {
  // TODO: Implement
  throw new Error('Not implemented');
}

/**
 * Generate test data for a schema.
 */
export function generateTestData(_schema: unknown): never {
  // TODO: Implement
  throw new Error('Not implemented');
}
