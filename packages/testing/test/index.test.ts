import { describe, it, expect } from 'vitest';
import { createMigrationGraph, semverStrategy } from '@migrex/core';
import type { MigrationContext } from '@migrex/core';
import {
  assertLossless,
  assertConnected,
  assertNoDeprecatedPaths,
  assertFieldProfile,
  testPipeline,
  createTestFixture,
  generateTestData,
} from '../src/index.js';

describe('@migrex/testing', () => {
  describe('assertLossless', () => {
    it('should pass when migration is lossless', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: { name: string }) => ({ name: data.name, email: '' }),
        down: (data: { name: string; email: string }) => ({
          name: data.name,
        }),
      });

      const result = graph.migrate<{ name: string; email: string }>(
        { name: 'Alice' },
        '1.0.0',
        '2.0.0'
      );

      expect(() => assertLossless(result)).not.toThrow();
    });

    it('should throw when migration has unconsumed fields', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: { theme: string }, ctx: MigrationContext) => {
          ctx.preserve('theme', data.theme);
          return {};
        },
        down: (data: unknown) => ({ theme: 'light' }),
      });

      const result = graph.migrate<Record<string, never>>(
        { theme: 'dark' },
        '1.0.0',
        '2.0.0'
      );

      expect(() => assertLossless(result)).toThrow(
        'Migration was lossy. Unconsumed fields: theme'
      );
    });
  });

  describe('assertConnected', () => {
    it('should pass when graph is fully connected', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: unknown) => data,
        down: (data: unknown) => data,
      });

      expect(() => assertConnected(graph)).not.toThrow();
    });

    it('should throw when graph has disconnected components', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      // Create two disconnected components
      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: unknown) => data,
        down: (data: unknown) => data,
      });

      // Add disconnected version
      graph.registerSchema({
        version: '3.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      expect(() => assertConnected(graph)).toThrow(
        'Graph is not fully connected'
      );
      expect(() => assertConnected(graph)).toThrow('Found 2 components');
    });

    it('should pass when graph is empty', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      expect(() => assertConnected(graph)).not.toThrow();
    });
  });

  describe('assertNoDeprecatedPaths', () => {
    it('should pass when no deprecated versions exist', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: unknown) => data,
        down: (data: unknown) => data,
      });

      expect(() => assertNoDeprecatedPaths(graph)).not.toThrow();
    });

    it('should pass when deprecated versions are isolated', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      // Current versions
      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '3.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerMigration({
        fromVersion: '2.0.0',
        toVersion: '3.0.0',
        up: (data: unknown) => data,
        down: (data: unknown) => data,
      });

      // Deprecated version with its own path
      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
        deprecated: {
          since: '2.0.0',
          successor: '2.0.0',
        },
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: unknown) => data,
        down: (data: unknown) => data,
      });

      expect(() => assertNoDeprecatedPaths(graph)).not.toThrow();
    });

    it('should throw when current versions must route through deprecated versions', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
        deprecated: {
          since: '3.0.0',
          successor: '3.0.0',
        },
      });

      graph.registerSchema({
        version: '3.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      // Only path from 1.0.0 to 3.0.0 is through deprecated 2.0.0
      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: unknown) => data,
        down: (data: unknown) => data,
      });

      graph.registerMigration({
        fromVersion: '2.0.0',
        toVersion: '3.0.0',
        up: (data: unknown) => data,
        down: (data: unknown) => data,
      });

      expect(() => assertNoDeprecatedPaths(graph)).toThrow(
        'Path from 1.0.0 to 3.0.0 goes through deprecated versions: 2.0.0'
      );
    });
  });

  describe('assertFieldProfile', () => {
    it('should pass when field has expected profile', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '3.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: { theme: string }, ctx: MigrationContext) => {
          ctx.preserve('theme', data.theme);
          return { mode: data.theme };
        },
        down: (data: { mode: string }, ctx: MigrationContext) => {
          const theme = ctx.consume('theme');
          return { theme: theme?.value as string };
        },
        traits: {
          up: { lossy: 'theme' },
        },
      });

      graph.registerMigration({
        fromVersion: '2.0.0',
        toVersion: '3.0.0',
        up: (data: { mode: string }, ctx: MigrationContext) => {
          const theme = ctx.consume('theme');
          return { appearance: theme?.value as string };
        },
        down: (data: { appearance: string }, ctx: MigrationContext) => {
          ctx.preserve('theme', data.appearance);
          return { mode: data.appearance };
        },
        traits: {
          down: { lossy: 'theme' },
        },
      });

      expect(() =>
        assertFieldProfile(graph, 'theme', 'always-single')
      ).not.toThrow();
    });

    it('should throw when field has different profile', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: unknown, ctx: MigrationContext) => {
          ctx.preserve('theme', 'light');
          return data;
        },
        down: (data: unknown) => data,
        traits: {
          up: { lossy: 'theme' },
        },
      });

      expect(() =>
        assertFieldProfile(graph, 'theme', 'sometimes-multi')
      ).toThrow('Field "theme" has profile "always-single"');
    });

    it('should throw when field is not preserved', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: unknown) => data,
        down: (data: unknown) => data,
      });

      expect(() =>
        assertFieldProfile(graph, 'nonexistent', 'always-single')
      ).toThrow('Field "nonexistent" is not preserved in any migration path');
    });

    it('should detect sometimes-multi profile when field can be preserved multiple times', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '3.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      // First migration preserves theme
      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: { theme: string }, ctx: MigrationContext) => {
          ctx.preserve('theme', data.theme);
          return { mode: data.theme };
        },
        down: (data: { mode: string }, ctx: MigrationContext) => {
          const theme = ctx.consume('theme');
          return { theme: theme?.value as string };
        },
        traits: {
          up: { lossy: 'theme' },
        },
      });

      // Second migration also preserves theme (allowing multiple preserves)
      graph.registerMigration({
        fromVersion: '2.0.0',
        toVersion: '3.0.0',
        up: (data: { mode: string }, ctx: MigrationContext) => {
          // This migration also preserves theme (could happen on some paths)
          ctx.preserve('theme', data.mode);
          return { appearance: data.mode };
        },
        down: (data: { appearance: string }, ctx: MigrationContext) => {
          const theme = ctx.consume('theme');
          return { mode: theme?.value as string };
        },
        traits: {
          up: { lossy: 'theme' },
        },
      });

      // The theme field can be preserved multiple times on the 1.0.0 -> 3.0.0 path
      expect(() =>
        assertFieldProfile(graph, 'theme', 'sometimes-multi')
      ).not.toThrow();
    });
  });

  describe('testPipeline', () => {
    it('should compute field profiles from migrations', () => {
      const pipeline = testPipeline([
        {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: (data: { theme: string }, ctx: MigrationContext) => {
            ctx.preserve('theme', data.theme);
            return { mode: 'new' };
          },
          down: (data: { mode: string }, ctx: MigrationContext) => {
            const theme = ctx.consume('theme');
            return { theme: theme?.value as string };
          },
          traits: {
            up: { lossy: 'theme' },
          },
        },
        {
          fromVersion: '2.0.0',
          toVersion: '3.0.0',
          up: (data: { mode: string }, ctx: MigrationContext) => {
            const theme = ctx.consume('theme');
            return { appearance: theme?.value as string };
          },
          down: (data: { appearance: string }, ctx: MigrationContext) => {
            ctx.preserve('theme', data.appearance);
            return { mode: 'old' };
          },
          traits: {
            down: { lossy: 'theme' },
          },
        },
      ]);

      const profile = pipeline.getProfile();
      expect(profile.theme).toBe('always-single');
    });

    it('should execute migrations sequentially', () => {
      interface V1 {
        name: string;
        age: number;
      }
      interface V2 {
        fullName: string;
        age: number;
      }
      interface V3 {
        fullName: string;
        birthYear: number;
      }

      const pipeline = testPipeline([
        {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: (data: V1) => ({
            fullName: data.name,
            age: data.age,
          }),
          down: (data: V2) => ({
            name: data.fullName,
            age: data.age,
          }),
        },
        {
          fromVersion: '2.0.0',
          toVersion: '3.0.0',
          up: (data: V2) => ({
            fullName: data.fullName,
            birthYear: new Date().getFullYear() - data.age,
          }),
          down: (data: V3) => ({
            fullName: data.fullName,
            age: new Date().getFullYear() - data.birthYear,
          }),
        },
      ]);

      const result = pipeline.execute<V1, V3>({ name: 'Alice', age: 30 });

      expect(result.fullName).toBe('Alice');
      expect(result.birthYear).toBeGreaterThan(1990);
    });

    it('should invoke callback with context at each step', () => {
      const steps: string[] = [];

      const pipeline = testPipeline([
        {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: (data: unknown) => data,
          down: (data: unknown) => data,
        },
        {
          fromVersion: '2.0.0',
          toVersion: '3.0.0',
          up: (data: unknown) => data,
          down: (data: unknown) => data,
        },
      ]);

      pipeline.execute({}, (ctx) => {
        steps.push(`${ctx.currentStep.from} -> ${ctx.currentStep.to}`);
      });

      expect(steps).toEqual(['1.0.0 -> 2.0.0', '2.0.0 -> 3.0.0']);
    });

    it('should handle empty migrations array', () => {
      const pipeline = testPipeline([]);

      const result = pipeline.execute({ value: 42 });

      expect(result).toEqual({ value: 42 });
    });

    it('should preserve and consume fields correctly', () => {
      let consumedValue: unknown;

      const pipeline = testPipeline([
        {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: (data: { secret: string }, ctx: MigrationContext) => {
            ctx.preserve('secret', data.secret);
            return { public: 'data' };
          },
          down: (data: unknown) => data,
        },
        {
          fromVersion: '2.0.0',
          toVersion: '3.0.0',
          up: (data: { public: string }, ctx: MigrationContext) => {
            const secret = ctx.consume('secret');
            consumedValue = secret?.value;
            return { combined: `${data.public}-${String(secret?.value)}` };
          },
          down: (data: unknown) => data,
        },
      ]);

      const result = pipeline.execute<
        { secret: string },
        { combined: string }
      >({ secret: 'hidden' });

      expect(consumedValue).toBe('hidden');
      expect(result.combined).toBe('data-hidden');
    });
  });

  describe('createTestFixture', () => {
    it('should create fixture with version and data', () => {
      const fixture = createTestFixture({
        version: '1.0.0',
        data: { name: 'Alice' },
      });

      expect(fixture.version).toBe('1.0.0');
      expect(fixture.data).toEqual({ name: 'Alice' });
    });

    it('should handle different data types', () => {
      const stringFixture = createTestFixture({
        version: '2.0.0',
        data: 'test',
      });

      expect(stringFixture.data).toBe('test');

      const numberFixture = createTestFixture({
        version: '3.0.0',
        data: 42,
      });

      expect(numberFixture.data).toBe(42);

      const arrayFixture = createTestFixture({
        version: '4.0.0',
        data: [1, 2, 3],
      });

      expect(arrayFixture.data).toEqual([1, 2, 3]);
    });

    it('should have readonly type for version and data', () => {
      const fixture = createTestFixture({
        version: '1.0.0',
        data: { test: true },
      });

      // TypeScript prevents mutation at compile time via readonly
      // Runtime doesn't enforce this, but TypeScript does
      expect(fixture.version).toBe('1.0.0');
      expect(fixture.data).toEqual({ test: true });

      // This would fail at compile time:
      // fixture.version = '2.0.0'; // Error: Cannot assign to 'version' because it is a read-only property
    });
  });

  describe('generateTestData', () => {
    it('should return empty object', () => {
      const data = generateTestData({
        version: '1.0.0',
        schema: () => ({ success: true }),
      });

      expect(data).toEqual({});
    });

    it('should accept any schema type', () => {
      expect(generateTestData('anything')).toEqual({});
      expect(generateTestData(null)).toEqual({});
      expect(generateTestData(undefined)).toEqual({});
      expect(generateTestData({ complex: 'object' })).toEqual({});
    });
  });

  describe('Integration tests', () => {
    it('should work together to test a complete migration graph', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      // Register schemas
      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '3.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      // Register migrations
      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: { theme: string }, ctx: MigrationContext) => {
          ctx.preserve('theme', data.theme);
          return { mode: data.theme };
        },
        down: (data: { mode: string }, ctx: MigrationContext) => {
          const theme = ctx.consume('theme');
          return { theme: theme?.value as string };
        },
        traits: {
          up: { lossy: 'theme' },
        },
      });

      graph.registerMigration({
        fromVersion: '2.0.0',
        toVersion: '3.0.0',
        up: (data: { mode: string }, ctx: MigrationContext) => {
          const theme = ctx.consume('theme');
          return { appearance: theme?.value as string };
        },
        down: (data: { appearance: string }, ctx: MigrationContext) => {
          ctx.preserve('theme', data.appearance);
          return { mode: data.appearance };
        },
        traits: {
          down: { lossy: 'theme' },
        },
      });

      // Test graph connectivity
      expect(() => assertConnected(graph)).not.toThrow();

      // Test no deprecated paths
      expect(() => assertNoDeprecatedPaths(graph)).not.toThrow();

      // Test field profile
      expect(() =>
        assertFieldProfile(graph, 'theme', 'always-single')
      ).not.toThrow();

      // Test migration result
      const result = graph.migrate<{ appearance: string }>(
        { theme: 'dark' },
        '1.0.0',
        '3.0.0'
      );

      expect(() => assertLossless(result)).not.toThrow();
      expect(result.data?.appearance).toBe('dark');
    });

    it('should detect issues in a flawed migration graph', () => {
      const graph = createMigrationGraph({
        id: 'test-graph',
        versionStrategy: semverStrategy,
      });

      // Create disconnected components
      graph.registerSchema({
        version: '1.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerSchema({
        version: '2.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: unknown) => data,
        down: (data: unknown) => data,
      });

      graph.registerSchema({
        version: '3.0.0',
        schema: (data: unknown) => ({ success: true, data }),
      });

      // Should detect disconnected graph
      expect(() => assertConnected(graph)).toThrow(
        'Graph is not fully connected'
      );
    });
  });
});
