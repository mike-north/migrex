import { describe, it, expect } from 'vitest';
import {
  fromJsonSchema,
  createFieldSchema,
  createJsonSchemaPlugin,
  jsonSchemaPlugin,
  extendJsonSchema,
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
    const schema = fromJsonSchema<{ name: string; email: string }>('1.0.0', userSchema, {
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
  it('should create a plugin that defaults to draft-07', () => {
    const plugin = createJsonSchemaPlugin();

    expect(plugin.id).toBe('json-schema');
    expect(plugin.draft).toBe('7');
  });

  it('should accept a different draft', () => {
    const plugin = createJsonSchemaPlugin({ draft: '2020-12' });
    expect(plugin.draft).toBe('2020-12');

    const schema = plugin.fromJsonSchema('1.0.0', {
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'number' }],
    } as JSONSchema);

    expect(schema.schema(['a', 1]).success).toBe(true);
    expect(schema.schema(['a', 'b']).success).toBe(false);
  });

  it('should allow disabling formats', () => {
    const plugin = createJsonSchemaPlugin({ useFormats: false });

    const schema = plugin.fromJsonSchema('1.0.0', {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        // A property literally named "format" must survive format stripping
        format: { type: 'string', enum: ['json'] },
      },
    });

    // With formats disabled, 'not-an-email' should pass
    expect(schema.schema({ email: 'not-an-email' }).success).toBe(true);
    expect(schema.schema({ format: 'yaml' }).success).toBe(false);
  });

  it('should collect all errors by default', () => {
    const plugin = createJsonSchemaPlugin();
    const schema = plugin.fromJsonSchema('1.0.0', {
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'string' } },
    });

    const result = schema.schema({ a: 1, b: 2 });
    expect(result.success).toBe(false);
    expect(result.errors!.map((e) => e.path)).toEqual([['a'], ['b']]);
  });

  it('should stop at the first error when allErrors is false', () => {
    const plugin = createJsonSchemaPlugin({ allErrors: false });
    const schema = plugin.fromJsonSchema('1.0.0', {
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'string' } },
    });

    const result = schema.schema({ a: 1, b: 2 });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('should not mutate the schema it is given', () => {
    const input: JSONSchema = {
      type: 'object',
      properties: { email: { type: 'string', format: 'email' } },
    };
    const snapshot = structuredClone(input);

    createJsonSchemaPlugin({ useFormats: false }).fromJsonSchema('1.0.0', input);
    createJsonSchemaPlugin().fromJsonSchema('1.0.0', input);

    expect(input).toEqual(snapshot);
    expect(Object.getOwnPropertyNames(input)).toEqual(Object.getOwnPropertyNames(snapshot));
  });
});

describe('validation errors', () => {
  it('should report leaf errors with keyword codes and paths', () => {
    const schema = fromJsonSchema('1.0.0', {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['tags', 'id'],
    });

    const result = schema.schema({ tags: ['a', 1] });
    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['tags', '1'], code: 'type' }),
        expect.objectContaining({ path: [], code: 'required' }),
      ])
    );
    // Summary errors from applicators like `properties` and `items` are dropped
    expect(result.errors!.some((e) => e.code === 'properties' || e.code === 'items')).toBe(false);
  });

  it('should report additionalProperties: false as the keyword at the extra property', () => {
    const schema = fromJsonSchema('1.0.0', {
      type: 'object',
      properties: { name: { type: 'string' } },
      additionalProperties: false,
    });

    const result = schema.schema({ name: 'x', extra: 1 });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0]).toMatchObject({ code: 'additionalProperties', path: ['extra'] });
    expect(result.errors![0].message).toContain('extra');
  });

  it('should report only the subschema error for additionalProperties with a schema', () => {
    const schema = fromJsonSchema('1.0.0', {
      type: 'object',
      additionalProperties: { type: 'string' },
    });

    const result = schema.schema({ x: 1 });
    expect(result.errors).toEqual([expect.objectContaining({ code: 'type', path: ['x'] })]);
  });

  it('should report additionalItems: false at the extra item', () => {
    const schema = fromJsonSchema('1.0.0', {
      type: 'array',
      items: [{ type: 'string' }],
      additionalItems: false,
    });

    const result = schema.schema(['x', 2]);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'additionalItems', path: ['1'] }),
    ]);
  });

  it('should keep false-subschema errors alongside other errors', () => {
    const schema = fromJsonSchema('1.0.0', {
      type: 'object',
      properties: { a: false, b: { type: 'string' } },
      additionalProperties: false,
    });

    const result = schema.schema({ a: 1, b: 1, x: 1 });
    expect(result.errors!.map((e) => [e.code, e.path.join('/')])).toEqual(
      expect.arrayContaining([
        ['false', 'a'],
        ['type', 'b'],
        ['additionalProperties', 'x'],
      ])
    );
    expect(result.errors).toHaveLength(3);
  });

  it('should decode JSON pointer escapes in paths', () => {
    const schema = fromJsonSchema('1.0.0', {
      type: 'object',
      properties: { 'a/b~c d': { type: 'string' } },
    });

    const result = schema.schema({ 'a/b~c d': 1 });
    expect(result.errors![0].path).toEqual(['a/b~c d']);
  });

  it('should resolve local $ref definitions', () => {
    const schema = fromJsonSchema('1.0.0', {
      definitions: { id: { type: 'string', minLength: 1 } },
      type: 'object',
      properties: { id: { $ref: '#/definitions/id' } },
    });

    expect(schema.schema({ id: 'x' }).success).toBe(true);
    const result = schema.schema({ id: '' });
    expect(result.success).toBe(false);
    expect(result.errors![0].path).toEqual(['id']);
  });
});

describe('Ajv compatibility', () => {
  it('should treat properties set to undefined as absent', () => {
    const schema = fromJsonSchema('1.0.0', {
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'string' } },
      required: ['a'],
    });

    const input = { a: 'x', b: undefined };
    const ok = schema.schema(input);
    expect(ok.success).toBe(true);
    expect(ok.data).toBe(input);

    const missing = schema.schema({ a: undefined });
    expect(missing.success).toBe(false);
    expect(missing.errors![0]).toMatchObject({ code: 'required', path: [] });
  });

  it('should return an error instead of throwing for values JSON cannot represent', () => {
    const schema = fromJsonSchema('1.0.0', { type: 'object' });

    expect(schema.schema(undefined)).toMatchObject({ success: false });
    expect(
      fromJsonSchema('1.0.0', { properties: { n: { type: 'number' } } }).schema({ n: 1n })
    ).toMatchObject({ success: false });
    expect(
      fromJsonSchema('1.0.0', { additionalProperties: { type: 'string' } }).schema({ '\uD800': 1 })
    ).toMatchObject({ success: false });
    expect(createFieldSchema({ type: 'string' }).validate(undefined).success).toBe(false);
  });

  it('should apply constraints beside $ref in draft-07', () => {
    const schema = fromJsonSchema('1.0.0', {
      definitions: { obj: { type: 'object' } },
      $ref: '#/definitions/obj',
      required: ['a'],
    });

    expect(schema.schema({ a: 1 }).success).toBe(true);
    const result = schema.schema({});
    expect(result.success).toBe(false);
    expect(result.errors![0].code).toBe('required');
    expect(schema.schema('nope').success).toBe(false);
  });

  it('should use the draft named by $schema', () => {
    const draft4 = fromJsonSchema('1.0.0', {
      $schema: 'http://json-schema.org/draft-04/schema#',
      type: 'number',
      minimum: 0,
      exclusiveMinimum: true,
    } as unknown as JSONSchema);
    expect(draft4.schema(1).success).toBe(true);
    expect(draft4.schema(0).success).toBe(false);

    const draft2020 = fromJsonSchema('1.0.0', {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'array',
      prefixItems: [{ type: 'string' }],
    } as JSONSchema);
    expect(draft2020.schema(['a']).success).toBe(true);
    expect(draft2020.schema([1]).success).toBe(false);
  });

  it('should reject invalid schemas when they are compiled', () => {
    expect(() => fromJsonSchema('1.0.0', { type: 'strin' } as unknown as JSONSchema)).toThrow(
      /Invalid JSON Schema/
    );
    expect(() => fromJsonSchema('1.0.0', { required: 'name' } as unknown as JSONSchema)).toThrow(
      /Invalid JSON Schema/
    );
    expect(() => createFieldSchema({ minimum: 'zero' } as unknown as JSONSchema)).toThrow(
      /Invalid JSON Schema/
    );
  });

  it('should reject unresolvable local $refs when they are compiled', () => {
    expect(() =>
      fromJsonSchema('1.0.0', {
        type: 'object',
        properties: { a: { $ref: '#/definitions/missing' } },
      })
    ).toThrow(/does not resolve/);
  });

  it('should compile schemas with keywords set to undefined', () => {
    const base: JSONSchema = {
      type: 'object',
      properties: { version: { const: '1.0.0' }, a: { type: 'string' } },
      required: ['a'],
    };
    const extended = extendJsonSchema(base, '1.1.0', { removeRequired: ['a'] });
    const schema = fromJsonSchema('1.1.0', extended);
    expect(schema.schema({ version: '1.1.0' }).success).toBe(true);

    expect(() =>
      fromJsonSchema('1.0.0', { type: 'object', description: undefined } as JSONSchema)
    ).not.toThrow();
  });

  it('should keep allOf indices stable when rewriting $ref siblings', () => {
    const schema = fromJsonSchema('1.0.0', {
      definitions: {
        b: { type: 'string' },
        x: { $ref: '#/definitions/b', minLength: 2, allOf: [{ maxLength: 3 }] },
      },
      $ref: '#/definitions/x/allOf/0',
    });

    expect(schema.schema('abc').success).toBe(true);
    const result = schema.schema('abcdef');
    expect(result.success).toBe(false);
    expect(result.errors![0].code).toBe('maxLength');
  });

  it('should reject unresolvable non-local $refs when they are compiled', () => {
    expect(() => fromJsonSchema('1.0.0', { $ref: 'other.json' })).toThrow(/does not resolve/);
    expect(() =>
      fromJsonSchema('1.0.0', {
        $id: 'https://example.com/root.json',
        definitions: { a: { $id: 'a.json', type: 'string' } },
        $ref: 'a.json',
      })
    ).not.toThrow();
  });

  it('should treat undefined properties on class instances as absent', () => {
    class Point {
      a = 'x';
      b: string | undefined = undefined;
    }
    const schema = fromJsonSchema('1.0.0', {
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'string' } },
    });

    const input = new Point();
    const result = schema.schema(input);
    expect(result.success).toBe(true);
    expect(result.data).toBe(input);
  });

  it('should handle cyclic and very deep data without throwing', () => {
    const cyclic: Record<string, unknown> = { a: 1, b: undefined };
    cyclic['self'] = cyclic;
    const schema = fromJsonSchema('1.0.0', {
      type: 'object',
      properties: { a: { type: 'number' } },
    });
    expect(schema.schema(cyclic).success).toBe(true);

    let deep: Record<string, unknown> = {};
    for (let i = 0; i < 20000; i++) deep = { next: deep, gap: undefined };
    expect(fromJsonSchema('1.0.0', { type: 'object' }).schema(deep).success).toBe(true);
  });

  it('should report a false tuple position as false, not additionalItems', () => {
    const schema = fromJsonSchema('1.0.0', {
      type: 'array',
      items: [false, {}],
      additionalItems: false,
    });

    const result = schema.schema([1, 2, 3]);
    expect(result.errors!.map((e) => [e.code, e.path.join('/')])).toEqual([
      ['false', '0'],
      ['additionalItems', '2'],
    ]);
  });

  it('should not check meta-schema formats when formats are disabled', () => {
    const schema = { $id: 'not a uri with spaces', type: 'string' } as JSONSchema;
    expect(() =>
      createJsonSchemaPlugin({ useFormats: false }).fromJsonSchema('1', schema)
    ).not.toThrow();
    expect(() => fromJsonSchema('1', schema)).toThrow(/Invalid JSON Schema/);
  });

  it('should strip formats reached through $ref outside definitions', () => {
    const plugin = createJsonSchemaPlugin({ useFormats: false });
    const schema = plugin.fromJsonSchema('1.0.0', {
      components: { email: { type: 'string', format: 'email' } },
      $ref: '#/components/email',
    } as JSONSchema);

    expect(schema.schema('nope').success).toBe(true);
    expect(schema.schema(1).success).toBe(false);
  });

  it('should leave format-like data in const, enum and default alone', () => {
    const plugin = createJsonSchemaPlugin({ useFormats: false });
    const schema = plugin.fromJsonSchema('1.0.0', {
      type: 'object',
      properties: {
        a: { const: { format: 'email' } },
        b: { enum: [{ format: 'x' }] },
      },
    });

    expect(schema.schema({ a: { format: 'email' } }).success).toBe(true);
    expect(schema.schema({ a: {} }).success).toBe(false);
    expect(schema.schema({ b: { format: 'x' } }).success).toBe(true);
    expect(schema.schema({ b: {} }).success).toBe(false);
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
    const fieldSchema = createFieldSchema({ type: 'string' }, { description: 'User avatar URL' });

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
