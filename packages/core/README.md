# @migrex/core

Core library for versioned data contracts with bidirectional migrations.

## Overview

Migrex provides a type-safe, graph-based migration system for evolving data schemas over time. It enables you to:

- Define multiple versions of your data schemas
- Write bidirectional migrations between versions
- Automatically compute migration paths between any two versions
- Preserve fields during migrations that would otherwise be lost
- Analyze your migration graph for connectivity and data loss issues

### Key Concepts

**Versioned Data Contracts**: Each version of your data has a schema that validates and types the data. Versions are ordered using a strategy (semver, calver, or integer).

**Bidirectional Migrations**: Most migrations are reversible, allowing you to migrate both forward (up) and backward (down) between versions. This ensures data can flow in both directions without loss.

**One-Way Migrations**: Some transformations are intentionally lossy or irreversible. These are marked with traits to help users understand the implications.

**Field Preservation**: When a field is removed in one version but needed in a later version, migrations can preserve the field in a "stash" and restore it later. This enables lossless multi-step migrations.

**Migration Graph**: All versions and migrations form a directed graph. Migrex automatically finds the shortest path between any two versions.

## Installation

```bash
pnpm add @migrex/core
```

## Quick Start

```typescript
import { createMigrationGraph, semverStrategy } from '@migrex/core';
import type { VersionedSchema, ReversibleMigration, MigrationContext } from '@migrex/core';

// Define your data types
type UserV1 = {
  version: '1.0.0';
  name: string;
};

type UserV2 = {
  version: '2.0.0';
  firstName: string;
  lastName: string;
};

// Define schemas with validation
const schemaV1: VersionedSchema<UserV1> = {
  version: '1.0.0',
  schema: (data: unknown) => {
    // Validate the shape and return typed data
    if (
      typeof data === 'object' &&
      data !== null &&
      'name' in data &&
      typeof data.name === 'string' &&
      'version' in data &&
      data.version === '1.0.0'
    ) {
      return { success: true, data: data as UserV1 };
    }
    return {
      success: false,
      errors: [{ path: [], message: 'Invalid v1 user data' }],
    };
  },
};

const schemaV2: VersionedSchema<UserV2> = {
  version: '2.0.0',
  schema: (data: unknown) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'firstName' in data &&
      typeof data.firstName === 'string' &&
      'lastName' in data &&
      typeof data.lastName === 'string' &&
      'version' in data &&
      data.version === '2.0.0'
    ) {
      return { success: true, data: data as UserV2 };
    }
    return {
      success: false,
      errors: [{ path: [], message: 'Invalid v2 user data' }],
    };
  },
};

// Define a bidirectional migration
const migrationV1ToV2: ReversibleMigration<UserV1, UserV2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data: UserV1, _ctx: MigrationContext) => {
    // Split name into firstName and lastName
    const parts = data.name.split(' ');
    return {
      version: '2.0.0',
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
    };
  },
  down: (data: UserV2, _ctx: MigrationContext) => {
    // Combine firstName and lastName back into name
    return {
      version: '1.0.0',
      name: `${data.firstName} ${data.lastName}`.trim(),
    };
  },
};

// Create the migration graph
const graph = createMigrationGraph({
  id: 'user-graph',
  versionStrategy: semverStrategy,
});

// Register schemas and migrations
graph.registerSchema(schemaV1);
graph.registerSchema(schemaV2);
graph.registerMigration(migrationV1ToV2);

// Migrate data from v1 to v2
const v1Data: UserV1 = { version: '1.0.0', name: 'John Doe' };
const result = graph.migrate(v1Data, '1.0.0', '2.0.0');

if (result.success) {
  console.log(result.data);
  // { version: '2.0.0', firstName: 'John', lastName: 'Doe' }
}

// Migrate back from v2 to v1
const v2Data: UserV2 = { version: '2.0.0', firstName: 'Jane', lastName: 'Smith' };
const reverseResult = graph.migrate(v2Data, '2.0.0', '1.0.0');

if (reverseResult.success) {
  console.log(reverseResult.data);
  // { version: '1.0.0', name: 'Jane Smith' }
}
```

## Declarative Graph Configuration

You can register schemas and migrations during graph creation for a more declarative style:

```typescript
import { createMigrationGraph, semverStrategy } from '@migrex/core';

const graph = createMigrationGraph({
  id: 'user-graph',
  versionStrategy: semverStrategy,
  schemas: [schemaV1, schemaV2, schemaV3],
  migrations: [migrationV1ToV2, migrationV2ToV3],
});

// No need to call registerSchema() or registerMigration()!
```

This is equivalent to calling `registerSchema()` and `registerMigration()` for each item. You can also mix declarative and imperative registration:

```typescript
const graph = createMigrationGraph({
  id: 'user-graph',
  versionStrategy: semverStrategy,
  schemas: [schemaV1, schemaV2],
});

// Add more later
graph.registerSchema(schemaV3);
graph.registerMigration(migrationV2ToV3);
```

## Migration Helpers

For common migration patterns, use the built-in helper functions instead of writing custom migrations:

### addField

Add a field with a default value:

```typescript
import { addField } from '@migrex/core';

interface V1 { version: string; name: string; }
interface V2 { version: string; name: string; logLevel: string; }

const migration = addField<V1, V2, 'logLevel'>({
  from: '1.0.0',
  to: '1.1.0',
  field: 'logLevel',
  defaultValue: 'info',
});

graph.registerMigration(migration);
```

### removeField

Remove a field, optionally preserving it for later restoration:

```typescript
import { removeField } from '@migrex/core';

interface V1 { version: string; name: string; deprecated: string; }
interface V2 { version: string; name: string; }

// Simple removal (lossy)
const migration = removeField<V1, V2, 'deprecated'>({
  from: '1.0.0',
  to: '1.1.0',
  field: 'deprecated',
});

// With preservation (lossless)
const preservingMigration = removeField<V1, V2, 'deprecated'>({
  from: '1.0.0',
  to: '1.1.0',
  field: 'deprecated',
  preserveAs: 'old.deprecated', // Stored in the stash
});
```

### renameField

Rename a field while preserving its value:

```typescript
import { renameField } from '@migrex/core';

interface V1 { version: string; user_name: string; }
interface V2 { version: string; userName: string; }

const migration = renameField<V1, V2>({
  from: '1.0.0',
  to: '2.0.0',
  oldName: 'user_name',
  newName: 'userName',
});
```

### restructure

Transform between flat and nested structures:

```typescript
import { restructure } from '@migrex/core';

interface V1 { version: string; appName: string; port: number; }
interface V2 { version: string; app: { name: string }; server: { port: number }; }

const migration = restructure<V1, V2>({
  from: '1.0.0',
  to: '2.0.0',
  transform: {
    'app.name': 'appName',
    'server.port': 'port',
  },
});
```

The `transform` object maps nested paths (in v2) to flat field names (in v1). This helper:
- Automatically handles both `up` (flat → nested) and `down` (nested → flat) migrations
- Sets appropriate traits to indicate the structural transformation
- Is fully reversible

## Field Preservation

When a field is removed in one version but needed later, you can preserve it:

```typescript
type V1 = { version: '1.0.0'; name: string; theme: 'light' | 'dark' };
type V2 = { version: '2.0.0'; name: string }; // theme removed
type V3 = { version: '3.0.0'; name: string; theme: 'light' | 'dark' }; // theme restored

const migrationV1ToV2: ReversibleMigration<V1, V2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data: V1, ctx: MigrationContext) => {
    // Preserve theme for later restoration
    ctx.preserve('theme', data.theme, {
      sourceVersion: '1.0.0',
      description: 'Theme preference reintroduced in v3',
    });

    return {
      version: '2.0.0',
      name: data.name,
    };
  },
  down: (data: V2, ctx: MigrationContext) => {
    // Restore theme when migrating back
    const preserved = ctx.consume('theme');
    return {
      version: '1.0.0',
      name: data.name,
      theme: (preserved?.value as 'light' | 'dark') ?? 'light',
    };
  },
};

const migrationV2ToV3: ReversibleMigration<V2, V3> = {
  fromVersion: '2.0.0',
  toVersion: '3.0.0',
  up: (data: V2, ctx: MigrationContext) => {
    // Restore preserved theme
    const preserved = ctx.consume('theme');
    return {
      version: '3.0.0',
      name: data.name,
      theme: (preserved?.value as 'light' | 'dark') ?? 'light',
    };
  },
  down: (data: V3, ctx: MigrationContext) => {
    // Preserve theme when migrating back through v2
    ctx.preserve('theme', data.theme, {
      sourceVersion: '3.0.0',
      description: 'Theme exists in v1',
    });

    return {
      version: '2.0.0',
      name: data.name,
    };
  },
};

// Now v1 -> v2 -> v3 migration preserves the theme field
const graph = createMigrationGraph({
  id: 'theme-example',
  versionStrategy: semverStrategy,
});
graph.registerSchema(schemaV1);
graph.registerSchema(schemaV2);
graph.registerSchema(schemaV3);
graph.registerMigration(migrationV1ToV2);
graph.registerMigration(migrationV2ToV3);

const v1Data: V1 = { version: '1.0.0', name: 'Alice', theme: 'dark' };
const result = graph.migrate(v1Data, '1.0.0', '3.0.0');

if (result.success) {
  console.log(result.data);
  // { version: '3.0.0', name: 'Alice', theme: 'dark' }
  // Theme was preserved through v2!

  console.log(result.stash.consumed);
  // ['theme'] - shows theme was successfully consumed in v3

  console.log(result.stash.lossless);
  // true - no data was lost during migration
}
```

### Round-Trip Migrations

When chaining multiple migrations (e.g., forward then backward), pass the stash from the first migration to the second using `initialStash`:

```typescript
// Migrate v1 -> v3 (forward)
const v1Data: V1 = { version: '1.0.0', name: 'Alice', theme: 'dark' };
const forwardResult = graph.migrate(v1Data, '1.0.0', '3.0.0');

if (forwardResult.success) {
  // Now migrate v3 -> v1 (backward), passing the stash
  const backwardResult = graph.migrate(forwardResult.data, '3.0.0', '1.0.0', {
    initialStash: forwardResult.preservedFields,
  });

  if (backwardResult.success) {
    console.log(backwardResult.data);
    // { version: '1.0.0', name: 'Alice', theme: 'dark' }
    // Theme was preserved through the round-trip!
  }
}
```

## Graph Analysis

Analyze your migration graph to find connectivity issues, lossy paths, and optimization opportunities:

```typescript
import { analyzeGraph, findLossyPaths, suggestMigrations } from '@migrex/core';

// Analyze the graph
const analysis = analyzeGraph(graph);

console.log(`Analyzed ${analysis.metadata.versionCount} versions`);
console.log(`Found ${analysis.diagnostics.length} issues`);

// Check connectivity
if (!analysis.connectivity.fullyConnected) {
  console.log('Warning: Graph has disconnected components');
  for (const component of analysis.connectivity.components) {
    console.log(`  Component: ${component.join(', ')}`);
  }
}

// Check for lossy paths
const lossyReport = findLossyPaths(graph);
console.log(`\nLossy paths: ${lossyReport.lossyPairCount}/${lossyReport.totalVersionPairs}`);

for (const { from, to, analysis } of lossyReport.lossyPairs) {
  console.log(`\n${from} -> ${to}: Data loss detected`);
  for (const step of analysis.lossySteps) {
    console.log(`  ${step.from} -> ${step.to}: ${step.reason}`);
  }
}

// Get migration suggestions
const suggestions = suggestMigrations(graph);
for (const suggestion of suggestions) {
  console.log(`\nSuggestion: Add migration ${suggestion.from} -> ${suggestion.to}`);
  console.log(`Reason: ${suggestion.reason}`);
}

// Check for deprecated versions
import { getDeprecatedVersions } from '@migrex/core';

const deprecated = getDeprecatedVersions(graph);
for (const info of deprecated) {
  console.log(`\n${info.version} is deprecated`);
  console.log(`  Successor: ${info.deprecated.successor}`);
  console.log(`  Since: ${info.deprecated.since}`);
  if (info.deprecated.message) {
    console.log(`  Message: ${info.deprecated.message}`);
  }
}
```

## Version Strategies

Migrex supports three versioning strategies:

### Semantic Versioning (semver)

```typescript
import { createMigrationGraph, semverStrategy } from '@migrex/core';

const graph = createMigrationGraph({
  id: 'my-graph',
  versionStrategy: semverStrategy,
});
// Versions: '1.0.0', '1.1.0', '2.0.0', etc.
```

### Calendar Versioning (calver)

```typescript
import { createMigrationGraph, calverStrategy } from '@migrex/core';

const graph = createMigrationGraph({
  id: 'my-graph',
  versionStrategy: calverStrategy,
});
// Versions: '2024.01.15', '2024.02.01', etc.
```

### Integer Versioning

```typescript
import { createMigrationGraph, integerStrategy } from '@migrex/core';

const graph = createMigrationGraph({
  id: 'my-graph',
  versionStrategy: integerStrategy,
});
// Versions: '1', '2', '3', etc.
```

## API Reference

### Core Types

#### `MigrationResult<T>`
Result returned by `graph.migrate()`:
```typescript
interface MigrationResult<T> {
  success: boolean;              // Whether migration succeeded
  data?: T;                      // Migrated data (if success)
  error?: Error;                 // Error (if !success)
  path: MigrationPath;           // The path that was executed
  stash: StashSummary;           // Summary of preserved fields
  preservedFields: PreservedField[]; // Raw stash for chaining migrations
}
```

#### `MigrationPath`
The path between two versions:
```typescript
interface MigrationPath {
  steps: MigrationStep[];        // Individual migration steps
  direction: 'up' | 'down' | 'mixed';
  hasIrreversibleStep: boolean;
}
```

#### `MigrationStep`
A single step in the migration path:
```typescript
interface MigrationStep {
  fromVersion: string;           // Source version
  toVersion: string;             // Target version
  direction: 'up' | 'down';
  migration: AnyMigration;
}
```

#### `PreservationMetadata`
Metadata for `ctx.preserve()`:
```typescript
interface PreservationMetadata {
  sourceVersion?: string;        // Version where field originated
  description?: string;          // Human-readable description
  fieldSchema?: FieldSchema;     // Optional validation schema
}
```

#### `MigrateOptions`
Options for `graph.migrate()`:
```typescript
interface MigrateOptions {
  skipValidation?: boolean;      // Skip final validation (default: false)
  validateIntermediate?: boolean; // Validate each step (default: false)
  initialStash?: PreservedField[]; // Pass stash from previous migration
}
```

#### `StashSummary`
Summary of field preservation across a migration:
```typescript
interface StashSummary {
  consumed: PreservedFieldSummary[];   // Fields that were preserved and later consumed
  unconsumed: PreservedFieldSummary[]; // Fields that were preserved but never consumed
  lossless: boolean;                   // True if all preserved fields were consumed
}

interface PreservedFieldSummary {
  path: string;           // Field path that was preserved
  preservedAt: string;    // Version where field was first preserved
  consumedAt?: string;    // Version where field was consumed (if it was)
}
```

#### Other Types
- `VersionedSchema<T>` - Schema definition for a version
- `ReversibleMigration<From, To>` - Bidirectional migration
- `OneWayMigration<From, To>` - Irreversible migration
- `MigrationContext` - Context for field preservation (`preserve`, `consume`, `hasPreserved`)
- `AnalysisResult` - Graph analysis results

### Core Functions

- `createMigrationGraph(options)` - Create a new migration graph with `{ id, versionStrategy }`
- `graph.registerSchema(schema)` - Register a version schema
- `graph.registerMigration(migration)` - Add a migration between versions
- `graph.migrate(data, from, to)` - Execute migrations
- `graph.migrateAsync(data, from, to)` - Execute async migrations
- `analyzeGraph(graph, options?)` - Analyze graph health
- `findLossyPaths(graph)` - Find data-losing paths
- `suggestMigrations(graph)` - Get improvement suggestions

## Troubleshooting

### "No path exists between versions"

**Problem**: `NoPathError` thrown when trying to migrate.

**Solution**: Add migrations to connect the versions. Use `analyzeGraph()` to see disconnected components.

```typescript
const analysis = analyzeGraph(graph);
if (!analysis.connectivity.fullyConnected) {
  console.log('Disconnected components:', analysis.connectivity.components);
  // Add migrations to bridge the gap
}
```

### "Field preserved multiple times"

**Problem**: Warning about a field having `sometimes-multi` profile.

**Solution**: Review your preservation logic. A field should only be preserved once per path.

```typescript
const analysis = analyzeGraph(graph);
for (const [field, profile] of Object.entries(analysis.profiles)) {
  if (profile === 'sometimes-multi') {
    console.log(`Field "${field}" is preserved multiple times on some paths`);
    // Review migrations that preserve this field
  }
}
```

### "Validation failed"

**Problem**: `SchemaValidationError` thrown during migration.

**Solution**: Ensure your migration outputs match the target schema.

```typescript
// Bad: Output doesn't match schema
up: (data) => ({
  // Missing required 'version' field!
  firstName: data.name,
})

// Good: Output matches schema
up: (data) => ({
  version: '2.0.0', // Include version field
  firstName: data.name,
  lastName: '',
})
```

### "Unconsumed preserved fields"

**Problem**: Field preserved but never consumed, shown in `result.stash.unconsumed`.

**Solution**: Either consume the field in a later migration or remove the preservation.

```typescript
const result = graph.migrate(data, '1.0.0', '3.0.0');
if (!result.stash.lossless) {
  console.log('Unconsumed fields:', result.stash.unconsumed);
  // Add consumption in target version migration
}
```

### Performance with large graphs

**Problem**: Analysis is slow with many versions.

**Solution**: Use incremental analysis or limit analysis scope.

```typescript
import { analyzeIncremental } from '@migrex/core';

const previousAnalysis = analyzeGraph(graph);
// ... make changes ...
const updatedAnalysis = analyzeIncremental(
  graph,
  previousAnalysis,
  ['src/migrations/new-migration.ts']
);
```

## Development

```bash
# Run tests
pnpm test

# Run type tests
pnpm test:types

# Build
pnpm build

# Generate type declarations
pnpm build:types

# Check API surface
pnpm api:check

# Update API report
pnpm api:update

# Lint
pnpm lint
```

## License

MIT
