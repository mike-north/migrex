import type {
  PreservedField,
  SingleValuePreservation,
  MultiValuePreservation,
  PreservationEvent,
  PreservationMetadata,
  PreserveResult,
} from './types.js';

/**
 * Internal stash data structure for managing field preservation across migrations.
 * Tracks all preservation events and maintains an audit trail.
 *
 * @internal
 */
export class PreservationStash {
  private readonly fields = new Map<string, InternalPreservedField>();
  private readonly eventLog: PreservationEvent[] = [];

  /**
   * Create a new stash, optionally initialized with existing preserved fields.
   */
  constructor(initialFields?: readonly PreservedField[]) {
    if (initialFields) {
      for (const field of initialFields) {
        if (field.kind === 'single') {
          const internal: InternalPreservedField = {
            path: field.path,
            values: [
              {
                value: field.value,
                event: field.history[0]!,
                ...(field.metadata !== undefined && { metadata: field.metadata }),
              },
            ],
          };
          this.fields.set(field.path, internal);
        } else {
          const internal: InternalPreservedField = {
            path: field.path,
            values: field.entries.map((e) => ({
              value: e.value,
              event: e.event,
              ...(e.metadata !== undefined && { metadata: e.metadata }),
            })),
          };
          this.fields.set(field.path, internal);
        }
      }
    }
  }

  /**
   * Preserve a field value for later restoration.
   * Handles idempotent preservations and multi-value scenarios.
   */
  preserve(
    field: string,
    value: unknown,
    currentStep: { version: string; direction: 'up' | 'down'; index: number },
    metadata?: PreservationMetadata
  ): PreserveResult {
    const event: PreservationEvent = {
      type: 'preserved',
      version: currentStep.version,
      direction: currentStep.direction,
      stepIndex: currentStep.index,
      timestamp: Date.now(),
      ...(metadata !== undefined && { metadata }),
    };

    const existing = this.fields.get(field);

    if (!existing) {
      // New preservation
      const preserved: InternalPreservedField = {
        path: field,
        values: [{ value, event, ...(metadata !== undefined && { metadata }) }],
      };
      this.fields.set(field, preserved);
      this.eventLog.push(event);

      return {
        status: 'preserved',
        field: this.toPreservedField(preserved),
      };
    }

    // Check if value is equivalent
    const lastValue = existing.values[existing.values.length - 1]!.value;
    if (this.valuesEquivalent(lastValue, value)) {
      // Idempotent - same value already preserved
      return {
        status: 'already_preserved',
        field: this.toPreservedField(existing),
        note: 'Same value already preserved',
      };
    }

    // Different value - this creates a multi-value preservation
    const rePreserveEvent: PreservationEvent = {
      ...event,
      type: 're-preserved',
    };
    existing.values.push({ value, event: rePreserveEvent, ...(metadata !== undefined && { metadata }) });
    this.eventLog.push(rePreserveEvent);

    return {
      status: 'preserved',
      field: this.toPreservedField(existing),
    };
  }

  /**
   * Consume (retrieve and remove) a preserved field.
   * Records the consumption event in the audit trail.
   */
  consume(
    field: string,
    currentStep: { version: string; direction: 'up' | 'down'; index: number }
  ): PreservedField | undefined {
    const preserved = this.fields.get(field);
    if (!preserved || preserved.consumed) {
      return undefined;
    }

    // Record consumption event
    const event: PreservationEvent = {
      type: 'consumed',
      version: currentStep.version,
      direction: currentStep.direction,
      stepIndex: currentStep.index,
      timestamp: Date.now(),
    };

    this.eventLog.push(event);

    // Mark as consumed but don't remove (for audit trail)
    preserved.consumed = true;
    preserved.consumedAt = currentStep.version;

    return this.toPreservedField(preserved);
  }

  /**
   * Peek at a preserved field without consuming it.
   */
  peek(field: string): PreservedField | undefined {
    const preserved = this.fields.get(field);
    if (!preserved || preserved.consumed) {
      return undefined;
    }
    return this.toPreservedField(preserved);
  }

  /**
   * Check if a field is currently preserved (and not consumed).
   */
  has(field: string): boolean {
    const preserved = this.fields.get(field);
    return preserved !== undefined && !preserved.consumed;
  }

  /**
   * List all currently preserved (unconsumed) fields.
   */
  listAll(): readonly PreservedField[] {
    return Array.from(this.fields.values())
      .filter((f) => !f.consumed)
      .map((f) => this.toPreservedField(f));
  }

  /**
   * Get a summary of all preserved fields and their lifecycle.
   */
  getSummary(): {
    consumed: Array<{
      path: string;
      preservedAt: string;
      consumedAt?: string;
      history: readonly PreservationEvent[];
    }>;
    unconsumed: Array<{
      path: string;
      preservedAt: string;
      history: readonly PreservationEvent[];
    }>;
    lossless: boolean;
  } {
    const consumed: Array<{
      path: string;
      preservedAt: string;
      consumedAt?: string;
      history: readonly PreservationEvent[];
    }> = [];
    const unconsumed: Array<{
      path: string;
      preservedAt: string;
      history: readonly PreservationEvent[];
    }> = [];

    for (const field of this.fields.values()) {
      const history = field.values.flatMap((v) => [v.event]);
      const preservedAt = field.values[0]!.event.version;

      if (field.consumed) {
        consumed.push({
          path: field.path,
          preservedAt,
          history,
          ...(field.consumedAt !== undefined && { consumedAt: field.consumedAt }),
        });
      } else {
        unconsumed.push({
          path: field.path,
          preservedAt,
          history,
        });
      }
    }

    return {
      consumed,
      unconsumed,
      lossless: unconsumed.length === 0,
    };
  }

  /**
   * Get a human-readable audit log of all preservation events.
   */
  getAuditLog(): string {
    const lines: string[] = ['=== Preservation Audit Log ==='];

    for (const event of this.eventLog) {
      const direction = event.direction === 'up' ? '↑' : '↓';
      lines.push(
        `[${event.type}] ${direction} step ${event.stepIndex} @ ${event.version}`
      );
    }

    lines.push('');
    lines.push('=== Current State ===');
    for (const [field, preserved] of this.fields) {
      const status = preserved.consumed ? '(consumed)' : '(active)';
      const valueCount = preserved.values.length;
      lines.push(`${field}: ${valueCount} value(s) ${status}`);
    }

    return lines.join('\n');
  }

  /**
   * Convert internal representation to public PreservedField type.
   */
  private toPreservedField(internal: InternalPreservedField): PreservedField {
    if (internal.values.length === 1) {
      const entry = internal.values[0]!;
      const single: SingleValuePreservation = {
        kind: 'single',
        path: internal.path,
        value: entry.value,
        history: [entry.event],
        ...(entry.metadata !== undefined && { metadata: entry.metadata }),
      };
      return single;
    }

    const multi: MultiValuePreservation = {
      kind: 'multi',
      path: internal.path,
      entries: internal.values.map((v) => ({
        value: v.value,
        event: v.event,
        ...(v.metadata !== undefined && { metadata: v.metadata }),
      })),
      valuesEquivalent: this.allValuesEquivalent(
        internal.values.map((v) => v.value)
      ),
    };
    return multi;
  }

  /**
   * Deep equality check for values.
   */
  private valuesEquivalent(a: unknown, b: unknown): boolean {
    // Deep equality check using JSON serialization
    // Note: This has limitations (e.g., doesn't handle undefined, functions, symbols)
    // but works well for typical JSON-serializable data
    return JSON.stringify(a) === JSON.stringify(b);
  }

  /**
   * Check if all values in an array are equivalent.
   */
  private allValuesEquivalent(values: unknown[]): boolean {
    if (values.length <= 1) return true;
    const first = values[0];
    return values.every((v) => this.valuesEquivalent(v, first));
  }
}

/**
 * Internal representation of a preserved field with all its history.
 */
interface InternalPreservedField {
  path: string;
  values: Array<{
    value: unknown;
    event: PreservationEvent;
    metadata?: PreservationMetadata;
  }>;
  consumed?: boolean;
  consumedAt?: string;
}
