# @migrex/zod

Zod schema integration for migrex - use Zod schemas as versioned schemas in your migration graph.

## Features

- **Zod integration** - Wrap Zod schemas for use with migrex
- **Type inference** - Full TypeScript type inference from Zod schemas
- **Field schemas** - Create validated field schemas for the preservation stash
- **Deprecation metadata** - Mark schema versions as deprecated

## Installation

```bash
npm install @migrex/zod @migrex/core zod
```

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
