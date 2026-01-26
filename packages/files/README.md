# @migrex/files

File-based versioned data integration for migrex. Load, save, upgrade, and watch versioned files with automatic migration support.

## Installation

```bash
npm install @migrex/files @migrex/core
```

## Features

- **Load & Auto-migrate**: Load versioned files and automatically migrate to target version
- **Save**: Save data with version information
- **Upgrade**: Upgrade files in place to a target version
- **Watch**: Watch files for changes and automatically reload/migrate
- **Format detection**: Automatic JSON format detection (YAML coming soon)
- **Type-safe**: Full TypeScript support with strict typing

## Usage

### Load Versioned File

```typescript
import { loadVersionedFile } from '@migrex/files';
import { createMigrationGraph, semverStrategy } from '@migrex/core';

const graph = createMigrationGraph({
  id: 'my-app',
  versionStrategy: semverStrategy,
});

// Register your schemas and migrations...

// Load and auto-migrate to latest version
const result = await loadVersionedFile(graph, './data.json');
console.log(result.data); // Migrated data
console.log(result.wasUpgraded); // true if migration occurred

// Load and migrate to specific version
const result2 = await loadVersionedFile(graph, './data.json', {
  targetVersion: '2.0.0',
});
```

### Save Versioned File

```typescript
import { saveVersionedFile } from '@migrex/files';

await saveVersionedFile(graph, './data.json', {
  version: '2.0.0',
  name: 'My App',
  port: 3000,
});

// Pretty-printed by default, save compact:
await saveVersionedFile(graph, './data.json', data, { pretty: false });
```

### Upgrade Versioned File

Upgrade a file in place - read, migrate, and write back:

```typescript
import { upgradeVersionedFile } from '@migrex/files';

// Upgrade to latest version
const result = await upgradeVersionedFile(graph, './data.json');
if (result.wasMigrated) {
  console.log(`Upgraded from ${result.sourceVersion} to ${result.targetVersion}`);
}

// Upgrade to specific version
const result2 = await upgradeVersionedFile(graph, './data.json', {
  targetVersion: '2.0.0',
});

// Force rewrite even if already at target version
await upgradeVersionedFile(graph, './data.json', {
  targetVersion: '2.0.0',
  skipIfCurrent: false,
});
```

### Watch Versioned File

```typescript
import { watchVersionedFile } from '@migrex/files';

const watcher = watchVersionedFile(graph, './data.json', {
  targetVersion: '2.0.0',
  onUpdate: (result) => {
    console.log('File updated:', result.data);
  },
  onError: (error) => {
    console.error('Error:', error);
  },
});

// Later, stop watching
watcher.stop();
```

### Compare Versions

```typescript
import { diffVersions } from '@migrex/files';

const diff = diffVersions(graph, '1.0.0', '2.0.0');
console.log('Added fields:', diff.addedFields);
console.log('Removed fields:', diff.removedFields);
console.log('Modified fields:', diff.modifiedFields);
```

## API

### `loadVersionedFile<T>(graph, filePath, options?)`

Load and auto-migrate a versioned file.

**Parameters:**
- `graph: MigrationGraph` - Migration graph with schemas and migrations
- `filePath: string` - Path to file
- `options?: LoadOptions` - Loading options

**Returns:** `Promise<LoadResult<T>>`

**Throws:**
- `VersionedFileError` - If file cannot be read or parsed
- `MigrationError` - If migration fails

### `saveVersionedFile(graph, filePath, data, options?)`

Save data to a versioned file.

**Parameters:**
- `graph: MigrationGraph` - Migration graph
- `filePath: string` - Path to save file
- `data: unknown` - Data to save
- `options?: SaveOptions` - Save options

**Returns:** `Promise<void>`

**Throws:**
- `VersionedFileError` - If file cannot be written or validation fails

### `upgradeVersionedFile(graph, filePath, options?)`

Upgrade a versioned file in place to a target version.

**Parameters:**
- `graph: MigrationGraph` - Migration graph with schemas and migrations
- `filePath: string` - Path to file
- `options?: UpgradeOptions` - Upgrade options

**Returns:** `Promise<UpgradeResult>`

**Throws:**
- `VersionedFileError` - If file cannot be read, parsed, or written
- `MigrationError` - If migration fails

### `watchVersionedFile(graph, filePath, options?)`

Watch a versioned file for changes.

**Parameters:**
- `graph: MigrationGraph` - Migration graph
- `filePath: string` - Path to watch
- `options?: WatchOptions` - Watch options

**Returns:** `FileWatcher` - Watcher with `stop()` method

### `diffVersions(graph, fromVersion, toVersion)`

Compare two schema versions.

**Parameters:**
- `graph: MigrationGraph` - Migration graph
- `fromVersion: string` - Source version
- `toVersion: string` - Target version

**Returns:** `VersionDiff` - Difference information

**Throws:**
- `Error` - If schemas not found

## Types

### `LoadOptions`

```typescript
interface LoadOptions {
  targetVersion?: string;  // Target version to migrate to
  format?: 'json' | 'yaml';  // File format (default: auto-detect)
}
```

### `LoadResult<T>`

```typescript
interface LoadResult<T> {
  data: T;  // Loaded and migrated data
  sourceVersion: string;  // Original version in file
  targetVersion: string;  // Version after migration
  migrationPath?: MigrationPath;  // Migration steps executed
  wasUpgraded: boolean;  // Whether migration occurred
}
```

### `SaveOptions`

```typescript
interface SaveOptions {
  version?: string;  // Version to set (default: auto-detect)
  format?: 'json' | 'yaml';  // File format (default: auto-detect)
  pretty?: boolean;  // Pretty-print output (default: true)
}
```

### `UpgradeOptions`

```typescript
interface UpgradeOptions {
  targetVersion?: string;  // Target version to upgrade to
  format?: 'json' | 'yaml';  // File format (default: auto-detect)
  pretty?: boolean;  // Pretty-print output (default: true)
  skipIfCurrent?: boolean;  // Skip write if already at target (default: true)
}
```

### `UpgradeResult`

```typescript
interface UpgradeResult {
  sourceVersion: string;  // Original version in file
  targetVersion: string;  // Version after upgrade
  wasWritten: boolean;  // Whether file was written
  wasMigrated: boolean;  // Whether migration occurred
  migrationPath?: MigrationPath;  // Migration steps executed
}
```

### `WatchOptions`

```typescript
interface WatchOptions {
  targetVersion?: string;  // Target version for auto-migration
  debounceMs?: number;  // Debounce delay (default: 100ms)
  onUpdate?: (result: LoadResult<unknown>) => void;
  onError?: (error: Error) => void;
}
```

### `FileWatcher`

```typescript
interface FileWatcher {
  stop(): void;  // Stop watching and clean up
}
```

### `VersionDiff`

```typescript
interface VersionDiff {
  from: string;
  to: string;
  addedFields: string[];
  removedFields: string[];
  modifiedFields: string[];
}
```

### `VersionedFileError`

```typescript
class VersionedFileError extends Error {
  readonly filePath: string;
  readonly cause?: unknown;
}
```

## Error Handling

All functions throw `VersionedFileError` for file operations and parse errors:

```typescript
try {
  const result = await loadVersionedFile(graph, './data.json');
} catch (error) {
  if (error instanceof VersionedFileError) {
    console.error('File error:', error.message);
    console.error('File path:', error.filePath);
    console.error('Cause:', error.cause);
  }
}
```

## Format Support

### JSON (Supported)

JSON format is fully supported out of the box:

```json
{
  "version": "2.0.0",
  "name": "My App",
  "port": 3000
}
```

### YAML (Coming Soon)

YAML support will be added in a future release. For now, attempting to load YAML files will throw an error.

## License

MIT
