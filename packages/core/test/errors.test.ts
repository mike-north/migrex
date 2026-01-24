import { describe, it, expect } from 'vitest';
import {
  MigrationError,
  NoPathError,
  SchemaValidationError,
  StashConflictError,
} from '../src/errors.js';

describe('MigrationError', () => {
  it('should create error with message, code, and details', () => {
    const error = new MigrationError('Test error', 'MIGRATION_FAILED', {
      foo: 'bar',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MigrationError);
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('MigrationError');
    expect(error.code).toBe('MIGRATION_FAILED');
    expect(error.details).toEqual({ foo: 'bar' });
  });

  it('should create error without details', () => {
    const error = new MigrationError('Test error', 'INVALID_VERSION');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('INVALID_VERSION');
    expect(error.details).toBeUndefined();
  });

  it('should maintain proper prototype chain', () => {
    const error = new MigrationError('Test', 'MIGRATION_FAILED');

    expect(error instanceof MigrationError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('NoPathError', () => {
  it('should create error with from and to versions', () => {
    const error = new NoPathError('1.0.0', '2.0.0');

    expect(error).toBeInstanceOf(MigrationError);
    expect(error).toBeInstanceOf(NoPathError);
    expect(error.name).toBe('NoPathError');
    expect(error.code).toBe('NO_PATH');
    expect(error.message).toBe(
      'No migration path exists from version "1.0.0" to "2.0.0"'
    );
    expect(error.details).toEqual({
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
    });
  });

  it('should maintain proper prototype chain', () => {
    const error = new NoPathError('1.0.0', '2.0.0');

    expect(error instanceof NoPathError).toBe(true);
    expect(error instanceof MigrationError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('SchemaValidationError', () => {
  it('should create error with validation errors', () => {
    const validationErrors = [
      { path: ['user', 'email'], message: 'Invalid email format' },
      { path: ['user', 'age'], message: 'Must be a positive number' },
    ];

    const error = new SchemaValidationError('2.0.0', validationErrors);

    expect(error).toBeInstanceOf(MigrationError);
    expect(error).toBeInstanceOf(SchemaValidationError);
    expect(error.name).toBe('SchemaValidationError');
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.message).toBe(
      'Validation failed for version "2.0.0": Invalid email format, Must be a positive number'
    );
    expect(error.validationErrors).toEqual(validationErrors);
    expect(error.details).toEqual({
      version: '2.0.0',
      validationErrors,
    });
  });

  it('should handle single validation error', () => {
    const validationErrors = [
      { path: ['name'], message: 'Name is required' },
    ];

    const error = new SchemaValidationError('1.0.0', validationErrors);

    expect(error.message).toBe(
      'Validation failed for version "1.0.0": Name is required'
    );
    expect(error.validationErrors).toEqual(validationErrors);
  });

  it('should handle empty path in validation error', () => {
    const validationErrors = [{ path: [], message: 'Root validation failed' }];

    const error = new SchemaValidationError('3.0.0', validationErrors);

    expect(error.validationErrors).toEqual(validationErrors);
  });

  it('should maintain proper prototype chain', () => {
    const error = new SchemaValidationError('1.0.0', [
      { path: [], message: 'Error' },
    ]);

    expect(error instanceof SchemaValidationError).toBe(true);
    expect(error instanceof MigrationError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('StashConflictError', () => {
  it('should create error with field and values', () => {
    const existingValue = { foo: 'bar' };
    const attemptedValue = { foo: 'baz' };

    const error = new StashConflictError(
      'user.profile',
      existingValue,
      attemptedValue
    );

    expect(error).toBeInstanceOf(MigrationError);
    expect(error).toBeInstanceOf(StashConflictError);
    expect(error.name).toBe('StashConflictError');
    expect(error.code).toBe('STASH_CONFLICT');
    expect(error.message).toBe(
      'Stash conflict for field "user.profile": attempted to preserve incompatible value'
    );
    expect(error.details).toEqual({
      field: 'user.profile',
      existingValue,
      attemptedValue,
    });
  });

  it('should handle primitive values', () => {
    const error = new StashConflictError('count', 10, 20);

    expect(error.details).toEqual({
      field: 'count',
      existingValue: 10,
      attemptedValue: 20,
    });
  });

  it('should handle null and undefined values', () => {
    const error = new StashConflictError('optional', null, undefined);

    expect(error.details).toEqual({
      field: 'optional',
      existingValue: null,
      attemptedValue: undefined,
    });
  });

  it('should maintain proper prototype chain', () => {
    const error = new StashConflictError('field', 1, 2);

    expect(error instanceof StashConflictError).toBe(true);
    expect(error instanceof MigrationError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('Error codes', () => {
  it('should use correct error code for each error type', () => {
    const noPath = new NoPathError('1.0.0', '2.0.0');
    expect(noPath.code).toBe('NO_PATH');

    const validation = new SchemaValidationError('1.0.0', [
      { path: [], message: 'error' },
    ]);
    expect(validation.code).toBe('VALIDATION_FAILED');

    const stash = new StashConflictError('field', 1, 2);
    expect(stash.code).toBe('STASH_CONFLICT');
  });
});
