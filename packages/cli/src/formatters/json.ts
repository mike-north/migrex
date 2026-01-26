/**
 * JSON formatter for machine-readable CLI output.
 *
 * @packageDocumentation
 */

import type {
  AnalysisResult,
  LossyPathReport,
  DeprecatedVersionInfo,
  MigrationSuggestion,
  MigrationPath,
} from '@migrex/core';

/**
 * Format an analysis result as JSON.
 * @public
 */
export function formatAnalysisJson(analysis: AnalysisResult): string {
  return JSON.stringify(analysis, null, 2);
}

/**
 * Format a lossy path report as JSON.
 * @public
 */
export function formatLossyPathsJson(report: LossyPathReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format migration suggestions as JSON.
 * @public
 */
export function formatSuggestionsJson(
  suggestions: readonly MigrationSuggestion[]
): string {
  return JSON.stringify(suggestions, null, 2);
}

/**
 * Format deprecated version info as JSON.
 * @public
 */
export function formatDeprecatedVersionsJson(
  versions: readonly DeprecatedVersionInfo[]
): string {
  return JSON.stringify(versions, null, 2);
}

/**
 * Format a migration path as JSON.
 * @public
 */
export function formatMigrationPathJson(path: MigrationPath): string {
  return JSON.stringify(path, null, 2);
}
