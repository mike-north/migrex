# @migrex/json-schema

JSON Schema integration for migrex - use JSON Schema definitions as versioned schemas in your migration graph.

## Features

- **Ajv-powered validation** - Full JSON Schema draft-07 support via Ajv
- **Format validators** - Built-in support for email, uri, date-time, and other formats
- **Field schemas** - Create validated field schemas for the preservation stash
- **Custom Ajv options** - Configure Ajv with your preferred settings

## Installation

```bash
npm install @migrex/json-schema @migrex/core ajv
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
  ajvOptions: {
    allErrors: true,
    coerceTypes: true,
  },
  useFormats: true, // Enable format validators (default)
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

## API Reference

### `fromJsonSchema(version, schema, options?)`

Create a versioned schema from a JSON Schema using the default plugin.

| Parameter | Type | Description |
|-----------|------|-------------|
| `version` | `string` | Version identifier |
| `schema` | `JSONSchema7` | JSON Schema definition |
| `options` | `FromJsonSchemaOptions` | Optional configuration |

### `createJsonSchemaPlugin(options?)`

Create a custom JSON Schema plugin with specific Ajv configuration.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ajvOptions` | `AjvOptions` | `{ allErrors: true, strict: true }` | Ajv configuration |
| `useFormats` | `boolean` | `true` | Enable format validators |

### `createFieldSchema(schema, options?)`

Create a field schema for use with the preservation stash.

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `JSONSchema7` | JSON Schema definition |
| `options` | `{ description?: string }` | Optional description |

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
