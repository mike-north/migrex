import { expectType, expectAssignable } from 'tsd';
import { createMigrationContext } from '../src/context.js';
import type {
  MigrationContext,
  PreservedField,
  PreserveResult,
  StashSummary,
  SingleValuePreservation,
  MultiValuePreservation,
} from '../src/types.js';

const context = createMigrationContext(3);

// Verify context implements MigrationContext
expectAssignable<MigrationContext>(context);

// Verify preserve returns PreserveResult
const preserveResult = context.preserve('field', 'value');
expectType<PreserveResult>(preserveResult);

// Verify preserve accepts metadata
const preserveWithMeta = context.preserve('field', 'value', {
  sourceVersion: '1.0.0',
  description: 'test',
});
expectType<PreserveResult>(preserveWithMeta);

// Verify preserve accepts any value type
expectType<PreserveResult>(context.preserve('field', 'string'));
expectType<PreserveResult>(context.preserve('field', 123));
expectType<PreserveResult>(context.preserve('field', true));
expectType<PreserveResult>(context.preserve('field', null));
expectType<PreserveResult>(context.preserve('field', undefined));
expectType<PreserveResult>(context.preserve('field', { nested: 'object' }));
expectType<PreserveResult>(context.preserve('field', [1, 2, 3]));

// Verify consume returns PreservedField | undefined
const consumeResult = context.consume('field');
expectType<PreservedField | undefined>(consumeResult);

// Verify peek returns PreservedField | undefined
const peekResult = context.peek('field');
expectType<PreservedField | undefined>(peekResult);

// Verify listPreserved returns readonly PreservedField[]
const listResult = context.listPreserved();
expectType<readonly PreservedField[]>(listResult);

// Verify hasPreserved returns boolean
const hasResult = context.hasPreserved('field');
expectType<boolean>(hasResult);

// Verify getAuditLog returns string
const auditLog = context.getAuditLog();
expectType<string>(auditLog);

// Verify getSummary returns StashSummary
const summary = context.getSummary();
expectType<StashSummary>(summary);

// Verify currentStep is readonly
const currentStep = context.currentStep;
expectType<
  Readonly<{
    from: string;
    to: string;
    direction: 'up' | 'down';
    index: number;
    totalSteps: number;
  }>
>(currentStep);

// Verify currentStep properties are correct types
expectType<string>(currentStep.from);
expectType<string>(currentStep.to);
expectType<'up' | 'down'>(currentStep.direction);
expectType<number>(currentStep.index);
expectType<number>(currentStep.totalSteps);

// Verify PreserveResult variants
if (preserveResult.status === 'preserved') {
  expectType<PreservedField>(preserveResult.field);
  expectType<SingleValuePreservation | MultiValuePreservation>(
    preserveResult.field
  );
} else if (preserveResult.status === 'already_preserved') {
  expectType<PreservedField>(preserveResult.field);
  expectType<string>(preserveResult.note);
} else if (preserveResult.status === 'conflict') {
  expectType<PreservedField>(preserveResult.existing);
  expectType<unknown>(preserveResult.attemptedValue);
  expectType<string>(preserveResult.reason);
}

// Verify PreservedField discriminated union
const field: PreservedField = {} as PreservedField;
if (field.kind === 'single') {
  expectType<SingleValuePreservation>(field);
  expectType<string>(field.path);
  expectType<unknown>(field.value);
  expectType<readonly import('../src/types.js').PreservationEvent[]>(
    field.history
  );
} else if (field.kind === 'multi') {
  expectType<MultiValuePreservation>(field);
  expectType<string>(field.path);
  expectType<boolean>(field.valuesEquivalent);
  expectType<
    ReadonlyArray<{
      readonly value: unknown;
      readonly event: import('../src/types.js').PreservationEvent;
      readonly metadata?: import('../src/types.js').PreservationMetadata;
    }>
  >(field.entries);
}

// Verify StashSummary structure
expectType<
  readonly import('../src/types.js').PreservedFieldSummary[]
>(summary.consumed);
expectType<
  readonly import('../src/types.js').PreservedFieldSummary[]
>(summary.unconsumed);
expectType<boolean>(summary.lossless);

// Verify methods don't accept invalid types
// @ts-expect-error - field name must be string
context.preserve(123, 'value');

// @ts-expect-error - hasPreserved requires string
context.hasPreserved(123);

// @ts-expect-error - consume requires string
context.consume(123);

// @ts-expect-error - peek requires string
context.peek(123);

// Verify readonly properties cannot be mutated
// @ts-expect-error - currentStep is readonly
context.currentStep = {
  from: '2.0.0',
  to: '3.0.0',
  direction: 'up',
  index: 1,
  totalSteps: 3,
};

// @ts-expect-error - currentStep.from is readonly
currentStep.from = '2.0.0';

// @ts-expect-error - listPreserved returns readonly array
listResult.push({} as PreservedField);
