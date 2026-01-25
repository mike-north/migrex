/**
 * \@migrex/json-schema - JSON Schema plugin for migrex
 *
 * This package provides integration between migrex and JSON Schema,
 * allowing you to use JSON Schema definitions as versioned schemas in your migration graph.
 *
 * @packageDocumentation
 */

import { Ajv } from 'ajv';
import type { ErrorObject, Options as AjvOptions, ValidateFunction, AnySchema } from 'ajv';
import * as addFormatsModule from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
import type {
  VersionedSchema,
  ValidationResult,
  ValidationError,
  FieldSchema,
} from '@migrex/core';
import type { JSONSchema7 } from 'json-schema';

// Handle ajv-formats ESM/CJS interop - it only has a default export
// Cast the namespace import to access the default export without esModuleInterop
const addFormats: FormatsPlugin = (
  addFormatsModule as unknown as { default: FormatsPlugin }
).default;

/** Type alias for Ajv instance */
type AjvInstance = InstanceType<typeof Ajv>;

/**
 * Re-export JSONSchema7 type for convenience.
 */
export type { JSONSchema7 as JSONSchema };

/**
 * Options for creating a JSON Schema plugin.
 */
export interface JsonSchemaPluginOptions {
  /**
   * Additional Ajv options.
   * @see https://ajv.js.org/options.html
   */
  ajvOptions?: AjvOptions;

  /**
   * Whether to add format validators (e.g., email, uri, date-time).
   * @default true
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
 * Convert an Ajv error path to a string array.
 */
function instancePathToArray(instancePath: string): string[] {
  if (!instancePath) return [];
  // instancePath is like "/foo/bar/0" - split and filter empty strings
  return instancePath.split('/').filter(Boolean);
}

/**
 * Convert Ajv errors to migrex ValidationErrors.
 */
function ajvErrorsToValidationErrors(
  errors: ErrorObject[] | null | undefined
): ValidationError[] {
  if (!errors) return [];

  return errors.map((error) => ({
    path: instancePathToArray(error.instancePath),
    message: error.message ?? 'Validation failed',
    code: error.keyword,
  }));
}

/**
 * A JSON Schema plugin instance with a pre-configured Ajv validator.
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
   * The underlying Ajv instance.
   */
  readonly ajv: AjvInstance;

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
  createFieldSchema(
    schema: JSONSchema7,
    options?: { description?: string }
  ): FieldSchema;
}

/**
 * Create a JSON Schema plugin with custom configuration.
 *
 * @example
 * ```typescript
 * import { createJsonSchemaPlugin } from '@migrex/json-schema';
 *
 * const plugin = createJsonSchemaPlugin({
 *   ajvOptions: { allErrors: true },
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
export function createJsonSchemaPlugin(
  options?: JsonSchemaPluginOptions
): JsonSchemaPlugin {
  const ajv: AjvInstance = new Ajv({
    allErrors: true,
    strict: true,
    ...options?.ajvOptions,
  });

  // Add format validators by default
  if (options?.useFormats !== false) {
    addFormats(ajv);
  }

  return {
    id: 'json-schema',
    name: 'JSON Schema Plugin',
    ajv,

    fromJsonSchema<T = unknown>(
      version: string,
      schema: JSONSchema7,
      opts?: FromJsonSchemaOptions<T>
    ): VersionedSchema<T> {
      // JSONSchema7 is compatible with Ajv's AnySchema at runtime
      const validate: ValidateFunction<T> = ajv.compile<T>(schema as AnySchema);

      return {
        version,

        schema(data: unknown): ValidationResult<T> {
          const valid = validate(data);

          if (!valid) {
            return {
              success: false,
              errors: ajvErrorsToValidationErrors(validate.errors),
            };
          }

          return {
            success: true,
            data,
          };
        },

        ...(opts?.validate !== undefined && { validate: opts.validate }),
        ...(opts?.deprecated !== undefined && { deprecated: opts.deprecated }),
        ...(opts?.releaseDate !== undefined && { releaseDate: opts.releaseDate }),
      };
    },

    createFieldSchema(
      schema: JSONSchema7,
      opts?: { description?: string }
    ): FieldSchema {
      // JSONSchema7 is compatible with Ajv's AnySchema at runtime
      const validate: ValidateFunction = ajv.compile(schema as AnySchema);

      return {
        validate(value: unknown): ValidationResult<unknown> {
          const valid = validate(value);

          if (!valid) {
            return {
              success: false,
              errors: ajvErrorsToValidationErrors(validate.errors),
            };
          }

          return {
            success: true,
            data: value,
          };
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
 * Use this to access the underlying Ajv instance or for advanced usage.
 */
export const jsonSchemaPlugin = defaultPlugin;
