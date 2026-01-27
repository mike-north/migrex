---
"@migrex/core": minor
"@migrex/zod": minor
"@migrex/json-schema": minor
"@migrex/rest": minor
"@migrex/cli": minor
---

feat: Add DX improvements based on developer experience evaluations

## @migrex/core

### Declarative Graph Configuration
- Added optional `schemas` and `migrations` arrays to `createMigrationGraph` options
- Allows registering schemas and migrations during graph creation instead of calling methods separately

### Migration Helpers
- Added `addField()` helper for adding fields with default values
- Added `removeField()` helper for removing fields with optional preservation
- Added `renameField()` helper for renaming fields while preserving values
- Added `restructure()` helper for transforming between flat and nested structures
- All helpers return properly typed `ReversibleMigration` objects with appropriate traits
- Added prototype pollution protection in `restructure()` helper

## @migrex/zod

### Schema Extension
- Added `extendZodSchema()` to extend Zod schemas with new fields while updating version literal
- Added `omitFromZodSchema()` to remove deprecated fields from schemas

## @migrex/json-schema

### Schema Extension
- Added `extendJsonSchema()` to extend JSON schemas with additional properties
- Added `omitFromJsonSchema()` to remove properties from schemas
- Already documented in README with comprehensive examples

## @migrex/rest

### Unified REST Endpoint Builder
- Added `createVersionedRESTEndpoint()` for unified request/response versioning
- Internally creates two graphs but exposes a single configuration API
- Includes `parseRequest()` and `formatResponse()` methods

## @migrex/cli

### CLI Templates
- Added `--template` flag to `init` command
- Templates: `basic` (default), `config`, `rest-api`
- Config template generates complete versioned configuration setup
- REST API template generates complete endpoint versioning setup
