# @migrex/files

## 1.0.0-alpha.3

### Minor Changes

- [#11](https://github.com/mike-north/migrex/pull/11) [`4887ecf`](https://github.com/mike-north/migrex/commit/4887ecfa1ed56f608a4d070374a85cd82b56d559) Thanks [@mike-north](https://github.com/mike-north)! - Add YAML and TOML file format support with automatic format detection

  The package now supports YAML (.yaml, .yml) and TOML (.toml) file formats in addition to JSON. File format is automatically detected from the file extension, or can be explicitly specified via the `format` option in all file operations (load, save, upgrade, watch).

  **New dependencies:**
  - `js-yaml` for YAML parsing and serialization
  - `smol-toml` for TOML parsing and serialization

  **Security improvements:**
  - YAML parsing uses JSON_SCHEMA mode to prevent type coercion issues (e.g., `yes`/`no` becoming booleans) and avoid code execution from custom YAML tags

  **Format-specific behavior:**
  - JSON: Supports pretty-printing via the `pretty` option
  - YAML: Uses safe parsing mode with JSON schema for consistent behavior
  - TOML: Requires data to be an object (arrays and primitives at root level are not supported by the TOML spec)

  **Breaking changes:** None. The API remains backward compatible.

## 1.0.0-alpha.2

### Patch Changes

- [#9](https://github.com/mike-north/migrex/pull/9) [`faf5420`](https://github.com/mike-north/migrex/commit/faf54202d312312650e403687c4a4279d03872e8) Thanks [@mike-north](https://github.com/mike-north)! - Improve documentation based on DX evaluation feedback
  - **@migrex/core**: Add StashSummary type documentation and round-trip migration example
  - **@migrex/files**: Clarify loadVersionedFile auto-migration behavior with examples
  - **@migrex/rest**: Add "Request vs Response Schemas" section explaining the two-graph pattern for REST APIs with different request/response shapes
  - **@migrex/zod**: Document Zod v3.x version requirement and update peerDependencies to explicitly exclude v4.x

- Updated dependencies [[`faf5420`](https://github.com/mike-north/migrex/commit/faf54202d312312650e403687c4a4279d03872e8), [`faf5420`](https://github.com/mike-north/migrex/commit/faf54202d312312650e403687c4a4279d03872e8)]:
  - @migrex/core@0.2.0-alpha.1

## 1.0.0-alpha.1

### Minor Changes

- [#7](https://github.com/mike-north/migrex/pull/7) [`7add28d`](https://github.com/mike-north/migrex/commit/7add28d8a37a6b4be48d9c18436ab764e6442c6c) Thanks [@mike-north](https://github.com/mike-north)! - Add upgradeVersionedFile function and rename API to be more generic

  ## Breaking Changes
  - **@migrex/files**: Renamed all API functions and types to avoid implying "config" is the only use case:
    - `loadConfig` → `loadVersionedFile`
    - `saveConfig` → `saveVersionedFile`
    - `watchConfig` → `watchVersionedFile`
    - `ConfigFileError` → `VersionedFileError`
    - `ConfigWatcher` → `FileWatcher`
    - All option/result types renamed (e.g., `LoadConfigOptions` → `LoadOptions`)

  ## New Features
  - **@migrex/files**: Add `upgradeVersionedFile()` function to read a versioned file, migrate it to a target version, and write it back in place. Supports `skipIfCurrent` option to avoid unnecessary rewrites when file is already at target version.

  ## Internal
  - **@migrex/example-config**: Update tests to use new API names

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
