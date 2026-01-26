# @migrex/eslint-plugin

ESLint plugin for migrex - provides rules for validating migration code quality and graph health.

## Features

- **consume-check**: Verify consume() calls handle the correct single/multi case based on field profiles
- **graph-health**: Report connectivity issues, deprecated version usage, and lossy paths
- **preserve-metadata**: Warn when preserve() is called without metadata

## Installation

```bash
npm install @migrex/eslint-plugin eslint @migrex/core
```

## Configuration (ESLint 9 Flat Config)

Add the plugin to your `eslint.config.js`:

```javascript
import migrex from '@migrex/eslint-plugin';

export default [
  // Use the recommended preset
  migrex.configs.recommended,

  // Or use strict preset (all rules as errors)
  // migrex.configs.strict,
];
```

### Custom Configuration

For fine-grained control:

```javascript
import migrex from '@migrex/eslint-plugin';

export default [
  {
    plugins: {
      '@migrex': migrex,
    },
    rules: {
      '@migrex/consume-check': 'error',
      '@migrex/graph-health': 'warn',
      '@migrex/preserve-metadata': 'off',
    },
  },
];
```

## Configuration Presets

### recommended

Balanced configuration for most projects:

| Rule | Severity |
|------|----------|
| `@migrex/consume-check` | error |
| `@migrex/graph-health` | warn |
| `@migrex/preserve-metadata` | off |

### strict

All rules enabled as errors:

| Rule | Severity |
|------|----------|
| `@migrex/consume-check` | error |
| `@migrex/graph-health` | error |
| `@migrex/preserve-metadata` | error |

## Rules

### @migrex/consume-check

Verifies that consume() calls properly handle the field's profile. If a field is 'sometimes-multi', code must handle both single and multi cases.

```typescript
// Error: Field "theme" has profile "sometimes-multi" but code does not handle multi-value case
const theme = ctx.consume('theme');
console.log(theme.value); // Unsafe access

// Correct: Check kind before accessing value
const theme = ctx.consume('theme');
if (theme) {
  if (theme.kind === 'single') {
    console.log(theme.value);
  } else {
    console.log(theme.values);
  }
}
```

#### Options

```typescript
{
  // Require kind checks even for 'always-single' fields
  strict?: boolean; // default: false

  // Migration graph to analyze
  graph?: MigrationGraph;
}
```

### @migrex/graph-health

Reports graph-level issues including disconnected version components, deprecated versions used in critical paths, and lossy migration paths.

#### Options

```typescript
{
  // Migration graph to analyze
  graph?: MigrationGraph;

  // Report lossy paths as errors instead of warnings
  lossyAsError?: boolean; // default: false

  // Suggest new migrations to improve graph connectivity
  suggestImprovements?: boolean; // default: true
}
```

### @migrex/preserve-metadata

Warns when preserve() is called without metadata. Helps ensure all preserved fields are documented.

```typescript
// Warning: preserve() missing metadata
ctx.preserve('theme', value);

// Correct: Include metadata
ctx.preserve('theme', value, {
  description: 'User theme preference',
  sourceVersion: '1.0',
});
```

#### Options

```typescript
{
  // Require metadata on all preserve() calls
  requireMetadata?: boolean; // default: true

  // Specific metadata fields that are required
  requiredFields?: ('description' | 'sourceVersion' | 'fieldSchema')[];
}
```

## Passing the Migration Graph

For profile-aware validation, pass your migration graph to the rules:

```javascript
import migrex from '@migrex/eslint-plugin';
import { graph } from './src/migrations/graph.js';

export default [
  {
    plugins: {
      '@migrex': migrex,
    },
    rules: {
      '@migrex/consume-check': ['error', { graph }],
      '@migrex/graph-health': ['warn', { graph }],
    },
  },
];
```

## Architecture

- **rules/consume-check.ts**: Validates consume() calls against field profiles
- **rules/graph-health.ts**: Reports graph connectivity and lossy path issues
- **rules/preserve-metadata.ts**: Enforces metadata on preserve() calls
- **configs/recommended.ts**: Recommended configuration preset
- **configs/strict.ts**: Strict configuration preset
- **utils/ast-helpers.ts**: ESLint AST utilities for parsing migration code
- **utils/graph-loader.ts**: Utilities for loading and analyzing the migration graph

## Development

```bash
# Build the plugin
pnpm build

# Run tests
pnpm test

# Build types
pnpm build:types

# Update API report
pnpm api:update

# Check API report
pnpm api:check
```

## License

UNLICENSED
