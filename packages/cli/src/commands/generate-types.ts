/**
 * Generate-types command - Generate TypeScript types from analysis.
 *
 * @packageDocumentation
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { analyzeGraph } from '@migrex/core';
import type { FieldProfileMap } from '@migrex/core';
import { loadGraph } from '../loaders/graph-loader.js';
import { ExitCode } from '../utils/exit-codes.js';
import { logger } from '../utils/logger.js';

/**
 * Options for the generate-types command.
 * @public
 */
export interface GenerateTypesOptions {
  /** Path to migration graph or config file */
  graph?: string;
  /** Output path for generated types */
  output?: string;
}

/**
 * Result of the generate-types command.
 * @public
 */
export interface GenerateTypesResult {
  /** Exit code to return */
  exitCode: ExitCode;
  /** Path where types were written */
  outputPath?: string;
  /** Error message if generation failed */
  error?: string;
}

/**
 * Execute the generate-types command.
 * Analyzes the graph and generates TypeScript type definitions for field profiles.
 *
 * @param options - Generate-types command options
 * @returns Generate-types result with exit code
 * @public
 */
export async function generateTypesCommand(
  options: GenerateTypesOptions
): Promise<GenerateTypesResult> {
  try {
    // Load the graph
    const loadResult = await loadGraph(options.graph);

    if (!loadResult) {
      const message = options.graph
        ? `Graph file not found: ${options.graph}`
        : 'No migrex config file found. Run "migrex init" to create one.';

      logger.error(message);

      return {
        exitCode: ExitCode.FILE_NOT_FOUND,
        error: message,
      };
    }

    // Analyze the graph to get field profiles
    const analysis = analyzeGraph(loadResult.graph);

    // Generate TypeScript types
    const typeDefinitions = generateTypeDefinitions(analysis.profiles);

    // Determine output path
    const outputPath = options.output
      ? resolve(process.cwd(), options.output)
      : resolve(process.cwd(), 'migrex-types.d.ts');

    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });

    // Write the types file
    await writeFile(outputPath, typeDefinitions, 'utf-8');

    logger.success(`Generated types at ${outputPath}`);
    logger.log(
      `  ${Object.keys(analysis.profiles).length} field profile${Object.keys(analysis.profiles).length === 1 ? '' : 's'}`
    );

    return {
      exitCode: ExitCode.SUCCESS,
      outputPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);

    return {
      exitCode: ExitCode.GENERAL_ERROR,
      error: message,
    };
  }
}

/**
 * Generate TypeScript type definitions from field profiles.
 */
function generateTypeDefinitions(profiles: FieldProfileMap): string {
  const lines: string[] = [];

  lines.push('/**');
  lines.push(' * Generated field profile types from migrex analysis.');
  lines.push(' * DO NOT EDIT - This file is auto-generated.');
  lines.push(' *');
  lines.push(' * Run `migrex generate-types` to regenerate.');
  lines.push(' */');
  lines.push('');

  lines.push('/**');
  lines.push(' * Field preservation profile.');
  lines.push(' *');
  lines.push(
    ' * - `always-single`: Field is preserved at most once on any path.'
  );
  lines.push(
    ' * - `sometimes-multi`: Field can be preserved multiple times on some paths.'
  );
  lines.push(' */');
  lines.push("export type FieldProfile = 'always-single' | 'sometimes-multi';");
  lines.push('');

  lines.push('/**');
  lines.push(' * Field profile map for all preserved fields.');
  lines.push(' */');
  lines.push('export interface FieldProfiles {');

  const entries = Object.entries(profiles).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  if (entries.length === 0) {
    lines.push('  // No preserved fields');
  } else {
    entries.forEach(([field, profile]) => {
      lines.push(`  /** ${profile} */`);
      lines.push(`  '${field}': '${profile}';`);
    });
  }

  lines.push('}');
  lines.push('');

  lines.push('/**');
  lines.push(' * Type-safe field name union.');
  lines.push(' */');
  if (entries.length === 0) {
    lines.push('export type FieldName = never;');
  } else {
    lines.push(
      `export type FieldName = ${entries.map(([field]) => `'${field}'`).join(' | ')};`
    );
  }
  lines.push('');

  lines.push('/**');
  lines.push(' * Fields that are always single-valued.');
  lines.push(' */');
  const singleFields = entries.filter(([, p]) => p === 'always-single');
  if (singleFields.length === 0) {
    lines.push('export type AlwaysSingleField = never;');
  } else {
    lines.push(
      `export type AlwaysSingleField = ${singleFields.map(([field]) => `'${field}'`).join(' | ')};`
    );
  }
  lines.push('');

  lines.push('/**');
  lines.push(' * Fields that can be multi-valued on some paths.');
  lines.push(' */');
  const multiFields = entries.filter(([, p]) => p === 'sometimes-multi');
  if (multiFields.length === 0) {
    lines.push('export type SometimesMultiField = never;');
  } else {
    lines.push(
      `export type SometimesMultiField = ${multiFields.map(([field]) => `'${field}'`).join(' | ')};`
    );
  }
  lines.push('');

  return lines.join('\n');
}
