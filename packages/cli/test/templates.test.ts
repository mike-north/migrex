/**
 * Tests for template generators.
 */

import { describe, it, expect } from 'vitest';
import { generateSchemaTemplate } from '../src/templates/schema.template.js';
import { generateMigrationTemplate } from '../src/templates/migration.template.js';
import {
  generateConfigTemplate,
  generateGitignoreTemplate,
  generateReadmeTemplate,
} from '../src/templates/config.template.js';
import { configTemplate, restApiTemplate } from '../src/templates/index.js';
import type { TemplateOptions } from '../src/templates/index.js';

describe('generateSchemaTemplate', () => {
  it('should generate Zod schema template', () => {
    const template = generateSchemaTemplate({
      version: '1.0.0',
      plugin: 'zod',
    });

    expect(template).toContain("import { z } from 'zod'");
    expect(template).toContain("import { fromZod } from '@migrex/zod'");
    expect(template).toContain("z.literal('1.0.0')");
    expect(template).toContain('export const v1_0_0');
  });

  it('should generate JSON Schema template', () => {
    const template = generateSchemaTemplate({
      version: '1.0.0',
      plugin: 'json-schema',
    });

    expect(template).toContain("import { fromJsonSchema } from '@migrex/json-schema'");
    expect(template).toContain("const: '1.0.0'");
    expect(template).toContain('export const v1_0_0');
  });

  it('should handle version with dots correctly', () => {
    const template = generateSchemaTemplate({
      version: '2.1.5',
      plugin: 'zod',
    });

    expect(template).toContain('export const v2_1_5');
    expect(template).toContain("z.literal('2.1.5')");
  });
});

describe('generateMigrationTemplate', () => {
  it('should generate migration template', () => {
    const template = generateMigrationTemplate({
      from: '1.0.0',
      to: '1.1.0',
      plugin: 'zod',
    });

    expect(template).toContain("from: '1.0.0'");
    expect(template).toContain("to: '1.1.0'");
    expect(template).toContain('import type { Schema as V1_0_0 }');
    expect(template).toContain('import type { Schema as V1_1_0 }');
    expect(template).toContain('up(data)');
    expect(template).toContain('down(data)');
  });

  it('should handle versions with dots correctly', () => {
    const template = generateMigrationTemplate({
      from: '2.0.0',
      to: '3.0.0',
      plugin: 'zod',
    });

    expect(template).toContain('./v2_0_0.js');
    expect(template).toContain('./v3_0_0.js');
  });
});

describe('generateConfigTemplate', () => {
  it('should generate config template with default version', () => {
    const template = generateConfigTemplate({ plugin: 'zod' });

    expect(template).toContain("import { createMigrationGraph, semverStrategy } from '@migrex/core'");
    expect(template).toContain('./schemas/v1_0_0.js');
    expect(template).toContain('graph.registerSchema(v1_0_0)');
  });

  it('should use custom initial version', () => {
    const template = generateConfigTemplate({
      plugin: 'zod',
      initialVersion: '2.5.0',
    });

    expect(template).toContain('./schemas/v2_5_0.js');
    expect(template).toContain('graph.registerSchema(v2_5_0)');
  });
});

describe('generateGitignoreTemplate', () => {
  it('should generate gitignore content', () => {
    const template = generateGitignoreTemplate();

    expect(template).toContain('migrex-types.d.ts');
    expect(template).toContain('node_modules/');
  });
});

describe('generateReadmeTemplate', () => {
  it('should generate README with Zod', () => {
    const template = generateReadmeTemplate({ plugin: 'zod' });

    expect(template).toContain('# Migrex Project');
    expect(template).toContain('Zod');
    expect(template).toContain('migrex check');
    expect(template).toContain('migrex analyze');
  });

  it('should generate README with JSON Schema', () => {
    const template = generateReadmeTemplate({ plugin: 'json-schema' });

    expect(template).toContain('JSON Schema');
  });
});

describe('configTemplate', () => {
  const baseOptions: TemplateOptions = {
    projectName: 'test-project',
    plugin: 'zod',
    outputDir: '/tmp/test',
  };

  describe('Positive tests', () => {
    it('should generate all required files', async () => {
      const files = await configTemplate.generate(baseOptions);

      expect(files).toHaveLength(4);
      expect(files.map((f) => f.path)).toEqual([
        'src/config/schemas.ts',
        'src/config/migrations.ts',
        'src/config/graph.ts',
        'src/config/index.ts',
      ]);
    });

    it('should generate valid Zod schemas', async () => {
      const files = await configTemplate.generate(baseOptions);
      const schemasFile = files.find((f) => f.path === 'src/config/schemas.ts');

      expect(schemasFile).toBeDefined();
      expect(schemasFile?.content).toContain("import { z } from 'zod'");
      expect(schemasFile?.content).toContain("import { fromZod } from '@migrex/zod'");
      expect(schemasFile?.content).toContain('ConfigV1');
      expect(schemasFile?.content).toContain('ConfigV1_1');
      expect(schemasFile?.content).toContain("version: z.literal('1.0.0')");
      expect(schemasFile?.content).toContain("version: z.literal('1.1.0')");
      expect(schemasFile?.content).toContain('logLevel');
    });

    it('should generate valid JSON Schema schemas', async () => {
      const files = await configTemplate.generate({
        ...baseOptions,
        plugin: 'json-schema',
      });
      const schemasFile = files.find((f) => f.path === 'src/config/schemas.ts');

      expect(schemasFile).toBeDefined();
      expect(schemasFile?.content).toContain("import { fromJsonSchema } from '@migrex/json-schema'");
      expect(schemasFile?.content).toContain("const: '1.0.0'");
      expect(schemasFile?.content).toContain("const: '1.1.0'");
    });

    it('should generate migrations file with up and down functions', async () => {
      const files = await configTemplate.generate(baseOptions);
      const migrationsFile = files.find((f) => f.path === 'src/config/migrations.ts');

      expect(migrationsFile).toBeDefined();
      expect(migrationsFile?.content).toContain('migrationV1ToV1_1');
      expect(migrationsFile?.content).toContain("fromVersion: '1.0.0'");
      expect(migrationsFile?.content).toContain("toVersion: '1.1.0'");
      expect(migrationsFile?.content).toContain('up:');
      expect(migrationsFile?.content).toContain('down:');
    });

    it('should generate graph file with correct project name', async () => {
      const files = await configTemplate.generate(baseOptions);
      const graphFile = files.find((f) => f.path === 'src/config/graph.ts');

      expect(graphFile).toBeDefined();
      expect(graphFile?.content).toContain("import { createMigrationGraph, semverStrategy } from '@migrex/core'");
      expect(graphFile?.content).toContain('test-project-config');
      expect(graphFile?.content).toContain('registerSchema(schemaV1)');
      expect(graphFile?.content).toContain('registerSchema(schemaV1_1)');
      expect(graphFile?.content).toContain('registerMigration(migrationV1ToV1_1)');
    });

    it('should generate index file with loadConfig and saveConfig functions', async () => {
      const files = await configTemplate.generate(baseOptions);
      const indexFile = files.find((f) => f.path === 'src/config/index.ts');

      expect(indexFile).toBeDefined();
      expect(indexFile?.content).toContain('export function loadConfig');
      expect(indexFile?.content).toContain('export function saveConfig');
      expect(indexFile?.content).toContain('configGraph.migrate');
    });
  });

  describe('Negative tests', () => {
    it('should handle empty project name', async () => {
      const files = await configTemplate.generate({
        ...baseOptions,
        projectName: '',
      });

      expect(files).toHaveLength(4);
      const graphFile = files.find((f) => f.path === 'src/config/graph.ts');
      expect(graphFile?.content).toContain('-config');
    });
  });

  describe('Edge cases', () => {
    it('should work with special characters in project name', async () => {
      const files = await configTemplate.generate({
        ...baseOptions,
        projectName: 'my-special_project.123',
      });

      const graphFile = files.find((f) => f.path === 'src/config/graph.ts');
      expect(graphFile?.content).toContain('my-special_project.123-config');
    });

    it('should generate consistent file structure regardless of plugin', async () => {
      const zodFiles = await configTemplate.generate({
        ...baseOptions,
        plugin: 'zod',
      });
      const jsonFiles = await configTemplate.generate({
        ...baseOptions,
        plugin: 'json-schema',
      });

      expect(zodFiles.map((f) => f.path)).toEqual(jsonFiles.map((f) => f.path));
    });
  });
});

describe('restApiTemplate', () => {
  const baseOptions: TemplateOptions = {
    projectName: 'test-api',
    plugin: 'zod',
    outputDir: '/tmp/test',
  };

  describe('Positive tests', () => {
    it('should generate all required files', async () => {
      const files = await restApiTemplate.generate(baseOptions);

      expect(files).toHaveLength(5);
      expect(files.map((f) => f.path)).toEqual([
        'src/api/schemas/user-request.ts',
        'src/api/schemas/user-response.ts',
        'src/api/migrations.ts',
        'src/api/endpoints.ts',
        'src/api/index.ts',
      ]);
    });

    it('should generate valid Zod request schemas', async () => {
      const files = await restApiTemplate.generate(baseOptions);
      const requestFile = files.find((f) => f.path === 'src/api/schemas/user-request.ts');

      expect(requestFile).toBeDefined();
      expect(requestFile?.content).toContain("import { z } from 'zod'");
      expect(requestFile?.content).toContain("import { fromZod } from '@migrex/zod'");
      expect(requestFile?.content).toContain('CreateUserRequestV1');
      expect(requestFile?.content).toContain('CreateUserRequestV2');
      expect(requestFile?.content).toContain('name: z.string()');
      expect(requestFile?.content).toContain('firstName: z.string()');
      expect(requestFile?.content).toContain('lastName: z.string()');
    });

    it('should generate valid Zod response schemas with server fields', async () => {
      const files = await restApiTemplate.generate(baseOptions);
      const responseFile = files.find((f) => f.path === 'src/api/schemas/user-response.ts');

      expect(responseFile).toBeDefined();
      expect(responseFile?.content).toContain('UserResponseV1');
      expect(responseFile?.content).toContain('UserResponseV2');
      expect(responseFile?.content).toContain('id: z.string()');
      expect(responseFile?.content).toContain('createdAt: z.string().datetime()');
    });

    it('should generate valid JSON Schema request schemas', async () => {
      const files = await restApiTemplate.generate({
        ...baseOptions,
        plugin: 'json-schema',
      });
      const requestFile = files.find((f) => f.path === 'src/api/schemas/user-request.ts');

      expect(requestFile).toBeDefined();
      expect(requestFile?.content).toContain("import { fromJsonSchema } from '@migrex/json-schema'");
      expect(requestFile?.content).toContain('createUserRequestV1Schema');
      expect(requestFile?.content).toContain('createUserRequestV2Schema');
    });

    it('should generate migrations with request and response migrations', async () => {
      const files = await restApiTemplate.generate(baseOptions);
      const migrationsFile = files.find((f) => f.path === 'src/api/migrations.ts');

      expect(migrationsFile).toBeDefined();
      expect(migrationsFile?.content).toContain('migrationV1ToV2');
      expect(migrationsFile?.content).toContain("fromVersion: '1.0.0'");
      expect(migrationsFile?.content).toContain("toVersion: '2.0.0'");
      expect(migrationsFile?.content).toContain('request:');
      expect(migrationsFile?.content).toContain('response:');
      expect(migrationsFile?.content).toContain('res.id'); // Preserve server fields
      expect(migrationsFile?.content).toContain('res.createdAt'); // Preserve server fields
    });

    it('should generate endpoints file with createVersionedRESTEndpoint', async () => {
      const files = await restApiTemplate.generate(baseOptions);
      const endpointsFile = files.find((f) => f.path === 'src/api/endpoints.ts');

      expect(endpointsFile).toBeDefined();
      expect(endpointsFile?.content).toContain("import { createVersionedRESTEndpoint, extractVersionFromHeader } from '@migrex/rest'");
      expect(endpointsFile?.content).toContain('test-api-users');
      expect(endpointsFile?.content).toContain('extractVersionFromHeader');
      expect(endpointsFile?.content).toContain("defaultVersion: '1.0.0'");
    });

    it('should generate index file with example handler', async () => {
      const files = await restApiTemplate.generate(baseOptions);
      const indexFile = files.find((f) => f.path === 'src/api/index.ts');

      expect(indexFile).toBeDefined();
      expect(indexFile?.content).toContain('export function handleCreateUser');
      expect(indexFile?.content).toContain('userEndpoint.parseRequest');
      expect(indexFile?.content).toContain('userEndpoint.formatResponse');
      expect(indexFile?.content).toContain('Example usage');
    });
  });

  describe('Negative tests', () => {
    it('should handle empty project name', async () => {
      const files = await restApiTemplate.generate({
        ...baseOptions,
        projectName: '',
      });

      expect(files).toHaveLength(5);
      const endpointsFile = files.find((f) => f.path === 'src/api/endpoints.ts');
      expect(endpointsFile?.content).toContain('-users');
    });
  });

  describe('Edge cases', () => {
    it('should generate consistent file structure regardless of plugin', async () => {
      const zodFiles = await restApiTemplate.generate({
        ...baseOptions,
        plugin: 'zod',
      });
      const jsonFiles = await restApiTemplate.generate({
        ...baseOptions,
        plugin: 'json-schema',
      });

      expect(zodFiles.map((f) => f.path)).toEqual(jsonFiles.map((f) => f.path));
    });

    it('should include RESTEndpointMigration type import', async () => {
      const files = await restApiTemplate.generate(baseOptions);
      const migrationsFile = files.find((f) => f.path === 'src/api/migrations.ts');

      expect(migrationsFile?.content).toContain("import type { RESTEndpointMigration } from '@migrex/rest'");
    });

    it('should preserve server-generated fields in migrations', async () => {
      const files = await restApiTemplate.generate(baseOptions);
      const migrationsFile = files.find((f) => f.path === 'src/api/migrations.ts');

      // Check that server fields are preserved in both up and down
      expect(migrationsFile?.content).toContain('id: res.id');
      expect(migrationsFile?.content).toContain('createdAt: res.createdAt');
    });

    it('should work with special characters in project name', async () => {
      const files = await restApiTemplate.generate({
        ...baseOptions,
        projectName: 'api-v2_beta.test',
      });

      const endpointsFile = files.find((f) => f.path === 'src/api/endpoints.ts');
      expect(endpointsFile?.content).toContain('api-v2_beta.test-users');
    });
  });
});
