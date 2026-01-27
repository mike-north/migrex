# @migrex/cli

## 0.2.0-alpha.2

### Minor Changes

- [#9](https://github.com/mike-north/migrex/pull/9) [`faf5420`](https://github.com/mike-north/migrex/commit/faf54202d312312650e403687c4a4279d03872e8) Thanks [@mike-north](https://github.com/mike-north)! - feat: Add DX improvements based on developer experience evaluations

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

### Patch Changes

- Updated dependencies [[`faf5420`](https://github.com/mike-north/migrex/commit/faf54202d312312650e403687c4a4279d03872e8), [`faf5420`](https://github.com/mike-north/migrex/commit/faf54202d312312650e403687c4a4279d03872e8)]:
  - @migrex/core@0.2.0-alpha.1

## 0.2.0-alpha.1

### Patch Changes

- [#4](https://github.com/mike-north/migrex/pull/4) [`0ec655b`](https://github.com/mike-north/migrex/commit/0ec655b6eeb2cc3010a02e5c7587c9606a6d3af5) Thanks [@mike-north](https://github.com/mike-north)! - Fix ts-plugin loadAnalysis() implementation and add documentation

  ## Bug Fixes
  - **@migrex/ts-plugin**: Fix `loadAnalysis()` function that was returning undefined, making the plugin non-functional. The plugin now properly loads migration graphs and provides diagnostics, hover info, and quick fixes.

  ## Documentation
  - **@migrex/eslint-plugin**: Add comprehensive README with installation, configuration, and rule documentation
  - **@migrex/cli**: Add comprehensive README with all commands, options, and exit codes documented
  - Add AI_ASSISTANT_INSTRUCTIONS.md with detailed guidance for AI coding assistants working with migrex

## 0.2.0-alpha.0

### Minor Changes

- [`bb31221`](https://github.com/mike-north/migrex/commit/bb312216067365157e1d154d9ce4a15d53755e03) Thanks [@mnorth-stripe](https://github.com/mnorth-stripe)! - Initial release of migrex packages

  Core packages:
  - `@migrex/core`: Core versioned data contract system with bidirectional migrations
  - `@migrex/cli`: Command-line interface for migrex
  - `@migrex/testing`: Test utilities for migrex contracts

  Validation plugins:
  - `@migrex/zod`: Zod schema integration with type-safe validation
  - `@migrex/json-schema`: JSON Schema (Draft-07) validation using Ajv

  Integration packages:
  - `@migrex/files`: File-based configuration integration
  - `@migrex/rest`: REST API integration

  Developer tooling:
  - `@migrex/eslint-plugin`: ESLint plugin for migrex best practices
  - `@migrex/ts-plugin`: TypeScript language service plugin

### Patch Changes

- Updated dependencies [[`bb31221`](https://github.com/mike-north/migrex/commit/bb312216067365157e1d154d9ce4a15d53755e03)]:
  - @migrex/core@0.2.0-alpha.0
