# @migrex/testing

Test utilities for migrex - helpers for testing migration graphs and pipelines.

## Features

- **Assertion helpers** - Verify migrations are lossless, graphs are connected, field profiles are correct
- **Test pipelines** - Execute migration sequences with profile analysis
- **Test fixtures** - Create version-tagged test data
- **Graph analysis** - Check for deprecated version paths

## Installation

```bash
npm install -D @migrex/testing @migrex/core
```

## Usage

### Assert Lossless Migrations

Verify that a migration doesn't lose any preserved fields:

```typescript
import { assertLossless } from '@migrex/testing';

describe('user migration', () => {
  it('should round-trip without loss', () => {
    const result = graph.migrate(data, '1.0.0', '2.0.0');
    assertLossless(result); // Throws if unconsumed preserved fields exist
  });
});
```

### Assert Graph Connectivity

Verify that all versions can reach each other:

```typescript
import { assertConnected } from '@migrex/testing';

describe('migration graph', () => {
  it('should be fully connected', () => {
    assertConnected(graph); // Throws if graph has disconnected components
  });
});
```

### Assert No Deprecated Paths

Verify that migrations between current versions don't route through deprecated ones:

```typescript
import { assertNoDeprecatedPaths } from '@migrex/testing';

describe('migration graph', () => {
  it('should not require deprecated versions for current migrations', () => {
    assertNoDeprecatedPaths(graph);
  });
});
```

### Assert Field Profiles

Verify that a field has the expected preservation profile:

```typescript
import { assertFieldProfile } from '@migrex/testing';

describe('field profiles', () => {
  it('should preserve theme as single value', () => {
    assertFieldProfile(graph, 'theme', 'always-single');
  });

  it('should handle tags as multi-value', () => {
    assertFieldProfile(graph, 'tags', 'sometimes-multi');
  });
});
```

### Test Pipelines

Create a test pipeline for migration sequences:

```typescript
import { testPipeline } from '@migrex/testing';

const pipeline = testPipeline([
  migrationV1ToV2,
  migrationV2ToV3,
]);

// Get computed field profiles
const profiles = pipeline.getProfile();
console.log(profiles); // { theme: 'always-single', ... }

// Execute the pipeline
const result = pipeline.execute({ name: 'Test', theme: 'dark' });
```

### Test Fixtures

Create version-tagged test data:

```typescript
import { createTestFixture } from '@migrex/testing';

const fixtures = [
  createTestFixture({ version: '1.0.0', data: { name: 'Alice' } }),
  createTestFixture({ version: '2.0.0', data: { firstName: 'Bob', lastName: 'Smith' } }),
];

describe('schema validation', () => {
  for (const fixture of fixtures) {
    it(`should validate ${fixture.version} data`, () => {
      const schema = graph.getSchema(fixture.version);
      const result = schema.schema(fixture.data);
      expect(result.success).toBe(true);
    });
  }
});
```

## API Reference

### Assertion Functions

| Function | Description |
|----------|-------------|
| `assertLossless(result)` | Assert migration result has no unconsumed preserved fields |
| `assertConnected(graph)` | Assert all versions can reach each other |
| `assertNoDeprecatedPaths(graph)` | Assert no deprecated versions in critical paths |
| `assertFieldProfile(graph, field, expected)` | Assert field has expected profile |

### Test Pipeline

```typescript
interface TestPipeline<TProfile> {
  getProfile(): TProfile;
  execute<TInput, TOutput>(
    input: TInput,
    callback?: (ctx: MigrationContext) => void
  ): TOutput;
}

function testPipeline(migrations: AnyMigration[]): TestPipeline<Record<string, FieldProfile>>;
```

### Test Fixtures

```typescript
interface TestFixture<T> {
  readonly version: string;
  readonly data: T;
}

function createTestFixture<T>(options: { version: string; data: T }): TestFixture<T>;
```

### Utility Functions

| Function | Description |
|----------|-------------|
| `generateTestData(schema)` | Placeholder for generating sample data (returns `{}`) |

## Example Test Suite

```typescript
import { describe, it, expect } from 'vitest';
import {
  assertLossless,
  assertConnected,
  assertFieldProfile,
  testPipeline,
  createTestFixture,
} from '@migrex/testing';
import { createMigrationGraph, semverStrategy } from '@migrex/core';

describe('User Migration Graph', () => {
  const graph = createMigrationGraph({
    id: 'user',
    versionStrategy: semverStrategy,
  });

  // Register schemas and migrations...

  describe('connectivity', () => {
    it('should be fully connected', () => {
      assertConnected(graph);
    });
  });

  describe('field profiles', () => {
    it('should preserve avatar as single value', () => {
      assertFieldProfile(graph, 'avatar', 'always-single');
    });
  });

  describe('round-trip migrations', () => {
    const fixtures = [
      createTestFixture({ version: '1.0.0', data: { name: 'Test User' } }),
    ];

    for (const fixture of fixtures) {
      it(`should round-trip ${fixture.version} without loss`, () => {
        const up = graph.migrate(fixture.data, fixture.version, '2.0.0');
        const down = graph.migrate(up.data, '2.0.0', fixture.version);
        assertLossless(down);
      });
    }
  });
});
```

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Build types
pnpm build:types

# Update API report
pnpm api:update
```

## License

UNLICENSED
