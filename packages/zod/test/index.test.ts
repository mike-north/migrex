import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { fromZod, createFieldSchema } from '../src/index.js';

describe('fromZod', () => {
  const UserSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    age: z.number().int().positive(),
  });

  it('should create a versioned schema with correct version', () => {
    const schema = fromZod('1.0.0', UserSchema);
    expect(schema.version).toBe('1.0.0');
  });

  it('should validate correct data successfully', () => {
    const schema = fromZod('1.0.0', UserSchema);
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
    const schema = fromZod('1.0.0', UserSchema);
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
    const schema = fromZod('1.0.0', UserSchema);
    const result = schema.schema({
      name: 'John Doe',
      email: 'not-an-email',
      age: 30,
    });

    expect(result.success).toBe(false);
    const emailError = result.errors!.find((e) => e.path.includes('email'));
    expect(emailError).toBeDefined();
  });

  it('should handle missing required fields', () => {
    const schema = fromZod('1.0.0', UserSchema);
    const result = schema.schema({
      name: 'John Doe',
    });

    expect(result.success).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should support deprecation info', () => {
    const schema = fromZod('1.0.0', UserSchema, {
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
    const schema = fromZod('1.0.0', UserSchema, {
      validate: (data) => {
        if (data.name.length < 2) {
          return {
            success: false,
            errors: [{ path: ['name'], message: 'Name too short' }],
          };
        }
        return { success: true, data };
      },
    });

    expect(schema.validate).toBeDefined();
    const result = schema.validate!({ name: 'A', email: 'a@b.com', age: 20 });
    expect(result.success).toBe(false);
  });

  it('should support releaseDate', () => {
    const schema = fromZod('1.0.0', UserSchema, {
      releaseDate: '2024-01-15',
    });

    expect(schema.releaseDate).toBe('2024-01-15');
  });

  it('should handle nested objects', () => {
    const NestedSchema = z.object({
      user: z.object({
        profile: z.object({
          bio: z.string(),
        }),
      }),
    });

    const schema = fromZod('1.0.0', NestedSchema);
    const result = schema.schema({
      user: {
        profile: {
          bio: 123, // wrong type
        },
      },
    });

    expect(result.success).toBe(false);
    const error = result.errors![0];
    expect(error.path).toContain('user');
    expect(error.path).toContain('profile');
    expect(error.path).toContain('bio');
  });

  it('should handle arrays', () => {
    const ArraySchema = z.object({
      tags: z.array(z.string()),
    });

    const schema = fromZod('1.0.0', ArraySchema);

    const validResult = schema.schema({ tags: ['a', 'b', 'c'] });
    expect(validResult.success).toBe(true);

    const invalidResult = schema.schema({ tags: ['a', 123, 'c'] });
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.errors![0].path).toContain('1'); // array index
  });
});

describe('createFieldSchema', () => {
  it('should create a field schema that validates correctly', () => {
    const fieldSchema = createFieldSchema(z.string().url());

    const validResult = fieldSchema.validate('https://example.com');
    expect(validResult.success).toBe(true);

    const invalidResult = fieldSchema.validate('not-a-url');
    expect(invalidResult.success).toBe(false);
  });

  it('should use provided description', () => {
    const fieldSchema = createFieldSchema(z.string(), {
      description: 'User avatar URL',
    });

    expect(fieldSchema.describe()).toBe('User avatar URL');
  });

  it('should use Zod description if available', () => {
    const fieldSchema = createFieldSchema(
      z.string().describe('A descriptive string')
    );

    expect(fieldSchema.describe()).toBe('A descriptive string');
  });

  it('should fall back to generic description', () => {
    const fieldSchema = createFieldSchema(z.number());

    expect(fieldSchema.describe()).toBe('Validated by Zod schema');
  });

  it('should prefer provided description over Zod description', () => {
    const fieldSchema = createFieldSchema(
      z.string().describe('Zod description'),
      { description: 'Custom description' }
    );

    expect(fieldSchema.describe()).toBe('Custom description');
  });

  it('should return validation errors with path', () => {
    const fieldSchema = createFieldSchema(
      z.object({
        nested: z.string(),
      })
    );

    const result = fieldSchema.validate({ nested: 123 });
    expect(result.success).toBe(false);
    expect(result.errors![0].path).toContain('nested');
  });
});
