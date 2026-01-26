/**
 * Path command - Show migration path between versions.
 *
 * @packageDocumentation
 */

import { NoPathError } from '@migrex/core';
import { loadGraph } from '../loaders/graph-loader.js';
import { ExitCode } from '../utils/exit-codes.js';
import { logger } from '../utils/logger.js';
import { formatMigrationPath } from '../formatters/text.js';
import { formatMigrationPathJson } from '../formatters/json.js';

/**
 * Options for the path command.
 * @public
 */
export interface PathOptions {
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
 * Result of the path command.
 * @public
 */
export interface PathResult {
  /** Exit code to return */
  exitCode: ExitCode;
  /** Error message if path failed */
  error?: string;
}

/**
 * Execute the path command.
 * Shows the migration path between two versions.
 *
 * @param options - Path command options
 * @returns Path result with exit code
 * @public
 */
export async function pathCommand(options: PathOptions): Promise<PathResult> {
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

    // Get the path
    const path = loadResult.graph.getPath(options.from, options.to);

    // Output results
    if (format === 'json') {
      console.log(formatMigrationPathJson(path));
    } else {
      console.log(formatMigrationPath(path));
    }

    return { exitCode: ExitCode.SUCCESS };
  } catch (error) {
    if (error instanceof NoPathError) {
      const message = `No migration path from ${options.from} to ${options.to}`;

      if (format === 'json') {
        console.log(
          JSON.stringify(
            {
              error: message,
              from: options.from,
              to: options.to,
              pathExists: false,
            },
            null,
            2
          )
        );
      } else {
        logger.error(message);
        logger.log('');
        logger.log(
          'Run "migrex analyze" to see suggestions for new migrations.'
        );
      }

      return {
        exitCode: ExitCode.GENERAL_ERROR,
        error: message,
      };
    }

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
