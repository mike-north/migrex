# @migrex/files

File-based configuration integration for migrex. Load, save, and watch versioned configuration files with automatic migration support.

## Installation

```bash
npm install @migrex/files @migrex/core
```

## Features

- **Load & Auto-migrate**: Load configuration files and automatically migrate to target version
- **Save**: Save configuration with version information
- **Watch**: Watch files for changes and automatically reload/migrate
- **Format detection**: Automatic JSON format detection (YAML coming soon)
- **Type-safe**: Full TypeScript support with strict typing

## Usage

### Load Configuration

```typescript
import { loadConfig } from '@migrex/files';
import { createMigrationGraph, semverStrategy } from '@migrex/core';

const graph = createMigrationGraph({
  id: 'my-app',
  versionStrategy: semverStrategy,
});

// Register your schemas and migrations...

// Load and auto-migrate to latest version
const result = await loadConfig(graph, './config.json');
console.log(result.data); // Migrated data
console.log(result.wasUpgraded); // true if migration occurred

// Load and migrate to specific version
const result2 = await loadConfig(graph, './config.json', {
  targetVersion: '2.0.0',
});
```

### Save Configuration

```typescript
import { saveConfig } from '@migrex/files';

await saveConfig(graph, './config.json', {
  version: '2.0.0',
  appName: 'My App',
  port: 3000,
});

// Pretty-printed by default, save compact:
await saveConfig(graph, './config.json', data, { pretty: false });
```

### Watch Configuration

```typescript
import { watchConfig } from '@migrex/files';

const watcher = watchConfig(graph, './config.json', {
  targetVersion: '2.0.0',
  onUpdate: (config) => {
    console.log('Config updated:', config.data);
  },
  onError: (error) => {
    console.error('Config error:', error);
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

### `loadConfig<T>(graph, filePath, options?)`

Load and auto-migrate a configuration file.

**Parameters:**
- `graph: MigrationGraph` - Migration graph with schemas and migrations
- `filePath: string` - Path to configuration file
- `options?: LoadConfigOptions` - Loading options

**Returns:** `Promise<LoadConfigResult<T>>`

**Throws:**
- `ConfigFileError` - If file cannot be read or parsed
- `MigrationError` - If migration fails

### `saveConfig(graph, filePath, data, options?)`

Save configuration to a file.

**Parameters:**
- `graph: MigrationGraph` - Migration graph
- `filePath: string` - Path to save file
- `data: unknown` - Configuration data
- `options?: SaveConfigOptions` - Save options

**Returns:** `Promise<void>`

**Throws:**
- `ConfigFileError` - If file cannot be written or validation fails

### `watchConfig(graph, filePath, options?)`

Watch a configuration file for changes.

**Parameters:**
- `graph: MigrationGraph` - Migration graph
- `filePath: string` - Path to watch
- `options?: WatchConfigOptions` - Watch options

**Returns:** `ConfigWatcher` - Watcher with `stop()` method

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

### `LoadConfigOptions`

```typescript
interface LoadConfigOptions {
  targetVersion?: string;  // Target version to migrate to
  format?: 'json' | 'yaml';  // File format (default: auto-detect)
}
```

### `LoadConfigResult<T>`

```typescript
interface LoadConfigResult<T> {
  data: T;  // Loaded and migrated data
  sourceVersion: string;  // Original version in file
  targetVersion: string;  // Version after migration
  migrationPath?: MigrationPath;  // Migration steps executed
  wasUpgraded: boolean;  // Whether migration occurred
}
```

### `SaveConfigOptions`

```typescript
interface SaveConfigOptions {
  version?: string;  // Version to set (default: auto-detect)
  format?: 'json' | 'yaml';  // File format (default: auto-detect)
  pretty?: boolean;  // Pretty-print output (default: true)
}
```

### `WatchConfigOptions`

```typescript
interface WatchConfigOptions {
  targetVersion?: string;  // Target version for auto-migration
  debounceMs?: number;  // Debounce delay (default: 100ms)
  onUpdate?: (config: LoadConfigResult<unknown>) => void;
  onError?: (error: Error) => void;
}
```

### `ConfigWatcher`

```typescript
interface ConfigWatcher {
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

### `ConfigFileError`

```typescript
class ConfigFileError extends Error {
  readonly filePath: string;
  readonly cause?: unknown;
}
```

## Error Handling

All functions throw `ConfigFileError` for file operations and parse errors:

```typescript
try {
  const result = await loadConfig(graph, './config.json');
} catch (error) {
  if (error instanceof ConfigFileError) {
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
  "appName": "My App",
  "port": 3000
}
```

### YAML (Coming Soon)

YAML support will be added in a future release. For now, attempting to load YAML files will throw an error.

## License

MIT
