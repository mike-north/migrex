/**
 * \@migrex/cli - Command-line interface for migrex
 *
 * CLI tool for versioned data contracts with bidirectional migrations.
 * Provides commands for CI integration, analysis, type generation, and scaffolding.
 *
 * @packageDocumentation
 */

import { runCli } from './cli.js';

// Run the CLI
runCli(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exit(1);
});

// Re-export for programmatic use
export { runCli } from './cli.js';
export { ExitCode } from './utils/exit-codes.js';
export type { ExitCode as ExitCodeType } from './utils/exit-codes.js';

// Export all commands for programmatic use
export {
  checkCommand,
  analyzeCommand,
  generateTypesCommand,
  initCommand,
  newSchemaCommand,
  newMigrationCommand,
  pathCommand,
  diffCommand,
} from './commands/index.js';

export type {
  CheckOptions,
  CheckResult,
  AnalyzeOptions,
  AnalyzeResult,
  GenerateTypesOptions,
  GenerateTypesResult,
  InitOptions,
  InitResult,
  NewSchemaOptions,
  NewMigrationOptions,
  NewResult,
  PathOptions,
  PathResult,
  DiffOptions,
  DiffResult,
} from './commands/index.js';

// Export utilities
export { logger } from './utils/logger.js';
export { loadGraph } from './loaders/graph-loader.js';
export type { LoadResult } from './loaders/graph-loader.js';

// Export formatters
export {
  formatAnalysisText,
  formatLossyPathsText,
  formatSuggestionsText,
  formatDeprecatedVersionsText,
  formatMigrationPath,
} from './formatters/text.js';

export {
  formatAnalysisJson,
  formatLossyPathsJson,
  formatSuggestionsJson,
  formatDeprecatedVersionsJson,
  formatMigrationPathJson,
} from './formatters/json.js';

// Export templates
export {
  generateSchemaTemplate,
  type SchemaTemplateOptions,
} from './templates/schema.template.js';

export {
  generateMigrationTemplate,
  type MigrationTemplateOptions,
} from './templates/migration.template.js';

export {
  generateConfigTemplate,
  generateGitignoreTemplate,
  generateReadmeTemplate,
  type ConfigTemplateOptions,
} from './templates/config.template.js';
