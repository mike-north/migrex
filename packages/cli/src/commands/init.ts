/**
 * Init command - Initialize project structure.
 *
 * @packageDocumentation
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ExitCode } from '../utils/exit-codes.js';
import { logger } from '../utils/logger.js';
import {
  generateConfigTemplate,
  generateGitignoreTemplate,
  generateReadmeTemplate,
} from '../templates/config.template.js';
import { generateSchemaTemplate } from '../templates/schema.template.js';

/**
 * Options for the init command.
 * @public
 */
export interface InitOptions {
  /** Plugin to use (zod or json-schema) */
  plugin?: 'zod' | 'json-schema';
  /** Initial version */
  version?: string;
}

/**
 * Result of the init command.
 * @public
 */
export interface InitResult {
  /** Exit code to return */
  exitCode: ExitCode;
  /** Files that were created */
  filesCreated?: string[];
  /** Error message if init failed */
  error?: string;
}

/**
 * Execute the init command.
 * Creates project structure with config file, example schema, and directories.
 *
 * @param options - Init command options
 * @returns Init result with exit code
 * @public
 */
export async function initCommand(options: InitOptions): Promise<InitResult> {
  const plugin = options.plugin ?? 'zod';
  const initialVersion = options.version ?? '1.0.0';
  const versionIdentifier = initialVersion.replace(/\./g, '_');

  try {
    const cwd = process.cwd();
    const filesCreated: string[] = [];

    // Check if config file already exists
    const configPath = resolve(cwd, 'migrex.config.ts');
    try {
      await access(configPath);
      logger.error(
        'migrex.config.ts already exists. Remove it first to reinitialize.'
      );
      return {
        exitCode: ExitCode.GENERAL_ERROR,
        error: 'Config file already exists',
      };
    } catch {
      // Config doesn't exist, continue
    }

    // Create directories
    await mkdir(resolve(cwd, 'schemas'), { recursive: true });
    await mkdir(resolve(cwd, 'migrations'), { recursive: true });

    // Generate config file
    const configContent = generateConfigTemplate({
      plugin,
      initialVersion,
    });
    await writeFile(configPath, configContent, 'utf-8');
    filesCreated.push('migrex.config.ts');

    // Generate initial schema file
    const schemaPath = resolve(cwd, 'schemas', `v${versionIdentifier}.ts`);
    const schemaContent = generateSchemaTemplate({
      version: initialVersion,
      plugin,
    });
    await writeFile(schemaPath, schemaContent, 'utf-8');
    filesCreated.push(`schemas/v${versionIdentifier}.ts`);

    // Generate .gitignore
    const gitignorePath = resolve(cwd, '.gitignore');
    try {
      await access(gitignorePath);
      // Append to existing .gitignore
      const gitignoreContent = `\n${generateGitignoreTemplate()}`;
      await writeFile(gitignorePath, gitignoreContent, {
        encoding: 'utf-8',
        flag: 'a',
      });
      filesCreated.push('.gitignore (updated)');
    } catch {
      // Create new .gitignore
      const gitignoreContent = generateGitignoreTemplate();
      await writeFile(gitignorePath, gitignoreContent, 'utf-8');
      filesCreated.push('.gitignore');
    }

    // Generate README
    const readmePath = resolve(cwd, 'MIGREX.md');
    const readmeContent = generateReadmeTemplate({ plugin });
    await writeFile(readmePath, readmeContent, 'utf-8');
    filesCreated.push('MIGREX.md');

    // Success
    logger.success('Initialized migrex project');
    logger.log('');
    logger.log('Created files:');
    filesCreated.forEach((file) => {
      logger.log(`  - ${file}`);
    });
    logger.log('');
    logger.log('Next steps:');
    logger.log('  1. Edit schemas/v${versionIdentifier}.ts to define your schema');
    logger.log('  2. Run "migrex check" to validate');
    logger.log('  3. Create new versions with "migrex new schema --version X"');

    return {
      exitCode: ExitCode.SUCCESS,
      filesCreated,
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
