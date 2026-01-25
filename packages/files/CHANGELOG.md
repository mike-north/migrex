# @migrex/files

## 1.0.0-alpha.0

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
