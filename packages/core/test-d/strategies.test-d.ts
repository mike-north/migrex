import { expectAssignable, expectType } from 'tsd';
import {
  calverStrategy,
  integerStrategy,
  semverStrategy,
  type IncrementType,
  type VersionComponents,
  type VersionStrategy,
} from '@migrex/core';

// Verify strategies implement VersionStrategy interface
expectType<VersionStrategy>(semverStrategy);
expectType<VersionStrategy>(calverStrategy);
expectType<VersionStrategy>(integerStrategy);

// Verify strategies are assignable to VersionStrategy
expectAssignable<VersionStrategy>(semverStrategy);
expectAssignable<VersionStrategy>(calverStrategy);
expectAssignable<VersionStrategy>(integerStrategy);

// Verify compare returns correct union type
expectType<-1 | 0 | 1>(semverStrategy.compare('1.0.0', '2.0.0'));
expectType<-1 | 0 | 1>(calverStrategy.compare('2024-01-01', '2024-01-02'));
expectType<-1 | 0 | 1>(integerStrategy.compare('1', '2'));

// Verify isValid returns boolean
expectType<boolean>(semverStrategy.isValid('1.0.0'));
expectType<boolean>(calverStrategy.isValid('2024-01-01'));
expectType<boolean>(integerStrategy.isValid('1'));

// Verify optional methods exist and return correct types
if (semverStrategy.normalize) {
  expectType<string>(semverStrategy.normalize('v1.0.0'));
}

if (semverStrategy.parse) {
  expectType<VersionComponents>(semverStrategy.parse('1.0.0'));
}

if (semverStrategy.increment) {
  expectType<string>(semverStrategy.increment('1.0.0', 'major'));
}

// Verify VersionComponents structure
const components: VersionComponents = {
  parts: [1, 2, 3],
  prerelease: 'alpha',
  build: 'build.123',
};
expectType<VersionComponents>(components);

// Verify VersionComponents with minimal fields
const minimalComponents: VersionComponents = {
  parts: [1],
};
expectType<VersionComponents>(minimalComponents);

// Verify VersionComponents parts can be strings or numbers
const mixedComponents: VersionComponents = {
  parts: [1, 'a', 2, 'b'],
};
expectType<VersionComponents>(mixedComponents);

// Verify IncrementType is a union of string literals
const majorType: IncrementType = 'major';
const minorType: IncrementType = 'minor';
const patchType: IncrementType = 'patch';
const prereleaseType: IncrementType = 'prerelease';

expectAssignable<IncrementType>(majorType);
expectAssignable<IncrementType>(minorType);
expectAssignable<IncrementType>(patchType);
expectAssignable<IncrementType>(prereleaseType);

// Verify strategy id is string (VersionStrategy.id is typed as string, not literals)
expectType<string>(semverStrategy.id);
expectType<string>(calverStrategy.id);
expectType<string>(integerStrategy.id);

// Verify the actual id values at runtime (these are string assertions, not type assertions)
// Note: The id type is 'string' in the interface, not branded literals
