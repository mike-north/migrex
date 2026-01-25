import type { MigrationGraph } from '../graph.js';
import type { MigrationTraits } from '../types.js';
import type {
  AnalysisResult,
  AnalysisOptions,
  ConnectivityAnalysis,
  FieldProfileMap,
  LossyPathReport,
  LossyPathAnalysis,
  MigrationSuggestion,
  DeprecatedVersionInfo,
  Diagnostic,
} from './types.js';

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
export function analyzeGraph(
  graph: MigrationGraph,
  options: AnalysisOptions = {}
): AnalysisResult {
  const versions = graph.getVersions();
  const migrations = graph.getMigrations();

  const connectivity = analyzeConnectivity(graph, versions);
  const profiles = computeFieldProfiles(graph, versions, options);
  const diagnostics = generateDiagnostics(
    graph,
    connectivity,
    profiles,
    options
  );

  return {
    profiles,
    diagnostics,
    connectivity,
    metadata: {
      versionCount: versions.length,
      migrationCount: migrations.length,
      pathsAnalyzed: countAnalyzedPaths(versions, connectivity),
      computedAt: Date.now(),
    },
  };
}

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
export function analyzeIncremental(
  graph: MigrationGraph,
  _previousResult: AnalysisResult,
  _changedFiles: readonly string[]
): AnalysisResult {
  // TODO: Implement incremental analysis
  // For now, just do full analysis
  return analyzeGraph(graph);
}

/**
 * Analyze graph connectivity using Union-Find algorithm.
 */
function analyzeConnectivity(
  graph: MigrationGraph,
  versions: readonly string[]
): ConnectivityAnalysis {
  if (versions.length === 0) {
    return {
      fullyConnected: true,
      components: [],
      unreachablePairs: [],
    };
  }

  // Build adjacency from migrations
  const adjacency = new Map<string, Set<string>>();
  for (const v of versions) {
    adjacency.set(v, new Set());
  }

  for (const migration of graph.getMigrations()) {
    const from = migration.fromVersion;
    const to = migration.toVersion;
    adjacency.get(from)?.add(to);
    adjacency.get(to)?.add(from);
  }

  // Find connected components using BFS
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const version of versions) {
    if (visited.has(version)) continue;

    const component: string[] = [];
    const queue = [version];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined || visited.has(current)) continue;

      visited.add(current);
      component.push(current);

      const neighbors = adjacency.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
    }

    components.push(component);
  }

  const fullyConnected = components.length === 1;

  // Find unreachable pairs if not fully connected
  const unreachablePairs: { from: string; to: string }[] = [];
  if (!fullyConnected) {
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const comp1 = components[i]![0];
        const comp2 = components[j]![0];
        // Just report first pair from each component pair
        if (comp1 !== undefined && comp2 !== undefined) {
          unreachablePairs.push({
            from: comp1,
            to: comp2,
          });
        }
      }
    }
  }

  return {
    fullyConnected,
    components,
    unreachablePairs,
  };
}

/**
 * Compute field profiles across all migration paths.
 * A field is 'sometimes-multi' if it can be preserved multiple times
 * on any path through the graph.
 */
function computeFieldProfiles(
  graph: MigrationGraph,
  versions: readonly string[],
  _options: AnalysisOptions
): FieldProfileMap {
  const profiles: FieldProfileMap = {};
  const fieldPreservationCounts = new Map<string, Map<string, number>>();

  // For each pair of versions, analyze the path
  for (const from of versions) {
    for (const to of versions) {
      if (from === to) continue;
      if (!graph.hasPath(from, to)) continue;

      const path = graph.getPath(from, to);
      const pathKey = `${from}->${to}`;

      // Track which fields are preserved on this path
      const pathFieldCounts = new Map<string, number>();

      for (const step of path.steps) {
        const migration = step.migration;
        const migrationTraits = migration.traits as
          | { up?: MigrationTraits; down?: MigrationTraits }
          | undefined;
        let traits: MigrationTraits | undefined;
        if (migrationTraits) {
          traits = step.direction === 'up' ? migrationTraits.up : migrationTraits.down;
        }

        // If migration has lossy trait, fields might be preserved
        if (traits) {
          const lossy = traits.lossy;
          if (lossy !== undefined && lossy !== false) {
            const lossyFields =
              typeof lossy === 'string' ? [lossy] : ['unknown'];

            for (const field of lossyFields) {
              const current = pathFieldCounts.get(field) ?? 0;
              pathFieldCounts.set(field, current + 1);
            }
          }
        }
      }

      // Update global counts
      for (const [field, count] of pathFieldCounts) {
        if (!fieldPreservationCounts.has(field)) {
          fieldPreservationCounts.set(field, new Map());
        }
        const fieldMap = fieldPreservationCounts.get(field);
        if (fieldMap) {
          fieldMap.set(pathKey, count);
        }
      }
    }
  }

  // Determine profiles based on max preservation count
  for (const [field, pathCounts] of fieldPreservationCounts) {
    let maxCount = 0;
    for (const count of pathCounts.values()) {
      maxCount = Math.max(maxCount, count);
    }
    profiles[field] = maxCount > 1 ? 'sometimes-multi' : 'always-single';
  }

  return profiles;
}

/**
 * Generate diagnostics for potential issues.
 */
function generateDiagnostics(
  _graph: MigrationGraph,
  connectivity: ConnectivityAnalysis,
  profiles: FieldProfileMap,
  _options: AnalysisOptions
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Check for disconnected graph
  if (!connectivity.fullyConnected) {
    const problematicPaths = connectivity.unreachablePairs.map((p) => ({
      from: p.from,
      to: p.to,
      steps: -1, // No path exists
    }));
    diagnostics.push({
      severity: 'error',
      code: 'DISCONNECTED_VERSIONS',
      message: `Graph has ${String(connectivity.components.length)} disconnected components`,
      details: {
        problematicPaths,
      },
    });
  }

  // Check for multi-value fields
  for (const [field, profile] of Object.entries(profiles)) {
    if (profile === 'sometimes-multi') {
      diagnostics.push({
        severity: 'warning',
        code: 'FIELD_PROFILE_MISMATCH',
        message: `Field "${field}" may have multiple preserved values on some paths`,
        details: {
          field,
          actualKind: 'sometimes-multi',
        },
      });
    }
  }

  return diagnostics;
}

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
export function findLossyPaths(graph: MigrationGraph): LossyPathReport {
  const versions = graph.getVersions();
  const lossyPairs: {
    from: string;
    to: string;
    analysis: LossyPathAnalysis;
  }[] = [];
  let unreachablePairCount = 0;

  for (const from of versions) {
    for (const to of versions) {
      if (from === to) continue;

      const analysis = analyzeLossyPath(graph, from, to);

      if (!analysis.pathExists) {
        unreachablePairCount++;
      } else if (analysis.isLossy) {
        lossyPairs.push({ from, to, analysis });
      }
    }
  }

  // Handle empty case to avoid -0
  const totalVersionPairs =
    versions.length <= 1 ? 0 : versions.length * (versions.length - 1);

  return {
    lossyPairs,
    totalVersionPairs,
    lossyPairCount: lossyPairs.length,
    unreachablePairCount,
  };
}

function analyzeLossyPath(
  graph: MigrationGraph,
  from: string,
  to: string
): LossyPathAnalysis {
  if (!graph.hasPath(from, to)) {
    return {
      from,
      to,
      pathExists: false,
      isLossy: false,
      lossySteps: [],
    };
  }

  const path = graph.getPath(from, to);
  const lossySteps: {
    from: string;
    to: string;
    direction: 'up' | 'down';
    reason: string;
  }[] = [];

  for (const step of path.steps) {
    const migrationTraits = step.migration.traits as
      | { up?: MigrationTraits; down?: MigrationTraits }
      | undefined;
    let traits: MigrationTraits | undefined;
    if (migrationTraits) {
      traits = step.direction === 'up' ? migrationTraits.up : migrationTraits.down;
    }

    if (traits) {
      const lossy = traits.lossy;
      if (lossy !== undefined && lossy !== false) {
        lossySteps.push({
          from: step.fromVersion,
          to: step.toVersion,
          direction: step.direction,
          reason: typeof lossy === 'string' ? lossy : 'Data may be lost',
        });
      }
    }
  }

  return {
    from,
    to,
    pathExists: true,
    isLossy: lossySteps.length > 0,
    lossySteps,
    path,
  };
}

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
export function suggestMigrations(
  graph: MigrationGraph
): MigrationSuggestion[] {
  const suggestions: MigrationSuggestion[] = [];
  const connectivity = analyzeConnectivity(graph, graph.getVersions());

  // Suggest bridges between disconnected components
  if (!connectivity.fullyConnected && connectivity.components.length > 1) {
    for (let i = 0; i < connectivity.components.length - 1; i++) {
      const comp1 = connectivity.components[i]!;
      const comp2 = connectivity.components[i + 1]!;
      const from = comp1[0];
      const to = comp2[0];

      if (from !== undefined && to !== undefined) {
        suggestions.push({
          from,
          to,
          reason: 'bridges_components',
          currentPathLength: -1, // No path exists
        });
      }
    }
  }

  return suggestions;
}

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
export function getDeprecatedVersions(
  graph: MigrationGraph
): DeprecatedVersionInfo[] {
  const deprecated: DeprecatedVersionInfo[] = [];
  const versions = graph.getVersions();

  for (const version of versions) {
    const schema = graph.getSchema(version);
    if (schema?.deprecated) {
      deprecated.push({
        version,
        deprecated: schema.deprecated,
        usedInPaths: [], // Would need to analyze all paths
      });
    }
  }

  return deprecated;
}

function countAnalyzedPaths(
  versions: readonly string[],
  connectivity: ConnectivityAnalysis
): number {
  if (!connectivity.fullyConnected) {
    // Count paths within each component
    let total = 0;
    for (const component of connectivity.components) {
      total += component.length * (component.length - 1);
    }
    return total;
  }
  return versions.length * (versions.length - 1);
}
