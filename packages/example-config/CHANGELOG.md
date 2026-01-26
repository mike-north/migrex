# @migrex/example-config

## 0.1.1-alpha.0

### Patch Changes

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
