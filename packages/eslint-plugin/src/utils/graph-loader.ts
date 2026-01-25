/**
 * Utilities for loading and analyzing migration graphs.
 * @packageDocumentation
 */

import type {
  AnalysisResult,
  FieldProfile,
  MigrationGraph,
} from '@migrex/core';
import {
  analyzeGraph,
  findLossyPaths,
  getDeprecatedVersions,
  suggestMigrations,
} from '@migrex/core';

/**
 * Cache for analyzed graphs to avoid re-analyzing on every lint pass.
 */
const analysisCache = new Map<MigrationGraph, AnalysisResult>();

/**
 * Get or compute analysis for a migration graph.
 */
export function getGraphAnalysis(
  graph: MigrationGraph
): AnalysisResult | undefined {
  // Check cache first
  if (analysisCache.has(graph)) {
    return analysisCache.get(graph);
  }

  // Analyze the graph
  try {
    const analysis = analyzeGraph(graph);
    analysisCache.set(graph, analysis);
    return analysis;
  } catch {
    // If analysis fails, return undefined
    // The graph-health rule will handle reporting this
    return undefined;
  }
}

/**
 * Get the field profile for a specific field.
 */
export function getFieldProfile(
  analysis: AnalysisResult,
  fieldName: string
): FieldProfile | undefined {
  return analysis.profiles[fieldName];
}

/**
 * Clear the analysis cache.
 * Should be called when the graph changes.
 * @internal Kept for testing and manual cache invalidation
 */
export function _clearAnalysisCache(): void {
  analysisCache.clear();
}

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
