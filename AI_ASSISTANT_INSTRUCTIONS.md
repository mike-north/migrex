# AI Assistant Instructions for migrex

This document provides guidance for AI coding assistants helping users work with the migrex library - a type-safe, graph-based migration system for versioned data contracts.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Getting Started](#getting-started)
3. [Creating Schemas](#creating-schemas)
4. [Creating Migrations](#creating-migrations)
5. [Reversible vs Irreversible Migrations](#reversible-vs-irreversible-migrations)
6. [Field Preservation (Stash)](#field-preservation-stash)
7. [Building the Migration Graph](#building-the-migration-graph)
8. [Understanding Field Profiles](#understanding-field-profiles)
9. [Graph Analysis and Health](#graph-analysis-and-health)
10. [Common Patterns](#common-patterns)
11. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
12. [Using the CLI](#using-the-cli)
13. [Testing Migrations](#testing-migrations)
14. [Troubleshooting](#troubleshooting)

---

## Core Concepts

### What is migrex?

migrex is a TypeScript library for managing versioned data contracts with bidirectional migrations. It enables:

- **Multiple schema versions** - Define how your data looks at each version
- **Bidirectional migrations** - Move data forward AND backward between versions
- **Field preservation** - Temporarily store fields that would otherwise be lost
- **Graph-based path finding** - Automatically compute migration paths between any two versions
- **Analysis tools** - Detect connectivity issues, lossy paths, and get improvement suggestions

### Key Types

| Type | Purpose |
|------|---------|
| `VersionedSchema<T>` | Defines validation for a specific version |
| `ReversibleMigration<From, To>` | Bidirectional migration with `up` and `down` |
| `OneWayMigration<From, To>` | Irreversible migration with only `up` |
| `MigrationContext` | Provides field preservation APIs in migrations |
| `MigrationGraph` | Container for schemas and migrations |

### Version Strategies

migrex supports three versioning approaches:

```typescript
import { semverStrategy, calverStrategy, integerStrategy } from '@migrex/core';

// Semantic versioning: '1.0.0', '1.1.0', '2.0.0'
const graph1 = createMigrationGraph({ id: 'my-graph', versionStrategy: semverStrategy });

// Calendar versioning: '2024.01.15', '2024.02.01'
const graph2 = createMigrationGraph({ id: 'my-graph', versionStrategy: calverStrategy });

// Integer versioning: '1', '2', '3'
const graph3 = createMigrationGraph({ id: 'my-graph', versionStrategy: integerStrategy });
```

---

## Getting Started

### Installation

```bash
# Core library (required)
npm install @migrex/core

# Schema validation with Zod (recommended)
npm install @migrex/zod zod

# Or with JSON Schema
npm install @migrex/json-schema

# CLI tools
npm install @migrex/cli

# ESLint plugin
npm install @migrex/eslint-plugin
```

### Project Structure

Recommended file organization:

```
src/
├── migrations/
│   ├── schemas/
│   │   ├── v1.ts       # Schema for version 1.0.0
│   │   ├── v2.ts       # Schema for version 2.0.0
│   │   └── index.ts    # Re-exports all schemas
│   ├── migrations/
│   │   ├── v1-to-v2.ts # Migration between v1 and v2
│   │   └── index.ts    # Re-exports all migrations
│   └── graph.ts        # The migration graph
```

---

## Creating Schemas

### Decision Tree: Choosing a Schema Approach

```
Do you already use Zod in your project?
├── Yes → Use @migrex/zod with fromZod()
└── No
    └── Do you need JSON Schema compatibility?
        ├── Yes → Use @migrex/json-schema
        └── No → Use raw validation functions or add Zod
```

### With Zod (Recommended)

```typescript
// schemas/v1.ts
import { z } from 'zod';
import { fromZod } from '@migrex/zod';

export const UserV1Schema = z.object({
  version: z.literal('1.0.0'),  // Always include version literal
  name: z.string().min(1),
  email: z.string().email(),
});

export type UserV1 = z.infer<typeof UserV1Schema>;

export const schemaV1 = fromZod('1.0.0', UserV1Schema, {
  releaseDate: '2024-01-01',  // Optional metadata
});
```

### Without Zod (Raw Validation)

```typescript
// schemas/v1.ts
import type { VersionedSchema, ValidationResult } from '@migrex/core';

export type UserV1 = {
  version: '1.0.0';
  name: string;
  email: string;
};

export const schemaV1: VersionedSchema<UserV1> = {
  version: '1.0.0',
  schema(data: unknown): ValidationResult<UserV1> {
    if (
      typeof data === 'object' &&
      data !== null &&
      'version' in data &&
      data.version === '1.0.0' &&
      'name' in data &&
      typeof data.name === 'string' &&
      'email' in data &&
      typeof data.email === 'string'
    ) {
      return { success: true, data: data as UserV1 };
    }
    return {
      success: false,
      errors: [{ path: [], message: 'Invalid UserV1 data' }],
    };
  },
};
```

### Schema Evolution Checklist

When adding a new version, ask:

1. **What fields are being added?** → Provide sensible defaults in `up`
2. **What fields are being removed?** → Consider if they need preservation
3. **What fields are being renamed?** → Map in both `up` and `down`
4. **What fields are changing type?** → Handle conversion in both directions
5. **Is the version literal correct?** → Must match the schema's `version` property

---

## Creating Migrations

### The Migration Template

Every migration needs to answer these questions:

1. **From which version?** → `fromVersion`
2. **To which version?** → `toVersion`
3. **How to go forward?** → `up(data, ctx)`
4. **How to go backward?** → `down(data, ctx)` (or `irreversibleReason` if one-way)

### Basic Reversible Migration

```typescript
import type { ReversibleMigration, MigrationContext } from '@migrex/core';
import type { UserV1 } from './schemas/v1';
import type { UserV2 } from './schemas/v2';

export const migrationV1ToV2: ReversibleMigration<UserV1, UserV2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',

  // Forward migration: v1 → v2
  up(data: UserV1, _ctx: MigrationContext): UserV2 {
    // Split name into firstName and lastName
    const parts = data.name.split(' ');
    return {
      version: '2.0.0',
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email: data.email,
    };
  },

  // Backward migration: v2 → v1
  down(data: UserV2, _ctx: MigrationContext): UserV1 {
    // Combine firstName and lastName back into name
    return {
      version: '1.0.0',
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
    };
  },

  // Optional: describe the migration
  description: 'Split name field into firstName and lastName',
};
```

### Migration with Field Preservation

When a field is removed but may need to be restored later:

```typescript
export const migrationV2ToV3: ReversibleMigration<ConfigV2, ConfigV3> = {
  fromVersion: '2.0.0',
  toVersion: '3.0.0',

  up(data: ConfigV2, ctx: MigrationContext): ConfigV3 {
    // Theme is being removed in v3 but may come back
    // Preserve it for potential restoration
    ctx.preserve('theme', data.theme, {
      description: 'User theme preference',
      sourceVersion: '2.0.0',
    });

    return {
      version: '3.0.0',
      name: data.name,
      // theme is not in v3
    };
  },

  down(data: ConfigV3, ctx: MigrationContext): ConfigV2 {
    // Try to restore the preserved theme, or use a default
    const preserved = ctx.consume('theme');
    const theme = preserved?.kind === 'single'
      ? (preserved.value as 'light' | 'dark')
      : 'light';

    return {
      version: '2.0.0',
      name: data.name,
      theme,
    };
  },
};
```

---

## Reversible vs Irreversible Migrations

### Decision Framework

Ask these questions to determine if a migration should be reversible:

```
Can the original data be reconstructed from the transformed data?
├── Yes, exactly → REVERSIBLE
├── Yes, with acceptable defaults → REVERSIBLE (document the defaults)
└── No, information is permanently lost → ONE-WAY (if acceptable) or redesign
```

### When to Use Reversible Migrations

✅ **Use reversible migrations when:**

- Field renames (bidirectional mapping is obvious)
- Adding new fields with sensible defaults
- Type changes that can round-trip (e.g., string ↔ number)
- Restructuring data (nested ↔ flat) without data loss
- Removing fields that can have a default when restored

### When to Use One-Way Migrations

⚠️ **Use one-way migrations only when:**

- Hashing or encrypting data (cannot reverse)
- Aggregating/summarizing data (individual records lost)
- Intentional data deletion for compliance (GDPR, etc.)
- Precision loss that's acceptable (64-bit → 32-bit)

### One-Way Migration Example

```typescript
import type { OneWayMigration, MigrationContext } from '@migrex/core';

export const migrationV3ToV4: OneWayMigration<DataV3, DataV4> = {
  fromVersion: '3.0.0',
  toVersion: '4.0.0',

  up(data: DataV3, _ctx: MigrationContext): DataV4 {
    return {
      version: '4.0.0',
      // Hash the password - cannot be reversed
      passwordHash: hashPassword(data.password),
      email: data.email,
    };
  },

  // No `down` method - use `irreversibleReason` instead
  irreversibleReason: 'Password is hashed and cannot be recovered',

  // Optional: describe what's lost
  traits: {
    up: {
      lossy: 'Plain text password is replaced with hash',
    },
  },
};
```

### Migration Traits

Document the nature of transformations with traits:

```typescript
traits: {
  up: {
    lossy: 'Description of data loss',
    restructures: 'Data structure changes',
    semanticShift: 'Meaning or interpretation changes',
    precisionLoss: 'Numerical precision is reduced',
    normalizes: 'Data is normalized/formatted',
  },
  down: {
    // Same options for the reverse direction
  },
}
```

---

## Field Preservation (Stash)

### What is Field Preservation?

Field preservation (the "stash") allows you to temporarily store field values during migrations so they can be restored in later migrations. This enables lossless multi-step migrations.

### When to Use Field Preservation

```
Is a field being removed in this version?
├── No → Don't use preservation
└── Yes
    └── Will this field exist in a later version?
        ├── Yes → USE PRESERVATION
        └── No
            └── Do you need to support backward migration?
                ├── Yes → USE PRESERVATION (for round-trips)
                └── No → Don't use preservation
```

### Preservation API

```typescript
// MigrationContext methods:

// Store a value for later
ctx.preserve(field: string, value: unknown, metadata?: PreservationMetadata): PreserveResult

// Check if a field is preserved
ctx.hasPreserved(field: string): boolean

// Retrieve and remove a preserved value
ctx.consume(field: string): PreservedField | undefined

// Look at a preserved value without removing it
ctx.peek(field: string): PreservedField | undefined

// List all preserved fields
ctx.listPreserved(): readonly PreservedField[]
```

### Handling Single vs Multi Values

A preserved field can have one or multiple values:

```typescript
const preserved = ctx.consume('theme');

if (!preserved) {
  // Field was never preserved - use default
  return defaultTheme;
}

if (preserved.kind === 'single') {
  // Normal case: one value
  return preserved.value as ThemeType;
} else {
  // Multiple preservations occurred (unusual)
  // Take the most recent value
  const lastEntry = preserved.entries[preserved.entries.length - 1];
  return lastEntry.value as ThemeType;
}
```

### Complete Preservation Example

```typescript
// v1 has: name, theme
// v2 has: name (theme removed)
// v3 has: name, theme (theme restored)

// v1 → v2: preserve theme
const migrationV1ToV2: ReversibleMigration<V1, V2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',

  up(data: V1, ctx: MigrationContext): V2 {
    ctx.preserve('theme', data.theme, {
      description: 'Theme preference preserved for v3',
      sourceVersion: '1.0.0',
    });
    return { version: '2.0.0', name: data.name };
  },

  down(data: V2, ctx: MigrationContext): V1 {
    const theme = ctx.consume('theme');
    return {
      version: '1.0.0',
      name: data.name,
      theme: (theme?.value as 'light' | 'dark') ?? 'light',
    };
  },
};

// v2 → v3: consume theme
const migrationV2ToV3: ReversibleMigration<V2, V3> = {
  fromVersion: '2.0.0',
  toVersion: '3.0.0',

  up(data: V2, ctx: MigrationContext): V3 {
    const theme = ctx.consume('theme');
    return {
      version: '3.0.0',
      name: data.name,
      theme: (theme?.value as 'light' | 'dark') ?? 'light',
    };
  },

  down(data: V3, ctx: MigrationContext): V2 {
    ctx.preserve('theme', data.theme, {
      description: 'Theme preserved when going back through v2',
      sourceVersion: '3.0.0',
    });
    return { version: '2.0.0', name: data.name };
  },
};
```

---

## Building the Migration Graph

### Basic Graph Setup

```typescript
// graph.ts
import { createMigrationGraph, semverStrategy } from '@migrex/core';
import { schemaV1, schemaV2, schemaV3 } from './schemas';
import { migrationV1ToV2, migrationV2ToV3 } from './migrations';

export const graph = createMigrationGraph({
  id: 'my-application',
  versionStrategy: semverStrategy,
});

// Register all schemas
graph.registerSchema(schemaV1);
graph.registerSchema(schemaV2);
graph.registerSchema(schemaV3);

// Register all migrations
graph.registerMigration(migrationV1ToV2);
graph.registerMigration(migrationV2ToV3);
```

### Using the Graph

```typescript
import { graph } from './graph';

// Migrate data forward
const v1Data = { version: '1.0.0', name: 'John Doe', email: 'john@example.com' };
const result = graph.migrate(v1Data, '1.0.0', '2.0.0');

if (result.success) {
  console.log(result.data);
  // { version: '2.0.0', firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
}

// Migrate data backward
const v2Data = { version: '2.0.0', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' };
const reverseResult = graph.migrate(v2Data, '2.0.0', '1.0.0');

// Multi-step migration (automatically finds path)
const multiStepResult = graph.migrate(v1Data, '1.0.0', '3.0.0');
// Executes: v1 → v2 → v3

// Check the stash for preservation info
console.log('Consumed fields:', result.stash.consumed);
console.log('Unconsumed fields:', result.stash.unconsumed);
console.log('Lossless?', result.stash.lossless);
```

### Migration Options

```typescript
const result = graph.migrate(data, '1.0.0', '3.0.0', {
  // Skip final validation (for performance)
  skipValidation: false,

  // Validate at each intermediate step (for debugging)
  validateIntermediate: true,

  // Pass stash from a previous migration
  initialStash: previousResult.preservedFields,
});
```

---

## Understanding Field Profiles

### What are Field Profiles?

Field profiles describe how a preserved field behaves across all possible migration paths:

| Profile | Meaning |
|---------|---------|
| `always-single` | Field is preserved at most once on any path. **Safe.** |
| `sometimes-multi` | Field can be preserved multiple times on some paths. **Review needed.** |

### Why It Matters

When a field is `sometimes-multi`, consuming code must handle multiple values:

```typescript
// Safe for 'always-single' fields:
const theme = ctx.consume('theme');
return theme?.value as ThemeType; // ✅ Single value expected

// Required for 'sometimes-multi' fields:
const theme = ctx.consume('theme');
if (theme?.kind === 'multi') {
  // Handle multiple values
  return theme.entries[theme.entries.length - 1].value as ThemeType;
}
return theme?.value as ThemeType;
```

### Checking Field Profiles

```typescript
import { analyzeGraph } from '@migrex/core';

const analysis = analyzeGraph(graph);

for (const [field, profile] of Object.entries(analysis.profiles)) {
  if (profile === 'sometimes-multi') {
    console.warn(`Field "${field}" can have multiple values on some paths`);
  }
}
```

### Fixing 'sometimes-multi' Issues

1. **Review preservation logic** - Is the field being preserved in multiple places unnecessarily?
2. **Consolidate preservations** - Move preservation to a single location
3. **Use consume before preserve** - Check if already preserved before preserving again
4. **Accept and handle it** - If legitimate, ensure consuming code handles multi-values

---

## Graph Analysis and Health

### Running Analysis

```typescript
import { analyzeGraph, findLossyPaths, suggestMigrations, getDeprecatedVersions } from '@migrex/core';

// Full analysis
const analysis = analyzeGraph(graph);

// Connectivity check
if (!analysis.connectivity.fullyConnected) {
  console.error('Graph has disconnected versions!');
  for (const component of analysis.connectivity.components) {
    console.log('Component:', component.join(', '));
  }
}

// Field profile check
for (const [field, profile] of Object.entries(analysis.profiles)) {
  console.log(`Field "${field}": ${profile}`);
}

// Diagnostic messages
for (const diagnostic of analysis.diagnostics) {
  console.log(`[${diagnostic.severity}] ${diagnostic.message}`);
}

// Find lossy paths
const lossyReport = findLossyPaths(graph);
for (const { from, to, analysis } of lossyReport.lossyPairs) {
  console.warn(`Lossy path: ${from} → ${to}`);
  for (const step of analysis.lossySteps) {
    console.warn(`  ${step.from} → ${step.to}: ${step.reason}`);
  }
}

// Get suggestions
const suggestions = suggestMigrations(graph);
for (const suggestion of suggestions) {
  console.log(`Suggestion: Add ${suggestion.from} → ${suggestion.to}`);
  console.log(`  Reason: ${suggestion.reason}`);
}

// Check for deprecated versions
const deprecated = getDeprecatedVersions(graph);
for (const info of deprecated) {
  console.warn(`${info.version} is deprecated, use ${info.deprecated.successor}`);
}
```

### CI Health Checks

Use the CLI for CI integration:

```bash
# Exit code 0 if healthy, non-zero otherwise
migrex check --graph ./src/migrations/graph.ts

# Strict mode: treat warnings as errors
migrex check --graph ./src/migrations/graph.ts --strict

# JSON output for programmatic parsing
migrex check --graph ./src/migrations/graph.ts --json
```

---

## Common Patterns

### 1. Adding a New Field

```typescript
up(data: V1, _ctx): V2 {
  return {
    ...data,
    version: '2.0.0',
    newField: 'default value',  // Provide sensible default
  };
},

down(data: V2, _ctx): V1 {
  const { newField, ...rest } = data;  // Remove the new field
  return { ...rest, version: '1.0.0' };
},
```

### 2. Renaming a Field

```typescript
up(data: V1, _ctx): V2 {
  return {
    version: '2.0.0',
    newName: data.oldName,  // Map old → new
    // Don't include oldName
  };
},

down(data: V2, _ctx): V1 {
  return {
    version: '1.0.0',
    oldName: data.newName,  // Map new → old
  };
},
```

### 3. Changing Field Type

```typescript
// String → Number
up(data: V1, _ctx): V2 {
  return {
    version: '2.0.0',
    count: parseInt(data.countStr, 10) || 0,
  };
},

down(data: V2, _ctx): V1 {
  return {
    version: '1.0.0',
    countStr: String(data.count),
  };
},
```

### 4. Flattening Nested Structure

```typescript
// { user: { name, email } } → { userName, userEmail }
up(data: V1, _ctx): V2 {
  return {
    version: '2.0.0',
    userName: data.user.name,
    userEmail: data.user.email,
  };
},

down(data: V2, _ctx): V1 {
  return {
    version: '1.0.0',
    user: {
      name: data.userName,
      email: data.userEmail,
    },
  };
},
```

### 5. Splitting a Field

```typescript
// name → firstName, lastName
up(data: V1, _ctx): V2 {
  const parts = data.name.split(' ');
  return {
    version: '2.0.0',
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
},

down(data: V2, _ctx): V1 {
  return {
    version: '1.0.0',
    name: `${data.firstName} ${data.lastName}`.trim(),
  };
},
```

---

## Anti-Patterns to Avoid

### 1. Missing Version Field

❌ **Bad:**
```typescript
up(data: V1, _ctx): V2 {
  return {
    firstName: data.name,  // Missing version!
  };
}
```

✅ **Good:**
```typescript
up(data: V1, _ctx): V2 {
  return {
    version: '2.0.0',  // Always include
    firstName: data.name,
  };
}
```

### 2. Preserving Without Need

❌ **Bad:**
```typescript
up(data: V1, ctx): V2 {
  ctx.preserve('name', data.name);  // name still exists in V2!
  return { version: '2.0.0', name: data.name };
}
```

✅ **Good:**
```typescript
up(data: V1, _ctx): V2 {
  return { version: '2.0.0', name: data.name };  // No preservation needed
}
```

### 3. Not Handling Undefined Consumed Fields

❌ **Bad:**
```typescript
up(data: V2, ctx): V3 {
  const theme = ctx.consume('theme');
  return { version: '3.0.0', theme: theme.value };  // Crashes if undefined!
}
```

✅ **Good:**
```typescript
up(data: V2, ctx): V3 {
  const theme = ctx.consume('theme');
  return {
    version: '3.0.0',
    theme: (theme?.value as ThemeType) ?? 'light',  // Provide default
  };
}
```

### 4. Forgetting the Down Migration for Round-Trips

❌ **Bad:**
```typescript
// Only handling up, but users need to migrate backward too
up(data: V2, ctx): V3 {
  ctx.preserve('theme', data.theme);
  return { version: '3.0.0', name: data.name };
},

down(data: V3, _ctx): V2 {
  return { version: '2.0.0', name: data.name };  // Lost theme!
}
```

✅ **Good:**
```typescript
down(data: V3, ctx): V2 {
  const theme = ctx.consume('theme');  // Restore in down too
  return {
    version: '2.0.0',
    name: data.name,
    theme: (theme?.value as ThemeType) ?? 'light',
  };
}
```

### 5. Mutating Input Data

❌ **Bad:**
```typescript
up(data: V1, _ctx): V2 {
  data.version = '2.0.0';  // Mutating input!
  return data;
}
```

✅ **Good:**
```typescript
up(data: V1, _ctx): V2 {
  return {
    ...data,
    version: '2.0.0',
  };
}
```

---

## Using the CLI

### Initialize a New Project

```bash
# With Zod (recommended)
migrex init --plugin zod --version 1.0.0

# With JSON Schema
migrex init --plugin json-schema --version 1.0.0
```

### Create New Schemas and Migrations

```bash
# Create a new schema
migrex new schema --version 2.0.0 --plugin zod

# Create a migration between versions
migrex new migration --from 1.0.0 --to 2.0.0
```

### Analyze the Graph

```bash
# Human-readable analysis
migrex analyze --graph ./src/migrations/graph.ts

# JSON output
migrex analyze --graph ./src/migrations/graph.ts --format json
```

### Show Migration Paths

```bash
# Show path between versions
migrex path --from 1.0.0 --to 3.0.0 --graph ./src/migrations/graph.ts

# Show diff between versions
migrex diff --from 1.0.0 --to 2.0.0 --graph ./src/migrations/graph.ts
```

### Generate TypeScript Types

```bash
migrex generate-types --graph ./src/migrations/graph.ts -o ./src/types/migrex.d.ts
```

---

## Testing Migrations

### Use @migrex/testing

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
import { migrationV1ToV2, migrationV2ToV3 } from './migrations';
import { schemaV1, schemaV2, schemaV3 } from './schemas';

describe('v1 → v2 migration', () => {
  it('should migrate forward correctly', () => {
    const graph = createMigrationGraph({ id: 'test', versionStrategy: semverStrategy });
    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerMigration(migrationV1ToV2);

    const result = graph.migrate({ name: 'John Doe' }, '1.0.0', '2.0.0');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ firstName: 'John', lastName: 'Doe' });
  });

  it('should migrate backward correctly', () => {
    const graph = createMigrationGraph({ id: 'test', versionStrategy: semverStrategy });
    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerMigration(migrationV1ToV2);

    const result = graph.migrate({ firstName: 'Jane', lastName: 'Smith' }, '2.0.0', '1.0.0');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Jane Smith' });
  });

  it('should round-trip without loss', () => {
    const graph = createMigrationGraph({ id: 'test', versionStrategy: semverStrategy });
    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerMigration(migrationV1ToV2);

    const original = { name: 'Test User' };
    const up = graph.migrate(original, '1.0.0', '2.0.0');
    const roundTrip = graph.migrate(up.data, '2.0.0', '1.0.0');

    assertLossless(roundTrip); // Verify no fields were lost
    expect(roundTrip.data).toEqual(original);
  });
});

describe('migration graph analysis', () => {
  it('should be fully connected', () => {
    const graph = createMigrationGraph({ id: 'test', versionStrategy: semverStrategy });
    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerSchema(schemaV3);
    graph.registerMigration(migrationV1ToV2);
    graph.registerMigration(migrationV2ToV3);

    assertConnected(graph); // Throws if not fully connected
  });

  it('should have correct field profiles', () => {
    const graph = createMigrationGraph({ id: 'test', versionStrategy: semverStrategy });
    // ... register schemas and migrations

    assertFieldProfile(graph, 'theme', 'always-single');
  });
});

describe('test pipeline', () => {
  it('should execute migrations in sequence', () => {
    const pipeline = testPipeline([migrationV1ToV2, migrationV2ToV3]);

    const result = pipeline.execute({ name: 'Test' });
    const profiles = pipeline.getProfile();

    expect(profiles).toBeDefined();
  });
});
```

### Test Cases to Include

1. **Forward migration** - Basic up transformation
2. **Backward migration** - Basic down transformation
3. **Round-trip** - up then down returns equivalent data
4. **Edge cases** - Empty strings, null values, missing optional fields
5. **Field preservation** - Values preserved across version gaps
6. **Multi-step paths** - Migrations spanning multiple versions

---

## Troubleshooting

### "No path exists between versions"

**Problem:** `NoPathError` when calling `graph.migrate()`

**Solution:**
1. Verify both versions have registered schemas
2. Verify migrations exist connecting the versions
3. Use `analyzeGraph()` to check connectivity

```typescript
const analysis = analyzeGraph(graph);
console.log('Components:', analysis.connectivity.components);
// If multiple components, some versions can't reach others
```

### "Validation failed"

**Problem:** `SchemaValidationError` after migration

**Solution:**
1. Check that migration output matches target schema exactly
2. Ensure version field is correct
3. Check all required fields are present

```typescript
// Debug by enabling intermediate validation
const result = graph.migrate(data, '1.0.0', '2.0.0', {
  validateIntermediate: true,
});
```

### "Field is 'sometimes-multi'"

**Problem:** Analysis shows a field with `sometimes-multi` profile

**Solution:**
1. Review all migrations that preserve this field
2. Check if preservation happens in multiple places on some paths
3. Either consolidate preservations or handle multi-values in consuming code

### "Unconsumed preserved fields"

**Problem:** `result.stash.unconsumed` contains fields

**Solution:**
1. Add consumption in the target version's migration
2. Or accept that those fields will be lost
3. Check if preservation is necessary at all

```typescript
const result = graph.migrate(data, '1.0.0', '3.0.0');
if (!result.stash.lossless) {
  console.log('Unconsumed:', result.stash.unconsumed.map(f => f.path));
}
```

### ESLint Plugin Not Working

**Problem:** ESLint rules not detecting issues

**Solution:**
1. Ensure graph is passed to rules in eslint.config.js
2. Check rule is enabled (not set to 'off')
3. Verify file is being linted (check includes/excludes)

```javascript
// eslint.config.js
import migrex from '@migrex/eslint-plugin';
import { graph } from './src/migrations/graph.js';

export default [
  {
    plugins: { '@migrex': migrex },
    rules: {
      '@migrex/consume-check': ['error', { graph }],
    },
  },
];
```

### TypeScript Plugin Not Showing Diagnostics

**Problem:** IDE not showing migrex warnings

**Solution:**
1. Verify plugin is in tsconfig.json
2. Ensure using workspace TypeScript version
3. Check graphPath is correct and graph can be loaded

```json
{
  "compilerOptions": {
    "plugins": [{
      "name": "@migrex/ts-plugin",
      "graphPath": "./src/migrations/graph.ts"
    }]
  }
}
```

---

## Quick Reference

### Imports Cheatsheet

```typescript
// Core
import {
  createMigrationGraph,
  semverStrategy,
  calverStrategy,
  integerStrategy,
  analyzeGraph,
  findLossyPaths,
  suggestMigrations,
  getDeprecatedVersions,
} from '@migrex/core';

import type {
  VersionedSchema,
  ReversibleMigration,
  OneWayMigration,
  MigrationContext,
  MigrationResult,
  AnalysisResult,
  FieldProfile,
  PreservedField,
} from '@migrex/core';

// Zod integration
import { fromZod } from '@migrex/zod';

// JSON Schema integration
import { createJsonSchemaPlugin, fromJsonSchema } from '@migrex/json-schema';

// Testing
import {
  assertLossless,
  assertConnected,
  assertFieldProfile,
  testPipeline,
  createTestFixture,
} from '@migrex/testing';
```

### Migration Context Methods

| Method | Returns | Purpose |
|--------|---------|---------|
| `preserve(field, value, metadata?)` | `PreserveResult` | Store value for later |
| `hasPreserved(field)` | `boolean` | Check if preserved |
| `consume(field)` | `PreservedField \| undefined` | Get and remove |
| `peek(field)` | `PreservedField \| undefined` | Get without removing |
| `listPreserved()` | `PreservedField[]` | List all preserved |
| `getAuditLog()` | `string` | Human-readable log |

### CLI Commands

| Command | Purpose |
|---------|---------|
| `migrex check` | CI health check |
| `migrex analyze` | Full analysis report |
| `migrex init` | Initialize project |
| `migrex new schema` | Create schema file |
| `migrex new migration` | Create migration file |
| `migrex path` | Show migration path |
| `migrex diff` | Show version diff |
| `migrex generate-types` | Generate TS types |
