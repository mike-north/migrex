/**
 * Property-based tests for migration round-trips.
 *
 * These tests use fast-check to verify that migrations preserve data
 * integrity through round-trip conversions (up then down).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createMigrationGraph, semverStrategy } from '../src/index.js';
import type {
  VersionedSchema,
  ReversibleMigration,
  MigrationContext,
} from '../src/index.js';

// Arbitraries for generating test data
const userArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  email: fc.emailAddress(),
  age: fc.integer({ min: 0, max: 150 }),
});

const productArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 200 }),
  price: fc.float({ min: 0, max: 1000000, noNaN: true }),
  quantity: fc.integer({ min: 0, max: 10000 }),
});

describe('Property-based Migration Tests', () => {
  describe('Round-trip preservation', () => {
    it('should preserve data through v1 -> v2 -> v1 migration (simple rename)', () => {
      interface V1 {
        name: string;
      }
      interface V2 {
        fullName: string;
      }

      const schemaV1: VersionedSchema<V1> = {
        version: '1.0.0',
        schema: (data) => {
          if (
            typeof data === 'object' &&
            data !== null &&
            'name' in data &&
            typeof data.name === 'string'
          ) {
            return { success: true, data: data as V1 };
          }
          return { success: false, errors: [{ path: [], message: 'Invalid v1' }] };
        },
      };

      const schemaV2: VersionedSchema<V2> = {
        version: '2.0.0',
        schema: (data) => {
          if (
            typeof data === 'object' &&
            data !== null &&
            'fullName' in data &&
            typeof data.fullName === 'string'
          ) {
            return { success: true, data: data as V2 };
          }
          return { success: false, errors: [{ path: [], message: 'Invalid v2' }] };
        },
      };

      const migration: ReversibleMigration<V1, V2> = {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => ({ fullName: data.name }),
        down: (data) => ({ name: data.fullName }),
      };

      const graph = createMigrationGraph({
        id: 'round-trip-test',
        versionStrategy: semverStrategy,
      });
      graph.registerSchema(schemaV1);
      graph.registerSchema(schemaV2);
      graph.registerMigration(migration);

      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (name) => {
          const original: V1 = { name };

          // Migrate up
          const upResult = graph.migrate<V2>(original, '1.0.0', '2.0.0');
          expect(upResult.success).toBe(true);

          // Migrate back down
          const downResult = graph.migrate<V1>(upResult.data!, '2.0.0', '1.0.0');
          expect(downResult.success).toBe(true);

          // Should be identical
          expect(downResult.data).toEqual(original);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve extra fields through stash in round-trip', () => {
      interface V1 {
        name: string;
        extra: string;
      }
      interface V2 {
        name: string;
      }

      const schemaV1: VersionedSchema<V1> = {
        version: '1.0.0',
        schema: (data) => {
          if (
            typeof data === 'object' &&
            data !== null &&
            'name' in data &&
            'extra' in data
          ) {
            return { success: true, data: data as V1 };
          }
          return { success: false, errors: [{ path: [], message: 'Invalid' }] };
        },
      };

      const schemaV2: VersionedSchema<V2> = {
        version: '2.0.0',
        schema: (data) => {
          if (typeof data === 'object' && data !== null && 'name' in data) {
            return { success: true, data: data as V2 };
          }
          return { success: false, errors: [{ path: [], message: 'Invalid' }] };
        },
      };

      const migration: ReversibleMigration<V1, V2> = {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data, ctx) => {
          ctx.preserve('extra', data.extra);
          return { name: data.name };
        },
        down: (data, ctx) => {
          const preserved = ctx.consume('extra');
          return {
            name: data.name,
            extra: preserved?.kind === 'single' ? (preserved.value as string) : '',
          };
        },
      };

      const graph = createMigrationGraph({
        id: 'stash-round-trip-test',
        versionStrategy: semverStrategy,
      });
      graph.registerSchema(schemaV1);
      graph.registerSchema(schemaV2);
      graph.registerMigration(migration);

      fc.assert(
        fc.property(fc.string(), fc.string(), (name, extra) => {
          const original: V1 = { name, extra };

          // Migrate up
          const upResult = graph.migrate<V2>(original, '1.0.0', '2.0.0');
          expect(upResult.success).toBe(true);
          expect(upResult.preservedFields).toHaveLength(1);

          // Migrate back down with stash
          const downResult = graph.migrate<V1>(upResult.data!, '2.0.0', '1.0.0', {
            initialStash: upResult.preservedFields,
          });
          expect(downResult.success).toBe(true);

          // Should be identical
          expect(downResult.data).toEqual(original);
          expect(downResult.stash.lossless).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle complex nested objects in round-trip', () => {
      interface V1 {
        user: {
          name: string;
          profile: {
            bio: string;
            avatar: string;
          };
        };
      }
      interface V2 {
        userName: string;
        userBio: string;
        userAvatar: string;
      }

      const schemaV1: VersionedSchema<V1> = {
        version: '1.0.0',
        schema: (data) => {
          if (
            typeof data === 'object' &&
            data !== null &&
            'user' in data &&
            typeof data.user === 'object'
          ) {
            return { success: true, data: data as V1 };
          }
          return { success: false, errors: [{ path: [], message: 'Invalid' }] };
        },
      };

      const schemaV2: VersionedSchema<V2> = {
        version: '2.0.0',
        schema: (data) => {
          if (
            typeof data === 'object' &&
            data !== null &&
            'userName' in data &&
            'userBio' in data &&
            'userAvatar' in data
          ) {
            return { success: true, data: data as V2 };
          }
          return { success: false, errors: [{ path: [], message: 'Invalid' }] };
        },
      };

      const migration: ReversibleMigration<V1, V2> = {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => ({
          userName: data.user.name,
          userBio: data.user.profile.bio,
          userAvatar: data.user.profile.avatar,
        }),
        down: (data) => ({
          user: {
            name: data.userName,
            profile: {
              bio: data.userBio,
              avatar: data.userAvatar,
            },
          },
        }),
      };

      const graph = createMigrationGraph({
        id: 'nested-round-trip-test',
        versionStrategy: semverStrategy,
      });
      graph.registerSchema(schemaV1);
      graph.registerSchema(schemaV2);
      graph.registerMigration(migration);

      fc.assert(
        fc.property(fc.string(), fc.string(), fc.string(), (name, bio, avatar) => {
          const original: V1 = {
            user: {
              name,
              profile: { bio, avatar },
            },
          };

          // Round trip
          const upResult = graph.migrate<V2>(original, '1.0.0', '2.0.0');
          expect(upResult.success).toBe(true);

          const downResult = graph.migrate<V1>(upResult.data!, '2.0.0', '1.0.0');
          expect(downResult.success).toBe(true);

          expect(downResult.data).toEqual(original);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle multi-step migrations', () => {
      interface V1 {
        value: number;
      }
      interface V2 {
        value: number;
        doubled: number;
      }
      interface V3 {
        original: number;
        doubled: number;
        quadrupled: number;
      }

      const schemaV1: VersionedSchema<V1> = {
        version: '1.0.0',
        schema: (data) => {
          if (typeof data === 'object' && data !== null && 'value' in data) {
            return { success: true, data: data as V1 };
          }
          return { success: false, errors: [{ path: [], message: 'Invalid' }] };
        },
      };

      const schemaV2: VersionedSchema<V2> = {
        version: '2.0.0',
        schema: (data) => {
          if (
            typeof data === 'object' &&
            data !== null &&
            'value' in data &&
            'doubled' in data
          ) {
            return { success: true, data: data as V2 };
          }
          return { success: false, errors: [{ path: [], message: 'Invalid' }] };
        },
      };

      const schemaV3: VersionedSchema<V3> = {
        version: '3.0.0',
        schema: (data) => {
          if (
            typeof data === 'object' &&
            data !== null &&
            'original' in data &&
            'doubled' in data &&
            'quadrupled' in data
          ) {
            return { success: true, data: data as V3 };
          }
          return { success: false, errors: [{ path: [], message: 'Invalid' }] };
        },
      };

      const migrationV1V2: ReversibleMigration<V1, V2> = {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => ({ value: data.value, doubled: data.value * 2 }),
        down: (data) => ({ value: data.value }),
      };

      const migrationV2V3: ReversibleMigration<V2, V3> = {
        fromVersion: '2.0.0',
        toVersion: '3.0.0',
        up: (data) => ({
          original: data.value,
          doubled: data.doubled,
          quadrupled: data.doubled * 2,
        }),
        down: (data) => ({
          value: data.original,
          doubled: data.doubled,
        }),
      };

      const graph = createMigrationGraph({
        id: 'multi-step-round-trip-test',
        versionStrategy: semverStrategy,
      });
      graph.registerSchema(schemaV1);
      graph.registerSchema(schemaV2);
      graph.registerSchema(schemaV3);
      graph.registerMigration(migrationV1V2);
      graph.registerMigration(migrationV2V3);

      fc.assert(
        fc.property(fc.integer({ min: -1000, max: 1000 }), (value) => {
          const original: V1 = { value };

          // Migrate all the way up
          const upResult = graph.migrate<V3>(original, '1.0.0', '3.0.0');
          expect(upResult.success).toBe(true);
          expect(upResult.path.steps).toHaveLength(2);

          // Migrate all the way back down
          const downResult = graph.migrate<V1>(upResult.data!, '3.0.0', '1.0.0');
          expect(downResult.success).toBe(true);
          expect(downResult.path.steps).toHaveLength(2);

          expect(downResult.data).toEqual(original);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Stash value equality', () => {
    it('should correctly compare complex nested objects', () => {
      interface V1 {
        data: Record<string, unknown>;
      }
      interface V2 {
        simplified: boolean;
      }

      const schemaV1: VersionedSchema<V1> = {
        version: '1.0.0',
        schema: (data) => ({ success: true, data: data as V1 }),
      };

      const schemaV2: VersionedSchema<V2> = {
        version: '2.0.0',
        schema: (data) => ({ success: true, data: data as V2 }),
      };

      const migration: ReversibleMigration<V1, V2> = {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data, ctx) => {
          ctx.preserve('data', data.data);
          return { simplified: true };
        },
        down: (data, ctx) => {
          const preserved = ctx.consume('data');
          return {
            data: preserved?.kind === 'single'
              ? (preserved.value as Record<string, unknown>)
              : {},
          };
        },
      };

      const graph = createMigrationGraph({
        id: 'complex-stash-test',
        versionStrategy: semverStrategy,
      });
      graph.registerSchema(schemaV1);
      graph.registerSchema(schemaV2);
      graph.registerMigration(migration);

      // Generate complex nested objects
      const complexObjectArb = fc.dictionary(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.array(fc.integer()),
          fc.dictionary(fc.string(), fc.string())
        )
      );

      fc.assert(
        fc.property(complexObjectArb, (complexData) => {
          const original: V1 = { data: complexData };

          const upResult = graph.migrate<V2>(original, '1.0.0', '2.0.0');
          expect(upResult.success).toBe(true);

          const downResult = graph.migrate<V1>(upResult.data!, '2.0.0', '1.0.0', {
            initialStash: upResult.preservedFields,
          });
          expect(downResult.success).toBe(true);

          expect(downResult.data).toEqual(original);
        }),
        { numRuns: 50 }
      );
    });
  });
});
