# @migrex/cli

Command-line interface for migrex - provides tools for CI integration, project scaffolding, and migration graph analysis.

## Features

- **check**: CI health check with exit codes
- **analyze**: Full analysis report with field profiles
- **generate-types**: Generate TypeScript types from analysis
- **init**: Initialize project structure
- **new schema**: Create new schema files
- **new migration**: Create new migration files
- **path**: Show migration path between versions
- **diff**: Show schema differences between versions

## Installation

```bash
npm install @migrex/cli @migrex/core
```

## Usage

```bash
# Or use directly via npx
npx @migrex/cli <command> [options]

# Or with pnpm
pnpm exec migrex <command> [options]
```

## Commands

### check

Check graph health for CI integration. Returns appropriate exit codes.

```bash
migrex check [options]
```

Options:
- `-g, --graph <path>` - Path to migration graph or config file
- `-s, --strict` - Treat warnings as errors
- `--json` - Output as JSON

```bash
# CI example
migrex check --graph ./src/migrations/graph.ts --strict
```

### analyze

Analyze and report on the migration graph.

```bash
migrex analyze [options]
```

Options:
- `-g, --graph <path>` - Path to migration graph or config file
- `-f, --format <format>` - Output format: `json` or `text` (default: `text`)

```bash
# Full analysis with JSON output
migrex analyze --graph ./src/migrations/graph.ts --format json
```

### generate-types

Generate TypeScript types from graph analysis.

```bash
migrex generate-types [options]
```

Options:
- `-g, --graph <path>` - Path to migration graph or config file
- `-o, --output <path>` - Output path for generated types

```bash
migrex generate-types --graph ./src/migrations/graph.ts -o ./src/types/migrex.d.ts
```

### init

Initialize project structure with a starter migration graph.

```bash
migrex init [options]
```

Options:
- `-p, --plugin <plugin>` - Plugin to use: `zod` or `json-schema` (default: `zod`)
- `-v, --version <version>` - Initial version (default: `1.0.0`)

```bash
migrex init --plugin zod --version 1.0.0
```

### new schema

Create a new schema file.

```bash
migrex new schema [options]
```

Options:
- `-v, --version <version>` - Schema version (required)
- `-p, --plugin <plugin>` - Plugin to use: `zod` or `json-schema` (default: `zod`)

```bash
migrex new schema --version 2.0.0 --plugin zod
```

### new migration

Create a new migration file.

```bash
migrex new migration [options]
```

Options:
- `-f, --from <version>` - Source version (required)
- `-t, --to <version>` - Target version (required)
- `-p, --plugin <plugin>` - Plugin to use: `zod` or `json-schema` (default: `zod`)

```bash
migrex new migration --from 1.0.0 --to 2.0.0
```

### path

Show the migration path between two versions.

```bash
migrex path [options]
```

Options:
- `-f, --from <version>` - Source version (required)
- `-t, --to <version>` - Target version (required)
- `-g, --graph <path>` - Path to migration graph or config file
- `--format <format>` - Output format: `json` or `text` (default: `text`)

```bash
migrex path --from 1.0.0 --to 3.0.0 --graph ./src/migrations/graph.ts
```

### diff

Show differences between two versions.

```bash
migrex diff [options]
```

Options:
- `-f, --from <version>` - Source version (required)
- `-t, --to <version>` - Target version (required)
- `-g, --graph <path>` - Path to migration graph or config file
- `--format <format>` - Output format: `json` or `text` (default: `text`)

```bash
migrex diff --from 1.0.0 --to 2.0.0 --graph ./src/migrations/graph.ts
```

## Exit Codes

The CLI uses standard Unix exit codes:

| Code | Constant | Description |
|------|----------|-------------|
| 0 | `SUCCESS` | Operation completed successfully |
| 1 | `GENERAL_ERROR` | General error (unspecified failure) |
| 2 | `CONFIG_ERROR` | Configuration file error (missing, invalid, etc.) |
| 3 | `VALIDATION_ERROR` | Validation error (graph validation failed) |
| 4 | `FILE_NOT_FOUND` | File not found error |

### CI Integration Example

```bash
#!/bin/bash
set -e

# Run graph health check
migrex check --graph ./src/migrations/graph.ts --strict

# If we reach here, exit code was 0
echo "Graph health check passed!"
```

## Architecture

- **cli.ts**: Argument parsing with Commander.js
- **commands/check.ts**: CI health check with exit codes
- **commands/analyze.ts**: Full analysis report
- **commands/generate-types.ts**: TypeScript type generation
- **commands/init.ts**: Project initialization
- **commands/new.ts**: Schema and migration scaffolding
- **commands/path.ts**: Migration path display
- **commands/diff.ts**: Version diff display
- **formatters/text.ts**: Human-readable output formatting
- **formatters/json.ts**: JSON output formatting
- **templates/**: Scaffolding templates for schemas and migrations
- **utils/exit-codes.ts**: Standard exit codes
- **utils/logger.ts**: Console logging utilities

## Development

```bash
# Build the CLI
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
