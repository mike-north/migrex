import type {
  VersionStrategy,
  VersionComponents,
  IncrementType,
} from './strategies/types.js';

// Re-export strategy types for convenience
export type { VersionStrategy, VersionComponents, IncrementType };

/**
 * Result of a validation operation.
 */
export interface ValidationResult<T> {
  /** Whether validation succeeded */
  readonly success: boolean;

  /** The validated data (only present if success is true) */
  readonly data?: T;

  /** Validation errors (only present if success is false) */
  readonly errors?: readonly ValidationError[];
}

/**
 * A single validation error with path and message.
 */
export interface ValidationError {
  /** Path to the field that failed validation */
  readonly path: readonly string[];

  /** Human-readable error message */
  readonly message: string;

  /** Optional error code for programmatic handling */
  readonly code?: string;
}

/**
 * A schema for a specific version of data.
 */
export interface VersionedSchema<T> {
  /** The version string this schema validates */
  readonly version: string;

  /**
   * Parse and validate raw data into typed data.
   * This is the primary validation entry point.
   */
  schema(data: unknown): ValidationResult<T>;

  /**
   * Additional validation logic for already-typed data (optional).
   * Used for business rule validation beyond type checking.
   */
  validate?(data: T): ValidationResult<T>;

  /**
   * Deprecation information (optional).
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
   * Release date of this schema version (optional).
   */
  releaseDate?: string;
}

/**
 * Migration traits describing the characteristics of a migration.
 * These help users understand the nature of data transformations.
 */
export interface MigrationTraits {
  /**
   * Indicates data loss during migration.
   * - true: Data is lost
   * - string: Description of what data is lost
   */
  lossy?: boolean | string;

  /**
   * Indicates structural changes to data organization.
   * - true: Data structure changes
   * - string: Description of structural changes
   */
  restructures?: boolean | string;

  /**
   * Indicates changes in the meaning or interpretation of data.
   * - true: Semantic meaning changes
   * - string: Description of semantic changes
   */
  semanticShift?: boolean | string;

  /**
   * Indicates loss of numerical precision.
   * - true: Precision is lost
   * - string: Description of precision loss
   */
  precisionLoss?: boolean | string;

  /**
   * Indicates data normalization (e.g., formatting changes).
   * - true: Data is normalized
   * - string: Description of normalization
   */
  normalizes?: boolean | string;
}

/**
 * A reversible migration between two versions.
 */
export interface ReversibleMigration<From, To> {
  /** Source version */
  readonly fromVersion: string;

  /** Target version */
  readonly toVersion: string;

  /**
   * Migrate data forward (from -> to).
   */
  up(data: From, ctx: MigrationContext): To;

  /**
   * Migrate data backward (to -> from).
   */
  down(data: To, ctx: MigrationContext): From;

  /**
   * Traits describing the characteristics of this migration (optional).
   */
  traits?: {
    up?: MigrationTraits;
    down?: MigrationTraits;
  };

  /**
   * Human-readable description of this migration (optional).
   */
  description?: string;
}

/**
 * A one-way (irreversible) migration between two versions.
 */
export interface OneWayMigration<From, To> {
  /** Source version */
  readonly fromVersion: string;

  /** Target version */
  readonly toVersion: string;

  /**
   * Migrate data forward (from -> to).
   */
  up(data: From, ctx: MigrationContext): To;

  /**
   * No down migration available.
   * This field must be explicitly set to never to indicate irreversibility.
   */
  down?: never;

  /**
   * Explanation of why this migration is irreversible.
   */
  irreversibleReason: string;

  /**
   * Traits describing the characteristics of this migration (optional).
   */
  traits?: {
    up?: MigrationTraits;
  };

  /**
   * Human-readable description of this migration (optional).
   */
  description?: string;
}

/**
 * A migration can be either reversible or one-way.
 */
export type Migration<From, To> =
  | ReversibleMigration<From, To>
  | OneWayMigration<From, To>;

/**
 * An async reversible migration between two versions.
 */
export interface AsyncReversibleMigration<From, To> {
  /** Source version */
  readonly fromVersion: string;

  /** Target version */
  readonly toVersion: string;

  /**
   * Migrate data forward (from -> to) asynchronously.
   */
  up(data: From, ctx: MigrationContext): Promise<To>;

  /**
   * Migrate data backward (to -> from) asynchronously.
   */
  down(data: To, ctx: MigrationContext): Promise<From>;

  /**
   * Traits describing the characteristics of this migration (optional).
   */
  traits?: {
    up?: MigrationTraits;
    down?: MigrationTraits;
  };

  /**
   * Human-readable description of this migration (optional).
   */
  description?: string;
}

/**
 * An async one-way (irreversible) migration between two versions.
 */
export interface AsyncOneWayMigration<From, To> {
  /** Source version */
  readonly fromVersion: string;

  /** Target version */
  readonly toVersion: string;

  /**
   * Migrate data forward (from -> to) asynchronously.
   */
  up(data: From, ctx: MigrationContext): Promise<To>;

  /**
   * No down migration available.
   * This field must be explicitly set to never to indicate irreversibility.
   */
  down?: never;

  /**
   * Explanation of why this migration is irreversible.
   */
  irreversibleReason: string;

  /**
   * Traits describing the characteristics of this migration (optional).
   */
  traits?: {
    up?: MigrationTraits;
  };

  /**
   * Human-readable description of this migration (optional).
   */
  description?: string;
}

/**
 * An async migration can be either reversible or one-way.
 */
export type AsyncMigration<From, To> =
  | AsyncReversibleMigration<From, To>
  | AsyncOneWayMigration<From, To>;

/**
 * A migration can be synchronous or asynchronous.
 */
export type AnyMigration<From, To> =
  | Migration<From, To>
  | AsyncMigration<From, To>;

/**
 * A complete migration path between two versions.
 */
export interface MigrationPath {
  /** Ordered list of migration steps to execute */
  readonly steps: readonly MigrationStep[];

  /** Overall direction of the migration path */
  readonly direction: 'up' | 'down' | 'mixed';

  /** Whether any step in the path is irreversible */
  readonly hasIrreversibleStep: boolean;
}

/**
 * A single step in a migration path.
 */
export interface MigrationStep {
  /** Source version for this step */
  readonly fromVersion: string;

  /** Target version for this step */
  readonly toVersion: string;

  /** Direction of this step */
  readonly direction: 'up' | 'down';

  /** The migration to execute for this step (sync or async) */
  readonly migration: AnyMigration<unknown, unknown>;
}

/**
 * Options for executing a migration.
 */
export interface MigrateOptions {
  /**
   * Skip validation of the final result (default: false).
   * Useful for performance when you trust the migrations.
   */
  skipValidation?: boolean;

  /**
   * Validate data at each intermediate step (default: false).
   * Useful for debugging migration issues.
   */
  validateIntermediate?: boolean;

  /**
   * Initial preserved fields to include in the migration context.
   * Use this to pass stash from a previous migration to restore preserved values.
   * Typically you'd pass `previousResult.preservedFields` here.
   */
  initialStash?: readonly PreservedField[];
}

/**
 * Result of executing a migration.
 */
export interface MigrationResult<T> {
  /** Whether the migration succeeded */
  readonly success: boolean;

  /** The migrated data (only present if success is true) */
  readonly data?: T;

  /** The migration path that was executed */
  readonly path: MigrationPath;

  /** Validation result for the final data (if validation was performed) */
  readonly validation?: ValidationResult<T>;

  /** Summary of preserved fields (stash) */
  readonly stash: StashSummary;

  /**
   * Raw preserved fields with their values, for passing to subsequent migrations.
   * Use this with `options.initialStash` when chaining migrations.
   */
  readonly preservedFields: readonly PreservedField[];

  /** Error that occurred (only present if success is false) */
  readonly error?: Error;
}

/**
 * Summary of field preservation across a migration.
 */
export interface StashSummary {
  /** Fields that were preserved and later consumed */
  readonly consumed: readonly PreservedFieldSummary[];

  /** Fields that were preserved but never consumed */
  readonly unconsumed: readonly PreservedFieldSummary[];

  /**
   * Whether the migration was lossless (all preserved fields were consumed).
   * Note: This doesn't account for data loss in the migration itself,
   * only whether preserved fields were restored.
   */
  readonly lossless: boolean;
}

/**
 * Summary of a single preserved field's lifecycle.
 */
export interface PreservedFieldSummary {
  /** Field path that was preserved */
  readonly path: string;

  /** Version where field was first preserved */
  readonly preservedAt: string;

  /** Version where field was consumed (if it was consumed) */
  readonly consumedAt?: string;

  /** Complete history of preservation events for this field */
  readonly history: readonly PreservationEvent[];
}

/**
 * Metadata attached to a preserved field.
 */
export interface PreservationMetadata {
  /** Version where this field originated */
  sourceVersion?: string;

  /** Human-readable description of the field */
  description?: string;

  /** Optional schema for validating the preserved value */
  fieldSchema?: FieldSchema;
}

/**
 * Schema for validating a single field value.
 */
export interface FieldSchema {
  /**
   * Validate a field value.
   */
  validate(value: unknown): ValidationResult<unknown>;

  /**
   * Provide a human-readable description of this schema.
   */
  describe(): string;
}

/**
 * A single event in a field's preservation history.
 */
export interface PreservationEvent {
  /** Type of event */
  type: 'preserved' | 'consumed' | 're-preserved';

  /** Version where this event occurred */
  version: string;

  /** Migration direction when event occurred */
  direction: 'up' | 'down';

  /** Index of the migration step where event occurred */
  stepIndex: number;

  /** Optional metadata about the preservation */
  metadata?: PreservationMetadata;

  /** Timestamp when event occurred (milliseconds since epoch) */
  timestamp: number;
}

/**
 * A preserved field with a single value.
 * This is the common case when a field is preserved once and consumed once.
 */
export interface SingleValuePreservation {
  /** Discriminator for type narrowing */
  readonly kind: 'single';

  /** Field path */
  readonly path: string;

  /** The preserved value */
  readonly value: unknown;

  /** History of preservation events */
  readonly history: readonly PreservationEvent[];

  /** Optional metadata */
  readonly metadata?: PreservationMetadata;
}

/**
 * A preserved field with multiple values from different events.
 * This occurs when a field is preserved, consumed, then preserved again
 * in the same migration path (e.g., in a round-trip migration).
 */
export interface MultiValuePreservation {
  /** Discriminator for type narrowing */
  readonly kind: 'multi';

  /** Field path */
  readonly path: string;

  /** All preserved values with their associated events */
  readonly entries: ReadonlyArray<{
    readonly value: unknown;
    readonly event: PreservationEvent;
    readonly metadata?: PreservationMetadata;
  }>;

  /**
   * Whether all preserved values are equivalent.
   * Used to detect if round-trip migrations are truly lossless.
   */
  readonly valuesEquivalent: boolean;
}

/**
 * A preserved field can be either single-valued or multi-valued.
 */
export type PreservedField = SingleValuePreservation | MultiValuePreservation;

/**
 * Result of attempting to preserve a field.
 */
export type PreserveResult =
  | { status: 'preserved'; field: PreservedField }
  | {
      status: 'already_preserved';
      field: PreservedField;
      note: string;
    }
  | {
      status: 'conflict';
      existing: PreservedField;
      attemptedValue: unknown;
      reason: string;
    };

/**
 * Context object passed to migration functions.
 * Provides access to field preservation (stash) and migration metadata.
 */
export interface MigrationContext {
  /**
   * Preserve a field value for later restoration.
   * @param field - Dot-separated path to the field (e.g., "user.profile.avatar")
   * @param value - Value to preserve
   * @param metadata - Optional metadata about the preservation
   */
  preserve(
    field: string,
    value: unknown,
    metadata?: PreservationMetadata
  ): PreserveResult;

  /**
   * Check if a field has been preserved.
   * @param field - Field path to check
   */
  hasPreserved(field: string): boolean;

  /**
   * Consume (retrieve and remove) a preserved field.
   * @param field - Field path to consume
   * @returns The preserved field, or undefined if not found
   */
  consume(field: string): PreservedField | undefined;

  /**
   * Peek at a preserved field without consuming it.
   * @param field - Field path to peek at
   * @returns The preserved field, or undefined if not found
   */
  peek(field: string): PreservedField | undefined;

  /**
   * List all currently preserved fields.
   */
  listPreserved(): readonly PreservedField[];

  /**
   * Get a human-readable audit log of all preservation events.
   */
  getAuditLog(): string;

  /**
   * Information about the current migration step being executed.
   */
  readonly currentStep: Readonly<{
    /** Source version */
    from: string;

    /** Target version */
    to: string;

    /** Migration direction */
    direction: 'up' | 'down';

    /** Zero-based index of current step */
    index: number;

    /** Total number of steps in the path */
    totalSteps: number;
  }>;
}

/**
 * Options for batch migration operations.
 */
export interface BatchMigrateOptions extends MigrateOptions {
  /**
   * Continue processing remaining items if one fails.
   * @default false
   */
  continueOnError?: boolean;

  /**
   * Progress callback invoked after each item.
   */
  onProgress?: (
    completed: number,
    total: number,
    lastResult: MigrationResult<unknown>
  ) => void;
}

/**
 * Result of a batch migration operation.
 */
export interface BatchMigrationResult<T> {
  /** Total items processed */
  readonly total: number;
  /** Number of successful migrations */
  readonly succeeded: number;
  /** Number of failed migrations */
  readonly failed: number;
  /** Individual results for each item */
  readonly results: readonly MigrationResult<T>[];
  /** The migration path used (computed once for all items) */
  readonly path: MigrationPath;
}

/**
 * Telemetry hooks for observability.
 * All hooks are optional and called synchronously.
 */
export interface MigrationTelemetry {
  /**
   * Called when a migration path is computed.
   */
  onPathComputed?: (path: MigrationPath, durationMs: number) => void;

  /**
   * Called before executing a migration step.
   */
  onStepStart?: (
    step: MigrationStep,
    stepIndex: number,
    totalSteps: number
  ) => void;

  /**
   * Called after a migration step completes.
   */
  onStepComplete?: (
    step: MigrationStep,
    stepIndex: number,
    durationMs: number
  ) => void;

  /**
   * Called when a migration completes (success or failure).
   */
  onMigrationComplete?: (
    result: MigrationResult<unknown>,
    totalDurationMs: number
  ) => void;

  /**
   * Called when an error occurs during migration.
   */
  onError?: (
    error: Error,
    step: MigrationStep | null,
    context: MigrationContext
  ) => void;
}

/**
 * Options for creating a migration graph.
 */
export interface MigrationGraphOptions {
  /** Unique identifier for this graph */
  id: string;

  /** Version strategy to use for comparing versions */
  versionStrategy: VersionStrategy;

  /**
   * Optional telemetry hooks for observability.
   */
  telemetry?: MigrationTelemetry;

  /**
   * Optional array of schemas to register at creation time.
   * This allows declarative configuration instead of calling registerSchema multiple times.
   */
  schemas?: readonly VersionedSchema<unknown>[];

  /**
   * Optional array of migrations to register at creation time.
   * This allows declarative configuration instead of calling registerMigration multiple times.
   */
  migrations?: readonly AnyMigration<unknown, unknown>[];
}
