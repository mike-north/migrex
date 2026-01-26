/**
 * Check command - CI health check with exit codes.
 *
 * @packageDocumentation
 */

import { analyzeGraph } from '@migrex/core';
import type { AnalysisResult } from '@migrex/core';
import { loadGraph } from '../loaders/graph-loader.js';
import { ExitCode } from '../utils/exit-codes.js';
import { logger } from '../utils/logger.js';

/**
 * Options for the check command.
 * @public
 */
export interface CheckOptions {
  /** Path to migration graph or config file */
  graph?: string;
  /** Treat warnings as errors */
  strict?: boolean;
  /** Output as JSON instead of text */
  json?: boolean;
}

/**
 * Result of the check command.
 * @public
 */
export interface CheckResult {
  /** Exit code to return */
  exitCode: ExitCode;
  /** Analysis result */
  analysis?: AnalysisResult;
  /** Error message if check failed */
  error?: string;
}

/**
 * Execute the check command.
 * Validates the migration graph and returns appropriate exit codes for CI.
 *
 * @param options - Check command options
 * @returns Check result with exit code
 * @public
 */
export async function checkCommand(
  options: CheckOptions
): Promise<CheckResult> {
  try {
    // Load the graph
    const loadResult = await loadGraph(options.graph);

    if (!loadResult) {
      const message = options.graph
        ? `Graph file not found: ${options.graph}`
        : 'No migrex config file found. Run "migrex init" to create one.';

      if (!options.json) {
        logger.error(message);
      }

      return {
        exitCode: ExitCode.FILE_NOT_FOUND,
        error: message,
      };
    }

    // Analyze the graph
    const analysis = analyzeGraph(loadResult.graph);

    // Determine if check passes
    const errors = analysis.diagnostics.filter((d) => d.severity === 'error');
    const warnings = analysis.diagnostics.filter(
      (d) => d.severity === 'warning'
    );

    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;
    const fails = hasErrors || (options.strict && hasWarnings);

    // Output results
    if (options.json) {
      const result = {
        success: !fails,
        errors: errors.length,
        warnings: warnings.length,
        analysis,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (!fails) {
        logger.success(
          `Graph check passed (${analysis.metadata.versionCount} versions, ${analysis.metadata.migrationCount} migrations)`
        );

        if (hasWarnings) {
          logger.warn(`Found ${warnings.length} warning(s)`);
          warnings.forEach((w) => {
            logger.log(`  - ${w.code}: ${w.message}`);
          });
        }
      } else {
        logger.error('Graph check failed');

        if (hasErrors) {
          logger.log(`\nErrors (${errors.length}):`);
          errors.forEach((e) => {
            logger.log(`  - ${e.code}: ${e.message}`);
          });
        }

        if (options.strict && hasWarnings) {
          logger.log(`\nWarnings (${warnings.length}) - treated as errors in strict mode:`);
          warnings.forEach((w) => {
            logger.log(`  - ${w.code}: ${w.message}`);
          });
        }

        logger.log('\nRun "migrex analyze" for detailed information.');
      }
    }

    return {
      exitCode: fails ? ExitCode.VALIDATION_ERROR : ExitCode.SUCCESS,
      analysis,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: false,
            error: message,
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
}
