/**
 * \@migrex/zod - Zod schema plugin for migrex
 *
 * This package provides integration between migrex and Zod schemas,
 * allowing you to use Zod schemas as versioned schemas in your migration graph.
 *
 * @packageDocumentation
 */

import type {
  VersionedSchema,
  ValidationResult,
  ValidationError,
  FieldSchema,
} from '@migrex/core';
import type { z, ZodType, ZodError, ZodIssue } from 'zod';

/**
 * Options for creating a versioned schema from a Zod schema.
 */
export interface FromZodOptions<T> {
  /**
   * Additional validation function to run after Zod parsing succeeds.
   * Use this for business logic validation that can't be expressed in Zod.
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
 * Convert a Zod issue path to a string array.
 */
function pathToStringArray(path: (string | number)[]): string[] {
  return path.map((p) => String(p));
}

/**
 * Convert a ZodError to migrex ValidationErrors.
 */
function zodErrorToValidationErrors(error: ZodError): ValidationError[] {
  return error.issues.map((issue: ZodIssue) => ({
    path: pathToStringArray(issue.path),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Create a versioned schema from a Zod schema.
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { fromZod } from '@migrex/zod';
 *
 * const UserV1Schema = z.object({
 *   name: z.string(),
 *   email: z.string().email(),
 * });
 *
 * const schemaV1 = fromZod('1.0.0', UserV1Schema);
 *
 * // Use with migration graph
 * graph.registerSchema(schemaV1);
 * ```
 *
 * @param version - The version string for this schema
 * @param zodSchema - The Zod schema to wrap
 * @param options - Optional configuration
 * @returns A VersionedSchema compatible with migrex
 */
export function fromZod<T>(
  version: string,
  zodSchema: ZodType<T>,
  options?: FromZodOptions<T>
): VersionedSchema<T> {
  return {
    version,

    schema(data: unknown): ValidationResult<T> {
      const result = zodSchema.safeParse(data);

      if (!result.success) {
        return {
          success: false,
          errors: zodErrorToValidationErrors(result.error),
        };
      }

      return {
        success: true,
        data: result.data,
      };
    },

    ...(options?.validate !== undefined && { validate: options.validate }),
    ...(options?.deprecated !== undefined && { deprecated: options.deprecated }),
    ...(options?.releaseDate !== undefined && { releaseDate: options.releaseDate }),
  };
}

/**
 * Options for creating a field schema from a Zod schema.
 */
export interface FieldSchemaOptions {
  /**
   * Human-readable description of the field.
   * If not provided, will attempt to use Zod's description if available.
   */
  description?: string;
}

/**
 * Create a FieldSchema from a Zod schema for use with the preservation stash.
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { createFieldSchema } from '@migrex/zod';
 *
 * const avatarSchema = createFieldSchema(
 *   z.string().url(),
 *   { description: 'User avatar URL' }
 * );
 *
 * // Use in migration context
 * ctx.preserve('avatar', data.avatar, {
 *   fieldSchema: avatarSchema,
 * });
 * ```
 *
 * @param zodSchema - The Zod schema to wrap
 * @param options - Optional configuration
 * @returns A FieldSchema for use with migrex stash
 */
export function createFieldSchema<T>(
  zodSchema: ZodType<T>,
  options?: FieldSchemaOptions
): FieldSchema {
  return {
    validate(value: unknown): ValidationResult<unknown> {
      const result = zodSchema.safeParse(value);

      if (!result.success) {
        return {
          success: false,
          errors: zodErrorToValidationErrors(result.error),
        };
      }

      return {
        success: true,
        data: result.data,
      };
    },

    describe(): string {
      if (options?.description) {
        return options.description;
      }

      // Try to get description from Zod schema
      const desc = (zodSchema as { description?: string }).description;
      if (desc) {
        return desc;
      }

      // Fall back to a generic description based on the schema type
      return `Validated by Zod schema`;
    },
  };
}

/**
 * Type helper to extract the inferred type from a Zod schema.
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import type { InferZodSchema } from '@migrex/zod';
 *
 * const UserSchema = z.object({
 *   name: z.string(),
 *   age: z.number(),
 * });
 *
 * type User = InferZodSchema<typeof UserSchema>;
 * // { name: string; age: number }
 * ```
 */
export type InferZodSchema<T extends ZodType> = z.infer<T>;

// Export schema extension utilities
export { extendZodSchema, omitFromZodSchema } from './extend.js';
