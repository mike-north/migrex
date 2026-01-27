/**
 * Schema extension utilities for Zod schemas.
 *
 * These utilities help reduce duplication when creating versioned schemas
 * by allowing you to extend existing schemas with new fields while updating
 * the version literal.
 *
 * @packageDocumentation
 */

import { z, type ZodObject, type ZodRawShape } from 'zod';

/**
 * Extends a Zod schema with new fields and updates the version literal.
 *
 * This function takes a base schema with a `version` field and creates a new
 * schema that includes all fields from the base (except version), adds new
 * fields from the extensions, and updates the version literal.
 *
 * @example
 * Basic extension with new fields
 * ```typescript
 * import { z } from 'zod';
 * import { extendZodSchema } from '@migrex/zod';
 *
 * const V1 = z.object({
 *   version: z.literal('1.0.0'),
 *   name: z.string(),
 *   port: z.number(),
 * });
 *
 * const V2 = extendZodSchema(V1, '1.1.0', {
 *   logLevel: z.string().default('info'),
 * });
 *
 * // V2 has: version: '1.1.0', name: string, port: number, logLevel: string
 * ```
 *
 * @example
 * Using with migrex versioned schemas
 * ```typescript
 * import { z } from 'zod';
 * import { extendZodSchema, fromZod } from '@migrex/zod';
 *
 * const ConfigV1Schema = z.object({
 *   version: z.literal('1.0.0'),
 *   host: z.string(),
 *   port: z.number(),
 * });
 *
 * const ConfigV2Schema = extendZodSchema(ConfigV1Schema, '2.0.0', {
 *   timeout: z.number().default(5000),
 *   retries: z.number().default(3),
 * });
 *
 * // Register both versions in the migration graph
 * const v1 = fromZod('1.0.0', ConfigV1Schema);
 * const v2 = fromZod('2.0.0', ConfigV2Schema);
 * ```
 *
 * @typeParam TBase - The base schema's raw shape type
 * @typeParam TExtensions - The extensions schema's raw shape type
 * @typeParam TVersion - The new version literal type
 *
 * @param base - The base Zod object schema to extend
 * @param newVersion - The new version string literal
 * @param extensions - An object containing the new fields to add
 *
 * @returns A new Zod object schema with the updated version and new fields
 */
export function extendZodSchema<
  TBase extends ZodRawShape,
  TExtensions extends ZodRawShape,
  TVersion extends string,
>(
  base: ZodObject<TBase>,
  newVersion: TVersion,
  extensions: TExtensions
): ZodObject<
  Omit<TBase, 'version'> & TExtensions & { version: z.ZodLiteral<TVersion> }
> {
  // Get the base shape without the version field
  const { version: _oldVersion, ...baseShape } = base.shape;

  // Create new schema with updated version and extensions
  return z.object({
    ...baseShape,
    ...extensions,
    version: z.literal(newVersion),
  }) as ZodObject<
    Omit<TBase, 'version'> & TExtensions & { version: z.ZodLiteral<TVersion> }
  >;
}

/**
 * Creates a Zod schema that omits specific fields from a base schema.
 *
 * This function is useful for removing deprecated fields when creating new
 * schema versions. It takes a base schema, removes specified fields, and
 * updates the version literal.
 *
 * @example
 * Removing deprecated fields
 * ```typescript
 * import { z } from 'zod';
 * import { omitFromZodSchema } from '@migrex/zod';
 *
 * const V1 = z.object({
 *   version: z.literal('1.0.0'),
 *   name: z.string(),
 *   legacyField: z.string(),
 *   deprecatedFlag: z.boolean(),
 * });
 *
 * const V2 = omitFromZodSchema(V1, '2.0.0', ['legacyField', 'deprecatedFlag']);
 * // V2 has: version: '2.0.0', name: string (deprecated fields removed)
 * ```
 *
 * @example
 * Combining omit and extend
 * ```typescript
 * import { z } from 'zod';
 * import { omitFromZodSchema, extendZodSchema } from '@migrex/zod';
 *
 * const V1 = z.object({
 *   version: z.literal('1.0.0'),
 *   oldName: z.string(),
 *   age: z.number(),
 * });
 *
 * // Remove old field and add new one
 * const V2WithoutOld = omitFromZodSchema(V1, '2.0.0', ['oldName']);
 * const V2 = extendZodSchema(V2WithoutOld, '2.0.0', {
 *   firstName: z.string(),
 *   lastName: z.string(),
 * });
 * ```
 *
 * @typeParam TBase - The base schema's raw shape type
 * @typeParam TKeys - The keys to omit from the base schema
 * @typeParam TVersion - The new version literal type
 *
 * @param base - The base Zod object schema
 * @param newVersion - The new version string literal
 * @param keysToOmit - An array of field names to remove from the schema
 *
 * @returns A new Zod object schema without the omitted fields and with updated version
 */
export function omitFromZodSchema<
  TBase extends ZodRawShape,
  TKeys extends Exclude<keyof TBase, 'version'>,
  TVersion extends string,
>(
  base: ZodObject<TBase>,
  newVersion: TVersion,
  keysToOmit: TKeys[]
): ZodObject<
  Omit<TBase, TKeys | 'version'> & { version: z.ZodLiteral<TVersion> }
> {
  // Start with a copy of the base shape
  const baseShape = { ...base.shape };

  // Remove the keys to omit
  for (const key of keysToOmit) {
    delete baseShape[key];
  }

  // Remove old version using bracket notation to avoid TS4111 error
  delete baseShape['version'];

  // Create new schema with updated version
  return z.object({
    ...baseShape,
    version: z.literal(newVersion),
  }) as ZodObject<
    Omit<TBase, TKeys | 'version'> & { version: z.ZodLiteral<TVersion> }
  >;
}
