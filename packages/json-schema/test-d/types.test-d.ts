import { expectType, expectAssignable } from 'tsd';
import type { VersionedSchema, FieldSchema } from '@migrex/core';
import {
  createJsonSchemaPlugin,
  fromJsonSchema,
  createFieldSchema,
  jsonSchemaPlugin,
  type JsonSchemaPlugin,
  type JsonSchemaPluginOptions,
  type FromJsonSchemaOptions,
  type JSONSchema,
  type JsonSchemaDraft,
} from '@migrex/json-schema';

// Verify JSONSchema type is exported (aliased from JSONSchema7)
const jsonSchema: JSONSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer', minimum: 0 },
  },
  required: ['name'],
};
expectAssignable<JSONSchema>(jsonSchema);

// Verify JsonSchemaPluginOptions interface
const pluginOptions: JsonSchemaPluginOptions = {
  draft: '7',
  allErrors: true,
  useFormats: true,
};
expectAssignable<JsonSchemaPluginOptions>(pluginOptions);

// Verify FromJsonSchemaOptions interface
interface TestData {
  name: string;
  age?: number;
}

const fromOptions: FromJsonSchemaOptions<TestData> = {
  validate: (data: TestData) => ({ success: true, data }),
  deprecated: {
    since: '2024-01-01',
    deadline: '2025-01-01',
    successor: '2.0.0',
    message: 'Use v2 instead',
  },
  releaseDate: '2023-01-01',
};
expectAssignable<FromJsonSchemaOptions<TestData>>(fromOptions);

// Verify createJsonSchemaPlugin returns JsonSchemaPlugin
const plugin = createJsonSchemaPlugin();
expectType<JsonSchemaPlugin>(plugin);

// Verify plugin.id is 'json-schema'
expectType<'json-schema'>(plugin.id);

// Verify plugin.name is string
expectType<string>(plugin.name);

// Verify plugin.draft is a supported draft
expectType<JsonSchemaDraft>(plugin.draft);

// Verify defaultPlugin is exported
expectType<JsonSchemaPlugin>(jsonSchemaPlugin);

// Verify fromJsonSchema returns VersionedSchema
const schema = fromJsonSchema<TestData>('1.0.0', jsonSchema);
expectAssignable<VersionedSchema<TestData>>(schema);

// Verify schema.version is string
expectType<string>(schema.version);

// Verify plugin.fromJsonSchema returns VersionedSchema
const pluginSchema = plugin.fromJsonSchema<TestData>('1.0.0', jsonSchema);
expectAssignable<VersionedSchema<TestData>>(pluginSchema);

// Verify createFieldSchema returns FieldSchema
const fieldSchema = createFieldSchema(
  { type: 'string', format: 'email' },
  { description: 'Email address' }
);
expectAssignable<FieldSchema>(fieldSchema);

// Verify plugin.createFieldSchema returns FieldSchema
const pluginFieldSchema = plugin.createFieldSchema(
  { type: 'string', format: 'uri' },
  { description: 'URL' }
);
expectAssignable<FieldSchema>(pluginFieldSchema);

// Verify FieldSchema methods exist and are callable
expectType<string>(fieldSchema.describe());
const validationResultField = fieldSchema.validate('test@example.com');
expectType<boolean>(validationResultField.success);
