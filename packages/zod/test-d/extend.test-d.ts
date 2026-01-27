import { expectType, expectNotType, expectError, expectAssignable } from 'tsd';
import { z } from 'zod';
import { extendZodSchema, omitFromZodSchema } from '@migrex/zod';

// Test extendZodSchema type inference
const BaseSchema = z.object({
  version: z.literal('1.0.0'),
  name: z.string(),
  count: z.number(),
});

const ExtendedSchema = extendZodSchema(BaseSchema, '1.1.0', {
  email: z.string(),
  active: z.boolean(),
});

type ExtendedType = z.infer<typeof ExtendedSchema>;

// Verify version is updated to literal type
expectType<'1.1.0'>({} as ExtendedType['version']);
expectNotType<'1.0.0'>({} as ExtendedType['version']);

// Verify base fields are preserved
expectType<string>({} as ExtendedType['name']);
expectType<number>({} as ExtendedType['count']);

// Verify extension fields are added
expectType<string>({} as ExtendedType['email']);
expectType<boolean>({} as ExtendedType['active']);

// Verify the full type is correct
const extendedData: ExtendedType = {
  version: '1.1.0',
  name: 'test',
  count: 42,
  email: 'test@example.com',
  active: true,
};
expectAssignable<ExtendedType>(extendedData);

// Verify old version is not compatible with the new type
// Note: The version field type is '1.1.0', not '1.0.0'
type VersionField = ExtendedType['version'];
expectType<'1.1.0'>({} as VersionField);

// Test extendZodSchema with empty extensions
const NoExtensionsSchema = extendZodSchema(BaseSchema, '2.0.0', {});
type NoExtensionsType = z.infer<typeof NoExtensionsSchema>;

expectType<'2.0.0'>({} as NoExtensionsType['version']);
expectType<string>({} as NoExtensionsType['name']);
expectType<number>({} as NoExtensionsType['count']);

// Test extendZodSchema with default values
const WithDefaultsSchema = extendZodSchema(BaseSchema, '1.2.0', {
  logLevel: z.string().default('info'),
});
type WithDefaultsType = z.infer<typeof WithDefaultsSchema>;

expectType<string>({} as WithDefaultsType['logLevel']);

// Test extendZodSchema with optional fields
const WithOptionalSchema = extendZodSchema(BaseSchema, '1.3.0', {
  nickname: z.string().optional(),
});
type WithOptionalType = z.infer<typeof WithOptionalSchema>;

expectType<string | undefined>({} as WithOptionalType['nickname']);

// Test chaining extensions
const ChainedSchema1 = extendZodSchema(BaseSchema, '1.1.0', {
  email: z.string(),
});
const ChainedSchema2 = extendZodSchema(ChainedSchema1, '1.2.0', {
  phone: z.string(),
});
type ChainedType = z.infer<typeof ChainedSchema2>;

expectType<'1.2.0'>({} as ChainedType['version']);
expectType<string>({} as ChainedType['name']);
expectType<number>({} as ChainedType['count']);
expectType<string>({} as ChainedType['email']);
expectType<string>({} as ChainedType['phone']);

// Test omitFromZodSchema type inference
const SchemaWithDeprecated = z.object({
  version: z.literal('1.0.0'),
  name: z.string(),
  email: z.string(),
  deprecated1: z.string(),
  deprecated2: z.number(),
});

const OmittedSchema = omitFromZodSchema(SchemaWithDeprecated, '2.0.0', [
  'deprecated1',
  'deprecated2',
]);
type OmittedType = z.infer<typeof OmittedSchema>;

// Verify version is updated
expectType<'2.0.0'>({} as OmittedType['version']);

// Verify remaining fields are preserved
expectType<string>({} as OmittedType['name']);
expectType<string>({} as OmittedType['email']);

// Verify omitted fields are not in the type
// Note: Accessing non-existent properties results in type `any` in TypeScript,
// so we can't use expectError here. Instead, we verify the structure is correct.
type OmittedKeys = keyof OmittedType;
type HasDeprecated1 = 'deprecated1' extends OmittedKeys ? true : false;
type HasDeprecated2 = 'deprecated2' extends OmittedKeys ? true : false;
expectType<false>({} as HasDeprecated1);
expectType<false>({} as HasDeprecated2);

// Verify the full type is correct
const omittedData: OmittedType = {
  version: '2.0.0',
  name: 'test',
  email: 'test@example.com',
};
expectAssignable<OmittedType>(omittedData);

// Test omitFromZodSchema with empty array
const NoOmissionsSchema = omitFromZodSchema(SchemaWithDeprecated, '2.1.0', []);
type NoOmissionsType = z.infer<typeof NoOmissionsSchema>;

expectType<'2.1.0'>({} as NoOmissionsType['version']);
expectType<string>({} as NoOmissionsType['name']);
expectType<string>({} as NoOmissionsType['email']);
expectType<string>({} as NoOmissionsType['deprecated1']);
expectType<number>({} as NoOmissionsType['deprecated2']);

// Test combining omit and extend
const CombinedBase = z.object({
  version: z.literal('1.0.0'),
  oldName: z.string(),
  age: z.number(),
});

const CombinedWithoutOld = omitFromZodSchema(CombinedBase, '2.0.0', ['oldName']);
const CombinedWithNew = extendZodSchema(CombinedWithoutOld, '2.0.0', {
  firstName: z.string(),
  lastName: z.string(),
});
type CombinedType = z.infer<typeof CombinedWithNew>;

expectType<'2.0.0'>({} as CombinedType['version']);
expectType<number>({} as CombinedType['age']);
expectType<string>({} as CombinedType['firstName']);
expectType<string>({} as CombinedType['lastName']);

// Verify 'oldName' field was removed
type CombinedKeys = keyof CombinedType;
type HasOldName = 'oldName' extends CombinedKeys ? true : false;
expectType<false>({} as HasOldName);

// Test complex types in extensions
const ComplexExtensions = extendZodSchema(BaseSchema, '1.5.0', {
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
  nested: z.object({
    foo: z.string(),
    bar: z.number(),
  }),
});
type ComplexType = z.infer<typeof ComplexExtensions>;

expectType<string[]>({} as ComplexType['tags']);
expectType<Record<string, unknown>>({} as ComplexType['metadata']);
expectType<{ foo: string; bar: number }>({} as ComplexType['nested']);

// Test that schema parsing returns the correct type
const parsedExtended = ExtendedSchema.parse({
  version: '1.1.0',
  name: 'test',
  count: 42,
  email: 'test@example.com',
  active: true,
});
expectType<ExtendedType>(parsedExtended);

const parsedOmitted = OmittedSchema.parse({
  version: '2.0.0',
  name: 'test',
  email: 'test@example.com',
});
expectType<OmittedType>(parsedOmitted);
