/**
 * Graph loading utilities for CLI commands.
 * Handles loading MigrationGraph instances from config files.
 *
 * @packageDocumentation
 */
import type { MigrationGraph } from '@migrex/core';
/**
 * Result of loading a migration graph.
 * @public
 */
export interface LoadResult {
    /** The loaded migration graph */
    graph: MigrationGraph;
    /** Absolute path to the config file that was loaded */
    path: string;
}
/**
 * Load a migration graph from a config file or explicit path.
 *
 * @param graphPath - Optional explicit path to graph file or config file.
 *                    If not provided, searches for standard config files.
 * @returns Load result with graph and path, or undefined if not found.
 * @throws {Error} If config file exists but cannot be loaded or has invalid format.
 * @public
 */
export declare function loadGraph(graphPath?: string): Promise<LoadResult | undefined>;
//# sourceMappingURL=graph-loader.d.ts.map