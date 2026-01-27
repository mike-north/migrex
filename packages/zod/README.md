# @migrex/zod

Zod schema integration for migrex - use Zod schemas as versioned schemas in your migration graph.

## Features

- **Zod integration** - Wrap Zod schemas for use with migrex
- **Type inference** - Full TypeScript type inference from Zod schemas
- **Field schemas** - Create validated field schemas for the preservation stash
- **Deprecation metadata** - Mark schema versions as deprecated

## Installation

```bash
npm install @migrex/zod @migrex/core zod@^3.24.0
```

> **Note**: @migrex/zod requires Zod v3.x. Zod v4.x is not yet supported due to breaking API changes.

## Usage

### Basic Usage

```typescript
import { z } from 'zod';
import { fromZod } from '@migrex/zod';
import { createMigrationGraph, semverStrategy } from '@migrex/core';

// Define Zod schemas
const UserV1Schema = z.object({
  name: z.string(),
  email: z.string().email(),
});

const UserV2Schema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
});

// Create versioned schemas
const schemaV1 = fromZod('1.0.0', UserV1Schema);
const schemaV2 = fromZod('2.0.0', UserV2Schema);

// Register with migration graph
const graph = createMigrationGraph({
  id: 'user-schema',
  versionStrategy: semverStrategy,
});

graph.registerSchema(schemaV1);
graph.registerSchema(schemaV2);
```

### Type Inference

Use `InferZodSchema` to extract types from your Zod schemas:

```typescript
import { z } from 'zod';
import type { InferZodSchema } from '@migrex/zod';

const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
});

type User = InferZodSchema<typeof UserSchema>;
// { name: string; age: number }
```

### Field Schemas for Preservation

```typescript
import { z } from 'zod';
import { createFieldSchema } from '@migrex/zod';

const avatarSchema = createFieldSchema(
  z.string().url(),
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

### Custom Validation

Add business logic validation that runs after Zod parsing:

```typescript
const schemaV1 = fromZod('1.0.0', UserV1Schema, {
  validate: (data) => {
    if (data.email.endsWith('@spam.com')) {
      return {
        success: false,
        errors: [{ path: ['email'], message: 'Spam emails not allowed' }],
      };
    }
    return { success: true, data };
  },
});
```

### Deprecation Metadata

```typescript
const schemaV1 = fromZod('1.0.0', UserV1Schema, {
  deprecated: {
    since: '2.0.0',
    successor: '2.0.0',
    deadline: '2025-06-01',
    message: 'Please upgrade to v2.0.0 for improved name handling',
  },
  releaseDate: '2024-01-01',
});
```

### Schema Extension

The `extendZodSchema` and `omitFromZodSchema` utilities help reduce duplication when creating multiple schema versions:

#### extendZodSchema

Extend a base schema with new fields while updating the version literal:

```typescript
import { z } from 'zod';
import { extendZodSchema, fromZod } from '@migrex/zod';

const ConfigV1 = z.object({
  version: z.literal('1.0.0'),
  name: z.string(),
  port: z.number(),
});

// Extend to v1.1.0 with new logLevel field
const ConfigV1_1 = extendZodSchema(ConfigV1, '1.1.0', {
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
// ConfigV1_1 now has: version: '1.1.0', name, port, logLevel

const schemaV1 = fromZod('1.0.0', ConfigV1);
const schemaV1_1 = fromZod('1.1.0', ConfigV1_1);
```

#### omitFromZodSchema

Remove deprecated fields when creating new schema versions:

```typescript
import { omitFromZodSchema, fromZod } from '@migrex/zod';

const V1 = z.object({
  version: z.literal('1.0.0'),
  name: z.string(),
  deprecatedField: z.string(),
});

const V2 = omitFromZodSchema(V1, '2.0.0', ['deprecatedField']);
// V2 has: version: '2.0.0', name (deprecatedField removed)

const schemaV2 = fromZod('2.0.0', V2);
```

#### Combining omit and extend

```typescript
// Remove old field and add new ones
const V2WithoutOld = omitFromZodSchema(V1, '2.0.0', ['oldName']);
const V2 = extendZodSchema(V2WithoutOld, '2.0.0', {
  firstName: z.string(),
  lastName: z.string(),
});
```

## API Reference

### `fromZod(version, zodSchema, options?)`

Create a versioned schema from a Zod schema.

| Parameter | Type | Description |
|-----------|------|-------------|
| `version` | `string` | Version identifier |
| `zodSchema` | `ZodType<T>` | Zod schema to wrap |
| `options` | `FromZodOptions<T>` | Optional configuration |

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `validate` | `(data: T) => ValidationResult<T>` | Additional validation function |
| `deprecated` | `DeprecationInfo` | Deprecation metadata |
| `releaseDate` | `string` | Release date of this version |

### `createFieldSchema(zodSchema, options?)`

Create a field schema for use with the preservation stash.

| Parameter | Type | Description |
|-----------|------|-------------|
| `zodSchema` | `ZodType<T>` | Zod schema to wrap |
| `options` | `{ description?: string }` | Optional description |

### `InferZodSchema<T>`

Type helper to extract the inferred type from a Zod schema.

```typescript
type User = InferZodSchema<typeof UserSchema>;
```

## Complete Example

```typescript
import { z } from 'zod';
import { fromZod, createFieldSchema, type InferZodSchema } from '@migrex/zod';
import { createMigrationGraph, semverStrategy, type ReversibleMigration } from '@migrex/core';

// Define schemas
const UserV1 = z.object({
  name: z.string(),
  avatar: z.string().url().optional(),
});

const UserV2 = z.object({
  firstName: z.string(),
  lastName: z.string(),
});

type UserV1Type = InferZodSchema<typeof UserV1>;
type UserV2Type = InferZodSchema<typeof UserV2>;

// Create versioned schemas
const schemaV1 = fromZod('1.0.0', UserV1);
const schemaV2 = fromZod('2.0.0', UserV2);

// Field schema for preserved fields
const avatarFieldSchema = createFieldSchema(z.string().url());

// Define migration
const migration: ReversibleMigration<UserV1Type, UserV2Type> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data, ctx) => {
    if (data.avatar) {
      ctx.preserve('avatar', data.avatar, { fieldSchema: avatarFieldSchema });
    }
    const [firstName, ...rest] = data.name.split(' ');
    return { firstName, lastName: rest.join(' ') || '' };
  },
  down: (data, ctx) => {
    const avatar = ctx.consume('avatar');
    return {
      name: `${data.firstName} ${data.lastName}`.trim(),
      avatar: avatar?.value as string | undefined,
    };
  },
};

// Build graph
const graph = createMigrationGraph({
  id: 'user-schema',
  versionStrategy: semverStrategy,
});

graph.registerSchema(schemaV1);
graph.registerSchema(schemaV2);
graph.registerMigration(migration);

// Use
const result = graph.migrate({ name: 'John Doe', avatar: 'https://example.com/avatar.png' }, '1.0.0', '2.0.0');
console.log(result.data); // { firstName: 'John', lastName: 'Doe' }
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
