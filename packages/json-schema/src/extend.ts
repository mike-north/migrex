import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

/**
 * Options for extending a JSON Schema with additional properties and requirements.
 */
export interface ExtendJsonSchemaOptions {
  /**
   * Additional properties to add to the schema.
   * These will be merged with existing properties.
   */
  additionalProperties?: Record<string, JSONSchema7Definition>;

  /**
   * Additional required fields to add to the schema.
   * These will be added to the existing required array.
   */
  additionalRequired?: string[];

  /**
   * Properties to remove from the schema.
   * These will be deleted from the properties object and removed from the required array.
   */
  removeProperties?: string[];

  /**
   * Required fields to remove from the schema.
   * The properties themselves will remain, but they will no longer be required.
   */
  removeRequired?: string[];
}

/**
 * Extends a JSON Schema with new properties and updates the version constant.
 *
 * This function creates a deep clone of the base schema and applies the specified
 * changes. It automatically updates the version constant in the schema properties
 * and handles the required array intelligently.
 *
 * @example
 * Basic extension with new properties
 * ```typescript
 * const v1Schema = {
 *   type: 'object',
 *   properties: {
 *     version: { const: '1.0.0' },
 *     name: { type: 'string' },
 *   },
 *   required: ['version', 'name'],
 * };
 *
 * const v2Schema = extendJsonSchema(v1Schema, '1.1.0', {
 *   additionalProperties: {
 *     logLevel: { type: 'string', default: 'info' }
 *   },
 *   additionalRequired: ['logLevel'],
 * });
 * ```
 *
 * @example
 * Removing deprecated properties
 * ```typescript
 * const v3Schema = extendJsonSchema(v2Schema, '2.0.0', {
 *   removeProperties: ['deprecatedField'],
 *   additionalProperties: {
 *     newField: { type: 'string' }
 *   },
 * });
 * ```
 *
 * @param base - The base JSON Schema to extend
 * @param newVersion - The version string for the new schema (will update the version constant)
 * @param options - Options specifying what to add, remove, or modify
 * @returns A new JSON Schema with the specified changes applied
 */
export function extendJsonSchema(
  base: JSONSchema7,
  newVersion: string,
  options: ExtendJsonSchemaOptions = {}
): JSONSchema7 {
  const {
    additionalProperties = {},
    additionalRequired = [],
    removeProperties = [],
    removeRequired = [],
  } = options;

  // Deep clone the base schema to avoid mutation
  const result = JSON.parse(JSON.stringify(base)) as JSONSchema7;

  // Ensure properties object exists
  result.properties ??= {};

  // Update version constant
  result.properties['version'] = { const: newVersion };

  // Add new properties
  for (const [key, value] of Object.entries(additionalProperties)) {
    result.properties[key] = value;
  }

  // Remove properties
  for (const key of removeProperties) {
    // Use Reflect.deleteProperty to satisfy ESLint no-dynamic-delete rule
    Reflect.deleteProperty(result.properties, key);
  }

  // Handle required array
  let required = Array.isArray(result.required) ? [...result.required] : [];

  // Add new required fields
  for (const field of additionalRequired) {
    if (!required.includes(field)) {
      required.push(field);
    }
  }

  // Remove required fields
  required = required.filter((field) => !removeRequired.includes(field));

  // Also remove from required if property was removed
  required = required.filter((field) => !removeProperties.includes(field));

  // Only set required if there are items, otherwise set to undefined
  result.required = required.length > 0 ? required : undefined;

  return result;
}

/**
 * Creates a new JSON Schema by omitting properties from a base schema.
 *
 * This is a convenience function that wraps {@link extendJsonSchema} specifically
 * for removing properties. It's useful when creating a new schema version that
 * deprecates certain fields.
 *
 * @example
 * ```typescript
 * const v2Schema = omitFromJsonSchema(v1Schema, '2.0.0', ['deprecatedField']);
 * ```
 *
 * @param base - The base JSON Schema to extend
 * @param newVersion - The version string for the new schema
 * @param propertiesToRemove - Array of property names to remove from the schema
 * @returns A new JSON Schema with the specified properties removed
 */
export function omitFromJsonSchema(
  base: JSONSchema7,
  newVersion: string,
  propertiesToRemove: string[]
): JSONSchema7 {
  return extendJsonSchema(base, newVersion, {
    removeProperties: propertiesToRemove,
  });
}
