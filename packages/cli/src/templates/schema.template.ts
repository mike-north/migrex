/**
 * Template for generating schema files.
 *
 * @packageDocumentation
 */

/**
 * Options for generating a schema template.
 * @public
 */
export interface SchemaTemplateOptions {
  /** Schema version */
  version: string;
  /** Plugin to use (zod or json-schema) */
  plugin: 'zod' | 'json-schema';
}

/**
 * Generate a schema template file content.
 * @param options - Template options
 * @returns Generated file content
 * @public
 */
export function generateSchemaTemplate(options: SchemaTemplateOptions): string {
  if (options.plugin === 'zod') {
    return generateZodSchemaTemplate(options.version);
  } else {
    return generateJsonSchemaTemplate(options.version);
  }
}

/**
 * Generate a Zod schema template.
 */
function generateZodSchemaTemplate(version: string): string {
  const versionIdentifier = version.replace(/\./g, '_');

  return `import { z } from 'zod';
import { fromZod } from '@migrex/zod';

/**
 * Schema for version ${version}.
 */
export const schema = z.object({
  version: z.literal('${version}'),
  // Add your fields here
  // Example:
  // id: z.string(),
  // name: z.string(),
  // createdAt: z.string().datetime(),
});

/**
 * TypeScript type inferred from the schema.
 */
export type Schema = z.infer<typeof schema>;

/**
 * Versioned schema for migrex.
 */
export const v${versionIdentifier} = fromZod('${version}', schema);
`;
}

/**
 * Generate a JSON Schema template.
 */
function generateJsonSchemaTemplate(version: string): string {
  const versionIdentifier = version.replace(/\./g, '_');

  return `import { fromJsonSchema } from '@migrex/json-schema';
import type { JSONSchema7 } from 'json-schema';

/**
 * JSON Schema for version ${version}.
 */
export const schema: JSONSchema7 = {
  type: 'object',
  required: ['version'],
  properties: {
    version: {
      type: 'string',
      const: '${version}',
    },
    // Add your fields here
    // Example:
    // id: { type: 'string' },
    // name: { type: 'string' },
    // createdAt: { type: 'string', format: 'date-time' },
  },
  additionalProperties: false,
};

/**
 * Versioned schema for migrex.
 */
export const v${versionIdentifier} = fromJsonSchema('${version}', schema);
`;
}
