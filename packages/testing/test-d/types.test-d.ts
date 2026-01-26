import { expectType, expectAssignable } from 'tsd';
import type {
  MigrationResult,
  MigrationGraph,
  FieldProfile,
  AnyMigration,
  MigrationContext,
} from '@migrex/core';
import {
  assertLossless,
  assertConnected,
  assertNoDeprecatedPaths,
  assertFieldProfile,
  testPipeline,
  createTestFixture,
  generateTestData,
  type TestPipeline,
  type TestFixture,
} from '@migrex/testing';

// Verify assertLossless accepts MigrationResult
declare const migrationResult: MigrationResult<{ name: string }>;
expectType<void>(assertLossless(migrationResult));

// Verify assertConnected accepts MigrationGraph
declare const mockGraph: MigrationGraph;
expectType<void>(assertConnected(mockGraph));

// Verify assertNoDeprecatedPaths accepts MigrationGraph
expectType<void>(assertNoDeprecatedPaths(mockGraph));

// Verify assertFieldProfile accepts correct parameters
expectType<void>(assertFieldProfile(mockGraph, 'theme', 'always-single'));
expectType<void>(assertFieldProfile(mockGraph, 'avatar', 'sometimes-multi'));

// Verify FieldProfile type values
const singleProfile: FieldProfile = 'always-single';
const multiProfile: FieldProfile = 'sometimes-multi';
expectAssignable<FieldProfile>(singleProfile);
expectAssignable<FieldProfile>(multiProfile);

// Verify TestFixture interface
const fixture: TestFixture<{ name: string }> = {
  version: '1.0.0',
  data: { name: 'test' },
};
expectType<string>(fixture.version);
expectType<{ name: string }>(fixture.data);

// Verify createTestFixture returns TestFixture
const createdFixture = createTestFixture({
  version: '1.0.0',
  data: { name: 'test', age: 30 },
});
expectType<TestFixture<{ name: string; age: number }>>(createdFixture);
expectType<string>(createdFixture.version);
expectType<{ name: string; age: number }>(createdFixture.data);

// Verify generateTestData returns empty object
const testData = generateTestData({});
expectType<Record<string, never>>(testData);

// Verify testPipeline returns TestPipeline
const migrations: AnyMigration<unknown, unknown>[] = [];
const pipeline = testPipeline(migrations);
expectAssignable<TestPipeline<Record<string, FieldProfile>>>(pipeline);

// Verify TestPipeline methods
expectType<Record<string, FieldProfile>>(pipeline.getProfile());

// Verify execute method
const input = { name: 'test' };
const output = pipeline.execute<{ name: string }, { name: string }>(input);
expectType<{ name: string }>(output);

// Verify execute with callback
const outputWithCallback = pipeline.execute<{ name: string }, { name: string }>(
  input,
  (_ctx: MigrationContext) => {}
);
expectType<{ name: string }>(outputWithCallback);

// Verify _profile property exists on pipeline
expectAssignable<Record<string, FieldProfile>>(pipeline._profile);
