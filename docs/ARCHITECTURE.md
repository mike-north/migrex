# Migrex Architecture

This document describes the high-level architecture of Migrex, a library for versioned data contracts with bidirectional migrations.

## Overview

Migrex provides a graph-based migration system that transforms data between schema versions. The core innovation is **bidirectional migration** with a **preservation stash** that enables lossless round-trips even when schema changes drop fields.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Migration Graph                          │
│                                                                 │
│     v1.0.0 ────────► v2.0.0 ────────► v3.0.0                   │
│         │               │               │                       │
│         ▼               ▼               ▼                       │
│     Schema V1       Schema V2       Schema V3                   │
│         │               │               │                       │
│         └───────────────┴───────────────┘                       │
│                         │                                       │
│                    Migrations                                   │
│               (up + down functions)                             │
└─────────────────────────────────────────────────────────────────┘
```

## Package Structure

```
migrex/
├── packages/
│   ├── core/          # Core library - graph, context, path-finding
│   ├── cli/           # Command-line interface
│   ├── eslint-plugin/ # ESLint rules for migrations
│   ├── ts-plugin/     # TypeScript language service plugin
│   ├── zod/           # Zod schema integration
│   ├── json-schema/   # JSON Schema integration
│   ├── rest/          # REST API versioning utilities
│   ├── testing/       # Test utilities and helpers
│   └── files/         # File-based configuration loading
└── docs/              # Documentation
```

## Core Concepts

### 1. Migration Graph

The **MigrationGraph** is the central data structure that manages:

- **Schemas**: Version-tagged validators for data shapes
- **Migrations**: Transformation functions between versions
- **Path Finding**: BFS algorithm to find shortest migration path

```typescript
const graph = createMigrationGraph({
  id: 'user-schema',
  versionStrategy: semverStrategy,
});

graph.registerSchema(schemaV1);
graph.registerSchema(schemaV2);
graph.registerMigration(migration);
```

### 2. Version Strategies

Version strategies define how version strings are compared and validated:

| Strategy | Format | Example |
|----------|--------|---------|
| `semverStrategy` | Semantic Versioning | `1.2.3`, `2.0.0-alpha.1` |
| `calverStrategy` | Calendar Versioning | `2024.01`, `2024.12` |
| `integerStrategy` | Simple Integers | `1`, `2`, `3` |

Each strategy provides:
- `compare(a, b)`: Version comparison (-1, 0, 1)
- `isValid(version)`: Validation check
- `normalize(version)`: Canonicalization (e.g., `v1.0.0` → `1.0.0`)
- `parse(version)`: Component extraction
- `increment(version, type)`: Version bumping

### 3. Reversible Migrations

Migrations define how to transform data **up** (forward) and **down** (backward):

```typescript
const migration: ReversibleMigration<UserV1, UserV2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data, ctx) => ({ firstName: data.name.split(' ')[0], ... }),
  down: (data, ctx) => ({ name: `${data.firstName} ${data.lastName}` }),
};
```

### 4. Preservation Stash

The stash enables **lossless round-trips** by temporarily storing fields that would be lost:

```typescript
// In up migration (v2 → v3, dropping 'avatar' field)
up: (data, ctx) => {
  ctx.preserve('avatar', data.avatar);  // Store for later
  return { name: data.name };
};

// In down migration (v3 → v2, restoring 'avatar')
down: (data, ctx) => {
  const avatar = ctx.consume('avatar');  // Retrieve stored value
  return { name: data.name, avatar: avatar?.value };
};
```

The stash tracks:
- **Field path**: Dot-separated path (e.g., `user.profile.avatar`)
- **Value**: The preserved data
- **History**: Full audit trail of preserve/consume events
- **Metadata**: Optional type info, source version, description

### 5. Migration Context

The `MigrationContext` is passed to every migration function and provides:

```typescript
interface MigrationContext {
  // Stash operations
  preserve(field, value, metadata?): PreserveResult;
  hasPreserved(field): boolean;
  consume(field): PreservedField | undefined;
  peek(field): PreservedField | undefined;
  listPreserved(): readonly PreservedField[];
  getAuditLog(): string;
  
  // Current step info
  currentStep: { from, to, direction, index, totalSteps };
}
```

## Data Flow

### Migration Execution

```
Input Data (v1)
      │
      ▼
┌─────────────┐
│ Validate    │ ◄── Source Schema
│ (optional)  │
└─────────────┘
      │
      ▼
┌─────────────┐
│ Find Path   │ ◄── BFS on adjacency graph
│ (v1 → v3)   │
└─────────────┘
      │
      ▼
┌─────────────────────────────────┐
│ Execute Steps                    │
│ ┌─────────┐   ┌─────────┐       │
│ │ v1 → v2 │ → │ v2 → v3 │ → ... │
│ └─────────┘   └─────────┘       │
│      ▲             ▲             │
│      │             │             │
│   Stash ◄─────► Stash           │
└─────────────────────────────────┘
      │
      ▼
┌─────────────┐
│ Validate    │ ◄── Target Schema
│ (optional)  │
└─────────────┘
      │
      ▼
Output Data (v3) + Stash Summary
```

### Path Finding Algorithm

The graph uses **Breadth-First Search (BFS)** to find the shortest migration path:

1. Build adjacency list from registered migrations
2. BFS from source version to target version
3. Track visited nodes to avoid cycles
4. Build `MigrationPath` with step metadata

```typescript
// Simplified path-finding logic
function findPath(from, to, adjacencyList): MigrationPath {
  const queue = [{ version: from, path: [from] }];
  const visited = new Set();
  
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.version === to) {
      return buildMigrationPath(current.path);
    }
    // ... BFS continues
  }
  return null; // No path exists
}
```

## Analysis System

The analysis module provides graph introspection:

### Connectivity Analysis

Detects disconnected components in the migration graph:

```typescript
const analysis = analyzeGraph(graph);
console.log(analysis.connectivity.fullyConnected); // true/false
console.log(analysis.connectivity.components);     // [['1.0', '2.0'], ['3.0']]
```

### Field Profiles

Tracks how fields behave across migration paths:

- **`always-single`**: Field preserved at most once on any path
- **`sometimes-multi`**: Field can be preserved multiple times (potential issue)

### Lossy Path Detection

Identifies paths where data may be lost:

```typescript
const lossyReport = findLossyPaths(graph);
for (const { from, to, analysis } of lossyReport.lossyPairs) {
  console.log(`${from} → ${to}: ${analysis.lossySteps.length} lossy steps`);
}
```

## Error Handling

Migrex uses typed errors for precise error handling:

| Error | Code | Description |
|-------|------|-------------|
| `NoPathError` | `NO_PATH` | No migration path between versions |
| `SchemaValidationError` | `VALIDATION_FAILED` | Data doesn't match schema |
| `StashConflictError` | `STASH_CONFLICT` | Conflicting stash values |
| `MigrationError` | `MIGRATION_FAILED` | Migration function threw |

## Telemetry

Optional hooks for observability:

```typescript
const graph = createMigrationGraph({
  telemetry: {
    onPathComputed: (path, durationMs) => { ... },
    onStepStart: (step, index, total) => { ... },
    onStepComplete: (step, index, durationMs) => { ... },
    onMigrationComplete: (result, totalMs) => { ... },
    onError: (error, step, context) => { ... },
  },
});
```

## Design Decisions

### Why Graph-Based?

1. **Automatic Path Finding**: No need to manually specify migration chains
2. **Bidirectional**: Same graph supports forward and backward migrations
3. **Shortest Path**: BFS ensures minimal transformation steps
4. **Connectivity Analysis**: Can detect and report graph issues

### Why Stash?

1. **Lossless Round-Trips**: Data survives even lossy transformations
2. **Explicit**: Developers consciously choose what to preserve
3. **Auditable**: Full history of preservation events
4. **Composable**: Stash can be passed between separate migrations

### Why Synchronous and Async?

- **Sync**: Fast path for pure data transformations
- **Async**: Required for migrations that need I/O (API calls, DB lookups)
- Both share the same interface and stash system

## Performance Considerations

1. **Path Caching**: Consider caching computed paths for repeated migrations
2. **Batch Migrations**: Use `migrateMany()` for arrays - path computed once
3. **Skip Validation**: Use `skipValidation: true` when you trust the data
4. **Lazy Analysis**: Analysis is computed on-demand, not on registration

## Testing Strategy

1. **Unit Tests**: Core functions, path-finding, stash operations
2. **Type Tests**: `tsd` for compile-time type verification
3. **Property Tests**: `fast-check` for round-trip invariants
4. **Integration Tests**: Full migration scenarios with schema plugins

## Future Considerations

1. **Incremental Analysis**: Only recompute affected paths on changes
2. **Migration Generators**: Auto-generate migrations from schema diffs
3. **Visualization**: Graph visualization for debugging
4. **Streaming**: Large data set support with streaming migrations
