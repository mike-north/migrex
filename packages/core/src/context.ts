import type {
  MigrationContext,
  PreservedField,
  PreservationMetadata,
  PreserveResult,
  StashSummary,
} from './types.js';
import { PreservationStash } from './stash.js';

/**
 * Current step information tracked by the migration context.
 */
interface CurrentStepInfo {
  from: string;
  to: string;
  direction: 'up' | 'down';
  index: number;
  totalSteps: number;
}

/**
 * Extended migration context interface with additional methods for internal use.
 * @internal
 */
export interface MigrationContextImpl extends MigrationContext {
  /**
   * Set the current step being executed.
   * Called by the migration executor before running each step.
   */
  setCurrentStep(step: CurrentStepInfo): void;

  /**
   * Get a summary of preserved fields.
   * Used to generate the final migration result.
   */
  getSummary(): StashSummary;

  /**
   * Get all preserved fields with their values.
   * Used for passing stash between migrations.
   */
  getPreservedFields(): readonly PreservedField[];
}

/**
 * Implementation of MigrationContext.
 * Manages field preservation (stash) and tracks current migration step.
 */
class MigrationContextImplClass implements MigrationContextImpl {
  private readonly stash: PreservationStash;
  private _currentStep: CurrentStepInfo;

  constructor(totalSteps: number, initialStash?: readonly PreservedField[]) {
    this.stash = new PreservationStash(initialStash);
    this._currentStep = {
      from: '',
      to: '',
      direction: 'up',
      index: 0,
      totalSteps,
    };
  }

  get currentStep(): Readonly<CurrentStepInfo> {
    return { ...this._currentStep };
  }

  setCurrentStep(step: CurrentStepInfo): void {
    this._currentStep = step;
  }

  preserve(
    field: string,
    value: unknown,
    metadata?: PreservationMetadata
  ): PreserveResult {
    return this.stash.preserve(
      field,
      value,
      {
        version: this._currentStep.from,
        direction: this._currentStep.direction,
        index: this._currentStep.index,
      },
      metadata
    );
  }

  hasPreserved(field: string): boolean {
    return this.stash.has(field);
  }

  consume(field: string): PreservedField | undefined {
    return this.stash.consume(field, {
      version: this._currentStep.to,
      direction: this._currentStep.direction,
      index: this._currentStep.index,
    });
  }

  peek(field: string): PreservedField | undefined {
    return this.stash.peek(field);
  }

  listPreserved(): readonly PreservedField[] {
    return this.stash.listAll();
  }

  getAuditLog(): string {
    return this.stash.getAuditLog();
  }

  getSummary(): StashSummary {
    const summary = this.stash.getSummary();
    return {
      consumed: summary.consumed,
      unconsumed: summary.unconsumed,
      lossless: summary.lossless,
    };
  }

  getPreservedFields(): readonly PreservedField[] {
    return this.stash.listAll();
  }
}

/**
 * Create a new migration context for executing a migration path.
 *
 * @param totalSteps - Total number of steps in the migration path
 * @param initialStash - Optional preserved fields from a previous migration
 * @returns A new migration context instance
 *
 * @example
 * ```typescript
 * const context = createMigrationContext(3);
 *
 * // In migration function
 * function migrateUp(data: V1, ctx: MigrationContext): V2 {
 *   ctx.preserve('theme', data.theme);
 *   return { ...data, version: '2.0.0' };
 * }
 * ```
 */
export function createMigrationContext(
  totalSteps: number,
  initialStash?: readonly PreservedField[]
): MigrationContextImpl {
  return new MigrationContextImplClass(totalSteps, initialStash);
}
