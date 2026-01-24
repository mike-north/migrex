import { expectType, expectError, expectAssignable } from 'tsd';
import { createMigrationGraph, type MigrationGraph } from '../src/graph.js';
import { semverStrategy } from '../src/strategies/index.js';
import type {
  MigrationPath,
  MigrationResult,
  VersionedSchema,
  ReversibleMigration,
  OneWayMigration,
} from '../src/types.js';

const graph = createMigrationGraph({
  id: 'test',
  versionStrategy: semverStrategy,
});

// Verify createMigrationGraph returns MigrationGraph
expectType<MigrationGraph>(graph);

// Verify method return types
expectType<readonly string[]>(graph.getVersions());
expectType<MigrationPath>(graph.getPath('1.0.0', '2.0.0'));
expectType<boolean>(graph.hasPath('1.0.0', '2.0.0'));
expectType<VersionedSchema<unknown> | undefined>(graph.getSchema('1.0.0'));
expectType<readonly import('../src/types.js').Migration<unknown, unknown>[]>(
  graph.getMigrations()
);

// Verify migrate return type
const result = graph.migrate({}, '1.0.0', '2.0.0');
expectType<MigrationResult<unknown>>(result);

// Verify migrate with type parameter
type UserV1 = { name: string };
const typedResult = graph.migrate<UserV1>({}, '1.0.0', '2.0.0');
expectType<MigrationResult<UserV1>>(typedResult);

// Verify result data type matches generic parameter
if (typedResult.success) {
  expectType<UserV1>(typedResult.data);
}

// Verify registration methods are type-safe
type V1 = { version: '1.0.0'; name: string };
type V2 = { version: '2.0.0'; name: string; age: number };

const schemaV1: VersionedSchema<V1> = {
  version: '1.0.0',
  schema: (data) => ({ success: true, data: data as V1 }),
};

const migration: ReversibleMigration<V1, V2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data, _ctx) => ({ version: '2.0.0', name: data.name, age: 0 }),
  down: (data, _ctx) => ({ version: '1.0.0', name: data.name }),
};

const oneWayMigration: OneWayMigration<V1, V2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  irreversibleReason: 'Cannot recover age',
  up: (data, _ctx) => ({ version: '2.0.0', name: data.name, age: 0 }),
};

// These should compile
graph.registerSchema(schemaV1);
graph.registerMigration(migration);
graph.registerMigration(oneWayMigration);

// Verify MigrationPath structure
const path = graph.getPath('1.0.0', '2.0.0');
expectType<readonly import('../src/types.js').MigrationStep[]>(path.steps);
expectType<'up' | 'down' | 'mixed'>(path.direction);
expectType<boolean>(path.hasIrreversibleStep);

// Verify steps have correct types
if (path.steps.length > 0) {
  const step = path.steps[0];
  expectType<string>(step.fromVersion);
  expectType<string>(step.toVersion);
  expectType<'up' | 'down'>(step.direction);
  expectType<import('../src/types.js').Migration<unknown, unknown>>(
    step.migration
  );
}

// Verify MigrationResult discriminated union
const migrationResult = graph.migrate<V1>({}, '1.0.0', '2.0.0');
if (migrationResult.success) {
  expectType<V1>(migrationResult.data);
  // Error should not exist on success
  expectType<Error | undefined>(migrationResult.error);
} else {
  // Data should not exist on failure
  expectType<V1 | undefined>(migrationResult.data);
  // Error should exist on failure
  expectType<Error | undefined>(migrationResult.error);
}

// Verify options are optional
graph.migrate({}, '1.0.0', '2.0.0');
graph.migrate({}, '1.0.0', '2.0.0', {});
graph.migrate({}, '1.0.0', '2.0.0', { skipValidation: true });
graph.migrate({}, '1.0.0', '2.0.0', { validateIntermediate: true });
graph.migrate({}, '1.0.0', '2.0.0', {
  skipValidation: false,
  validateIntermediate: false,
});

// Verify registration methods don't accept invalid types
expectError(graph.registerSchema({ version: 123 }));
expectError(graph.registerSchema({ version: '1.0.0' })); // Missing schema function
expectError(
  graph.registerMigration({ fromVersion: '1.0.0', toVersion: '2.0.0' })
); // Missing up function

// Verify OneWayMigration requires irreversibleReason
expectError(
  graph.registerMigration({
    fromVersion: '1.0.0',
    toVersion: '2.0.0',
    up: (data: V1) => data as unknown as V2,
    // Missing irreversibleReason
  })
);

// Verify down is never for OneWayMigration
const oneWay: OneWayMigration<V1, V2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  irreversibleReason: 'test',
  up: (data) => data as unknown as V2,
};
expectError((oneWay.down = () => ({}) as V1));
