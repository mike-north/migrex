# @migrex/json-schema

JSON Schema integration for migrex - use JSON Schema definitions as versioned schemas in your migration graph.

## Features

- **Lightweight validation** - JSON Schema drafts 4, 7, 2019-09 and 2020-12 via [`@cfworker/json-schema`](https://github.com/cfworker/cfworker/tree/main/packages/json-schema), with no Ajv dependency
- **Format validators** - Built-in support for email, uri, date-time, and other formats
- **Schema extension** - Extend schemas across versions without duplication
- **Field schemas** - Create validated field schemas for the preservation stash
- **Configurable** - Choose the draft, all-errors mode, and format checking

## Installation

```bash
npm install @migrex/json-schema @migrex/core
```

## Usage

### Basic Usage

```typescript
import { fromJsonSchema } from '@migrex/json-schema';
import { createMigrationGraph, semverStrategy } from '@migrex/core';

const schemaV1 = fromJsonSchema('1.0.0', {
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
  },
  required: ['name', 'email'],
});

const graph = createMigrationGraph({
  id: 'user-schema',
  versionStrategy: semverStrategy,
});

graph.registerSchema(schemaV1);
```

### Custom Plugin Configuration

```typescript
import { createJsonSchemaPlugin } from '@migrex/json-schema';

const plugin = createJsonSchemaPlugin({
  draft: '7', // JSON Schema draft (default '7'; also '4', '2019-09', '2020-12')
  allErrors: true, // Report every error, not just the first (default)
  useFormats: true, // Check `format` keywords (default)
});

const schema = plugin.fromJsonSchema('1.0.0', {
  type: 'object',
  properties: {
    age: { type: 'integer', minimum: 0 },
  },
});
```

### Field Schemas for Preservation

```typescript
import { createFieldSchema } from '@migrex/json-schema';

const avatarSchema = createFieldSchema(
  { type: 'string', format: 'uri' },
  { description: 'User avatar URL' }
);

// Use in migration context
const migration = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data, ctx) => {
    ctx.preserve('avatar', data.avatar, {
      fieldSchema: avatarSchema,
    });
    return { ...data, avatar: undefined };
  },
  down: (data, ctx) => {
    const avatar = ctx.consume('avatar');
    return { ...data, avatar: avatar?.value };
  },
};
```

### Schema Extension

The `extendJsonSchema` function helps reduce duplication when creating multiple schema versions by allowing you to extend a base schema with new properties:

```typescript
import { extendJsonSchema, fromJsonSchema } from '@migrex/json-schema';

// Define v1 schema
const schemaV1 = {
  type: 'object',
  properties: {
    version: { const: '1.0.0' },
    name: { type: 'string' },
    port: { type: 'integer', minimum: 1, maximum: 65535 },
  },
  required: ['version', 'name', 'port'],
};

// Extend to v1.1.0 with new logLevel field
const schemaV1_1 = extendJsonSchema(schemaV1, '1.1.0', {
  additionalProperties: {
    logLevel: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
  },
  additionalRequired: ['logLevel'],
});

// Remove deprecated fields in v2.0.0
const schemaV2 = extendJsonSchema(schemaV1_1, '2.0.0', {
  removeProperties: ['port'],
  additionalProperties: {
    serverPort: { type: 'integer', minimum: 1, maximum: 65535 },
  },
  additionalRequired: ['serverPort'],
});

// Register all versions
const graph = createMigrationGraph({ id: 'config', versionStrategy: semverStrategy });
graph.registerSchema(fromJsonSchema('1.0.0', schemaV1));
graph.registerSchema(fromJsonSchema('1.1.0', schemaV1_1));
graph.registerSchema(fromJsonSchema('2.0.0', schemaV2));
```

For removing deprecated properties, you can use the convenience function `omitFromJsonSchema`:

```typescript
import { omitFromJsonSchema } from '@migrex/json-schema';

const schemaV2 = omitFromJsonSchema(schemaV1, '2.0.0', ['deprecatedField']);
```

### Deprecation Metadata

```typescript
const schemaV1 = fromJsonSchema(
  '1.0.0',
  { type: 'object', properties: { name: { type: 'string' } } },
  {
    deprecated: {
      since: '2.0.0',
      successor: '2.0.0',
      deadline: '2025-06-01',
      message: 'Please upgrade to v2.0.0',
    },
  }
);
```

## Complete Example

A full example showing versioned config files with JSON Schema validation:

```typescript
import { fromJsonSchema } from '@migrex/json-schema';
import { createMigrationGraph, semverStrategy } from '@migrex/core';
import type { ReversibleMigration } from '@migrex/core';
import { saveVersionedFile, loadVersionedFile, upgradeVersionedFile } from '@migrex/files';

// =============================================================================
// Step 1: Define TypeScript types and JSON Schemas for each version
// =============================================================================

// v1.0.0 - Basic config
type ConfigV1 = { version: '1.0.0'; appName: string; port: number };

const schemaV1 = fromJsonSchema<ConfigV1>('1.0.0', {
  type: 'object',
  properties: {
    version: { const: '1.0.0' },
    appName: { type: 'string' },
    port: { type: 'integer', minimum: 1, maximum: 65535 },
  },
  required: ['version', 'appName', 'port'],
});

// v1.1.0 - Add logLevel
type ConfigV1_1 = { version: '1.1.0'; appName: string; port: number; logLevel: string };

const schemaV1_1 = fromJsonSchema<ConfigV1_1>('1.1.0', {
  type: 'object',
  properties: {
    version: { const: '1.1.0' },
    appName: { type: 'string' },
    port: { type: 'integer' },
    logLevel: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
  },
  required: ['version', 'appName', 'port', 'logLevel'],
});

// v2.0.0 - Restructure into nested objects
type ConfigV2 = {
  version: '2.0.0';
  app: { name: string };
  server: { port: number };
  logging: { level: string };
};

const schemaV2 = fromJsonSchema<ConfigV2>('2.0.0', {
  type: 'object',
  properties: {
    version: { const: '2.0.0' },
    app: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
    server: {
      type: 'object',
      properties: { port: { type: 'integer' } },
      required: ['port'],
    },
    logging: {
      type: 'object',
      properties: { level: { type: 'string' } },
      required: ['level'],
    },
  },
  required: ['version', 'app', 'server', 'logging'],
});

// =============================================================================
// Step 2: Define migrations between versions
// =============================================================================

const migrationV1ToV1_1: ReversibleMigration<ConfigV1, ConfigV1_1> = {
  fromVersion: '1.0.0',
  toVersion: '1.1.0',
  up: (data) => ({ ...data, version: '1.1.0', logLevel: 'info' }),
  down: (data) => {
    const { logLevel, ...rest } = data;
    return { ...rest, version: '1.0.0' };
  },
};

const migrationV1_1ToV2: ReversibleMigration<ConfigV1_1, ConfigV2> = {
  fromVersion: '1.1.0',
  toVersion: '2.0.0',
  up: (data) => ({
    version: '2.0.0',
    app: { name: data.appName },
    server: { port: data.port },
    logging: { level: data.logLevel },
  }),
  down: (data) => ({
    version: '1.1.0',
    appName: data.app.name,
    port: data.server.port,
    logLevel: data.logging.level,
  }),
};

// =============================================================================
// Step 3: Create migration graph and register everything
// =============================================================================

const graph = createMigrationGraph({
  id: 'app-config',
  versionStrategy: semverStrategy,
});

graph.registerSchema(schemaV1);
graph.registerSchema(schemaV1_1);
graph.registerSchema(schemaV2);
graph.registerMigration(migrationV1ToV1_1);
graph.registerMigration(migrationV1_1ToV2);

// =============================================================================
// Step 4: Use file operations
// =============================================================================

async function main() {
  const configPath = './config.json';

  // Save a v1.0.0 config
  await saveVersionedFile(graph, configPath, {
    version: '1.0.0',
    appName: 'MyApp',
    port: 3000,
  });

  // Load and auto-migrate to latest (v2.0.0)
  const result = await loadVersionedFile<ConfigV2>(graph, configPath);
  console.log('Migrated to:', result.data);
  // { version: '2.0.0', app: { name: 'MyApp' }, server: { port: 3000 }, logging: { level: 'info' } }

  // Or upgrade the file in place
  const upgraded = await upgradeVersionedFile(graph, configPath);
  console.log('Was migrated:', upgraded.wasMigrated);
}

main();
```

> **Note**: Your data must include a `version` field that matches a registered schema version. This is how the library detects which version a file contains.

## API Reference

### `fromJsonSchema(version, schema, options?)`

Create a versioned schema from a JSON Schema using the default plugin.

| Parameter | Type | Description |
|-----------|------|-------------|
| `version` | `string` | Version identifier |
| `schema` | `JSONSchema7` | JSON Schema definition |
| `options` | `FromJsonSchemaOptions` | Optional configuration |

### `createJsonSchemaPlugin(options?)`

Create a custom JSON Schema plugin with specific validator configuration.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `draft` | `'4' \| '7' \| '2019-09' \| '2020-12'` | `'7'` | JSON Schema draft for schemas without a recognised `$schema` |
| `allErrors` | `boolean` | `true` | Report every error rather than stopping at the first |
| `useFormats` | `boolean` | `true` | Check `format` keywords |

Schemas are checked when compiled: draft-04 and draft-07 schemas against their meta-schema, and local `#/...` `$ref`s must resolve. An invalid schema throws from `fromJsonSchema` / `createFieldSchema`.

### `createFieldSchema(schema, options?)`

Create a field schema for use with the preservation stash.

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `JSONSchema7` | JSON Schema definition |
| `options` | `{ description?: string }` | Optional description |

### `extendJsonSchema(base, newVersion, options?)`

Extend a JSON Schema with new properties and update the version constant.

| Parameter | Type | Description |
|-----------|------|-------------|
| `base` | `JSONSchema7` | Base schema to extend |
| `newVersion` | `string` | New version string |
| `options` | `ExtendJsonSchemaOptions` | Properties to add/remove |

**Options:**
- `additionalProperties?: Record<string, JSONSchema7Definition>` - Properties to add
- `additionalRequired?: string[]` - Fields to add to required array
- `removeProperties?: string[]` - Properties to remove
- `removeRequired?: string[]` - Fields to remove from required array

### `omitFromJsonSchema(base, newVersion, propertiesToRemove)`

Convenience function to create a new schema by removing properties.

| Parameter | Type | Description |
|-----------|------|-------------|
| `base` | `JSONSchema7` | Base schema to extend |
| `newVersion` | `string` | New version string |
| `propertiesToRemove` | `string[]` | Properties to remove |

### `jsonSchemaPlugin`

The default plugin instance for advanced usage.

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
