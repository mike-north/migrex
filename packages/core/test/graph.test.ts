import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMigrationGraph } from '../src/graph.js';
import { semverStrategy } from '../src/strategies/index.js';
import type {
  VersionedSchema,
  ReversibleMigration,
  OneWayMigration,
  AsyncReversibleMigration,
  AsyncOneWayMigration,
  MigrationContext,
} from '../src/types.js';

// Test data types
type V1Data = { version: '1.0.0'; name: string };
type V2Data = { version: '2.0.0'; name: string; email?: string };
type V3Data = { version: '3.0.0'; fullName: string; contactInfo?: string };

// Test schemas
const schemaV1: VersionedSchema<V1Data> = {
  version: '1.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'name' in data &&
      'version' in data &&
      data.version === '1.0.0'
    ) {
      return { success: true, data: data as V1Data };
    }
    return { success: false, errors: [{ path: [], message: 'Invalid v1 data' }] };
  },
};

const schemaV2: VersionedSchema<V2Data> = {
  version: '2.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'name' in data &&
      'version' in data &&
      data.version === '2.0.0'
    ) {
      return { success: true, data: data as V2Data };
    }
    return { success: false, errors: [{ path: [], message: 'Invalid v2 data' }] };
  },
};

const schemaV3: VersionedSchema<V3Data> = {
  version: '3.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'fullName' in data &&
      'version' in data &&
      data.version === '3.0.0'
    ) {
      return { success: true, data: data as V3Data };
    }
    return { success: false, errors: [{ path: [], message: 'Invalid v3 data' }] };
  },
};

// Test migrations
const migrationV1ToV2: ReversibleMigration<V1Data, V2Data> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data, _ctx) => ({
    version: '2.0.0',
    name: data.name,
  }),
  down: (data, _ctx) => ({
    version: '1.0.0',
    name: data.name,
  }),
};

const migrationV2ToV3: ReversibleMigration<V2Data, V3Data> = {
  fromVersion: '2.0.0',
  toVersion: '3.0.0',
  up: (data, ctx) => {
    // Preserve email if present
    if (data.email) {
      ctx.preserve('email', data.email);
    }
    return {
      version: '3.0.0',
      fullName: data.name,
    };
  },
  down: (data, ctx) => {
    // Restore email if preserved
    const preserved = ctx.consume('email');
    return {
      version: '2.0.0',
      name: data.fullName,
      email: preserved?.kind === 'single' ? (preserved.value as string) : undefined,
    };
  },
};

const irreversibleMigrationV1ToV2: OneWayMigration<V1Data, V2Data> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  irreversibleReason: 'Email cannot be recovered',
  up: (data, _ctx) => ({
    version: '2.0.0',
    name: data.name,
    email: 'unknown@example.com', // Default email
  }),
};

describe('MigrationGraph', () => {
  let graph: ReturnType<typeof createMigrationGraph>;

  beforeEach(() => {
    graph = createMigrationGraph({
      id: 'test-graph',
      versionStrategy: semverStrategy,
    });
  });

  describe('registerSchema', () => {
    it('should register a schema', () => {
      graph.registerSchema(schemaV1);
      expect(graph.getSchema('1.0.0')).toBe(schemaV1);
    });

    it('should register multiple schemas', () => {
      graph.registerSchema(schemaV1);
      graph.registerSchema(schemaV2);
      expect(graph.getSchema('1.0.0')).toBe(schemaV1);
      expect(graph.getSchema('2.0.0')).toBe(schemaV2);
    });

    it('should throw on duplicate schema', () => {
      graph.registerSchema(schemaV1);
      expect(() => graph.registerSchema(schemaV1)).toThrow('already registered');
    });

    it('should normalize version before registering', () => {
      const schema = { ...schemaV1, version: 'v1.0.0' };
      graph.registerSchema(schema);
      // Should be accessible with normalized version
      expect(graph.getSchema('1.0.0')).toBeDefined();
    });

    it('should throw on invalid version', () => {
      const invalidSchema = {
        version: 'invalid-version',
        schema: () => ({ success: false as const, errors: [] }),
      };
      expect(() => graph.registerSchema(invalidSchema)).toThrow('Invalid version');
    });
  });

  describe('registerMigration', () => {
    it('should register a migration', () => {
      graph.registerMigration(migrationV1ToV2);
      expect(graph.getMigrations()).toHaveLength(1);
    });

    it('should register multiple migrations', () => {
      graph.registerMigration(migrationV1ToV2);
      graph.registerMigration(migrationV2ToV3);
      expect(graph.getMigrations()).toHaveLength(2);
    });

    it('should throw on duplicate migration', () => {
      graph.registerMigration(migrationV1ToV2);
      expect(() => graph.registerMigration(migrationV1ToV2)).toThrow(
        'already registered'
      );
    });

    it('should normalize versions before registering', () => {
      const migration = {
        ...migrationV1ToV2,
        fromVersion: 'v1.0.0',
        toVersion: 'v2.0.0',
      };
      graph.registerMigration(migration);
      expect(graph.getMigrations()).toHaveLength(1);
    });

    it('should throw on invalid version in migration', () => {
      const invalidMigration = {
        fromVersion: 'invalid',
        toVersion: '2.0.0',
        up: () => ({ version: '2.0.0' as const }),
      };
      expect(() => graph.registerMigration(invalidMigration)).toThrow(
        'Invalid version'
      );
    });
  });

  describe('hasPath', () => {
    it('should return true for same version', () => {
      expect(graph.hasPath('1.0.0', '1.0.0')).toBe(true);
    });

    it('should return true for existing direct path', () => {
      graph.registerMigration(migrationV1ToV2);
      expect(graph.hasPath('1.0.0', '2.0.0')).toBe(true);
    });

    it('should return true for bidirectional path', () => {
      graph.registerMigration(migrationV1ToV2);
      expect(graph.hasPath('2.0.0', '1.0.0')).toBe(true);
    });

    it('should return true for multi-step path', () => {
      graph.registerMigration(migrationV1ToV2);
      graph.registerMigration(migrationV2ToV3);
      expect(graph.hasPath('1.0.0', '3.0.0')).toBe(true);
    });

    it('should return false for non-existing path', () => {
      graph.registerMigration(migrationV1ToV2);
      expect(graph.hasPath('1.0.0', '3.0.0')).toBe(false);
    });

    it('should return false for unregistered versions', () => {
      expect(graph.hasPath('1.0.0', '999.0.0')).toBe(false);
    });
  });

  describe('getPath', () => {
    it('should return empty path for same version', () => {
      const path = graph.getPath('1.0.0', '1.0.0');
      expect(path.steps).toHaveLength(0);
      expect(path.direction).toBe('up');
      expect(path.hasIrreversibleStep).toBe(false);
    });

    it('should return correct path for upgrade', () => {
      graph.registerMigration(migrationV1ToV2);
      const path = graph.getPath('1.0.0', '2.0.0');
      expect(path.steps).toHaveLength(1);
      expect(path.direction).toBe('up');
      expect(path.steps[0]).toMatchObject({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        direction: 'up',
      });
    });

    it('should return correct path for downgrade', () => {
      graph.registerMigration(migrationV1ToV2);
      const path = graph.getPath('2.0.0', '1.0.0');
      expect(path.steps).toHaveLength(1);
      expect(path.direction).toBe('down');
      expect(path.steps[0].direction).toBe('down');
    });

    it('should return multi-step path', () => {
      graph.registerMigration(migrationV1ToV2);
      graph.registerMigration(migrationV2ToV3);
      const path = graph.getPath('1.0.0', '3.0.0');
      expect(path.steps).toHaveLength(2);
      expect(path.direction).toBe('up');
      expect(path.steps[0].fromVersion).toBe('1.0.0');
      expect(path.steps[0].toVersion).toBe('2.0.0');
      expect(path.steps[1].fromVersion).toBe('2.0.0');
      expect(path.steps[1].toVersion).toBe('3.0.0');
    });

    it('should mark irreversible steps', () => {
      graph.registerMigration(irreversibleMigrationV1ToV2);
      const path = graph.getPath('2.0.0', '1.0.0');
      expect(path.hasIrreversibleStep).toBe(true);
    });

    it('should throw NoPathError when no path exists', () => {
      expect(() => graph.getPath('1.0.0', '3.0.0')).toThrow('No migration path');
    });

    it('should normalize versions before finding path', () => {
      graph.registerMigration(migrationV1ToV2);
      const path = graph.getPath('v1.0.0', 'v2.0.0');
      expect(path.steps).toHaveLength(1);
    });
  });

  describe('migrate', () => {
    beforeEach(() => {
      graph.registerSchema(schemaV1);
      graph.registerSchema(schemaV2);
      graph.registerSchema(schemaV3);
      graph.registerMigration(migrationV1ToV2);
      graph.registerMigration(migrationV2ToV3);
    });

    describe('successful migrations', () => {
      it('should return same data for same version', () => {
        const data: V1Data = { version: '1.0.0', name: 'Test' };
        const result = graph.migrate(data, '1.0.0', '1.0.0');
        expect(result.success).toBe(true);
        expect(result.data).toEqual(data);
        expect(result.path.steps).toHaveLength(0);
      });

      it('should migrate data forward one step', () => {
        const result = graph.migrate<V2Data>(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '2.0.0'
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ version: '2.0.0', name: 'Test' });
        expect(result.path.steps).toHaveLength(1);
        expect(result.stash.lossless).toBe(true);
      });

      it('should migrate data backward one step', () => {
        const result = graph.migrate<V1Data>(
          { version: '2.0.0', name: 'Test', email: 'test@example.com' },
          '2.0.0',
          '1.0.0'
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ version: '1.0.0', name: 'Test' });
        expect(result.path.steps).toHaveLength(1);
      });

      it('should migrate data across multiple steps', () => {
        const result = graph.migrate<V3Data>(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '3.0.0'
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ version: '3.0.0', fullName: 'Test' });
        expect(result.path.steps).toHaveLength(2);
      });

      it('should preserve and restore fields', () => {
        const data: V2Data = {
          version: '2.0.0',
          name: 'Test',
          email: 'test@example.com',
        };
        // Go up to v3 (preserves email) then back down to v2 (restores email)
        const upResult = graph.migrate<V3Data>(data, '2.0.0', '3.0.0');
        expect(upResult.success).toBe(true);
        expect(upResult.stash.consumed).toHaveLength(0);
        expect(upResult.stash.unconsumed).toHaveLength(1);
        expect(upResult.preservedFields).toHaveLength(1);

        // Pass the preserved fields to the next migration
        const downResult = graph.migrate<V2Data>(
          upResult.data!,
          '3.0.0',
          '2.0.0',
          { initialStash: upResult.preservedFields }
        );
        expect(downResult.success).toBe(true);
        expect(downResult.data?.email).toBe('test@example.com');
        expect(downResult.stash.consumed).toHaveLength(1);
      });
    });

    describe('validation failures', () => {
      it('should fail on invalid source data', () => {
        const result = graph.migrate({ invalid: true }, '1.0.0', '2.0.0');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_FAILED');
      });

      it('should fail on invalid destination data', () => {
        const badMigration: ReversibleMigration<V1Data, V2Data> = {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: () => ({ invalid: 'data' } as unknown as V2Data),
          down: (data) => data as unknown as V1Data,
        };

        const graph2 = createMigrationGraph({
          id: 'test-2',
          versionStrategy: semverStrategy,
        });
        graph2.registerSchema(schemaV1);
        graph2.registerSchema(schemaV2);
        graph2.registerMigration(badMigration);

        const result = graph2.migrate({ version: '1.0.0', name: 'Test' }, '1.0.0', '2.0.0');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_FAILED');
      });

      it('should skip validation when skipValidation is true', () => {
        const result = graph.migrate(
          { invalid: true },
          '1.0.0',
          '2.0.0',
          { skipValidation: true }
        );
        // Migration succeeds because validation is skipped,
        // but the result may have malformed data
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          version: '2.0.0',
          name: undefined,
        });
      });

      it('should validate intermediate steps when validateIntermediate is true', () => {
        const badMigration: ReversibleMigration<V1Data, V2Data> = {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: () => ({ version: '2.0.0', invalid: true } as unknown as V2Data),
          down: (data) => data as unknown as V1Data,
        };

        const graph2 = createMigrationGraph({
          id: 'test-2',
          versionStrategy: semverStrategy,
        });
        graph2.registerSchema(schemaV1);
        graph2.registerSchema(schemaV2);
        graph2.registerSchema(schemaV3);
        graph2.registerMigration(badMigration);
        graph2.registerMigration(migrationV2ToV3);

        const result = graph2.migrate(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '3.0.0',
          { validateIntermediate: true }
        );
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_FAILED');
      });
    });

    describe('migration failures', () => {
      it('should fail when migration throws error', () => {
        const failingMigration: ReversibleMigration<V1Data, V2Data> = {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: () => {
            throw new Error('Migration failed');
          },
          down: (data) => data as unknown as V1Data,
        };

        const graph2 = createMigrationGraph({
          id: 'test-2',
          versionStrategy: semverStrategy,
        });
        graph2.registerSchema(schemaV1);
        graph2.registerSchema(schemaV2);
        graph2.registerMigration(failingMigration);

        const result = graph2.migrate({ version: '1.0.0', name: 'Test' }, '1.0.0', '2.0.0');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MIGRATION_FAILED');
        expect(result.error?.message).toContain('Migration failed');
      });

      it('should fail when no path exists', () => {
        const result = graph.migrate({ version: '1.0.0', name: 'Test' }, '1.0.0', '4.0.0');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('NO_PATH');
      });
    });

    describe('edge cases', () => {
      it('should handle normalized versions', () => {
        const result = graph.migrate<V2Data>(
          { version: '1.0.0', name: 'Test' },
          'v1.0.0',
          'v2.0.0'
        );
        expect(result.success).toBe(true);
      });

      it('should handle empty stash for lossless migration', () => {
        const result = graph.migrate<V2Data>(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '2.0.0'
        );
        expect(result.success).toBe(true);
        expect(result.stash.lossless).toBe(true);
        expect(result.stash.consumed).toHaveLength(0);
        expect(result.stash.unconsumed).toHaveLength(0);
      });
    });

    describe('error handling', () => {
      it('should handle migration function that throws non-Error', () => {
        const badMigration: ReversibleMigration<V1Data, V2Data> = {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: () => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw 'String error instead of Error object';
          },
          down: (data) => data as unknown as V1Data,
        };

        const graph2 = createMigrationGraph({
          id: 'test-2',
          versionStrategy: semverStrategy,
        });
        graph2.registerSchema(schemaV1);
        graph2.registerSchema(schemaV2);
        graph2.registerMigration(badMigration);

        const result = graph2.migrate({ version: '1.0.0', name: 'Test' }, '1.0.0', '2.0.0');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MIGRATION_FAILED');
      });

      it('should fail gracefully with invalid data types', () => {
        // Pass number where object expected
        const result = graph.migrate(12345 as unknown, '1.0.0', '2.0.0');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_FAILED');
      });

      it('should fail gracefully with null data', () => {
        const result = graph.migrate(null, '1.0.0', '2.0.0');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_FAILED');
      });

      it('should fail gracefully with undefined data', () => {
        const result = graph.migrate(undefined, '1.0.0', '2.0.0');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_FAILED');
      });

      it('should handle very large data objects', () => {
        // Create object with many properties
        const largeObj: Record<string, number> = {};
        for (let i = 0; i < 1000; i++) {
          largeObj[`field${i}`] = i;
        }
        const data = { version: '1.0.0', name: 'Test', ...largeObj };

        const result = graph.migrate<V2Data>(data, '1.0.0', '2.0.0');
        expect(result.success).toBe(true);
        expect(result.data?.version).toBe('2.0.0');
      });

      it('should fail when migrating to unregistered version', () => {
        const data: V1Data = { version: '1.0.0', name: 'Test' };
        const result = graph.migrate(data, '1.0.0', '999.0.0');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('NO_PATH');
      });

      it('should fail when path requires down but migration is one-way', () => {
        const graph2 = createMigrationGraph({
          id: 'test-one-way',
          versionStrategy: semverStrategy,
        });
        graph2.registerSchema(schemaV1);
        graph2.registerSchema(schemaV2);
        graph2.registerMigration(irreversibleMigrationV1ToV2);

        // Try to go backwards through one-way migration
        const data: V2Data = { version: '2.0.0', name: 'Test', email: 'test@example.com' };
        const result = graph2.migrate(data, '2.0.0', '1.0.0');
        expect(result.success).toBe(false);
        // The path exists but migration fails when trying to execute the down step
        expect(result.error?.code).toBe('MIGRATION_FAILED');
      });

      it('should handle empty string in version field', () => {
        const data = { version: '', name: 'Test' };
        const result = graph.migrate(data, '1.0.0', '2.0.0');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_FAILED');
      });

      it('should handle array as data', () => {
        const result = graph.migrate(['not', 'an', 'object'], '1.0.0', '2.0.0');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_FAILED');
      });
    });
  });

  describe('getVersions', () => {
    it('should return empty array when no schemas', () => {
      expect(graph.getVersions()).toHaveLength(0);
    });

    it('should return sorted versions', () => {
      graph.registerSchema(schemaV3);
      graph.registerSchema(schemaV1);
      graph.registerSchema(schemaV2);
      expect(graph.getVersions()).toEqual(['1.0.0', '2.0.0', '3.0.0']);
    });
  });

  describe('getSchema', () => {
    it('should return undefined for unregistered version', () => {
      expect(graph.getSchema('999.0.0')).toBeUndefined();
    });

    it('should return schema for registered version', () => {
      graph.registerSchema(schemaV1);
      expect(graph.getSchema('1.0.0')).toBe(schemaV1);
    });

    it('should handle normalized versions', () => {
      graph.registerSchema(schemaV1);
      expect(graph.getSchema('v1.0.0')).toBe(schemaV1);
    });
  });

  describe('getMigrations', () => {
    it('should return empty array when no migrations', () => {
      expect(graph.getMigrations()).toHaveLength(0);
    });

    it('should return all registered migrations', () => {
      graph.registerMigration(migrationV1ToV2);
      graph.registerMigration(migrationV2ToV3);
      expect(graph.getMigrations()).toHaveLength(2);
    });
  });

  describe('migrateMany', () => {
    beforeEach(() => {
      graph.registerSchema(schemaV1);
      graph.registerSchema(schemaV2);
      graph.registerMigration(migrationV1ToV2);
    });

    it('should migrate multiple items', () => {
      const users = [
        { version: '1.0.0' as const, name: 'Alice' },
        { version: '1.0.0' as const, name: 'Bob' },
        { version: '1.0.0' as const, name: 'Charlie' },
      ];

      const result = graph.migrateMany<V2Data>(users, '1.0.0', '2.0.0');

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].data).toEqual({ version: '2.0.0', name: 'Alice' });
      expect(result.results[1].data).toEqual({ version: '2.0.0', name: 'Bob' });
      expect(result.results[2].data).toEqual({ version: '2.0.0', name: 'Charlie' });
    });

    it('should track progress via callback', () => {
      const users = [
        { version: '1.0.0' as const, name: 'Alice' },
        { version: '1.0.0' as const, name: 'Bob' },
      ];

      const progressCalls: Array<{ completed: number; total: number }> = [];
      graph.migrateMany<V2Data>(users, '1.0.0', '2.0.0', {
        onProgress: (completed, total) => {
          progressCalls.push({ completed, total });
        },
      });

      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0]).toEqual({ completed: 1, total: 2 });
      expect(progressCalls[1]).toEqual({ completed: 2, total: 2 });
    });

    it('should stop on first error by default', () => {
      const users = [
        { version: '1.0.0' as const, name: 'Alice' },
        { invalid: true }, // Invalid data
        { version: '1.0.0' as const, name: 'Charlie' },
      ];

      const result = graph.migrateMany<V2Data>(users, '1.0.0', '2.0.0');

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[2].success).toBe(false);
      expect(result.results[2].error?.message).toContain('stopped due to previous error');
    });

    it('should continue on error when configured', () => {
      const users = [
        { version: '1.0.0' as const, name: 'Alice' },
        { invalid: true }, // Invalid data
        { version: '1.0.0' as const, name: 'Charlie' },
      ];

      const result = graph.migrateMany<V2Data>(users, '1.0.0', '2.0.0', {
        continueOnError: true,
      });

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[2].success).toBe(true);
    });

    it('should handle empty iterable', () => {
      const result = graph.migrateMany<V2Data>([], '1.0.0', '2.0.0');

      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should compute path only once', () => {
      const users = [
        { version: '1.0.0' as const, name: 'Alice' },
        { version: '1.0.0' as const, name: 'Bob' },
      ];

      const result = graph.migrateMany<V2Data>(users, '1.0.0', '2.0.0');

      // All results should reference the same path
      expect(result.path).toStrictEqual(result.results[0].path);
      expect(result.path).toStrictEqual(result.results[1].path);
    });
  });

  describe('telemetry', () => {
    it('should call onPathComputed', () => {
      const onPathComputed = vi.fn();
      const graphWithTelemetry = createMigrationGraph({
        id: 'telemetry-test',
        versionStrategy: semverStrategy,
        telemetry: { onPathComputed },
      });

      graphWithTelemetry.registerSchema(schemaV1);
      graphWithTelemetry.registerSchema(schemaV2);
      graphWithTelemetry.registerMigration(migrationV1ToV2);

      graphWithTelemetry.migrate<V2Data>(
        { version: '1.0.0', name: 'Test' },
        '1.0.0',
        '2.0.0'
      );

      expect(onPathComputed).toHaveBeenCalledTimes(1);
      expect(onPathComputed).toHaveBeenCalledWith(
        expect.objectContaining({
          steps: expect.any(Array),
          direction: 'up',
        }),
        expect.any(Number)
      );
    });

    it('should call onStepStart and onStepComplete', () => {
      const onStepStart = vi.fn();
      const onStepComplete = vi.fn();
      const graphWithTelemetry = createMigrationGraph({
        id: 'telemetry-test',
        versionStrategy: semverStrategy,
        telemetry: { onStepStart, onStepComplete },
      });

      graphWithTelemetry.registerSchema(schemaV1);
      graphWithTelemetry.registerSchema(schemaV2);
      graphWithTelemetry.registerMigration(migrationV1ToV2);

      graphWithTelemetry.migrate<V2Data>(
        { version: '1.0.0', name: 'Test' },
        '1.0.0',
        '2.0.0'
      );

      expect(onStepStart).toHaveBeenCalledTimes(1);
      expect(onStepStart).toHaveBeenCalledWith(
        expect.objectContaining({
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          direction: 'up',
        }),
        0,
        1
      );

      expect(onStepComplete).toHaveBeenCalledTimes(1);
      expect(onStepComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          direction: 'up',
        }),
        0,
        expect.any(Number)
      );
    });

    it('should call onMigrationComplete on success', () => {
      const onMigrationComplete = vi.fn();
      const graphWithTelemetry = createMigrationGraph({
        id: 'telemetry-test',
        versionStrategy: semverStrategy,
        telemetry: { onMigrationComplete },
      });

      graphWithTelemetry.registerSchema(schemaV1);
      graphWithTelemetry.registerSchema(schemaV2);
      graphWithTelemetry.registerMigration(migrationV1ToV2);

      graphWithTelemetry.migrate<V2Data>(
        { version: '1.0.0', name: 'Test' },
        '1.0.0',
        '2.0.0'
      );

      expect(onMigrationComplete).toHaveBeenCalledTimes(1);
      expect(onMigrationComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
        }),
        expect.any(Number)
      );
    });

    it('should call onMigrationComplete on failure', () => {
      const onMigrationComplete = vi.fn();
      const graphWithTelemetry = createMigrationGraph({
        id: 'telemetry-test',
        versionStrategy: semverStrategy,
        telemetry: { onMigrationComplete },
      });

      graphWithTelemetry.registerSchema(schemaV1);
      graphWithTelemetry.registerSchema(schemaV2);
      graphWithTelemetry.registerMigration(migrationV1ToV2);

      graphWithTelemetry.migrate<V2Data>({ invalid: true }, '1.0.0', '2.0.0');

      expect(onMigrationComplete).toHaveBeenCalledTimes(1);
      expect(onMigrationComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(Error),
        }),
        expect.any(Number)
      );
    });

    it('should call onError on migration failure', () => {
      const onError = vi.fn();
      const failingMigration: ReversibleMigration<V1Data, V2Data> = {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: () => {
          throw new Error('Migration failed');
        },
        down: (data) => data as unknown as V1Data,
      };

      const graphWithTelemetry = createMigrationGraph({
        id: 'telemetry-test',
        versionStrategy: semverStrategy,
        telemetry: { onError },
      });

      graphWithTelemetry.registerSchema(schemaV1);
      graphWithTelemetry.registerSchema(schemaV2);
      graphWithTelemetry.registerMigration(failingMigration);

      graphWithTelemetry.migrate<V2Data>(
        { version: '1.0.0', name: 'Test' },
        '1.0.0',
        '2.0.0'
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
        }),
        expect.any(Object)
      );
    });

    it('should call onError on validation failure', () => {
      const onError = vi.fn();
      const graphWithTelemetry = createMigrationGraph({
        id: 'telemetry-test',
        versionStrategy: semverStrategy,
        telemetry: { onError },
      });

      graphWithTelemetry.registerSchema(schemaV1);
      graphWithTelemetry.registerSchema(schemaV2);
      graphWithTelemetry.registerMigration(migrationV1ToV2);

      graphWithTelemetry.migrate<V2Data>({ invalid: true }, '1.0.0', '2.0.0');

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        null, // No step for validation errors
        expect.any(Object)
      );
    });
  });

  describe('migrateAsync', () => {
    // Define async test migrations
    const asyncMigrationV1ToV2: AsyncReversibleMigration<V1Data, V2Data> = {
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      up: async (data, _ctx) => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          version: '2.0.0',
          name: data.name,
          email: 'async@example.com',
        };
      },
      down: async (data, _ctx) => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          version: '1.0.0',
          name: data.name,
        };
      },
    };

    const asyncMigrationV2ToV3: AsyncReversibleMigration<V2Data, V3Data> = {
      fromVersion: '2.0.0',
      toVersion: '3.0.0',
      up: async (data, ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (data.email) {
          ctx.preserve('email', data.email);
        }
        return {
          version: '3.0.0',
          fullName: data.name,
        };
      },
      down: async (data, ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const preserved = ctx.consume('email');
        return {
          version: '2.0.0',
          name: data.fullName,
          email: preserved?.kind === 'single' ? (preserved.value as string) : undefined,
        };
      },
    };

    const asyncOneWayMigrationV1ToV2: AsyncOneWayMigration<V1Data, V2Data> = {
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      irreversibleReason: 'Email cannot be recovered in async migration',
      up: async (data, _ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          version: '2.0.0',
          name: data.name,
          email: 'default@example.com',
        };
      },
    };

    let graph: ReturnType<typeof createMigrationGraph>;

    beforeEach(() => {
      graph = createMigrationGraph({
        id: 'test-async-graph',
        versionStrategy: semverStrategy,
      });
      graph.registerSchema(schemaV1);
      graph.registerSchema(schemaV2);
      graph.registerSchema(schemaV3);
    });

    describe('async migration up', () => {
      it('should migrate data forward with async migration', async () => {
        graph.registerMigration(asyncMigrationV1ToV2);
        const result = await graph.migrateAsync<V2Data>(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '2.0.0'
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          version: '2.0.0',
          name: 'Test',
          email: 'async@example.com',
        });
        expect(result.path.steps).toHaveLength(1);
      });

      it('should migrate data across multiple async steps', async () => {
        graph.registerMigration(asyncMigrationV1ToV2);
        graph.registerMigration(asyncMigrationV2ToV3);
        const result = await graph.migrateAsync<V3Data>(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '3.0.0'
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          version: '3.0.0',
          fullName: 'Test',
        });
        expect(result.path.steps).toHaveLength(2);
      });
    });

    describe('async migration down', () => {
      it('should migrate data backward with async migration', async () => {
        graph.registerMigration(asyncMigrationV1ToV2);
        const result = await graph.migrateAsync<V1Data>(
          { version: '2.0.0', name: 'Test', email: 'test@example.com' },
          '2.0.0',
          '1.0.0'
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          version: '1.0.0',
          name: 'Test',
        });
        expect(result.path.steps).toHaveLength(1);
      });
    });

    describe('mixed sync and async migrations', () => {
      it('should handle mix of sync and async migrations in forward direction', async () => {
        graph.registerMigration(migrationV1ToV2); // sync
        graph.registerMigration(asyncMigrationV2ToV3); // async
        const result = await graph.migrateAsync<V3Data>(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '3.0.0'
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          version: '3.0.0',
          fullName: 'Test',
        });
        expect(result.path.steps).toHaveLength(2);
      });

      it('should handle mix of sync and async migrations in backward direction', async () => {
        graph.registerMigration(asyncMigrationV1ToV2); // async
        graph.registerMigration(migrationV2ToV3); // sync
        const result = await graph.migrateAsync<V1Data>(
          { version: '3.0.0', fullName: 'Test' },
          '3.0.0',
          '1.0.0'
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          version: '1.0.0',
          name: 'Test',
        });
        expect(result.path.steps).toHaveLength(2);
      });
    });

    describe('async migration with stash', () => {
      it('should preserve and restore fields across async migrations', async () => {
        graph.registerMigration(asyncMigrationV2ToV3);
        const data: V2Data = {
          version: '2.0.0',
          name: 'Test',
          email: 'preserved@example.com',
        };

        // Go up to v3 (preserves email)
        const upResult = await graph.migrateAsync<V3Data>(data, '2.0.0', '3.0.0');
        expect(upResult.success).toBe(true);
        expect(upResult.stash.unconsumed).toHaveLength(1);
        expect(upResult.preservedFields).toHaveLength(1);

        // Go back down to v2 (restores email)
        const downResult = await graph.migrateAsync<V2Data>(
          upResult.data!,
          '3.0.0',
          '2.0.0',
          { initialStash: upResult.preservedFields }
        );
        expect(downResult.success).toBe(true);
        expect(downResult.data?.email).toBe('preserved@example.com');
        expect(downResult.stash.consumed).toHaveLength(1);
        expect(downResult.stash.lossless).toBe(true);
      });
    });

    describe('async migration errors', () => {
      it('should handle errors in async migrations', async () => {
        const failingAsyncMigration: AsyncReversibleMigration<V1Data, V2Data> = {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            throw new Error('Async migration failed');
          },
          down: async (data) => data as unknown as V1Data,
        };

        graph.registerMigration(failingAsyncMigration);
        const result = await graph.migrateAsync(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '2.0.0'
        );
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MIGRATION_FAILED');
        expect(result.error?.message).toContain('Async migration failed');
      });

      it('should handle validation errors in async migrations', async () => {
        const badAsyncMigration: AsyncReversibleMigration<V1Data, V2Data> = {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: async () => ({ invalid: 'data' } as unknown as V2Data),
          down: async (data) => data as unknown as V1Data,
        };

        graph.registerMigration(badAsyncMigration);
        const result = await graph.migrateAsync(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '2.0.0'
        );
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_FAILED');
      });
    });

    describe('async one-way migrations', () => {
      it('should execute async one-way migrations forward', async () => {
        graph.registerMigration(asyncOneWayMigrationV1ToV2);
        const result = await graph.migrateAsync<V2Data>(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '2.0.0'
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          version: '2.0.0',
          name: 'Test',
          email: 'default@example.com',
        });
        expect(result.path.hasIrreversibleStep).toBe(false); // Going forward
      });

      it('should mark path as irreversible when going backward', async () => {
        graph.registerMigration(asyncOneWayMigrationV1ToV2);
        const path = graph.getPath('2.0.0', '1.0.0');
        expect(path.hasIrreversibleStep).toBe(true);
      });
    });

    describe('async migration with validation', () => {
      it('should validate intermediate steps when validateIntermediate is true', async () => {
        const badAsyncMigration: AsyncReversibleMigration<V1Data, V2Data> = {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: async () => ({ version: '2.0.0', invalid: true } as unknown as V2Data),
          down: async (data) => data as unknown as V1Data,
        };

        const graph2 = createMigrationGraph({
          id: 'test-validation',
          versionStrategy: semverStrategy,
        });
        graph2.registerSchema(schemaV1);
        graph2.registerSchema(schemaV2);
        graph2.registerSchema(schemaV3);
        graph2.registerMigration(badAsyncMigration);
        graph2.registerMigration(asyncMigrationV2ToV3);

        const result = await graph2.migrateAsync(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '3.0.0',
          { validateIntermediate: true }
        );
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_FAILED');
      });

      it('should skip validation when skipValidation is true', async () => {
        graph.registerMigration(asyncMigrationV1ToV2);
        const result = await graph.migrateAsync(
          { invalid: true },
          '1.0.0',
          '2.0.0',
          { skipValidation: true }
        );
        expect(result.success).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should return same data for same version', async () => {
        const data: V1Data = { version: '1.0.0', name: 'Test' };
        const result = await graph.migrateAsync(data, '1.0.0', '1.0.0');
        expect(result.success).toBe(true);
        expect(result.data).toEqual(data);
        expect(result.path.steps).toHaveLength(0);
      });

      it('should handle normalized versions', async () => {
        graph.registerMigration(asyncMigrationV1ToV2);
        const result = await graph.migrateAsync<V2Data>(
          { version: '1.0.0', name: 'Test' },
          'v1.0.0',
          'v2.0.0'
        );
        expect(result.success).toBe(true);
      });

      it('should return error when no path exists', async () => {
        const result = await graph.migrateAsync(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '4.0.0'
        );
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('NO_PATH');
      });
    });
  });

  describe('declarative configuration', () => {
    describe('schemas-only registration', () => {
      it('should register schemas from options array', () => {
        const graph = createMigrationGraph({
          id: 'test-declarative',
          versionStrategy: semverStrategy,
          schemas: [schemaV1, schemaV2, schemaV3],
        });

        expect(graph.getSchema('1.0.0')).toBe(schemaV1);
        expect(graph.getSchema('2.0.0')).toBe(schemaV2);
        expect(graph.getSchema('3.0.0')).toBe(schemaV3);
        expect(graph.getVersions()).toEqual(['1.0.0', '2.0.0', '3.0.0']);
      });

      it('should handle empty schemas array', () => {
        const graph = createMigrationGraph({
          id: 'test-empty',
          versionStrategy: semverStrategy,
          schemas: [],
        });

        expect(graph.getVersions()).toHaveLength(0);
      });

      it('should throw on duplicate schemas in array', () => {
        expect(() =>
          createMigrationGraph({
            id: 'test-duplicate',
            versionStrategy: semverStrategy,
            schemas: [schemaV1, schemaV1],
          })
        ).toThrow('already registered');
      });
    });

    describe('migrations-only registration', () => {
      it('should register migrations from options array', () => {
        const graph = createMigrationGraph({
          id: 'test-declarative',
          versionStrategy: semverStrategy,
          migrations: [migrationV1ToV2, migrationV2ToV3],
        });

        expect(graph.getMigrations()).toHaveLength(2);
        expect(graph.hasPath('1.0.0', '2.0.0')).toBe(true);
        expect(graph.hasPath('2.0.0', '3.0.0')).toBe(true);
        expect(graph.hasPath('1.0.0', '3.0.0')).toBe(true);
      });

      it('should handle empty migrations array', () => {
        const graph = createMigrationGraph({
          id: 'test-empty',
          versionStrategy: semverStrategy,
          migrations: [],
        });

        expect(graph.getMigrations()).toHaveLength(0);
      });

      it('should throw on duplicate migrations in array', () => {
        expect(() =>
          createMigrationGraph({
            id: 'test-duplicate',
            versionStrategy: semverStrategy,
            migrations: [migrationV1ToV2, migrationV1ToV2],
          })
        ).toThrow('already registered');
      });
    });

    describe('complete declarative configuration', () => {
      it('should register both schemas and migrations from options', () => {
        const graph = createMigrationGraph({
          id: 'test-complete',
          versionStrategy: semverStrategy,
          schemas: [schemaV1, schemaV2, schemaV3],
          migrations: [migrationV1ToV2, migrationV2ToV3],
        });

        expect(graph.getVersions()).toEqual(['1.0.0', '2.0.0', '3.0.0']);
        expect(graph.getMigrations()).toHaveLength(2);
        expect(graph.hasPath('1.0.0', '3.0.0')).toBe(true);
      });

      it('should allow migration with declaratively configured graph', () => {
        const graph = createMigrationGraph({
          id: 'test-migration',
          versionStrategy: semverStrategy,
          schemas: [schemaV1, schemaV2],
          migrations: [migrationV1ToV2],
        });

        const result = graph.migrate<V2Data>(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '2.0.0'
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ version: '2.0.0', name: 'Test' });
      });

      it('should support async migrations in declarative config', () => {
        const asyncMigration: AsyncReversibleMigration<V1Data, V2Data> = {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: async (data) => ({
            version: '2.0.0',
            name: data.name,
          }),
          down: async (data) => ({
            version: '1.0.0',
            name: data.name,
          }),
        };

        const graph = createMigrationGraph({
          id: 'test-async',
          versionStrategy: semverStrategy,
          schemas: [schemaV1, schemaV2],
          migrations: [asyncMigration],
        });

        expect(graph.hasPath('1.0.0', '2.0.0')).toBe(true);
      });

      it('should support one-way migrations in declarative config', () => {
        const graph = createMigrationGraph({
          id: 'test-oneway',
          versionStrategy: semverStrategy,
          schemas: [schemaV1, schemaV2],
          migrations: [irreversibleMigrationV1ToV2],
        });

        const result = graph.migrate<V2Data>(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '2.0.0'
        );

        expect(result.success).toBe(true);
        expect(result.data?.email).toBe('unknown@example.com');
      });
    });

    describe('mixed registration', () => {
      it('should allow adding schemas after declarative initialization', () => {
        const graph = createMigrationGraph({
          id: 'test-mixed',
          versionStrategy: semverStrategy,
          schemas: [schemaV1],
        });

        graph.registerSchema(schemaV2);
        graph.registerSchema(schemaV3);

        expect(graph.getVersions()).toEqual(['1.0.0', '2.0.0', '3.0.0']);
      });

      it('should allow adding migrations after declarative initialization', () => {
        const graph = createMigrationGraph({
          id: 'test-mixed',
          versionStrategy: semverStrategy,
          migrations: [migrationV1ToV2],
        });

        graph.registerMigration(migrationV2ToV3);

        expect(graph.getMigrations()).toHaveLength(2);
        expect(graph.hasPath('1.0.0', '3.0.0')).toBe(true);
      });

      it('should prevent duplicate registration across declarative and imperative', () => {
        const graph = createMigrationGraph({
          id: 'test-duplicate',
          versionStrategy: semverStrategy,
          schemas: [schemaV1],
        });

        expect(() => graph.registerSchema(schemaV1)).toThrow('already registered');
      });

      it('should work with complex migration paths', () => {
        const graph = createMigrationGraph({
          id: 'test-complex',
          versionStrategy: semverStrategy,
          schemas: [schemaV1, schemaV2],
          migrations: [migrationV1ToV2],
        });

        // Add additional schema and migration imperatively
        graph.registerSchema(schemaV3);
        graph.registerMigration(migrationV2ToV3);

        const result = graph.migrate<V3Data>(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '3.0.0'
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ version: '3.0.0', fullName: 'Test' });
        expect(result.path.steps).toHaveLength(2);
      });
    });

    describe('edge cases', () => {
      it('should handle undefined schemas and migrations options', () => {
        const graph = createMigrationGraph({
          id: 'test-undefined',
          versionStrategy: semverStrategy,
          schemas: undefined,
          migrations: undefined,
        });

        expect(graph.getVersions()).toHaveLength(0);
        expect(graph.getMigrations()).toHaveLength(0);
      });

      it('should work when options omit schemas and migrations', () => {
        const graph = createMigrationGraph({
          id: 'test-omit',
          versionStrategy: semverStrategy,
        });

        expect(graph.getVersions()).toHaveLength(0);
        expect(graph.getMigrations()).toHaveLength(0);
      });

      it('should validate schema versions in declarative config', () => {
        const invalidSchema = {
          version: 'invalid-version',
          schema: () => ({ success: false as const, errors: [] }),
        };

        expect(() =>
          createMigrationGraph({
            id: 'test-invalid',
            versionStrategy: semverStrategy,
            schemas: [invalidSchema],
          })
        ).toThrow('Invalid version');
      });

      it('should validate migration versions in declarative config', () => {
        const invalidMigration = {
          fromVersion: 'invalid',
          toVersion: '2.0.0',
          up: () => ({ version: '2.0.0' as const }),
        };

        expect(() =>
          createMigrationGraph({
            id: 'test-invalid',
            versionStrategy: semverStrategy,
            migrations: [invalidMigration],
          })
        ).toThrow('Invalid version');
      });

      it('should work with telemetry and declarative config', () => {
        const onPathComputed = vi.fn();
        const graph = createMigrationGraph({
          id: 'test-telemetry',
          versionStrategy: semverStrategy,
          schemas: [schemaV1, schemaV2],
          migrations: [migrationV1ToV2],
          telemetry: { onPathComputed },
        });

        graph.migrate<V2Data>(
          { version: '1.0.0', name: 'Test' },
          '1.0.0',
          '2.0.0'
        );

        expect(onPathComputed).toHaveBeenCalledTimes(1);
      });

      it('should handle single schema in declarative config', () => {
        const graph = createMigrationGraph({
          id: 'test-single',
          versionStrategy: semverStrategy,
          schemas: [schemaV1],
        });

        expect(graph.getVersions()).toEqual(['1.0.0']);
        expect(graph.getSchema('1.0.0')).toBe(schemaV1);
      });

      it('should handle single migration in declarative config', () => {
        const graph = createMigrationGraph({
          id: 'test-single',
          versionStrategy: semverStrategy,
          migrations: [migrationV1ToV2],
        });

        expect(graph.getMigrations()).toHaveLength(1);
        expect(graph.hasPath('1.0.0', '2.0.0')).toBe(true);
      });
    });

    describe('type safety', () => {
      it('should accept typed schema arrays', () => {
        const typedSchemas: VersionedSchema<V1Data | V2Data>[] = [schemaV1, schemaV2];

        const graph = createMigrationGraph({
          id: 'test-typed',
          versionStrategy: semverStrategy,
          schemas: typedSchemas,
        });

        expect(graph.getVersions()).toEqual(['1.0.0', '2.0.0']);
      });

      it('should accept mixed migration types', () => {
        const reversible: ReversibleMigration<V1Data, V2Data> = migrationV1ToV2;
        const oneWay: OneWayMigration<V1Data, V2Data> = irreversibleMigrationV1ToV2;

        // Should accept both types in the migrations array
        const graph1 = createMigrationGraph({
          id: 'test-reversible',
          versionStrategy: semverStrategy,
          migrations: [reversible],
        });

        const graph2 = createMigrationGraph({
          id: 'test-oneway',
          versionStrategy: semverStrategy,
          migrations: [oneWay],
        });

        expect(graph1.getMigrations()).toHaveLength(1);
        expect(graph2.getMigrations()).toHaveLength(1);
      });
    });
  });
});
