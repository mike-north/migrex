import { expectType, expectAssignable } from 'tsd';
import type { VersionedSchema, FieldSchema, ValidationResult } from '@migrex/core';
import type { z, ZodType } from 'zod';
import {
  fromZod,
  createFieldSchema,
  type FromZodOptions,
  type FieldSchemaOptions,
  type InferZodSchema,
} from '@migrex/zod';

// Mock Zod schema type for testing (we can't import actual zod in type tests)
declare const mockZodSchema: ZodType<{ name: string; age: number }>;
declare const mockStringSchema: ZodType<string>;

// Verify FromZodOptions interface
const fromZodOptions: FromZodOptions<{ name: string }> = {
  validate: (data) => ({ success: true, data }),
  deprecated: {
    since: '2024-01-01',
    deadline: '2025-01-01',
    successor: '2.0.0',
    message: 'Deprecated',
  },
  releaseDate: '2023-01-01',
};
expectAssignable<FromZodOptions<{ name: string }>>(fromZodOptions);

// Verify minimal options
const minimalOptions: FromZodOptions<unknown> = {};
expectAssignable<FromZodOptions<unknown>>(minimalOptions);

// Verify FieldSchemaOptions interface
const fieldSchemaOptions: FieldSchemaOptions = {
  description: 'A field description',
};
expectAssignable<FieldSchemaOptions>(fieldSchemaOptions);

// Verify fromZod returns VersionedSchema
const schema = fromZod('1.0.0', mockZodSchema);
expectAssignable<VersionedSchema<{ name: string; age: number }>>(schema);

// Verify schema.version is string
expectType<string>(schema.version);

// Verify schema.schema function exists
const validationResult = schema.schema({ name: 'test', age: 30 });
expectAssignable<ValidationResult<{ name: string; age: number }>>(validationResult);

// Verify createFieldSchema returns FieldSchema
const fieldSchema = createFieldSchema(mockStringSchema, { description: 'A string field' });
expectAssignable<FieldSchema>(fieldSchema);

// Verify FieldSchema methods exist
expectType<(value: unknown) => ValidationResult<unknown>>(fieldSchema.validate);
expectType<() => string>(fieldSchema.describe);

// Verify InferZodSchema type helper
type InferredType = InferZodSchema<typeof mockZodSchema>;
expectAssignable<InferredType>({ name: 'test', age: 30 });

// Verify z.infer equivalence (conceptually)
declare const inferredValue: InferredType;
expectType<{ name: string; age: number }>(inferredValue);
