/**
 * Config template generator - creates a complete config versioning setup.
 *
 * @packageDocumentation
 */

import type { Template, TemplateOptions, GeneratedFile } from './index.js';

/**
 * Generate schemas file with v1.0.0 and v1.1.0 examples.
 */
function generateSchemasFile(options: TemplateOptions): string {
  const { plugin } = options;

  if (plugin === 'zod') {
    return `import { z } from 'zod';
import { fromZod } from '@migrex/zod';

/**
 * Config schema v1.0.0 - Initial version.
 */
export const ConfigV1 = z.object({
  version: z.literal('1.0.0'),
  appName: z.string(),
  port: z.number().int().min(1).max(65535),
});

export type ConfigV1 = z.infer<typeof ConfigV1>;

export const schemaV1 = fromZod('1.0.0', ConfigV1);

/**
 * Config schema v1.1.0 - Added logLevel.
 */
export const ConfigV1_1 = z.object({
  version: z.literal('1.1.0'),
  appName: z.string(),
  port: z.number().int().min(1).max(65535),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ConfigV1_1 = z.infer<typeof ConfigV1_1>;

export const schemaV1_1 = fromZod('1.1.0', ConfigV1_1);
`;
  } else {
    return `import { fromJsonSchema } from '@migrex/json-schema';
import type { JSONSchema7 } from 'json-schema';

/**
 * Config schema v1.0.0 - Initial version.
 */
export const configV1Schema: JSONSchema7 = {
  type: 'object',
  required: ['version', 'appName', 'port'],
  properties: {
    version: {
      type: 'string',
      const: '1.0.0',
    },
    appName: {
      type: 'string',
    },
    port: {
      type: 'number',
      minimum: 1,
      maximum: 65535,
    },
  },
  additionalProperties: false,
};

export const schemaV1 = fromJsonSchema('1.0.0', configV1Schema);

/**
 * Config schema v1.1.0 - Added logLevel.
 */
export const configV1_1Schema: JSONSchema7 = {
  type: 'object',
  required: ['version', 'appName', 'port'],
  properties: {
    version: {
      type: 'string',
      const: '1.1.0',
    },
    appName: {
      type: 'string',
    },
    port: {
      type: 'number',
      minimum: 1,
      maximum: 65535,
    },
    logLevel: {
      type: 'string',
      enum: ['debug', 'info', 'warn', 'error'],
      default: 'info',
    },
  },
  additionalProperties: false,
};

export const schemaV1_1 = fromJsonSchema('1.1.0', configV1_1Schema);
`;
  }
}

/**
 * Generate migrations file with v1.0.0 → v1.1.0 migration.
 */
function generateMigrationsFile(options: TemplateOptions): string {
  const { plugin } = options;

  if (plugin === 'zod') {
    return `import type { ConfigV1, ConfigV1_1 } from './schemas.js';

/**
 * Migration from v1.0.0 to v1.1.0.
 * Adds logLevel field with default value.
 */
export const migrationV1ToV1_1 = {
  fromVersion: '1.0.0',
  toVersion: '1.1.0',
  up: (data: ConfigV1): ConfigV1_1 => {
    return {
      ...data,
      version: '1.1.0',
      logLevel: 'info',
    };
  },
  down: (data: ConfigV1_1): ConfigV1 => {
    const { logLevel: _logLevel, ...rest } = data;
    return {
      ...rest,
      version: '1.0.0',
    };
  },
};
`;
  } else {
    return `/**
 * Migration from v1.0.0 to v1.1.0.
 * Adds logLevel field with default value.
 */
export const migrationV1ToV1_1 = {
  fromVersion: '1.0.0',
  toVersion: '1.1.0',
  up: (data: any) => {
    return {
      ...data,
      version: '1.1.0',
      logLevel: 'info',
    };
  },
  down: (data: any) => {
    const { logLevel, ...rest } = data;
    return {
      ...rest,
      version: '1.0.0',
    };
  },
};
`;
  }
}

/**
 * Generate graph configuration file.
 */
function generateGraphFile(options: TemplateOptions): string {
  const { projectName } = options;

  return `import { createMigrationGraph, semverStrategy } from '@migrex/core';
import { schemaV1, schemaV1_1 } from './schemas.js';
import { migrationV1ToV1_1 } from './migrations.js';

/**
 * Migration graph for ${projectName} config.
 */
export const configGraph = createMigrationGraph({
  id: '${projectName}-config',
  versionStrategy: semverStrategy,
});

// Register schemas
configGraph.registerSchema(schemaV1);
configGraph.registerSchema(schemaV1_1);

// Register migrations
configGraph.registerMigration(migrationV1ToV1_1);
`;
}

/**
 * Generate index file with usage example.
 */
function generateIndexFile(options: TemplateOptions): string {
  const { projectName, plugin } = options;

  if (plugin === 'zod') {
    return `import { configGraph } from './graph.js';
import type { ConfigV1_1 } from './schemas.js';

/**
 * Load config from file and migrate to latest version.
 *
 * @param rawConfig - Raw config data loaded from file
 * @returns Migrated config in latest version
 */
export function loadConfig(rawConfig: unknown): ConfigV1_1 {
  const latestVersion = configGraph.getVersions().slice(-1)[0];

  // Detect version from the config data
  const version = (rawConfig as any)?.version;
  if (!version) {
    throw new Error('Config is missing version field');
  }

  // Migrate to latest version
  const result = configGraph.migrate<ConfigV1_1>(
    rawConfig,
    version,
    latestVersion
  );

  if (!result.success) {
    throw new Error(\`Failed to migrate config: \${result.error?.message ?? 'Unknown error'}\`);
  }

  return result.data;
}

/**
 * Save config by migrating to a specific version.
 *
 * @param config - Config data in latest version
 * @param targetVersion - Version to save as
 * @returns Config data in target version
 */
export function saveConfig(config: ConfigV1_1, targetVersion: string): unknown {
  const latestVersion = configGraph.getVersions().slice(-1)[0];

  const result = configGraph.migrate(
    config,
    latestVersion,
    targetVersion
  );

  if (!result.success) {
    throw new Error(\`Failed to migrate config: \${result.error?.message ?? 'Unknown error'}\`);
  }

  return result.data;
}

// Example usage:
// const rawConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
// const config = loadConfig(rawConfig);
// console.log('Loaded config:', config);
//
// const v1Config = saveConfig(config, '1.0.0');
// fs.writeFileSync('config-v1.json', JSON.stringify(v1Config, null, 2));
`;
  } else {
    return `import { configGraph } from './graph.js';

/**
 * Load config from file and migrate to latest version.
 *
 * @param rawConfig - Raw config data loaded from file
 * @returns Migrated config in latest version
 */
export function loadConfig(rawConfig: unknown): any {
  const latestVersion = configGraph.getVersions().slice(-1)[0];

  // Detect version from the config data
  const version = (rawConfig as any)?.version;
  if (!version) {
    throw new Error('Config is missing version field');
  }

  // Migrate to latest version
  const result = configGraph.migrate(
    rawConfig,
    version,
    latestVersion
  );

  if (!result.success) {
    throw new Error(\`Failed to migrate config: \${result.error?.message ?? 'Unknown error'}\`);
  }

  return result.data;
}

/**
 * Save config by migrating to a specific version.
 *
 * @param config - Config data in latest version
 * @param targetVersion - Version to save as
 * @returns Config data in target version
 */
export function saveConfig(config: any, targetVersion: string): unknown {
  const latestVersion = configGraph.getVersions().slice(-1)[0];

  const result = configGraph.migrate(
    config,
    latestVersion,
    targetVersion
  );

  if (!result.success) {
    throw new Error(\`Failed to migrate config: \${result.error?.message ?? 'Unknown error'}\`);
  }

  return result.data;
}

// Example usage:
// const rawConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
// const config = loadConfig(rawConfig);
// console.log('Loaded config:', config);
//
// const v1Config = saveConfig(config, '1.0.0');
// fs.writeFileSync('config-v1.json', JSON.stringify(v1Config, null, 2));
`;
  }
}

/**
 * Config template - generates a complete config versioning example.
 * @public
 */
export const configTemplate: Template = {
  name: 'config',
  description: 'Versioned configuration file with migration example',

  async generate(options: TemplateOptions): Promise<GeneratedFile[]> {
    return [
      {
        path: 'src/config/schemas.ts',
        content: generateSchemasFile(options),
      },
      {
        path: 'src/config/migrations.ts',
        content: generateMigrationsFile(options),
      },
      {
        path: 'src/config/graph.ts',
        content: generateGraphFile(options),
      },
      {
        path: 'src/config/index.ts',
        content: generateIndexFile(options),
      },
    ];
  },
};
