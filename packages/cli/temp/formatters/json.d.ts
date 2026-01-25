/**
 * JSON formatter for machine-readable CLI output.
 *
 * @packageDocumentation
 */
import type { AnalysisResult, LossyPathReport, DeprecatedVersionInfo, MigrationSuggestion, MigrationPath } from '@migrex/core';
/**
 * Format an analysis result as JSON.
 * @public
 */
export declare function formatAnalysisJson(analysis: AnalysisResult): string;
/**
 * Format a lossy path report as JSON.
 * @public
 */
export declare function formatLossyPathsJson(report: LossyPathReport): string;
/**
 * Format migration suggestions as JSON.
 * @public
 */
export declare function formatSuggestionsJson(suggestions: readonly MigrationSuggestion[]): string;
/**
 * Format deprecated version info as JSON.
 * @public
 */
export declare function formatDeprecatedVersionsJson(versions: readonly DeprecatedVersionInfo[]): string;
/**
 * Format a migration path as JSON.
 * @public
 */
export declare function formatMigrationPathJson(path: MigrationPath): string;
//# sourceMappingURL=json.d.ts.map