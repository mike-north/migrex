import type { MigrationGraph } from '../graph.js';
import type { AnalysisResult, AnalysisOptions, LossyPathReport, MigrationSuggestion, DeprecatedVersionInfo } from './types.js';
export * from './types.js';
/**
 * Analyze a migration graph for connectivity, field profiles, and potential issues.
 *
 * This performs a comprehensive analysis of the entire migration graph, checking for:
 * - Version connectivity (can all versions reach each other?)
 * - Field preservation patterns (which fields are preserved and how often?)
 * - Potential issues (disconnected components, multi-value fields, etc.)
 *
 * @param graph - The migration graph to analyze
 * @param options - Optional configuration for analysis behavior
 * @returns Complete analysis result with profiles, diagnostics, and connectivity info
 *
 * @example
 * ```typescript
 * const graph = new MigrationGraph('semver');
 * graph.register({
 *   version: '1.0.0',
 *   schema: (data) => ({ success: true, data }),
 * });
 * graph.register({
 *   version: '2.0.0',
 *   schema: (data) => ({ success: true, data }),
 * });
 * graph.addMigration({
 *   fromVersion: '1.0.0',
 *   toVersion: '2.0.0',
 *   up: (data) => data,
 *   down: (data) => data,
 * });
 *
 * const result = analyzeGraph(graph);
 * console.log(`Analyzed ${result.metadata.pathsAnalyzed} paths`);
 * console.log(`Found ${result.diagnostics.length} issues`);
 * ```
 */
export declare function analyzeGraph(graph: MigrationGraph, options?: AnalysisOptions): AnalysisResult;
/**
 * Perform incremental analysis by re-analyzing only affected portions of the graph.
 *
 * This is intended to be more efficient than full analysis when only a small
 * portion of the graph has changed. Currently, this is a stub that delegates
 * to full analysis - true incremental analysis is planned for future implementation.
 *
 * @param graph - The migration graph to analyze
 * @param _previousResult - Previous analysis result (currently unused)
 * @param _changedFiles - Files that have changed since previous analysis (currently unused)
 * @returns Complete analysis result
 *
 * @remarks
 * Future implementation will:
 * - Identify which versions and migrations are affected by changed files
 * - Recompute only the field profiles that could have changed
 * - Preserve diagnostics for unaffected portions of the graph
 *
 * @example
 * ```typescript
 * const initialResult = analyzeGraph(graph);
 * // ... later, after changes ...
 * const updatedResult = analyzeIncremental(
 *   graph,
 *   initialResult,
 *   ['src/migrations/v2-to-v3.ts']
 * );
 * ```
 */
export declare function analyzeIncremental(graph: MigrationGraph, _previousResult: AnalysisResult, _changedFiles: readonly string[]): AnalysisResult;
/**
 * Find all lossy migration paths in the graph.
 *
 * A lossy path is one where data may be lost during migration, either because:
 * - The migration is explicitly marked as one-way (lossy trait)
 * - Fields are dropped during transformation
 * - Data cannot be perfectly reconstructed when migrating backward
 *
 * This function analyzes every possible path between version pairs to identify
 * where data loss occurs, which steps are lossy, and why.
 *
 * @param graph - The migration graph to analyze
 * @returns Report containing all lossy paths with detailed analysis
 *
 * @example
 * ```typescript
 * const report = findLossyPaths(graph);
 *
 * console.log(`Total pairs: ${report.totalVersionPairs}`);
 * console.log(`Lossy pairs: ${report.lossyPairCount}`);
 * console.log(`Unreachable pairs: ${report.unreachablePairCount}`);
 *
 * for (const { from, to, analysis } of report.lossyPairs) {
 *   console.log(`\n${from} -> ${to}: LOSSY`);
 *   for (const step of analysis.lossySteps) {
 *     console.log(`  ${step.from} -> ${step.to}: ${step.reason}`);
 *   }
 * }
 * ```
 */
export declare function findLossyPaths(graph: MigrationGraph): LossyPathReport;
/**
 * Suggest new migrations that would improve graph quality.
 *
 * This function analyzes the graph to identify opportunities for new migrations that would:
 * - Bridge disconnected version components
 * - Eliminate lossy paths by providing direct, lossless alternatives
 * - Shorten long migration paths with more direct routes
 *
 * The suggestions are prioritized by impact, with bridging disconnected components
 * being the most critical.
 *
 * @param graph - The migration graph to analyze
 * @returns Array of migration suggestions ordered by priority
 *
 * @example
 * ```typescript
 * const suggestions = suggestMigrations(graph);
 *
 * for (const suggestion of suggestions) {
 *   console.log(`Suggest migration: ${suggestion.from} -> ${suggestion.to}`);
 *   console.log(`Reason: ${suggestion.reason}`);
 *   console.log(`Current path length: ${suggestion.currentPathLength}`);
 *
 *   if (suggestion.currentLoss) {
 *     console.log(`Would preserve: ${suggestion.currentLoss.join(', ')}`);
 *   }
 * }
 * ```
 */
export declare function suggestMigrations(graph: MigrationGraph): MigrationSuggestion[];
/**
 * Get information about deprecated versions and where they're used in migration paths.
 *
 * This function identifies all versions marked as deprecated in the graph and
 * tracks which migration paths include them. This is useful for:
 * - Planning deprecation timelines
 * - Identifying affected users
 * - Creating migration guides
 *
 * @param graph - The migration graph to analyze
 * @returns Array of deprecated versions with usage information
 *
 * @example
 * ```typescript
 * const deprecated = getDeprecatedVersions(graph);
 *
 * for (const info of deprecated) {
 *   console.log(`\n${info.version} (deprecated)`);
 *   console.log(`  Since: ${info.deprecated.since}`);
 *   console.log(`  Use instead: ${info.deprecated.successor}`);
 *
 *   if (info.deprecated.deadline) {
 *     console.log(`  Deadline: ${info.deprecated.deadline}`);
 *   }
 *
 *   if (info.deprecated.message) {
 *     console.log(`  Note: ${info.deprecated.message}`);
 *   }
 *
 *   console.log(`  Used in ${info.usedInPaths.length} paths`);
 * }
 * ```
 */
export declare function getDeprecatedVersions(graph: MigrationGraph): DeprecatedVersionInfo[];
//# sourceMappingURL=index.d.ts.map