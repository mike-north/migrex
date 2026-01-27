/**
 * Utilities for loading and analyzing migration graphs.
 * @packageDocumentation
 */
import type { AnalysisResult, FieldProfile, MigrationGraph } from '@migrex/core';
import { findLossyPaths, getDeprecatedVersions, suggestMigrations } from '@migrex/core';
/**
 * Get or compute analysis for a migration graph.
 */
export declare function getGraphAnalysis(graph: MigrationGraph): AnalysisResult | undefined;
/**
 * Get the field profile for a specific field.
 */
export declare function getFieldProfile(analysis: AnalysisResult, fieldName: string): FieldProfile | undefined;
/**
 * Clear the analysis cache.
 * Should be called when the graph changes.
 * @internal Kept for testing and manual cache invalidation
 */
export declare function _clearAnalysisCache(): void;
/**
 * Find lossy paths in the graph.
 */
export { findLossyPaths };
/**
 * Get suggestions for new migrations.
 */
export { suggestMigrations };
/**
 * Get deprecated versions used in the graph.
 */
export { getDeprecatedVersions };
//# sourceMappingURL=graph-loader.d.ts.map