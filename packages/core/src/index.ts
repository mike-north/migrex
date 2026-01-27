/**
 * \@migrex/core - Core library for versioned data contracts with bidirectional migrations
 *
 * @packageDocumentation
 */

// Types
export type {
  ValidationResult,
  ValidationError,
  VersionedSchema,
  MigrationTraits,
  ReversibleMigration,
  OneWayMigration,
  Migration,
  AsyncReversibleMigration,
  AsyncOneWayMigration,
  AsyncMigration,
  AnyMigration,
  MigrationPath,
  MigrationStep,
  MigrateOptions,
  MigrationResult,
  StashSummary,
  PreservedFieldSummary,
  PreservationMetadata,
  FieldSchema,
  PreservationEvent,
  SingleValuePreservation,
  MultiValuePreservation,
  PreservedField,
  PreserveResult,
  MigrationContext,
  MigrationGraphOptions,
  BatchMigrateOptions,
  BatchMigrationResult,
  MigrationTelemetry,
  VersionStrategy,
  VersionComponents,
  IncrementType,
} from './types.js';

// Errors
export {
  MigrationError,
  NoPathError,
  SchemaValidationError,
  StashConflictError,
} from './errors.js';
export type { MigrationErrorCode } from './errors.js';

// Strategies
export {
  semverStrategy,
  calverStrategy,
  integerStrategy,
} from './strategies/index.js';

// Graph
export { createMigrationGraph } from './graph.js';
export type { MigrationGraph } from './graph.js';

// Context
export { createMigrationContext } from './context.js';

// Analysis
export {
  analyzeGraph,
  analyzeIncremental,
  findLossyPaths,
  suggestMigrations,
  getDeprecatedVersions,
} from './analysis/index.js';
export type {
  AnalysisResult,
  AnalysisOptions,
  Diagnostic,
  DiagnosticCode,
  SuggestedFix,
  TextEdit,
  Position,
  ConnectivityAnalysis,
  FieldProfile,
  FieldProfileMap,
  LossyPathReport,
  LossyPathAnalysis,
  MigrationSuggestion,
  DeprecatedVersionInfo,
  PathSummary,
} from './analysis/types.js';

// Helpers
export {
  addField,
  removeField,
  renameField,
  restructure,
} from './helpers/index.js';
export type {
  AddFieldOptions,
  RemoveFieldOptions,
  RenameFieldOptions,
  RestructureOptions,
} from './helpers/index.js';
