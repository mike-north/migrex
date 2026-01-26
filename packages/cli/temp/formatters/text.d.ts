/**
 * Text formatter for human-readable CLI output.
 *
 * @packageDocumentation
 */
import type { AnalysisResult, LossyPathReport, DeprecatedVersionInfo, MigrationSuggestion, MigrationPath } from '@migrex/core';
/**
 * Format an analysis result as human-readable text.
 * @public
 */
export declare function formatAnalysisText(analysis: AnalysisResult): string;
/**
 * Format a lossy path report as human-readable text.
 * @public
 */
export declare function formatLossyPathsText(report: LossyPathReport): string;
/**
 * Format migration suggestions as human-readable text.
 * @public
 */
export declare function formatSuggestionsText(suggestions: readonly MigrationSuggestion[]): string;
/**
 * Format deprecated version info as human-readable text.
 * @public
 */
export declare function formatDeprecatedVersionsText(versions: readonly DeprecatedVersionInfo[]): string;
/**
 * Format a migration path as human-readable text.
 * @public
 */
export declare function formatMigrationPath(path: MigrationPath): string;
//# sourceMappingURL=text.d.ts.map