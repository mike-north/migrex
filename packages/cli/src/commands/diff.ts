/**
 * Diff command - Show diff between two versions.
 *
 * @packageDocumentation
 */

import { loadGraph } from '../loaders/graph-loader.js';
import { ExitCode } from '../utils/exit-codes.js';
import { logger } from '../utils/logger.js';

/**
 * Options for the diff command.
 * @public
 */
export interface DiffOptions {
  /** Source version */
  from: string;
  /** Target version */
  to: string;
  /** Path to migration graph or config file */
  graph?: string;
  /** Output format (json or text) */
  format?: 'json' | 'text';
}

/**
 * Result of the diff command.
 * @public
 */
export interface DiffResult {
  /** Exit code to return */
  exitCode: ExitCode;
  /** Error message if diff failed */
  error?: string;
}

/**
 * Execute the diff command.
 * Shows the differences between two schema versions.
 *
 * Note: This is a placeholder implementation. Full schema diff
 * functionality would require schema introspection APIs from
 * `@migrex/core` that are not yet available.
 *
 * @param options - Diff command options
 * @returns Diff result with exit code
 * @public
 */
export async function diffCommand(options: DiffOptions): Promise<DiffResult> {
  const format = options.format ?? 'text';

  try {
    // Load the graph
    const loadResult = await loadGraph(options.graph);

    if (!loadResult) {
      const message = options.graph
        ? `Graph file not found: ${options.graph}`
        : 'No migrex config file found. Run "migrex init" to create one.';

      if (format === 'json') {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        logger.error(message);
      }

      return {
        exitCode: ExitCode.FILE_NOT_FOUND,
        error: message,
      };
    }

    // Check if versions exist
    const hasPath = loadResult.graph.hasPath(options.from, options.to);

    if (!hasPath) {
      const message = `No migration path from ${options.from} to ${options.to}`;

      if (format === 'json') {
        console.log(
          JSON.stringify(
            {
              error: message,
              from: options.from,
              to: options.to,
            },
            null,
            2
          )
        );
      } else {
        logger.error(message);
      }

      return {
        exitCode: ExitCode.GENERAL_ERROR,
        error: message,
      };
    }

    // Get the migration path to show what migrations are involved
    const path = loadResult.graph.getPath(options.from, options.to);

    // Output placeholder diff information
    if (format === 'json') {
      const result = {
        from: options.from,
        to: options.to,
        path,
        note: 'Schema diff functionality requires schema introspection APIs that are not yet implemented in @migrex/core',
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      logger.log(`Schema diff: ${options.from} → ${options.to}`);
      logger.log('');
      logger.log('Migration path:');
      path.steps.forEach((step, index) => {
        const arrow = step.direction === 'up' ? '→' : '←';
        logger.log(`  ${index + 1}. ${step.fromVersion} ${arrow} ${step.toVersion}`);
      });
      logger.log('');
      logger.warn(
        'Full schema diff functionality requires schema introspection APIs'
      );
      logger.log(
        'that are not yet implemented in @migrex/core. Use "migrex path"'
      );
      logger.log('to see the migration path between versions.');
    }

    return { exitCode: ExitCode.SUCCESS };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (format === 'json') {
      console.log(JSON.stringify({ error: message }, null, 2));
    } else {
      logger.error(message);
    }

    return {
      exitCode: ExitCode.GENERAL_ERROR,
      error: message,
    };
  }
}
