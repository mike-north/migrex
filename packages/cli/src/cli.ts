/**
 * CLI entry point with argument parsing.
 *
 * @packageDocumentation
 */

import { Command } from 'commander';
import {
  checkCommand,
  analyzeCommand,
  generateTypesCommand,
  initCommand,
  newSchemaCommand,
  newMigrationCommand,
  pathCommand,
  diffCommand,
} from './commands/index.js';
import type {
  CheckOptions,
  AnalyzeOptions,
  GenerateTypesOptions,
  InitOptions,
  NewSchemaOptions,
  NewMigrationOptions,
  PathOptions,
  DiffOptions,
} from './commands/index.js';
import { logger } from './utils/logger.js';

/**
 * Run the CLI with the given arguments.
 * @param args - Command line arguments (without node and script path)
 * @public
 */
export async function runCli(args: string[]): Promise<void> {
  const program = new Command()
    .name('migrex')
    .description('CLI for versioned data contracts with bidirectional migrations')
    .version('0.2.0-alpha.0');

  // Check command
  program
    .command('check')
    .description('Check graph health (CI integration)')
    .option('-g, --graph <path>', 'Path to migration graph or config file')
    .option('-s, --strict', 'Treat warnings as errors')
    .option('--json', 'Output as JSON')
    .action(async (options: CheckOptions) => {
      const result = await checkCommand(options);
      process.exit(result.exitCode);
    });

  // Analyze command
  program
    .command('analyze')
    .description('Analyze and report on graph')
    .option('-g, --graph <path>', 'Path to migration graph or config file')
    .option('-f, --format <format>', 'Output format (json or text)', 'text')
    .action(async (options: AnalyzeOptions) => {
      const result = await analyzeCommand(options);
      process.exit(result.exitCode);
    });

  // Generate-types command
  program
    .command('generate-types')
    .description('Generate TypeScript types from analysis')
    .option('-g, --graph <path>', 'Path to migration graph or config file')
    .option('-o, --output <path>', 'Output path for generated types')
    .action(async (options: GenerateTypesOptions) => {
      const result = await generateTypesCommand(options);
      process.exit(result.exitCode);
    });

  // Init command
  program
    .command('init')
    .description('Initialize project structure')
    .option(
      '-p, --plugin <plugin>',
      'Plugin to use (zod or json-schema)',
      'zod'
    )
    .option('-v, --version <version>', 'Initial version', '1.0.0')
    .action(async (options: InitOptions) => {
      const result = await initCommand(options);
      process.exit(result.exitCode);
    });

  // New command (schema and migration)
  const newCommand = program
    .command('new')
    .description('Create new schema or migration');

  newCommand
    .command('schema')
    .description('Create a new schema file')
    .requiredOption('-v, --version <version>', 'Schema version')
    .option(
      '-p, --plugin <plugin>',
      'Plugin to use (zod or json-schema)',
      'zod'
    )
    .action(async (options: NewSchemaOptions) => {
      const result = await newSchemaCommand(options);
      process.exit(result.exitCode);
    });

  newCommand
    .command('migration')
    .description('Create a new migration file')
    .requiredOption('-f, --from <version>', 'Source version')
    .requiredOption('-t, --to <version>', 'Target version')
    .option(
      '-p, --plugin <plugin>',
      'Plugin to use (zod or json-schema)',
      'zod'
    )
    .action(async (options: NewMigrationOptions) => {
      const result = await newMigrationCommand(options);
      process.exit(result.exitCode);
    });

  // Path command
  program
    .command('path')
    .description('Show migration path between versions')
    .requiredOption('-f, --from <version>', 'Source version')
    .requiredOption('-t, --to <version>', 'Target version')
    .option('-g, --graph <path>', 'Path to migration graph or config file')
    .option('--format <format>', 'Output format (json or text)', 'text')
    .action(async (options: PathOptions) => {
      const result = await pathCommand(options);
      process.exit(result.exitCode);
    });

  // Diff command
  program
    .command('diff')
    .description('Show diff between two versions')
    .requiredOption('-f, --from <version>', 'Source version')
    .requiredOption('-t, --to <version>', 'Target version')
    .option('-g, --graph <path>', 'Path to migration graph or config file')
    .option('--format <format>', 'Output format (json or text)', 'text')
    .action(async (options: DiffOptions) => {
      const result = await diffCommand(options);
      process.exit(result.exitCode);
    });

  // Handle errors
  program.exitOverride((err) => {
    if (err.code === 'commander.help') {
      process.exit(0);
    }
    if (err.code === 'commander.version') {
      process.exit(0);
    }
    logger.error(err.message);
    process.exit(1);
  });

  // Parse arguments
  await program.parseAsync(args, { from: 'user' });
}
