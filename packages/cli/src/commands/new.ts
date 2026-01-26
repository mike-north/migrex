/**
 * New command - Create new schema or migration files.
 *
 * @packageDocumentation
 */

import { writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ExitCode } from '../utils/exit-codes.js';
import { logger } from '../utils/logger.js';
import { generateSchemaTemplate } from '../templates/schema.template.js';
import { generateMigrationTemplate } from '../templates/migration.template.js';

/**
 * Options for creating a new schema.
 * @public
 */
export interface NewSchemaOptions {
  /** Schema version */
  version: string;
  /** Plugin to use (zod or json-schema) */
  plugin?: 'zod' | 'json-schema';
}

/**
 * Options for creating a new migration.
 * @public
 */
export interface NewMigrationOptions {
  /** Source version */
  from: string;
  /** Target version */
  to: string;
  /** Plugin to use (zod or json-schema) */
  plugin?: 'zod' | 'json-schema';
}

/**
 * Result of the new command.
 * @public
 */
export interface NewResult {
  /** Exit code to return */
  exitCode: ExitCode;
  /** File that was created */
  fileCreated?: string;
  /** Error message if new failed */
  error?: string;
}

/**
 * Execute the new schema command.
 * Creates a new schema file from template.
 *
 * @param options - New schema options
 * @returns New result with exit code
 * @public
 */
export async function newSchemaCommand(
  options: NewSchemaOptions
): Promise<NewResult> {
  const plugin = options.plugin ?? 'zod';
  const versionIdentifier = options.version.replace(/\./g, '_');

  try {
    const cwd = process.cwd();
    const filePath = resolve(cwd, 'schemas', `v${versionIdentifier}.ts`);

    // Check if file already exists
    try {
      await access(filePath);
      logger.error(
        `Schema file already exists: schemas/v${versionIdentifier}.ts`
      );
      return {
        exitCode: ExitCode.GENERAL_ERROR,
        error: 'Schema file already exists',
      };
    } catch {
      // File doesn't exist, continue
    }

    // Generate schema content
    const content = generateSchemaTemplate({
      version: options.version,
      plugin,
    });

    // Write file
    await writeFile(filePath, content, 'utf-8');

    logger.success(`Created schema file: schemas/v${versionIdentifier}.ts`);
    logger.log('');
    logger.log('Next steps:');
    logger.log('  1. Edit the schema file to define your fields');
    logger.log('  2. Register the schema in migrex.config.ts');
    logger.log('  3. Run "migrex check" to validate');

    return {
      exitCode: ExitCode.SUCCESS,
      fileCreated: `schemas/v${versionIdentifier}.ts`,
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
 * Execute the new migration command.
 * Creates a new migration file from template.
 *
 * @param options - New migration options
 * @returns New result with exit code
 * @public
 */
export async function newMigrationCommand(
  options: NewMigrationOptions
): Promise<NewResult> {
  const plugin = options.plugin ?? 'zod';
  const fromIdentifier = options.from.replace(/\./g, '_');
  const toIdentifier = options.to.replace(/\./g, '_');
  const fileName = `v${fromIdentifier}_to_v${toIdentifier}.ts`;

  try {
    const cwd = process.cwd();
    const filePath = resolve(cwd, 'migrations', fileName);

    // Check if file already exists
    try {
      await access(filePath);
      logger.error(`Migration file already exists: migrations/${fileName}`);
      return {
        exitCode: ExitCode.GENERAL_ERROR,
        error: 'Migration file already exists',
      };
    } catch {
      // File doesn't exist, continue
    }

    // Generate migration content
    const content = generateMigrationTemplate({
      from: options.from,
      to: options.to,
      plugin,
    });

    // Write file
    await writeFile(filePath, content, 'utf-8');

    logger.success(`Created migration file: migrations/${fileName}`);
    logger.log('');
    logger.log('Next steps:');
    logger.log('  1. Edit the migration file to implement up() and down()');
    logger.log('  2. Register the migration in migrex.config.ts');
    logger.log('  3. Run "migrex check" to validate');

    return {
      exitCode: ExitCode.SUCCESS,
      fileCreated: `migrations/${fileName}`,
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
