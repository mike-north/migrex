import { describe, it, expect } from 'vitest';
import { extendJsonSchema, omitFromJsonSchema } from '../src/extend.js';
import type { JSONSchema7 } from 'json-schema';

describe('extendJsonSchema', () => {
  const baseSchema: JSONSchema7 = {
    type: 'object',
    properties: {
      version: { const: '1.0.0' },
      name: { type: 'string' },
      port: { type: 'integer', minimum: 1, maximum: 65535 },
    },
    required: ['version', 'name', 'port'],
  };

  describe('version updates', () => {
    it('should update version constant', () => {
      const extended = extendJsonSchema(baseSchema, '2.0.0', {});

      expect(extended.properties!.version).toEqual({ const: '2.0.0' });
    });

    it('should preserve version property when no other changes', () => {
      const extended = extendJsonSchema(baseSchema, '1.0.1');

      expect(extended.properties!.version).toEqual({ const: '1.0.1' });
      expect(extended.properties!.name).toEqual({ type: 'string' });
      expect(extended.properties!.port).toEqual({
        type: 'integer',
        minimum: 1,
        maximum: 65535,
      });
    });
  });

  describe('adding properties', () => {
    it('should add new properties', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        additionalProperties: {
          logLevel: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
        },
      });

      expect(extended.properties).toHaveProperty('logLevel');
      expect(extended.properties!.logLevel).toEqual({
        type: 'string',
        enum: ['debug', 'info', 'warn', 'error'],
      });
    });

    it('should add multiple new properties', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        additionalProperties: {
          email: { type: 'string', format: 'email' },
          age: { type: 'integer', minimum: 0 },
        },
      });

      expect(extended.properties).toHaveProperty('email');
      expect(extended.properties).toHaveProperty('age');
      expect(extended.properties!.email).toEqual({ type: 'string', format: 'email' });
      expect(extended.properties!.age).toEqual({ type: 'integer', minimum: 0 });
    });

    it('should preserve existing properties when adding new ones', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        additionalProperties: { logLevel: { type: 'string' } },
      });

      expect(extended.properties!.name).toEqual({ type: 'string' });
      expect(extended.properties!.port).toEqual({
        type: 'integer',
        minimum: 1,
        maximum: 65535,
      });
    });

    it('should add properties with complex schemas', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        additionalProperties: {
          config: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              timeout: { type: 'integer', default: 5000 },
            },
            required: ['enabled'],
          },
        },
      });

      expect(extended.properties!.config).toEqual({
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          timeout: { type: 'integer', default: 5000 },
        },
        required: ['enabled'],
      });
    });
  });

  describe('required array handling', () => {
    it('should add to required array', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        additionalProperties: { email: { type: 'string', format: 'email' } },
        additionalRequired: ['email'],
      });

      expect(extended.required).toContain('email');
      expect(extended.required).toContain('version');
      expect(extended.required).toContain('name');
    });

    it('should not duplicate existing required fields', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        additionalRequired: ['name'], // already required
      });

      const nameCount = extended.required!.filter((f) => f === 'name').length;
      expect(nameCount).toBe(1);
    });

    it('should add multiple required fields', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        additionalProperties: {
          email: { type: 'string' },
          phone: { type: 'string' },
        },
        additionalRequired: ['email', 'phone'],
      });

      expect(extended.required).toContain('email');
      expect(extended.required).toContain('phone');
    });

    it('should remove from required', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        removeRequired: ['port'],
      });

      expect(extended.properties).toHaveProperty('port');
      expect(extended.required).not.toContain('port');
      expect(extended.required).toContain('name');
    });

    it('should handle removing multiple required fields', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        removeRequired: ['name', 'port'],
      });

      expect(extended.required).not.toContain('name');
      expect(extended.required).not.toContain('port');
      expect(extended.required).toEqual(['version']);
    });

    it('should automatically remove required when property is removed', () => {
      const extended = extendJsonSchema(baseSchema, '2.0.0', {
        removeProperties: ['port'],
      });

      expect(extended.properties).not.toHaveProperty('port');
      expect(extended.required).not.toContain('port');
    });

    it('should set required to undefined when empty', () => {
      const schemaWithoutRequired: JSONSchema7 = {
        type: 'object',
        properties: {
          version: { const: '1.0.0' },
          optional: { type: 'string' },
        },
      };

      const extended = extendJsonSchema(schemaWithoutRequired, '1.1.0', {});

      expect(extended.required).toBeUndefined();
    });

    it('should set required to undefined when all fields are removed', () => {
      const extended = extendJsonSchema(baseSchema, '2.0.0', {
        removeRequired: ['version', 'name', 'port'],
      });

      expect(extended.required).toBeUndefined();
    });

    it('should handle adding and removing required simultaneously', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        additionalProperties: { email: { type: 'string' } },
        additionalRequired: ['email'],
        removeRequired: ['port'],
      });

      expect(extended.required).toContain('email');
      expect(extended.required).toContain('version');
      expect(extended.required).toContain('name');
      expect(extended.required).not.toContain('port');
    });
  });

  describe('removing properties', () => {
    it('should remove specified properties', () => {
      const extended = extendJsonSchema(baseSchema, '2.0.0', {
        removeProperties: ['port'],
      });

      expect(extended.properties).not.toHaveProperty('port');
      expect(extended.properties).toHaveProperty('name');
      expect(extended.required).not.toContain('port');
    });

    it('should remove multiple properties', () => {
      const extended = extendJsonSchema(baseSchema, '2.0.0', {
        removeProperties: ['name', 'port'],
      });

      expect(extended.properties).not.toHaveProperty('name');
      expect(extended.properties).not.toHaveProperty('port');
      expect(extended.properties).toHaveProperty('version');
    });

    it('should handle removing non-existent properties gracefully', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        removeProperties: ['nonExistent'],
      });

      expect(extended.properties!.name).toEqual({ type: 'string' });
      expect(extended.required).toEqual(['version', 'name', 'port']);
    });
  });

  describe('immutability', () => {
    it('should not mutate original schema', () => {
      const original = JSON.stringify(baseSchema);
      extendJsonSchema(baseSchema, '2.0.0', {
        additionalProperties: { newField: { type: 'string' } },
      });

      expect(JSON.stringify(baseSchema)).toBe(original);
    });

    it('should not mutate original when removing properties', () => {
      const original = JSON.stringify(baseSchema);
      extendJsonSchema(baseSchema, '2.0.0', {
        removeProperties: ['port'],
      });

      expect(JSON.stringify(baseSchema)).toBe(original);
      expect(baseSchema.properties).toHaveProperty('port');
    });

    it('should not mutate original when modifying required', () => {
      const original = JSON.stringify(baseSchema);
      extendJsonSchema(baseSchema, '1.1.0', {
        removeRequired: ['port'],
      });

      expect(JSON.stringify(baseSchema)).toBe(original);
      expect(baseSchema.required).toContain('port');
    });
  });

  describe('complex scenarios', () => {
    it('should handle all operations simultaneously', () => {
      const extended = extendJsonSchema(baseSchema, '2.0.0', {
        additionalProperties: {
          email: { type: 'string', format: 'email' },
          logLevel: { type: 'string', default: 'info' },
        },
        additionalRequired: ['email'],
        removeProperties: ['port'],
        removeRequired: ['name'],
      });

      // Check new properties
      expect(extended.properties).toHaveProperty('email');
      expect(extended.properties).toHaveProperty('logLevel');

      // Check removed properties
      expect(extended.properties).not.toHaveProperty('port');

      // Check preserved properties
      expect(extended.properties).toHaveProperty('name');

      // Check required array
      expect(extended.required).toContain('email');
      expect(extended.required).not.toContain('name');
      expect(extended.required).not.toContain('port');
      expect(extended.required).toContain('version');
    });

    it('should handle schema without properties object', () => {
      const minimalSchema: JSONSchema7 = {
        type: 'object',
      };

      const extended = extendJsonSchema(minimalSchema, '1.0.0', {
        additionalProperties: {
          name: { type: 'string' },
        },
      });

      expect(extended.properties).toHaveProperty('version');
      expect(extended.properties!.version).toEqual({ const: '1.0.0' });
      expect(extended.properties).toHaveProperty('name');
    });

    it('should handle schema without required array', () => {
      const schemaWithoutRequired: JSONSchema7 = {
        type: 'object',
        properties: {
          version: { const: '1.0.0' },
          optional: { type: 'string' },
        },
      };

      const extended = extendJsonSchema(schemaWithoutRequired, '1.1.0', {
        additionalProperties: { required: { type: 'string' } },
        additionalRequired: ['required'],
      });

      expect(extended.required).toEqual(['required']);
    });
  });

  describe('empty options', () => {
    it('should handle empty options object', () => {
      const extended = extendJsonSchema(baseSchema, '1.0.1', {});

      expect(extended.properties!.version).toEqual({ const: '1.0.1' });
      expect(extended.properties!.name).toEqual({ type: 'string' });
    });

    it('should handle undefined options', () => {
      const extended = extendJsonSchema(baseSchema, '1.0.1');

      expect(extended.properties!.version).toEqual({ const: '1.0.1' });
      expect(extended.properties!.name).toEqual({ type: 'string' });
    });
  });

  describe('edge cases', () => {
    it('should handle adding a property that already exists (overwrite)', () => {
      const extended = extendJsonSchema(baseSchema, '1.1.0', {
        additionalProperties: {
          name: { type: 'string', minLength: 1 },
        },
      });

      expect(extended.properties!.name).toEqual({ type: 'string', minLength: 1 });
    });

    it('should handle empty arrays in options', () => {
      const extended = extendJsonSchema(baseSchema, '1.0.1', {
        additionalProperties: {},
        additionalRequired: [],
        removeProperties: [],
        removeRequired: [],
      });

      expect(extended.properties!.version).toEqual({ const: '1.0.1' });
      expect(extended.required).toEqual(['version', 'name', 'port']);
    });

    it('should preserve other schema properties', () => {
      const schemaWithAdditionalProps: JSONSchema7 = {
        ...baseSchema,
        additionalProperties: false,
        title: 'Base Schema',
        description: 'A base schema for testing',
      };

      const extended = extendJsonSchema(schemaWithAdditionalProps, '1.1.0', {
        additionalProperties: { email: { type: 'string' } },
      });

      expect(extended.additionalProperties).toBe(false);
      expect(extended.title).toBe('Base Schema');
      expect(extended.description).toBe('A base schema for testing');
    });
  });
});

describe('omitFromJsonSchema', () => {
  const baseSchema: JSONSchema7 = {
    type: 'object',
    properties: {
      version: { const: '1.0.0' },
      name: { type: 'string' },
      deprecated: { type: 'string' },
    },
    required: ['version', 'name', 'deprecated'],
  };

  it('should remove specified properties', () => {
    const result = omitFromJsonSchema(baseSchema, '2.0.0', ['deprecated']);

    expect(result.properties).not.toHaveProperty('deprecated');
    expect(result.required).not.toContain('deprecated');
  });

  it('should update version', () => {
    const result = omitFromJsonSchema(baseSchema, '2.0.0', ['deprecated']);

    expect(result.properties!.version).toEqual({ const: '2.0.0' });
  });

  it('should preserve other properties', () => {
    const result = omitFromJsonSchema(baseSchema, '2.0.0', ['deprecated']);

    expect(result.properties!.name).toEqual({ type: 'string' });
  });

  it('should handle multiple properties', () => {
    const result = omitFromJsonSchema(baseSchema, '2.0.0', ['name', 'deprecated']);

    expect(result.properties).not.toHaveProperty('name');
    expect(result.properties).not.toHaveProperty('deprecated');
    expect(result.properties).toHaveProperty('version');
  });

  it('should not mutate original schema', () => {
    const original = JSON.stringify(baseSchema);
    omitFromJsonSchema(baseSchema, '2.0.0', ['deprecated']);

    expect(JSON.stringify(baseSchema)).toBe(original);
  });

  it('should handle empty array', () => {
    const result = omitFromJsonSchema(baseSchema, '1.0.1', []);

    expect(result.properties!.version).toEqual({ const: '1.0.1' });
    expect(result.properties!.name).toEqual({ type: 'string' });
    expect(result.properties!.deprecated).toEqual({ type: 'string' });
  });

  it('should handle non-existent properties gracefully', () => {
    const result = omitFromJsonSchema(baseSchema, '1.0.1', ['nonExistent']);

    expect(result.properties!.name).toEqual({ type: 'string' });
    expect(result.required).toEqual(['version', 'name', 'deprecated']);
  });
});
