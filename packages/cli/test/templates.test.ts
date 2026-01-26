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
