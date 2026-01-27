import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { extendZodSchema, omitFromZodSchema } from '../src/extend.js';

describe('extendZodSchema', () => {
  describe('positive cases', () => {
    it('should extend schema with new fields', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        email: z.string().email(),
      });

      const result = V2.parse({
        version: '1.1.0',
        name: 'Test',
        email: 'test@example.com',
      });

      expect(result).toEqual({
        version: '1.1.0',
        name: 'Test',
        email: 'test@example.com',
      });
    });

    it('should work with empty extensions object', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = extendZodSchema(V1, '2.0.0', {});

      const result = V2.parse({
        version: '2.0.0',
        name: 'Test',
      });

      expect(result).toEqual({
        version: '2.0.0',
        name: 'Test',
      });
    });

    it('should preserve all base fields except version', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
        age: z.number(),
        active: z.boolean(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        email: z.string().email(),
      });

      const result = V2.parse({
        version: '1.1.0',
        name: 'Test',
        age: 30,
        active: true,
        email: 'test@example.com',
      });

      expect(result).toEqual({
        version: '1.1.0',
        name: 'Test',
        age: 30,
        active: true,
        email: 'test@example.com',
      });
    });

    it('should work with default values in extensions', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        logLevel: z.string().default('info'),
      });

      const result = V2.parse({
        version: '1.1.0',
        name: 'Test',
      });

      expect(result.logLevel).toBe('info');
    });

    it('should work with multiple extension fields', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        host: z.string(),
      });

      const V2 = extendZodSchema(V1, '2.0.0', {
        port: z.number(),
        timeout: z.number().default(5000),
        retries: z.number().default(3),
      });

      const result = V2.parse({
        version: '2.0.0',
        host: 'localhost',
        port: 8080,
      });

      expect(result).toEqual({
        version: '2.0.0',
        host: 'localhost',
        port: 8080,
        timeout: 5000,
        retries: 3,
      });
    });

    it('should work with complex field types', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        id: z.string(),
      });

      const V2 = extendZodSchema(V1, '2.0.0', {
        tags: z.array(z.string()),
        metadata: z.record(z.string(), z.unknown()),
        config: z.object({
          enabled: z.boolean(),
        }),
      });

      const result = V2.parse({
        version: '2.0.0',
        id: '123',
        tags: ['tag1', 'tag2'],
        metadata: { key: 'value' },
        config: { enabled: true },
      });

      expect(result).toEqual({
        version: '2.0.0',
        id: '123',
        tags: ['tag1', 'tag2'],
        metadata: { key: 'value' },
        config: { enabled: true },
      });
    });
  });

  describe('negative cases', () => {
    it('should reject old version literal', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = extendZodSchema(V1, '2.0.0', {});

      expect(() =>
        V2.parse({
          version: '1.0.0',
          name: 'Test',
        })
      ).toThrow();
    });

    it('should reject wrong version literal', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = extendZodSchema(V1, '2.0.0', {});

      expect(() =>
        V2.parse({
          version: '3.0.0',
          name: 'Test',
        })
      ).toThrow();
    });

    it('should reject missing required extension fields', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        email: z.string().email(),
      });

      expect(() =>
        V2.parse({
          version: '1.1.0',
          name: 'Test',
          // missing email
        })
      ).toThrow();
    });

    it('should reject invalid extension field types', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        age: z.number(),
      });

      expect(() =>
        V2.parse({
          version: '1.1.0',
          name: 'Test',
          age: 'not a number',
        })
      ).toThrow();
    });

    it('should reject missing base fields', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
        age: z.number(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        email: z.string(),
      });

      expect(() =>
        V2.parse({
          version: '1.1.0',
          name: 'Test',
          email: 'test@example.com',
          // missing age
        })
      ).toThrow();
    });

    it('should reject invalid base field types', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        age: z.number(),
      });

      expect(() =>
        V2.parse({
          version: '1.1.0',
          name: 123, // should be string
          age: 30,
        })
      ).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle extending an already extended schema', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        email: z.string(),
      });

      const V3 = extendZodSchema(V2, '1.2.0', {
        phone: z.string(),
      });

      const result = V3.parse({
        version: '1.2.0',
        name: 'Test',
        email: 'test@example.com',
        phone: '555-1234',
      });

      expect(result).toEqual({
        version: '1.2.0',
        name: 'Test',
        email: 'test@example.com',
        phone: '555-1234',
      });
    });

    it('should handle optional fields in base schema', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
        nickname: z.string().optional(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        age: z.number(),
      });

      const result = V2.parse({
        version: '1.1.0',
        name: 'Test',
        age: 30,
        // nickname is optional
      });

      expect(result).toEqual({
        version: '1.1.0',
        name: 'Test',
        age: 30,
      });
    });

    it('should handle optional fields in extensions', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        age: z.number().optional(),
      });

      const result = V2.parse({
        version: '1.1.0',
        name: 'Test',
        // age is optional
      });

      expect(result).toEqual({
        version: '1.1.0',
        name: 'Test',
      });
    });

    it('should allow adding refinements after extension', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        password: z.string(),
        confirmPassword: z.string(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        email: z.string().email(),
      }).refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords must match',
        path: ['confirmPassword'],
      });

      // Should fail refinement
      expect(() =>
        V2.parse({
          version: '1.1.0',
          password: 'pass123',
          confirmPassword: 'different',
          email: 'test@example.com',
        })
      ).toThrow();

      // Should pass refinement
      const result = V2.parse({
        version: '1.1.0',
        password: 'pass123',
        confirmPassword: 'pass123',
        email: 'test@example.com',
      });

      expect(result).toEqual({
        version: '1.1.0',
        password: 'pass123',
        confirmPassword: 'pass123',
        email: 'test@example.com',
      });
    });
  });

  describe('type safety', () => {
    it('should infer correct TypeScript types', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        count: z.number(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        flag: z.boolean(),
      });

      // TypeScript should infer: { version: '1.1.0', count: number, flag: boolean }
      type V2Type = z.infer<typeof V2>;

      const data: V2Type = {
        version: '1.1.0',
        count: 42,
        flag: true,
      };

      expect(V2.parse(data)).toEqual(data);
    });
  });
});

describe('omitFromZodSchema', () => {
  describe('positive cases', () => {
    it('should remove specified fields', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
        deprecated: z.string(),
      });

      const V2 = omitFromZodSchema(V1, '2.0.0', ['deprecated']);

      const result = V2.parse({
        version: '2.0.0',
        name: 'Test',
      });

      expect(result).toEqual({
        version: '2.0.0',
        name: 'Test',
      });
      expect('deprecated' in result).toBe(false);
    });

    it('should remove multiple fields', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
        old1: z.string(),
        old2: z.number(),
        old3: z.boolean(),
      });

      const V2 = omitFromZodSchema(V1, '2.0.0', ['old1', 'old2', 'old3']);

      const result = V2.parse({
        version: '2.0.0',
        name: 'Test',
      });

      expect(result).toEqual({
        version: '2.0.0',
        name: 'Test',
      });
      expect('old1' in result).toBe(false);
      expect('old2' in result).toBe(false);
      expect('old3' in result).toBe(false);
    });

    it('should update version literal', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
        old: z.string(),
      });

      const V2 = omitFromZodSchema(V1, '2.0.0', ['old']);

      const result = V2.parse({
        version: '2.0.0',
        name: 'Test',
      });

      expect(result.version).toBe('2.0.0');
    });

    it('should work with empty omit array', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = omitFromZodSchema(V1, '2.0.0', []);

      const result = V2.parse({
        version: '2.0.0',
        name: 'Test',
      });

      expect(result).toEqual({
        version: '2.0.0',
        name: 'Test',
      });
    });

    it('should preserve remaining fields with their validation', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        email: z.string().email(),
        deprecated: z.string(),
        age: z.number().positive(),
      });

      const V2 = omitFromZodSchema(V1, '2.0.0', ['deprecated']);

      const result = V2.parse({
        version: '2.0.0',
        email: 'test@example.com',
        age: 30,
      });

      expect(result).toEqual({
        version: '2.0.0',
        email: 'test@example.com',
        age: 30,
      });

      // Should still validate email
      expect(() =>
        V2.parse({
          version: '2.0.0',
          email: 'not-an-email',
          age: 30,
        })
      ).toThrow();

      // Should still validate age
      expect(() =>
        V2.parse({
          version: '2.0.0',
          email: 'test@example.com',
          age: -5,
        })
      ).toThrow();
    });
  });

  describe('negative cases', () => {
    it('should reject old version literal', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
        old: z.string(),
      });

      const V2 = omitFromZodSchema(V1, '2.0.0', ['old']);

      expect(() =>
        V2.parse({
          version: '1.0.0',
          name: 'Test',
        })
      ).toThrow();
    });

    it('should not have omitted fields in schema shape', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
        old: z.string(),
      });

      const V2 = omitFromZodSchema(V1, '2.0.0', ['old']);

      expect(V2.shape).not.toHaveProperty('old');
      expect(V2.shape).toHaveProperty('name');
      expect(V2.shape).toHaveProperty('version');
    });

    it('should reject if omitted field is provided', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
        deprecated: z.string(),
      });

      const V2 = omitFromZodSchema(V1, '2.0.0', ['deprecated']);

      // Zod strips unknown keys by default, but we can verify it's not in the result
      const result = V2.parse({
        version: '2.0.0',
        name: 'Test',
        deprecated: 'should be ignored',
      } as unknown);

      expect('deprecated' in result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should work when combining with extendZodSchema', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        oldName: z.string(),
        age: z.number(),
      });

      // Remove old field
      const V2WithoutOld = omitFromZodSchema(V1, '2.0.0', ['oldName']);

      // Add new fields
      const V2 = extendZodSchema(V2WithoutOld, '2.0.0', {
        firstName: z.string(),
        lastName: z.string(),
      });

      const result = V2.parse({
        version: '2.0.0',
        age: 30,
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result).toEqual({
        version: '2.0.0',
        age: 30,
        firstName: 'John',
        lastName: 'Doe',
      });
      expect('oldName' in result).toBe(false);
    });

    it('should handle omitting from an already extended schema', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
      });

      const V2 = extendZodSchema(V1, '1.1.0', {
        deprecated: z.string(),
        email: z.string(),
      });

      const V3 = omitFromZodSchema(V2, '2.0.0', ['deprecated']);

      const result = V3.parse({
        version: '2.0.0',
        name: 'Test',
        email: 'test@example.com',
      });

      expect(result).toEqual({
        version: '2.0.0',
        name: 'Test',
        email: 'test@example.com',
      });
      expect('deprecated' in result).toBe(false);
    });
  });

  describe('type safety', () => {
    it('should infer correct TypeScript types', () => {
      const V1 = z.object({
        version: z.literal('1.0.0'),
        name: z.string(),
        deprecated: z.string(),
        age: z.number(),
      });

      const V2 = omitFromZodSchema(V1, '2.0.0', ['deprecated']);

      // TypeScript should infer: { version: '2.0.0', name: string, age: number }
      type V2Type = z.infer<typeof V2>;

      const data: V2Type = {
        version: '2.0.0',
        name: 'Test',
        age: 30,
      };

      expect(V2.parse(data)).toEqual(data);
    });
  });
});
