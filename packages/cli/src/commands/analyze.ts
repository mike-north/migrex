/**
 * Analyze command - Full analysis report.
 *
 * @packageDocumentation
 */

import {
  analyzeGraph,
  findLossyPaths,
  suggestMigrations,
  getDeprecatedVersions,
} from '@migrex/core';
import { loadGraph } from '../loaders/graph-loader.js';
import { ExitCode } from '../utils/exit-codes.js';
import { logger } from '../utils/logger.js';
import {
  formatAnalysisText,
  formatLossyPathsText,
  formatSuggestionsText,
  formatDeprecatedVersionsText,
} from '../formatters/text.js';
import {
  formatAnalysisJson,
  formatLossyPathsJson,
  formatSuggestionsJson,
  formatDeprecatedVersionsJson,
} from '../formatters/json.js';

/**
 * Options for the analyze command.
 * @public
 */
export interface AnalyzeOptions {
  /** Path to migration graph or config file */
  graph?: string;
  /** Output format (json or text) */
  format?: 'json' | 'text';
}

/**
 * Result of the analyze command.
 * @public
 */
export interface AnalyzeResult {
  /** Exit code to return */
  exitCode: ExitCode;
  /** Error message if analyze failed */
  error?: string;
}

/**
 * Execute the analyze command.
 * Performs comprehensive analysis and displays results.
 *
 * @param options - Analyze command options
 * @returns Analyze result with exit code
 * @public
 */
export async function analyzeCommand(
  options: AnalyzeOptions
): Promise<AnalyzeResult> {
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

    // Perform analysis
    const analysis = analyzeGraph(loadResult.graph);
    const lossyPaths = findLossyPaths(loadResult.graph);
    const suggestions = suggestMigrations(loadResult.graph);
    const deprecatedVersions = getDeprecatedVersions(loadResult.graph);

    // Output results
    if (format === 'json') {
      const result = {
        analysis,
        lossyPaths,
        suggestions,
        deprecatedVersions,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Text output
      console.log(formatAnalysisText(analysis));
      console.log('');
      console.log(formatLossyPathsText(lossyPaths));
      console.log('');
      console.log(formatSuggestionsText(suggestions));
      console.log('');
      console.log(formatDeprecatedVersionsText(deprecatedVersions));
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
