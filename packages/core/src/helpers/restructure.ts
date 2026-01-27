import type { ReversibleMigration, MigrationContext } from '../types.js';

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
 * Gets a value from a nested object using a dot-separated path.
 *
 * @param obj - Object to traverse
 * @param path - Dot-separated path (e.g., "app.server.port")
 * @returns The value at the path, or undefined if not found
 */
function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc !== null && acc !== undefined
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj
    );
}

/**
 * Sets a value in a nested object using a dot-separated path.
 * Creates intermediate objects as needed.
 *
 * @param obj - Object to modify
 * @param path - Dot-separated path (e.g., "app.server.port")
 * @param value - Value to set
 */
// Keys that could enable prototype pollution attacks
const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

function setPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split('.');
  const lastKey = keys.pop();
  if (lastKey === undefined) return;

  // Validate all keys to prevent prototype pollution
  for (const key of [...keys, lastKey]) {
    if (FORBIDDEN_KEYS.includes(key)) {
      throw new Error(
        `Invalid property path "${path}": "${key}" is forbidden for security reasons`
      );
    }
  }

  const target = keys.reduce((acc, key) => {
    if (!(key in acc)) {
      acc[key] = {};
    }
    return acc[key] as Record<string, unknown>;
  }, obj);

  target[lastKey] = value;
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
export function restructure<TFrom extends object, TTo extends object>(
  options: RestructureOptions
): ReversibleMigration<TFrom, TTo> {
  const { from, to, transform } = options;

  // Validate all paths upfront to prevent prototype pollution
  for (const nestedPath of Object.keys(transform)) {
    const keys = nestedPath.split('.');
    for (const key of keys) {
      if (FORBIDDEN_KEYS.includes(key)) {
        throw new Error(
          `Invalid property path "${nestedPath}": "${key}" is forbidden for security reasons`
        );
      }
    }
  }

  return {
    fromVersion: from,
    toVersion: to,
    up: (data: TFrom, _ctx: MigrationContext): TTo => {
      const result: Record<string, unknown> = { version: to };
      for (const [nestedPath, flatField] of Object.entries(transform)) {
        const value = (data as Record<string, unknown>)[flatField];
        setPath(result, nestedPath, value);
      }
      return result as unknown as TTo;
    },
    down: (data: TTo, _ctx: MigrationContext): TFrom => {
      const result: Record<string, unknown> = { version: from };
      for (const [nestedPath, flatField] of Object.entries(transform)) {
        const value = getPath(data as Record<string, unknown>, nestedPath);
        result[flatField] = value;
      }
      return result as unknown as TFrom;
    },
    traits: {
      up: {
        restructures: 'Converts flat structure to nested hierarchy',
      },
      down: {
        restructures: 'Converts nested hierarchy to flat structure',
      },
    },
    description: 'Restructure data between flat and nested forms',
  };
}
