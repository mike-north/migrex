import type { ReversibleMigration, MigrationContext } from '../types.js';

/**
 * Options for the {@link renameField} helper.
 *
 * @typeParam TFrom - The source data type (with old field name)
 * @typeParam TTo - The target data type (with new field name)
 */
export interface RenameFieldOptions<TFrom extends object, TTo extends object> {
  /** Source version */
  from: string;

  /** Target version */
  to: string;

  /** Original field name in source version */
  oldName: keyof TFrom;

  /** New field name in target version */
  newName: keyof TTo;
}

/**
 * Creates a reversible migration that renames a field.
 *
 * This helper renames a field from one name to another while preserving its value.
 * The migration is fully reversible and lossless - the field value is maintained
 * in both directions.
 *
 * @example
 * ```typescript
 * interface V1 { version: string; user_name: string; }
 * interface V2 { version: string; userName: string; }
 *
 * const migration = renameField<V1, V2>({
 *   from: '1.0.0',
 *   to: '2.0.0',
 *   oldName: 'user_name',
 *   newName: 'userName',
 * });
 * ```
 *
 * @param options - Configuration for the field rename
 * @returns A reversible migration that renames the field in both directions
 *
 * @remarks
 * This migration is lossless - the field value is preserved in both the up and
 * down directions. Only the field name changes; the value remains the same.
 */
export function renameField<TFrom extends object, TTo extends object>(
  options: RenameFieldOptions<TFrom, TTo>
): ReversibleMigration<TFrom, TTo> {
  const { from, to, oldName, newName } = options;

  return {
    fromVersion: from,
    toVersion: to,
    up: (data: TFrom, _ctx: MigrationContext): TTo => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [oldName]: value, version, ...rest } = data as Record<
        string,
        unknown
      >;
      return { ...rest, version: to, [newName]: value } as unknown as TTo;
    },
    down: (data: TTo, _ctx: MigrationContext): TFrom => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [newName]: value, version, ...rest } = data as Record<
        string,
        unknown
      >;
      return { ...rest, version: from, [oldName]: value } as unknown as TFrom;
    },
    description: `Rename field '${String(oldName)}' to '${String(newName)}'`,
  };
}
