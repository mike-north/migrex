import { describe, it, expect } from 'vitest';
import {
  fromJsonSchema,
  createFieldSchema,
  createJsonSchemaPlugin,
  jsonSchemaPlugin,
  type JSONSchema,
} from '../src/index.js';

describe('fromJsonSchema', () => {
  const userSchema: JSONSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      age: { type: 'integer', minimum: 0 },
    },
    required: ['name', 'email'],
    additionalProperties: false,
  };

  it('should create a versioned schema with correct version', () => {
    const schema = fromJsonSchema('1.0.0', userSchema);
    expect(schema.version).toBe('1.0.0');
  });

  it('should validate correct data successfully', () => {
    const schema = fromJsonSchema('1.0.0', userSchema);
    const result = schema.schema({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    });
  });

  it('should return validation errors for invalid data', () => {
    const schema = fromJsonSchema('1.0.0', userSchema);
    const result = schema.schema({
      name: 'John Doe',
      email: 'not-an-email',
      age: -5,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should include path in validation errors', () => {
    const schema = fromJsonSchema('1.0.0', userSchema);
    const result = schema.schema({
      name: 'John Doe',
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);
    const emailError = result.errors!.find((e) => e.path.includes('email'));
    expect(emailError).toBeDefined();
  });

  it('should handle missing required fields', () => {
    const schema = fromJsonSchema('1.0.0', userSchema);
    const result = schema.schema({
      name: 'John Doe',
    });

    expect(result.success).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should support deprecation info', () => {
    const schema = fromJsonSchema('1.0.0', userSchema, {
      deprecated: {
        since: '2.0.0',
        successor: '2.0.0',
        message: 'Use v2 instead',
      },
    });

    expect(schema.deprecated).toEqual({
      since: '2.0.0',
      successor: '2.0.0',
      message: 'Use v2 instead',
    });
  });

  it('should support custom validate function', () => {
    const schema = fromJsonSchema<{ name: string; email: string }>(
      '1.0.0',
      userSchema,
      {
        validate: (data) => {
          if (data.name.length < 2) {
            return {
              success: false,
              errors: [{ path: ['name'], message: 'Name too short' }],
            };
          }
          return { success: true, data };
        },
      }
    );

    expect(schema.validate).toBeDefined();
    const result = schema.validate!({ name: 'A', email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('should support releaseDate', () => {
    const schema = fromJsonSchema('1.0.0', userSchema, {
      releaseDate: '2024-01-15',
    });

    expect(schema.releaseDate).toBe('2024-01-15');
  });

  it('should handle nested objects', () => {
    const nestedSchema: JSONSchema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            profile: {
              type: 'object',
              properties: {
                bio: { type: 'string' },
              },
              required: ['bio'],
            },
          },
          required: ['profile'],
        },
      },
      required: ['user'],
    };

    const schema = fromJsonSchema('1.0.0', nestedSchema);
    const result = schema.schema({
      user: {
        profile: {
          bio: 123, // wrong type
        },
      },
    });

    expect(result.success).toBe(false);
    const error = result.errors![0];
    expect(error.path.join('/')).toContain('user');
  });

  it('should handle arrays', () => {
    const arraySchema: JSONSchema = {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['tags'],
    };

    const schema = fromJsonSchema('1.0.0', arraySchema);

    const validResult = schema.schema({ tags: ['a', 'b', 'c'] });
    expect(validResult.success).toBe(true);

    const invalidResult = schema.schema({ tags: ['a', 123, 'c'] });
    expect(invalidResult.success).toBe(false);
  });

  it('should validate formats when useFormats is enabled (default)', () => {
    const schemaWithFormat: JSONSchema = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        uri: { type: 'string', format: 'uri' },
        date: { type: 'string', format: 'date' },
      },
    };

    const schema = fromJsonSchema('1.0.0', schemaWithFormat);

    const validResult = schema.schema({
      email: 'test@example.com',
      uri: 'https://example.com',
      date: '2024-01-15',
    });
    expect(validResult.success).toBe(true);

    const invalidResult = schema.schema({
      email: 'not-an-email',
    });
    expect(invalidResult.success).toBe(false);
  });
});

describe('createJsonSchemaPlugin', () => {
  it('should create a plugin with custom ajv options', () => {
    const plugin = createJsonSchemaPlugin({
      ajvOptions: { strict: false },
    });

    expect(plugin.id).toBe('json-schema');
    expect(plugin.ajv).toBeDefined();
  });

  it('should allow disabling formats with relaxed strict mode', () => {
    const plugin = createJsonSchemaPlugin({
      useFormats: false,
      ajvOptions: { strict: false },
    });

    // This should not validate the email format
    const schema = plugin.fromJsonSchema('1.0.0', {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
      },
    });

    // With formats disabled and strict: false, 'not-an-email' should pass
    const result = schema.schema({ email: 'not-an-email' });
    expect(result.success).toBe(true);
  });

  it('should expose the ajv instance', () => {
    const plugin = createJsonSchemaPlugin();
    expect(plugin.ajv).toBeDefined();
    expect(typeof plugin.ajv.compile).toBe('function');
  });
});

describe('createFieldSchema', () => {
  it('should create a field schema that validates correctly', () => {
    const fieldSchema = createFieldSchema({
      type: 'string',
      format: 'uri',
    });

    const validResult = fieldSchema.validate('https://example.com');
    expect(validResult.success).toBe(true);

    const invalidResult = fieldSchema.validate('not-a-url');
    expect(invalidResult.success).toBe(false);
  });

  it('should use provided description', () => {
    const fieldSchema = createFieldSchema(
      { type: 'string' },
      { description: 'User avatar URL' }
    );

    expect(fieldSchema.describe()).toBe('User avatar URL');
  });

  it('should use JSON Schema description if available', () => {
    const fieldSchema = createFieldSchema({
      type: 'string',
      description: 'A descriptive string',
    });

    expect(fieldSchema.describe()).toBe('A descriptive string');
  });

  it('should use JSON Schema title as fallback', () => {
    const fieldSchema = createFieldSchema({
      type: 'string',
      title: 'String Field',
    });

    expect(fieldSchema.describe()).toBe('String Field');
  });

  it('should fall back to generic description', () => {
    const fieldSchema = createFieldSchema({
      type: 'number',
    });

    expect(fieldSchema.describe()).toBe('Validated by JSON Schema');
  });

  it('should prefer provided description over schema description', () => {
    const fieldSchema = createFieldSchema(
      { type: 'string', description: 'Schema description' },
      { description: 'Custom description' }
    );

    expect(fieldSchema.describe()).toBe('Custom description');
  });

  it('should return validation errors with path for nested objects', () => {
    const fieldSchema = createFieldSchema({
      type: 'object',
      properties: {
        nested: { type: 'string' },
      },
      required: ['nested'],
    });

    const result = fieldSchema.validate({ nested: 123 });
    expect(result.success).toBe(false);
    expect(result.errors![0].path).toContain('nested');
  });
});

describe('jsonSchemaPlugin', () => {
  it('should be the default plugin instance', () => {
    expect(jsonSchemaPlugin.id).toBe('json-schema');
    expect(jsonSchemaPlugin.name).toBe('JSON Schema Plugin');
  });

  it('should have fromJsonSchema method', () => {
    const schema = jsonSchemaPlugin.fromJsonSchema('1.0.0', {
      type: 'string',
    });

    expect(schema.version).toBe('1.0.0');
    expect(schema.schema('test').success).toBe(true);
  });

  it('should have createFieldSchema method', () => {
    const fieldSchema = jsonSchemaPlugin.createFieldSchema({
      type: 'number',
    });

    expect(fieldSchema.validate(123).success).toBe(true);
    expect(fieldSchema.validate('not a number').success).toBe(false);
  });
});
