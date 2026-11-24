/**
 * \@migrex/json-schema - JSON Schema plugin for migrex
 *
 * This package provides integration between migrex and JSON Schema,
 * allowing you to use JSON Schema definitions as versioned schemas in your migration graph.
 *
 * @packageDocumentation
 */

import { Validator } from '@cfworker/json-schema';
import type { OutputUnit, Schema as CfworkerSchema } from '@cfworker/json-schema';
import type { VersionedSchema, ValidationResult, ValidationError, FieldSchema } from '@migrex/core';
import type { JSONSchema7 } from 'json-schema';

/**
 * Re-export JSONSchema7 type for convenience.
 */
export type { JSONSchema7 as JSONSchema };

/**
 * JSON Schema drafts supported by the validator.
 */
export type JsonSchemaDraft = '4' | '7' | '2019-09' | '2020-12';

/**
 * Options for creating a JSON Schema plugin.
 */
export interface JsonSchemaPluginOptions {
  /**
   * The JSON Schema draft used to interpret schemas.
   * @defaultValue '7'
   */
  draft?: JsonSchemaDraft;

  /**
   * Whether to collect every validation error rather than stopping at the first one.
   * @defaultValue true
   */
  allErrors?: boolean;

  /**
   * Whether to check the `format` keyword (e.g., email, uri, date-time).
   * When false, `format` is treated as an annotation only.
   * @defaultValue true
   */
  useFormats?: boolean;
}

/**
 * Options for creating a versioned schema from a JSON Schema.
 */
export interface FromJsonSchemaOptions<T> {
  /**
   * Additional validation function to run after JSON Schema validation succeeds.
   * Use this for business logic validation that can't be expressed in JSON Schema.
   */
  validate?: (data: T) => ValidationResult<T>;

  /**
   * Deprecation information for this schema version.
   */
  deprecated?: {
    /** Version when this schema was deprecated */
    since: string;
    /** Optional deadline for removal */
    deadline?: string;
    /** The version that supersedes this one */
    successor: string;
    /** Optional human-readable deprecation message */
    message?: string;
  };

  /**
   * Release date of this schema version.
   */
  releaseDate?: string;
}

/**
 * Keywords whose errors only summarize failures in a subschema.
 * The subschema's own errors are more specific, so these are dropped.
 */
const SUMMARY_KEYWORDS = new Set([
  'properties',
  'patternProperties',
  'items',
  'prefixItems',
  'additionalItems',
  'allOf',
  '$ref',
  '$recursiveRef',
  'dependentSchemas',
  'dependencies',
  'propertyNames',
  'if',
  'then',
  'else',
]);

/**
 * Keywords whose values are a single subschema.
 */
const SINGLE_SCHEMA_KEYWORDS = [
  'not',
  'if',
  'then',
  'else',
  'items',
  'additionalItems',
  'additionalProperties',
  'unevaluatedItems',
  'unevaluatedProperties',
  'contains',
  'propertyNames',
] as const;

/**
 * Keywords whose values are arrays of subschemas.
 */
const ARRAY_SCHEMA_KEYWORDS = ['allOf', 'anyOf', 'oneOf', 'items', 'prefixItems'] as const;

/**
 * Keywords whose values are maps of name to subschema.
 */
const MAP_SCHEMA_KEYWORDS = [
  'properties',
  'patternProperties',
  'definitions',
  '$defs',
  'dependentSchemas',
  'dependencies',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-copy a schema, optionally dropping every `format` keyword.
 * The validator annotates the schema it is given, so callers' schemas are never passed in directly.
 */
function prepareSchema(schema: unknown, stripFormats: boolean): unknown {
  if (Array.isArray(schema)) return schema.map((s) => prepareSchema(s, stripFormats));
  if (!isPlainObject(schema)) return schema;

  const copy: Record<string, unknown> = structuredClone(schema);
  if (!stripFormats) return copy;

  const strip = (node: unknown): void => {
    if (!isPlainObject(node)) return;
    if (typeof node['format'] === 'string') delete node['format'];
    for (const key of SINGLE_SCHEMA_KEYWORDS) {
      if (!Array.isArray(node[key])) strip(node[key]);
    }
    for (const key of ARRAY_SCHEMA_KEYWORDS) {
      const value = node[key];
      if (Array.isArray(value)) value.forEach(strip);
    }
    for (const key of MAP_SCHEMA_KEYWORDS) {
      const value = node[key];
      if (isPlainObject(value)) Object.values(value).forEach(strip);
    }
  };
  strip(copy);
  return copy;
}

/**
 * Convert a validator instance location (e.g. "#/foo/bar/0") to a path array.
 */
function instanceLocationToPath(instanceLocation: string): string[] {
  const pointer = instanceLocation.startsWith('#') ? instanceLocation.slice(1) : instanceLocation;
  if (!pointer) return [];
  return pointer
    .split('/')
    .slice(1)
    .map((segment) => decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~'));
}

/**
 * Convert validator output to migrex ValidationErrors, keeping the most specific errors.
 */
function toValidationErrors(errors: OutputUnit[]): ValidationError[] {
  let specific = errors.filter((e) => !SUMMARY_KEYWORDS.has(e.keyword));
  if (specific.length === 0) specific = errors;

  // A `false` subschema error ("False boolean schema.") is redundant when its
  // parent keyword (e.g. additionalProperties) already reported the failure.
  const withoutFalse = specific.filter((e) => e.keyword !== 'false');
  if (withoutFalse.length > 0) specific = withoutFalse;

  return specific.map((error) => ({
    path: instanceLocationToPath(error.instanceLocation),
    message: error.error,
    code: error.keyword,
  }));
}

/**
 * Validate data with a compiled validator and convert the result.
 */
function runValidator<T>(validator: Validator, data: unknown): ValidationResult<T> {
  const result = validator.validate(data);
  if (!result.valid) {
    return { success: false, errors: toValidationErrors(result.errors) };
  }
  return { success: true, data: data as T };
}

/**
 * A JSON Schema plugin instance with a pre-configured validator.
 */
export interface JsonSchemaPlugin {
  /**
   * Plugin identifier.
   */
  readonly id: 'json-schema';

  /**
   * Human-readable name.
   */
  readonly name: string;

  /**
   * The JSON Schema draft this plugin validates against.
   */
  readonly draft: JsonSchemaDraft;

  /**
   * Create a versioned schema from a JSON Schema.
   */
  fromJsonSchema<T = unknown>(
    version: string,
    schema: JSONSchema7,
    options?: FromJsonSchemaOptions<T>
  ): VersionedSchema<T>;

  /**
   * Create a field schema from a JSON Schema for use with the preservation stash.
   */
  createFieldSchema(schema: JSONSchema7, options?: { description?: string }): FieldSchema;
}

/**
 * Create a JSON Schema plugin with custom configuration.
 *
 * @example
 * ```typescript
 * import { createJsonSchemaPlugin } from '@migrex/json-schema';
 *
 * const plugin = createJsonSchemaPlugin({
 *   draft: '7',
 *   allErrors: true,
 * });
 *
 * const schema = plugin.fromJsonSchema('1.0.0', {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     email: { type: 'string', format: 'email' },
 *   },
 *   required: ['name', 'email'],
 * });
 * ```
 *
 * @param options - Plugin configuration options
 * @returns A configured JSON Schema plugin
 */
export function createJsonSchemaPlugin(options?: JsonSchemaPluginOptions): JsonSchemaPlugin {
  const draft: JsonSchemaDraft = options?.draft ?? '7';
  const shortCircuit = options?.allErrors === false;
  const stripFormats = options?.useFormats === false;

  const compile = (schema: JSONSchema7): Validator =>
    new Validator(prepareSchema(schema, stripFormats) as CfworkerSchema, draft, shortCircuit);

  return {
    id: 'json-schema',
    name: 'JSON Schema Plugin',
    draft,

    fromJsonSchema<T = unknown>(
      version: string,
      schema: JSONSchema7,
      opts?: FromJsonSchemaOptions<T>
    ): VersionedSchema<T> {
      const validator = compile(schema);

      return {
        version,

        schema(data: unknown): ValidationResult<T> {
          return runValidator<T>(validator, data);
        },

        ...(opts?.validate !== undefined && { validate: opts.validate }),
        ...(opts?.deprecated !== undefined && { deprecated: opts.deprecated }),
        ...(opts?.releaseDate !== undefined && { releaseDate: opts.releaseDate }),
      };
    },

    createFieldSchema(schema: JSONSchema7, opts?: { description?: string }): FieldSchema {
      const validator = compile(schema);

      return {
        validate(value: unknown): ValidationResult<unknown> {
          return runValidator<unknown>(validator, value);
        },

        describe(): string {
          if (opts?.description) {
            return opts.description;
          }

          if (schema.description) {
            return schema.description;
          }

          if (schema.title) {
            return schema.title;
          }

          return 'Validated by JSON Schema';
        },
      };
    },
  };
}

// Create a default plugin instance
const defaultPlugin = createJsonSchemaPlugin();

/**
 * Create a versioned schema from a JSON Schema using the default plugin.
 *
 * @example
 * ```typescript
 * import { fromJsonSchema } from '@migrex/json-schema';
 *
 * const schemaV1 = fromJsonSchema('1.0.0', {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'integer', minimum: 0 },
 *   },
 *   required: ['name'],
 * });
 *
 * // Use with migration graph
 * graph.registerSchema(schemaV1);
 * ```
 *
 * @param version - The version string for this schema
 * @param schema - The JSON Schema definition
 * @param options - Optional configuration
 * @returns A VersionedSchema compatible with migrex
 */
export function fromJsonSchema<T = unknown>(
  version: string,
  schema: JSONSchema7,
  options?: FromJsonSchemaOptions<T>
): VersionedSchema<T> {
  return defaultPlugin.fromJsonSchema(version, schema, options);
}

/**
 * Create a field schema from a JSON Schema for use with the preservation stash.
 *
 * @example
 * ```typescript
 * import { createFieldSchema } from '@migrex/json-schema';
 *
 * const avatarSchema = createFieldSchema(
 *   { type: 'string', format: 'uri' },
 *   { description: 'User avatar URL' }
 * );
 *
 * // Use in migration context
 * ctx.preserve('avatar', data.avatar, {
 *   fieldSchema: avatarSchema,
 * });
 * ```
 *
 * @param schema - The JSON Schema definition
 * @param options - Optional configuration
 * @returns A FieldSchema for use with migrex stash
 */
export function createFieldSchema(
  schema: JSONSchema7,
  options?: { description?: string }
): FieldSchema {
  return defaultPlugin.createFieldSchema(schema, options);
}

/**
 * The default JSON Schema plugin instance.
 * Use this for advanced usage.
 */
export const jsonSchemaPlugin = defaultPlugin;

// Export schema extension utilities
export { extendJsonSchema, omitFromJsonSchema, type ExtendJsonSchemaOptions } from './extend.js';
