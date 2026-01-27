# DX Improvement Ideas

Ideas for reducing time-to-success based on developer experience evaluations.

## Summary of Friction Points

| Package | Verdict | Time to Success | Top Issue |
|---------|---------|-----------------|-----------|
| @migrex/zod (config) | Proportionate | ~15 min | Minor (version format) |
| @migrex/rest | Slightly more complex | ~35 min | Request/response pattern undocumented |
| @migrex/json-schema | Slightly more complex | ~18 min | Boilerplate graph registration |

---

## Idea 1: Declarative Graph Configuration

**Problem**: Registering schemas and migrations requires 5-6 separate method calls.

**Current Pattern**:
```typescript
const graph = createMigrationGraph({ id: 'config', versionStrategy: semverStrategy });
graph.registerSchema(schemaV1);
graph.registerSchema(schemaV1_1);
graph.registerSchema(schemaV2);
graph.registerMigration(migrationV1ToV1_1);
graph.registerMigration(migrationV1_1ToV2);
```

**Proposed Pattern**:
```typescript
const graph = createMigrationGraph({
  id: 'config',
  versionStrategy: semverStrategy,
  schemas: [schemaV1, schemaV1_1, schemaV2],
  migrations: [migrationV1ToV1_1, migrationV1_1ToV2],
});
```

**Benefits**:
- Reduces boilerplate by ~60%
- Single point of configuration
- Harder to forget to register something
- Backwards compatible (imperative API still works)

**Implementation Complexity**: Low
- Add optional `schemas` and `migrations` arrays to `MigrationGraphOptions`
- Call `registerSchema`/`registerMigration` internally during construction

---

## Idea 2: REST Endpoint Builder with Request/Response Separation

**Problem**: REST APIs need separate graphs for requests and responses, requiring duplicate migration logic.

**Current Pattern** (from DX evaluation):
```typescript
// Must define request schemas
const requestGraph = createMigrationGraph({ id: 'user-request', ... });
requestGraph.registerSchema(fromZod('1.0.0', UserRequestV1));
requestGraph.registerSchema(fromZod('2.0.0', UserRequestV2));
requestGraph.registerMigration(requestMigration);

// Must define response schemas (with server fields like id, createdAt)
const responseGraph = createMigrationGraph({ id: 'user-response', ... });
responseGraph.registerSchema(fromZod('1.0.0', UserResponseV1));
responseGraph.registerSchema(fromZod('2.0.0', UserResponseV2));
responseGraph.registerMigration(responseMigration); // Nearly identical logic!

// Create two endpoints
const requestEndpoint = createVersionedEndpoint(requestGraph, options);
const responseEndpoint = createVersionedEndpoint(responseGraph, options);
```

**Proposed Pattern**:
```typescript
const endpoint = createVersionedRESTEndpoint({
  versionStrategy: semverStrategy,
  extractVersion: extractVersionFromHeader('X-API-Version'),
  defaultVersion: '1.0.0',
  versions: {
    '1.0.0': {
      request: fromZod('1.0.0', UserRequestV1),
      response: fromZod('1.0.0', UserResponseV1),
    },
    '2.0.0': {
      request: fromZod('2.0.0', UserRequestV2),
      response: fromZod('2.0.0', UserResponseV2),
    },
  },
  migrations: [{
    fromVersion: '1.0.0',
    toVersion: '2.0.0',
    // Core transformation (works for both request and response)
    transform: {
      up: (data) => {
        const [firstName, ...rest] = data.name.split(' ');
        return { firstName, lastName: rest.join(' ') };
      },
      down: (data) => ({ name: `${data.firstName} ${data.lastName}`.trim() }),
    },
  }],
});

// Single endpoint handles both directions
app.post('/users', async (req, res) => {
  const { version, body } = endpoint.parseRequest(req, '2.0.0');
  const user = await createUser(body);
  endpoint.sendResponse(res, user, version, '2.0.0');
});
```

**Benefits**:
- Single configuration object for the entire endpoint
- Migration logic defined once, applied to both request and response
- Server fields (id, createdAt) preserved automatically during response migration
- Much less boilerplate for common REST patterns

**Implementation Complexity**: Medium
- New `createVersionedRESTEndpoint` function in @migrex/rest
- Internally creates two graphs but exposes unified API
- Migration transform applied with field passthrough for extra response fields

---

## Idea 3: Migration Helpers for Common Patterns

**Problem**: Simple migrations (add field, rename field, restructure) require verbose boilerplate.

**Current Pattern**:
```typescript
const migration: ReversibleMigration<V1, V2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data) => ({
    version: '2.0.0',
    name: data.name,
    email: data.email,
    logLevel: 'info', // Just adding one field!
  }),
  down: (data) => ({
    version: '1.0.0',
    name: data.name,
    email: data.email,
  }),
};
```

**Proposed Helpers**:
```typescript
import { addField, removeField, renameField, restructure } from '@migrex/core/helpers';

// Add a field with default value
const migration1 = addField({
  from: '1.0.0',
  to: '1.1.0',
  field: 'logLevel',
  defaultValue: 'info',
});

// Rename a field
const migration2 = renameField({
  from: '1.1.0',
  to: '1.2.0',
  oldName: 'userName',
  newName: 'name',
});

// Restructure flat -> nested
const migration3 = restructure({
  from: '1.2.0',
  to: '2.0.0',
  transform: {
    'app.name': 'appName',
    'server.port': 'port',
    'logging.level': 'logLevel',
  },
});
```

**Benefits**:
- Common operations become one-liners
- Self-documenting intent
- Less room for copy-paste errors
- Still supports custom migrations for complex cases

**Implementation Complexity**: Low-Medium
- Pure utility functions that return `ReversibleMigration` objects
- Can be added incrementally without breaking changes

---

## Idea 4: Schema Extension/Inheritance

**Problem**: Each schema version must redeclare all fields, even when only adding one.

**Current Pattern (Zod)**:
```typescript
const V1 = z.object({ version: z.literal('1.0.0'), name: z.string(), port: z.number() });
const V2 = z.object({ version: z.literal('1.1.0'), name: z.string(), port: z.number(), logLevel: z.string() });
//                                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ duplicated
```

**Proposed Pattern**:
```typescript
import { extendSchema } from '@migrex/zod';

const V1 = z.object({ version: z.literal('1.0.0'), name: z.string(), port: z.number() });

// Extend V1, overriding version and adding logLevel
const V2 = extendSchema(V1, '1.1.0', {
  logLevel: z.string().default('info'),
});
```

**For JSON Schema**:
```typescript
import { extendJsonSchema } from '@migrex/json-schema';

const schemaV2 = extendJsonSchema(schemaV1, '1.1.0', {
  additionalProperties: {
    logLevel: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
  },
  additionalRequired: ['logLevel'],
});
```

**Benefits**:
- DRY schema definitions
- Clear indication of what changed between versions
- Leverages Zod's built-in `.extend()` under the hood

**Implementation Complexity**: Low
- Wrapper functions around Zod's `.extend()` and JSON Schema merging
- Updates version literal automatically

---

## Idea 5: Quick Start Templates via CLI

**Problem**: Initial setup requires understanding multiple packages and patterns.

**Proposed CLI Enhancement**:
```bash
# Generate a complete versioned config setup
migrex init --template config --plugin zod
# Creates:
#   src/config/
#     schemas.ts      # v1.0.0 schema with example fields
#     migrations.ts   # Empty migrations file with template
#     graph.ts        # Wired-up graph export
#     index.ts        # Load/save helpers

# Generate a REST API versioning setup
migrex init --template rest-api --plugin zod
# Creates:
#   src/api/
#     schemas/
#       request.ts    # Request schemas for v1, v2
#       response.ts   # Response schemas with server fields
#     migrations.ts
#     endpoints.ts    # Configured endpoints ready to use
```

**Benefits**:
- Instant working example
- Teaches patterns through generated code
- Reduces "blank page" friction

**Implementation Complexity**: Medium
- Templates in @migrex/cli
- Placeholders for customization

---

## Idea 6: Unified "Versioned Data" Package

**Problem**: Common use cases require importing from 3 packages.

**Current**:
```typescript
import { createMigrationGraph, semverStrategy } from '@migrex/core';
import { fromZod } from '@migrex/zod';
import { loadVersionedFile, saveVersionedFile } from '@migrex/files';
```

**Proposed**:
```typescript
// Everything needed for files + zod in one import
import {
  createMigrationGraph,
  semverStrategy,
  fromZod,
  loadVersionedFile,
  saveVersionedFile,
} from '@migrex/zod-files';

// Or a "batteries included" package
import { ... } from 'migrex';
```

**Benefits**:
- Single import for common cases
- Still allows granular imports for advanced users
- Better discoverability

**Implementation Complexity**: Low
- Re-export package or umbrella package
- No new functionality, just convenience

---

## Priority Ranking

| Idea | Impact | Effort | Priority |
|------|--------|--------|----------|
| 1. Declarative Graph Config | High | Low | **P0** |
| 3. Migration Helpers | High | Low-Med | **P0** |
| 2. REST Endpoint Builder | High | Medium | **P1** |
| 4. Schema Extension | Medium | Low | **P1** |
| 5. CLI Templates | Medium | Medium | **P2** |
| 6. Unified Package | Low | Low | **P2** |

---

## Next Steps

1. **Implement P0 items** - Declarative graph config and migration helpers
2. **Re-run DX evaluations** - Measure improvement in time-to-success
3. **Gather feedback** - Share with potential users for validation
4. **Iterate** - Prioritize remaining items based on feedback
