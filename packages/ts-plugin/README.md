# @migrex/ts-plugin

TypeScript Language Service Plugin for migrex - provides IDE integration including diagnostics, hover information, and quick fixes for migration code.

## Features

- **Diagnostics on consume() calls**: Detects when code doesn't properly handle single vs multi-value preserved fields
- **Hover information**: Shows field profiles ('always-single' or 'sometimes-multi') when hovering over field names
- **Quick fixes**: Suggests code fixes for handling multi-value cases

## Installation

```bash
npm install @migrex/ts-plugin typescript @migrex/core
```

## Configuration

Add the plugin to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@migrex/ts-plugin",
        "graphPath": "./src/migrations/graph.ts",
        "enableHover": true,
        "enableQuickFixes": true
      }
    ]
  }
}
```

### Configuration Options

- **graphPath** (string, optional): Path to migration graph file (relative to project root)
- **enableHover** (boolean, optional): Enable hover information for field profiles (default: true)
- **enableQuickFixes** (boolean, optional): Enable quick fixes for multi-value handling (default: true)

## IDE Setup

### VS Code

The plugin will be automatically loaded by the TypeScript language server when you open a TypeScript file. Make sure you're using the workspace TypeScript version:

1. Open a `.ts` file
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Select "TypeScript: Select TypeScript Version..."
4. Choose "Use Workspace Version"

### Other Editors

Any editor that uses the TypeScript Language Service should automatically load the plugin from your `tsconfig.json`.

## Usage

### Diagnostics

The plugin will show warnings when you consume a field that can have multiple values without checking the `kind` property:

```typescript
// ⚠️ Warning: Field "theme" can have multiple preserved values
const theme = ctx.consume('theme');

// ✅ Correct: Check kind before using
const theme = ctx.consume('theme');
if (theme) {
  if (theme.kind === 'single') {
    // Handle single value: theme.value
  } else {
    // Handle multiple values: theme.values
  }
}
```

### Hover Information

Hover over a field name in a `consume()` or `preserve()` call to see its profile:

```typescript
// Hover over 'theme' to see:
// **migrex field profile**
// Field `theme` is preserved at most once on any migration path.
// Safe to use: `field.kind === "single"` is always true.
const theme = ctx.consume('theme');
```

### Quick Fixes

When a diagnostic appears, you can use the quick fix (light bulb) to automatically generate proper multi-value handling code.

## How It Works

The plugin:

1. Loads your migration graph from the configured path
2. Analyzes the graph to determine field profiles
3. Checks `consume()` calls against the field profiles
4. Provides diagnostics, hover info, and quick fixes through the TypeScript Language Service

## Architecture

The plugin uses the proxy pattern to wrap the base TypeScript Language Service:

- **plugin.ts**: Main proxy logic that intercepts specific LanguageService methods
- **diagnostics.ts**: Generates diagnostics for consume() calls
- **hover.ts**: Augments hover information with field profiles
- **quick-fixes.ts**: Provides code fixes for multi-value handling
- **analysis-cache.ts**: Caches graph analysis results for performance
- **graph-loader.ts**: Loads migration graph from user code

## Development

```bash
# Build the plugin
pnpm build

# Run tests
pnpm test

# Build types
pnpm build:types

# Update API report
pnpm api:update

# Check API report
pnpm api:check
```

## License

UNLICENSED
