import type { ReversibleMigration } from '../types.js';
/**
 * Options for the {@link removeField} helper.
 *
 * @typeParam TFrom - The source data type (with the field to remove)
 * @typeParam TTo - The target data type (without the field)
 * @typeParam K - The key of the field being removed
 */
export interface RemoveFieldOptions<TFrom extends object, _TTo extends object, K extends keyof TFrom> {
    /** Source version */
    from: string;
    /** Target version */
    to: string;
    /** Name of the field to remove */
    field: K;
    /**
     * Optional: preserve the removed field in the migration context stash.
     * If provided, the field will be stored with this key and can be restored
     * in subsequent migrations.
     */
    preserveAs?: string;
}
/**
 * Creates a reversible migration that removes a field.
 *
 * This helper removes a field from the data structure. By default, the down
 * migration cannot restore the field value (it's lossy). To preserve the value
 * for potential restoration, use the `preserveAs` option to stash it.
 *
 * @example
 * ```typescript
 * interface V1 { version: string; name: string; deprecated: string; }
 * interface V2 { version: string; name: string; }
 *
 * // Basic usage - lossy down migration
 * const migration = removeField<V1, V2, 'deprecated'>({
 *   from: '1.0.0',
 *   to: '1.1.0',
 *   field: 'deprecated',
 * });
 *
 * // With preservation - allows restoration in future migrations
 * const migration2 = removeField<V1, V2, 'deprecated'>({
 *   from: '1.0.0',
 *   to: '1.1.0',
 *   field: 'deprecated',
 *   preserveAs: 'old.deprecated',
 * });
 * ```
 *
 * @param options - Configuration for the field removal
 * @returns A reversible migration that removes the field in up and cannot restore it in down
 *
 * @remarks
 * Without `preserveAs`, the down migration is lossy - it cannot restore the removed
 * field value. The field will be undefined in the downgraded data. With `preserveAs`,
 * the field is stored in the migration context stash for potential future use.
 */
export declare function removeField<TFrom extends object, TTo extends object, K extends keyof TFrom>(options: RemoveFieldOptions<TFrom, TTo, K>): ReversibleMigration<TFrom, TTo>;
//# sourceMappingURL=remove-field.d.ts.map