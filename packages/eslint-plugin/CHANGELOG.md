# @migrex/eslint-plugin

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
