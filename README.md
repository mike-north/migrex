# Migrex

Versioned data contracts with bidirectional migrations for TypeScript.

Migrex helps you manage evolving data schemas by providing a graph-based migration system that can transform data between any two versions—forward or backward—while preserving fields that would otherwise be lost.

## Features

- **Bidirectional migrations** - Migrate data forward (up) or backward (down) between any versions
- **Automatic path finding** - BFS algorithm finds the shortest migration path between versions
- **Preservation stash** - Temporarily store fields during migration for lossless round-trips
- **Multiple version strategies** - SemVer, CalVer, or integer versioning
- **Async support** - Full support for asynchronous migrations
- **Batch operations** - Migrate arrays of data with progress callbacks
- **Telemetry hooks** - Observe migration execution for monitoring and debugging
- **Graph analysis** - Detect connectivity gaps, lossy paths, and deprecated versions
- **Type-safe** - Full TypeScript support with strict typing

## Installation

```bash
npm install @migrex/core
# or
pnpm add @migrex/core
```

## Quick Start

```typescript
import {
  createMigrationGraph,
  semverStrategy,
  type VersionedSchema,
  type ReversibleMigration,
} from '@migrex/core';

// Define your versioned schemas
interface UserV1 {
  name: string;
}

interface UserV2 {
  firstName: string;
  lastName: string;
}

const schemaV1: VersionedSchema<UserV1> = {
  version: '1.0.0',
  schema: (data) => {
    if (typeof data === 'object' && data !== null && 'name' in data) {
      return { success: true, data: data as UserV1 };
    }
    return { success: false, errors: [{ path: [], message: 'Invalid user' }] };
  },
};

const schemaV2: VersionedSchema<UserV2> = {
  version: '2.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'firstName' in data &&
      'lastName' in data
    ) {
      return { success: true, data: data as UserV2 };
    }
    return { success: false, errors: [{ path: [], message: 'Invalid user' }] };
  },
};

// Define migrations
const migration: ReversibleMigration<UserV1, UserV2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data) => {
    const [firstName, ...rest] = data.name.split(' ');
    return { firstName, lastName: rest.join(' ') || '' };
  },
  down: (data) => ({
    name: `${data.firstName} ${data.lastName}`.trim(),
  }),
};

// Create the migration graph
const graph = createMigrationGraph({
  id: 'user-schema',
  versionStrategy: semverStrategy,
});

graph.registerSchema(schemaV1);
graph.registerSchema(schemaV2);
graph.registerMigration(migration);

// Migrate data
const result = graph.migrate({ name: 'John Doe' }, '1.0.0', '2.0.0');

if (result.success) {
  console.log(result.data); // { firstName: 'John', lastName: 'Doe' }
}
```

## Preservation Stash

The preservation stash allows you to store field values during migration that would otherwise be lost, enabling lossless round-trip migrations:

```typescript
const migration: ReversibleMigration<DetailedUser, SimpleUser> = {
  fromVersion: '2.0.0',
  toVersion: '1.0.0',
  up: (data, ctx) => {
    // Preserve fields that don't exist in v1
    ctx.preserve('avatar', data.avatar);
    ctx.preserve('bio', data.bio);
    return { name: data.name };
  },
  down: (data, ctx) => {
    // Restore preserved fields when migrating back
    const avatar = ctx.consume('avatar');
    const bio = ctx.consume('bio');
    return {
      name: data.name,
      avatar: avatar?.value as string | undefined,
      bio: bio?.value as string | undefined,
    };
  },
};
```

## Async Migrations

For migrations that require async operations (API calls, database lookups):

```typescript
import type { AsyncReversibleMigration } from '@migrex/core';

const asyncMigration: AsyncReversibleMigration<UserV1, UserV2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: async (data, ctx) => {
    const enriched = await fetchUserDetails(data.id);
    return { ...data, ...enriched };
  },
  down: async (data) => {
    return { id: data.id, name: data.name };
  },
};

// Use migrateAsync for async migrations
const result = await graph.migrateAsync(data, '1.0.0', '2.0.0');
```

## Batch Migrations

Migrate arrays of data efficiently:

```typescript
const results = graph.migrateMany(users, '1.0.0', '2.0.0', {
  continueOnError: true,
  onProgress: (completed, total, lastResult) => {
    console.log(`Progress: ${completed}/${total}`);
  },
});

console.log(`Succeeded: ${results.succeeded}, Failed: ${results.failed}`);
```

## Telemetry

Add observability to your migrations:

```typescript
const graph = createMigrationGraph({
  id: 'user-schema',
  versionStrategy: semverStrategy,
  telemetry: {
    onPathComputed: (path, durationMs) => {
      console.log(`Path found in ${durationMs}ms`);
    },
    onStepStart: (step, index, total) => {
      console.log(`Starting step ${index + 1}/${total}`);
    },
    onStepComplete: (step, index, durationMs) => {
      console.log(`Step completed in ${durationMs}ms`);
    },
    onMigrationComplete: (result, totalMs) => {
      console.log(`Migration ${result.success ? 'succeeded' : 'failed'}`);
    },
    onError: (error, step, ctx) => {
      console.error('Migration error:', error);
    },
  },
});
```

## Graph Analysis

Analyze your migration graph for potential issues:

```typescript
import { analyzeGraph, findLossyPaths, suggestMigrations } from '@migrex/core';

// Full analysis
const analysis = analyzeGraph(graph);
console.log(analysis.diagnostics); // Warnings and errors
console.log(analysis.connectivity); // Reachability between versions

// Find paths that lose data
const lossyPaths = findLossyPaths(graph);

// Get suggestions for new migrations
const suggestions = suggestMigrations(graph);
```

## Packages

| Package | Description |
|---------|-------------|
| [`@migrex/core`](./packages/core) | Core migration graph and execution engine |
| [`@migrex/zod`](./packages/zod) | Zod schema integration |
| [`@migrex/json-schema`](./packages/json-schema) | JSON Schema integration |
| [`@migrex/rest`](./packages/rest) | REST API versioning utilities |
| [`@migrex/testing`](./packages/testing) | Test utilities and helpers |
| [`@migrex/cli`](./packages/cli) | Command-line interface |
| [`@migrex/eslint-plugin`](./packages/eslint-plugin) | ESLint rules for migrations |
| [`@migrex/ts-plugin`](./packages/ts-plugin) | TypeScript language service plugin |
| [`@migrex/files`](./packages/files) | File-based configuration |

## Version Strategies

Migrex supports multiple versioning schemes:

```typescript
import { semverStrategy, calverStrategy, integerStrategy } from '@migrex/core';

// Semantic versioning (1.0.0, 2.1.3)
const graph1 = createMigrationGraph({
  id: 'semver-example',
  versionStrategy: semverStrategy,
});

// Calendar versioning (2024.01, 2024.02)
const graph2 = createMigrationGraph({
  id: 'calver-example',
  versionStrategy: calverStrategy,
});

// Simple integers (1, 2, 3)
const graph3 = createMigrationGraph({
  id: 'integer-example',
  versionStrategy: integerStrategy,
});
```

## API Documentation

Full API documentation is available in the [docs](./packages/core/docs) directory.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Full validation
pnpm validate
```

## License

UNLICENSED
