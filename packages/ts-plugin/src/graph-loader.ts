/**
 * Load migration graph from user code.
 * Handles dynamic import and caching of the graph module.
 */

import type { MigrationGraph } from '@migrex/core';
import * as path from 'node:path';

/**
 * Result of attempting to load a migration graph.
 */
export type GraphLoadResult =
  | { success: true; graph: MigrationGraph }
  | { success: false; error: string };

/**
 * Manages loading migration graphs from user-specified paths.
 */
export class GraphLoader {
  private cachedGraph: MigrationGraph | undefined;
  private cachedPath: string | undefined;
  private loadError: string | undefined;

  /**
   * Load migration graph from the specified path.
   *
   * @param graphPath - Path to the migration graph module (relative to project root)
   * @param projectRoot - Absolute path to project root directory
   * @returns Load result with graph or error
   */
  load(
    graphPath: string,
    projectRoot: string
  ): GraphLoadResult {
    // Return cached graph if path hasn't changed
    if (this.cachedGraph && this.cachedPath === graphPath) {
      return { success: true, graph: this.cachedGraph };
    }

    // Return cached error if path hasn't changed
    if (this.loadError && this.cachedPath === graphPath) {
      return { success: false, error: this.loadError };
    }

    try {
      // Resolve absolute path
      const absolutePath = path.resolve(projectRoot, graphPath);

      // Dynamic import of the graph module
      // TypeScript plugins run in Node.js, so we can use require
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const module = (globalThis as typeof globalThis & { require: NodeJS.Require }).require(absolutePath) as unknown;

      // Extract graph from module
      const graph = this.extractGraph(module);

      // Cache successful load
      this.cachedGraph = graph;
      this.cachedPath = graphPath;
      this.loadError = undefined;

      return { success: true, graph };
    } catch (error) {
      // Cache error
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.loadError = `Failed to load migration graph from "${graphPath}": ${errorMessage}`;
      this.cachedPath = graphPath;
      this.cachedGraph = undefined;

      return { success: false, error: this.loadError };
    }
  }

  /**
   * Invalidate cached graph, forcing reload on next access.
   */
  invalidate(): void {
    this.cachedGraph = undefined;
    this.cachedPath = undefined;
    this.loadError = undefined;
  }

  /**
   * Extract MigrationGraph from a module export.
   * Supports both default export and named 'graph' export.
   */
  private extractGraph(module: unknown): MigrationGraph {
    // Check for default export
    if (this.isMigrationGraph(module)) {
      return module;
    }

    // Check for named export 'graph'
    if (
      typeof module === 'object' &&
      module !== null &&
      'default' in module
    ) {
      const defaultExport = (module as { default: unknown }).default;
      if (this.isMigrationGraph(defaultExport)) {
        return defaultExport;
      }
    }

    // Check for named export 'graph'
    if (
      typeof module === 'object' &&
      module !== null &&
      'graph' in module
    ) {
      const graphExport = (module as { graph: unknown }).graph;
      if (this.isMigrationGraph(graphExport)) {
        return graphExport;
      }
    }

    throw new Error(
      'Module does not export a MigrationGraph. Expected default export or named export "graph".'
    );
  }

  /**
   * Type guard to check if an object is a MigrationGraph.
   */
  private isMigrationGraph(obj: unknown): obj is MigrationGraph {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'migrate' in obj &&
      'findPath' in obj &&
      typeof (obj as Record<string, unknown>)['migrate'] === 'function' &&
      typeof (obj as Record<string, unknown>)['findPath'] === 'function'
    );
  }
}
