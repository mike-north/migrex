---
"@migrex/core": minor
"@migrex/zod": minor
"@migrex/json-schema": minor
"@migrex/files": minor
"@migrex/rest": minor
"@migrex/testing": minor
"@migrex/cli": minor
"@migrex/eslint-plugin": minor
"@migrex/ts-plugin": minor
---

Initial release of migrex - a TypeScript-first versioned data contract system

## Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.0 (for type inference features)

## Key Features

- **Bidirectional migrations**: Define `up` and `down` migrations between schema versions
- **Field preservation**: Safely preserve data during lossy migrations with the stash system
- **Graph analysis**: Analyze migration graphs for connectivity, deprecation paths, and field profiles
- **Type-safe validation**: Full TypeScript inference with validation plugins
- **Framework agnostic**: Works with Express, Hono, Koa, and other HTTP frameworks

## Getting Started

```typescript
import { createMigrationGraph, semverStrategy } from '@migrex/core';

const graph = createMigrationGraph({
  id: 'my-api',
  versionStrategy: semverStrategy,
});

// Register schemas and migrations
graph.registerSchema({ version: '1.0.0', schema: validateV1 });
graph.registerSchema({ version: '2.0.0', schema: validateV2 });
graph.registerMigration({
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data) => ({ ...data, newField: 'default' }),
  down: (data) => { const { newField, ...rest } = data; return rest; },
});

// Migrate data
const result = graph.migrate(data, '1.0.0', '2.0.0');
```

## Packages

### Core packages
- `@migrex/core`: Core versioned data contract system with bidirectional migrations
- `@migrex/cli`: Command-line interface for migrex
- `@migrex/testing`: Test utilities for migrex contracts

### Validation plugins
- `@migrex/zod`: Zod schema integration with type-safe validation
- `@migrex/json-schema`: JSON Schema (Draft-07) validation using Ajv

### Integration packages
- `@migrex/files`: File-based configuration with load/save/watch utilities (JSON only; YAML support planned)
- `@migrex/rest`: REST API integration with Express/Hono-compatible middleware

### Developer tooling
- `@migrex/eslint-plugin`: ESLint plugin for migrex best practices
- `@migrex/ts-plugin`: TypeScript language service plugin
