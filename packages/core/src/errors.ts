/**
 * Error codes for migration-related errors.
 */
export type MigrationErrorCode =
  | 'NO_PATH'
  | 'VALIDATION_FAILED'
  | 'STASH_CONFLICT'
  | 'MIGRATION_FAILED'
  | 'INVALID_VERSION'
  | 'DUPLICATE_MIGRATION'
  | 'DUPLICATE_SCHEMA';

/**
 * Base error class for all migration-related errors.
 */
export class MigrationError extends Error {
  public readonly code: MigrationErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: MigrationErrorCode,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MigrationError';
    this.code = code;
    this.details = details;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when no migration path exists between two versions.
 */
export class NoPathError extends MigrationError {
  constructor(fromVersion: string, toVersion: string) {
    super(
      `No migration path exists from version "${fromVersion}" to "${toVersion}"`,
      'NO_PATH',
      { fromVersion, toVersion }
    );
    this.name = 'NoPathError';

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when schema validation fails.
 */
export class SchemaValidationError extends MigrationError {
  public readonly validationErrors: readonly {
    readonly path: readonly string[];
    readonly message: string;
  }[];

  constructor(
    version: string,
    validationErrors: readonly { path: readonly string[]; message: string }[]
  ) {
    super(
      `Validation failed for version "${version}": ${validationErrors.map((e) => e.message).join(', ')}`,
      'VALIDATION_FAILED',
      { version, validationErrors }
    );
    this.name = 'SchemaValidationError';
    this.validationErrors = validationErrors;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when a stash conflict occurs (attempting to preserve
 * incompatible values for the same field).
 */
export class StashConflictError extends MigrationError {
  constructor(field: string, existingValue: unknown, attemptedValue: unknown) {
    super(
      `Stash conflict for field "${field}": attempted to preserve incompatible value`,
      'STASH_CONFLICT',
      { field, existingValue, attemptedValue }
    );
    this.name = 'StashConflictError';

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
