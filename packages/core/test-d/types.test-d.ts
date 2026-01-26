import { expectType, expectAssignable, expectNotAssignable } from 'tsd';
import type {
  ValidationResult,
  ValidationError,
  VersionedSchema,
  MigrationTraits,
  ReversibleMigration,
  OneWayMigration,
  Migration,
  MigrationPath,
  MigrationStep,
  MigrateOptions,
  MigrationResult,
  StashSummary,
  PreservedFieldSummary,
  PreservationMetadata,
  FieldSchema,
  PreservationEvent,
  SingleValuePreservation,
  MultiValuePreservation,
  PreservedField,
  PreserveResult,
  MigrationContext,
  MigrationGraphOptions,
  VersionStrategy,
  VersionComponents,
  IncrementType,
} from '@migrex/core';

// ValidationResult
const successResult: ValidationResult<string> = {
  success: true,
  data: 'test',
};
expectType<ValidationResult<string>>(successResult);

const failureResult: ValidationResult<string> = {
  success: false,
  errors: [{ path: ['field'], message: 'error' }],
};
expectType<ValidationResult<string>>(failureResult);

// ValidationError
const validationError: ValidationError = {
  path: ['user', 'email'],
  message: 'Invalid email',
};
expectType<ValidationError>(validationError);

const validationErrorWithCode: ValidationError = {
  path: [],
  message: 'Root error',
  code: 'INVALID_ROOT',
};
expectType<ValidationError>(validationErrorWithCode);

// VersionedSchema
const schema: VersionedSchema<{ name: string }> = {
  version: '1.0.0',
  schema: (data: unknown) => ({ success: true, data: { name: 'test' } }),
};
expectType<VersionedSchema<{ name: string }>>(schema);

const schemaWithValidate: VersionedSchema<{ age: number }> = {
  version: '2.0.0',
  schema: (data: unknown) => ({ success: true, data: { age: 25 } }),
  validate: (data: { age: number }) => ({ success: true, data }),
};
expectType<VersionedSchema<{ age: number }>>(schemaWithValidate);

const deprecatedSchema: VersionedSchema<string> = {
  version: '1.0.0',
  schema: (data: unknown) => ({ success: true, data: 'test' }),
  deprecated: {
    since: '2.0.0',
    deadline: '3.0.0',
    successor: '2.1.0',
    message: 'Use 2.1.0 instead',
  },
};
expectType<VersionedSchema<string>>(deprecatedSchema);

// MigrationTraits
const traits: MigrationTraits = {
  lossy: true,
  restructures: 'Field renamed from X to Y',
  semanticShift: false,
  precisionLoss: 'Float converted to int',
};
expectType<MigrationTraits>(traits);

// ReversibleMigration
const reversible: ReversibleMigration<{ v1: string }, { v2: string }> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data, ctx) => ({ v2: data.v1 }),
  down: (data, ctx) => ({ v1: data.v2 }),
};
expectType<ReversibleMigration<{ v1: string }, { v2: string }>>(reversible);

const reversibleWithTraits: ReversibleMigration<number, string> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data, ctx) => String(data),
  down: (data, ctx) => Number(data),
  traits: {
    up: { normalizes: true },
    down: { precisionLoss: 'String to number may lose precision' },
  },
  description: 'Convert between number and string',
};
expectType<ReversibleMigration<number, string>>(reversibleWithTraits);

// OneWayMigration
const oneWay: OneWayMigration<{ old: string }, { new: number }> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data, ctx) => ({ new: data.old.length }),
  irreversibleReason: 'Cannot recover original string from length',
};
expectType<OneWayMigration<{ old: string }, { new: number }>>(oneWay);

const oneWayWithTraits: OneWayMigration<string[], string> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data, ctx) => data.join(','),
  irreversibleReason: 'Cannot determine original array structure',
  traits: {
    up: { lossy: 'Array structure lost' },
  },
  description: 'Flatten array to CSV',
};
expectType<OneWayMigration<string[], string>>(oneWayWithTraits);

// OneWayMigration should not allow down function
// Using expectNotAssignable to verify that a migration with 'down' is not a OneWayMigration
const migrationWithDown = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data: string) => Number(data),
  down: (data: number) => String(data),
  irreversibleReason: 'test',
} as const;
// A migration with a 'down' function should not be assignable to OneWayMigration
expectNotAssignable<OneWayMigration<string, number>>(migrationWithDown);

// Migration union type
const migration1: Migration<number, string> = reversibleWithTraits as Migration<
  number,
  string
>;
expectType<Migration<number, string>>(migration1);

const migration2: Migration<string[], string> = oneWayWithTraits as Migration<
  string[],
  string
>;
expectType<Migration<string[], string>>(migration2);

// MigrationPath
const path: MigrationPath = {
  steps: [],
  direction: 'up',
  hasIrreversibleStep: false,
};
expectType<MigrationPath>(path);

const pathWithSteps: MigrationPath = {
  steps: [
    {
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      direction: 'up',
      migration: reversible as Migration<unknown, unknown>,
    },
  ],
  direction: 'mixed',
  hasIrreversibleStep: true,
};
expectType<MigrationPath>(pathWithSteps);

// MigrationStep
const step: MigrationStep = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  direction: 'down',
  migration: reversible as Migration<unknown, unknown>,
};
expectType<MigrationStep>(step);

// MigrateOptions
const options1: MigrateOptions = {};
expectType<MigrateOptions>(options1);

const options2: MigrateOptions = {
  skipValidation: true,
  validateIntermediate: false,
};
expectType<MigrateOptions>(options2);

// MigrationResult
const result: MigrationResult<{ data: string }> = {
  success: true,
  data: { data: 'test' },
  path: { steps: [], direction: 'up', hasIrreversibleStep: false },
  stash: { consumed: [], unconsumed: [], lossless: true },
  preservedFields: [],
};
expectType<MigrationResult<{ data: string }>>(result);

const failedResult: MigrationResult<string> = {
  success: false,
  path: { steps: [], direction: 'up', hasIrreversibleStep: false },
  stash: { consumed: [], unconsumed: [], lossless: false },
  preservedFields: [],
  error: new Error('Migration failed'),
};
expectType<MigrationResult<string>>(failedResult);

// StashSummary
const stash: StashSummary = {
  consumed: [],
  unconsumed: [
    {
      path: 'field',
      preservedAt: '1.0.0',
      history: [],
    },
  ],
  lossless: false,
};
expectType<StashSummary>(stash);

// PreservedFieldSummary
const fieldSummary: PreservedFieldSummary = {
  path: 'user.profile.avatar',
  preservedAt: '1.0.0',
  consumedAt: '2.0.0',
  history: [
    {
      type: 'preserved',
      version: '1.0.0',
      direction: 'up',
      stepIndex: 0,
      timestamp: Date.now(),
    },
  ],
};
expectType<PreservedFieldSummary>(fieldSummary);

// PreservationMetadata
const metadata: PreservationMetadata = {
  sourceVersion: '1.0.0',
  description: 'User avatar URL',
};
expectType<PreservationMetadata>(metadata);

const metadataWithSchema: PreservationMetadata = {
  fieldSchema: {
    validate: (value: unknown) => ({ success: true, data: value }),
    describe: () => 'string',
  },
};
expectType<PreservationMetadata>(metadataWithSchema);

// FieldSchema
const fieldSchema: FieldSchema = {
  validate: (value: unknown) => ({ success: true, data: value }),
  describe: () => 'A string field',
};
expectType<FieldSchema>(fieldSchema);

// PreservationEvent
const event: PreservationEvent = {
  type: 'preserved',
  version: '1.0.0',
  direction: 'up',
  stepIndex: 0,
  timestamp: Date.now(),
};
expectType<PreservationEvent>(event);

const eventWithMetadata: PreservationEvent = {
  type: 'consumed',
  version: '2.0.0',
  direction: 'down',
  stepIndex: 5,
  metadata: { sourceVersion: '1.0.0' },
  timestamp: Date.now(),
};
expectType<PreservationEvent>(eventWithMetadata);

// SingleValuePreservation
const singleValue: SingleValuePreservation = {
  kind: 'single',
  path: 'field',
  value: 'test',
  history: [event],
};
expectType<SingleValuePreservation>(singleValue);

// MultiValuePreservation
const multiValue: MultiValuePreservation = {
  kind: 'multi',
  path: 'field',
  entries: [
    {
      value: 'test1',
      event: event,
      metadata: { sourceVersion: '1.0.0' },
    },
  ],
  valuesEquivalent: false,
};
expectType<MultiValuePreservation>(multiValue);

// PreservedField union
const preserved1: PreservedField = singleValue;
expectAssignable<PreservedField>(preserved1);

const preserved2: PreservedField = multiValue;
expectAssignable<PreservedField>(preserved2);

// Type narrowing for PreservedField
declare const preservedField: PreservedField;
if (preservedField.kind === 'single') {
  expectType<SingleValuePreservation>(preservedField);
  expectType<unknown>(preservedField.value);
  expectType<readonly PreservationEvent[]>(preservedField.history);
} else {
  expectType<MultiValuePreservation>(preservedField);
  expectType<boolean>(preservedField.valuesEquivalent);
  expectType<
    ReadonlyArray<{
      readonly value: unknown;
      readonly event: PreservationEvent;
      readonly metadata?: PreservationMetadata;
    }>
  >(preservedField.entries);
}

// PreserveResult
const preserveSuccess: PreserveResult = {
  status: 'preserved',
  field: singleValue,
};
expectAssignable<PreserveResult>(preserveSuccess);

const preserveAlready: PreserveResult = {
  status: 'already_preserved',
  field: multiValue,
  note: 'Already preserved',
};
expectAssignable<PreserveResult>(preserveAlready);

const preserveConflict: PreserveResult = {
  status: 'conflict',
  existing: singleValue,
  attemptedValue: 'new value',
  reason: 'Values differ',
};
expectAssignable<PreserveResult>(preserveConflict);

// Type narrowing for PreserveResult
declare const preserveResult: PreserveResult;
if (preserveResult.status === 'preserved') {
  expectType<PreservedField>(preserveResult.field);
  // @ts-expect-error - note should not exist on 'preserved' status
  preserveResult.note;
} else if (preserveResult.status === 'already_preserved') {
  expectType<PreservedField>(preserveResult.field);
  expectType<string>(preserveResult.note);
} else {
  expectType<PreservedField>(preserveResult.existing);
  expectType<unknown>(preserveResult.attemptedValue);
  expectType<string>(preserveResult.reason);
}

// MigrationContext
declare const ctx: MigrationContext;
expectType<PreserveResult>(ctx.preserve('field', 'value'));
expectType<PreserveResult>(
  ctx.preserve('field', 'value', { sourceVersion: '1.0.0' })
);
expectType<boolean>(ctx.hasPreserved('field'));
expectType<PreservedField | undefined>(ctx.consume('field'));
expectType<PreservedField | undefined>(ctx.peek('field'));
expectType<readonly PreservedField[]>(ctx.listPreserved());
expectType<string>(ctx.getAuditLog());
expectType<
  Readonly<{
    from: string;
    to: string;
    direction: 'up' | 'down';
    index: number;
    totalSteps: number;
  }>
>(ctx.currentStep);

// MigrationGraphOptions
const graphOptions: MigrationGraphOptions = {
  id: 'my-graph',
  versionStrategy: {
    id: 'semver',
    compare: (a, b) => 0,
    isValid: (v) => true,
  },
};
expectType<MigrationGraphOptions>(graphOptions);

// VersionStrategy
const strategy: VersionStrategy = {
  id: 'custom',
  compare: (a: string, b: string) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  },
  isValid: (version: string) => version.length > 0,
};
expectType<VersionStrategy>(strategy);

const fullStrategy: VersionStrategy = {
  id: 'full',
  compare: (a, b) => -1,
  isValid: (v) => true,
  normalize: (v) => v.trim(),
  parse: (v) => ({ parts: [1, 0, 0] }),
  increment: (v, type) => '2.0.0',
};
expectType<VersionStrategy>(fullStrategy);

// VersionComponents
const components: VersionComponents = {
  parts: [1, 2, 3],
};
expectType<VersionComponents>(components);

const fullComponents: VersionComponents = {
  parts: ['2024', '01', '15'],
  prerelease: 'alpha.1',
  build: 'build.123',
};
expectType<VersionComponents>(fullComponents);

// IncrementType - verify valid values are assignable
expectAssignable<IncrementType>('major');
expectAssignable<IncrementType>('minor');
expectAssignable<IncrementType>('patch');
expectAssignable<IncrementType>('prerelease');

// Verify invalid increment type is not assignable
expectNotAssignable<IncrementType>('invalid');

// Test readonly enforcement on arrays and objects
declare const testPath: MigrationPath;
// @ts-expect-error - steps is readonly
testPath.steps.push({} as MigrationStep);

declare const testValidation: ValidationResult<string>;
if (testValidation.errors) {
  // @ts-expect-error - errors is readonly
  testValidation.errors.push({} as ValidationError);
}

declare const testError: ValidationError;
// @ts-expect-error - path is readonly
testError.path.push('field');

// Note: PreservationEvent properties are not readonly (by design - they're data objects)
// The readonly enforcement is on the arrays that contain them

declare const testSingle: SingleValuePreservation;
// @ts-expect-error - history is readonly
testSingle.history.push({} as PreservationEvent);

declare const testMulti: MultiValuePreservation;
// @ts-expect-error - entries is readonly
testMulti.entries.push({
  value: 'test',
  event: {} as PreservationEvent,
});

// Test that currentStep is readonly
// @ts-expect-error - currentStep properties are readonly
ctx.currentStep.from = '2.0.0';
