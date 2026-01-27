import type { ReversibleMigration } from '../types.js';
/**
 * Options for the {@link addField} helper.
 *
 * @typeParam TFrom - The source data type (without the new field)
 * @typeParam TTo - The target data type (with the new field)
 * @typeParam K - The key of the field being added
 */
export interface AddFieldOptions<_TFrom extends object, TTo extends object, K extends keyof TTo> {
    /** Source version */
    from: string;
    /** Target version */
    to: string;
    /** Name of the field to add */
    field: K;
    /** Default value for the new field */
    defaultValue: TTo[K];
}
/**
 * Creates a reversible migration that adds a field with a default value.
 *
 * This helper is useful for simple schema additions where a new field is added
 * with a constant default value. The down migration removes the field.
 *
 * @example
 * ```typescript
 * interface V1 { version: string; name: string; }
 * interface V2 { version: string; name: string; logLevel: string; }
 *
 * const migration = addField<V1, V2, 'logLevel'>({
 *   from: '1.0.0',
 *   to: '1.1.0',
 *   field: 'logLevel',
 *   defaultValue: 'info',
 * });
 * ```
 *
 * @param options - Configuration for the field addition
 * @returns A reversible migration that adds the field in the up direction and removes it in down
 *
 * @remarks
 * The down migration is lossy - it removes the field value even if it was changed
 * from the default. If you need to preserve the original value, use the migration
 * context's `preserve` method in a custom migration.
 */
export declare function addField<TFrom extends object, TTo extends object, K extends keyof TTo>(options: AddFieldOptions<TFrom, TTo, K>): ReversibleMigration<TFrom, TTo>;
//# sourceMappingURL=add-field.d.ts.map