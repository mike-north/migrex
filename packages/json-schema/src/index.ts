/**
 * \@migrex/json-schema - JSON Schema plugin for migrex
 *
 * This package provides integration between migrex and JSON Schema,
 * allowing you to use JSON Schema definitions as versioned schemas in your migration graph.
 *
 * @packageDocumentation
 */

import type { VersionedSchema, ValidationResult, FieldSchema } from '@migrex/core';
import type { JSONSchema7 } from 'json-schema';
import { compileSchema, type CompiledSchema, type JsonSchemaDraft } from './validator.js';

/**
 * Re-export JSONSchema7 type for convenience.
 */
export type { JSONSchema7 as JSONSchema };

export type { JsonSchemaDraft };

/**
 * Options for creating a JSON Schema plugin.
 */
export interface JsonSchemaPluginOptions {
  /**
   * The JSON Schema draft used to interpret schemas that do not declare one.
   * A recognised `$schema` URI in a schema takes precedence.
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
   * The JSON Schema draft used for schemas that do not declare a `$schema`.
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
  const allErrors = options?.allErrors !== false;
  const stripFormats = options?.useFormats === false;

  const compile = (schema: JSONSchema7): CompiledSchema =>
    compileSchema(schema, { draft, allErrors, stripFormats });

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
          return validator.validate<T>(data);
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
          return validator.validate<unknown>(value);
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
