import type { ReversibleMigration } from '../types.js';
/**
 * Options for the {@link restructure} helper.
 */
export interface RestructureOptions {
    /** Source version */
    from: string;
    /** Target version */
    to: string;
    /**
     * Mapping of nested paths in the target to flat fields in the source.
     *
     * Keys are dot-separated paths in the target structure.
     * Values are field names in the source structure.
     *
     * @example
     * ```typescript
     * // Flat to nested
     * {
     *   'app.name': 'appName',
     *   'app.version': 'appVersion',
     *   'server.port': 'port',
     *   'server.host': 'host',
     * }
     * ```
     */
    transform: Record<string, string>;
}
/**
 * Creates a reversible migration that restructures data between flat and nested forms.
 *
 * This helper transforms between flat object structures and nested object hierarchies.
 * It's useful for:
 * - Converting flat configuration objects to nested structures
 * - Reorganizing data into logical groupings
 * - Migrating from denormalized to normalized schemas
 *
 * @example
 * ```typescript
 * interface V1 {
 *   version: string;
 *   appName: string;
 *   appVersion: string;
 *   port: number;
 *   host: string;
 * }
 *
 * interface V2 {
 *   version: string;
 *   app: {
 *     name: string;
 *     version: string;
 *   };
 *   server: {
 *     port: number;
 *     host: string;
 *   };
 * }
 *
 * const migration = restructure<V1, V2>({
 *   from: '1.0.0',
 *   to: '2.0.0',
 *   transform: {
 *     'app.name': 'appName',
 *     'app.version': 'appVersion',
 *     'server.port': 'port',
 *     'server.host': 'host',
 *   },
 * });
 * ```
 *
 * @param options - Configuration for the restructuring
 * @returns A reversible migration that transforms between flat and nested structures
 *
 * @remarks
 * This migration is lossless - all field values are preserved in both directions.
 * The transformation is purely structural. The `transform` mapping defines the
 * relationship between flat source fields and nested target paths.
 */
export declare function restructure<TFrom extends object, TTo extends object>(options: RestructureOptions): ReversibleMigration<TFrom, TTo>;
//# sourceMappingURL=restructure.d.ts.map