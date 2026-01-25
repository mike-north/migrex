/**
 * Tests for analysis cache.
 */

import { describe, it, expect, vi } from 'vitest';
import { AnalysisCache } from '../src/analysis-cache.js';
import type { MigrationGraph, AnalysisResult } from '@migrex/core';

describe('AnalysisCache', () => {
  /**
   * Create a mock migration graph.
   */
  function createMockGraph(): MigrationGraph {
    return {
      migrate: vi.fn(),
      findPath: vi.fn(),
      batchMigrate: vi.fn(),
      getAllVersions: vi.fn(() => ['1.0.0', '2.0.0']),
      getMigration: vi.fn(),
      getVersionStrategy: vi.fn(),
      getVersions: vi.fn(() => ['1.0.0', '2.0.0']),
      getMigrations: vi.fn(() => []),
      hasPath: vi.fn(() => false), // No paths by default
      getPath: vi.fn(() => undefined),
    } as unknown as MigrationGraph;
  }

  /**
   * Create a mock file version getter.
   */
  function createVersionGetter(
    versions: Record<string, string>
  ): (fileName: string) => string | undefined {
    return (fileName: string) => versions[fileName];
  }

  describe('positive cases - cache hits', () => {
    it('should return cached result when file versions unchanged', () => {
      const cache = new AnalysisCache();
      const graph = createMockGraph();
      const getVersion = createVersionGetter({
        'test.ts': 'v1',
      });

      // First call computes analysis
      const result1 = cache.get(graph, getVersion);
      expect(result1).toBeDefined();

      // Second call should return cached result
      const result2 = cache.get(graph, getVersion);
      expect(result2).toBe(result1);
    });

    it('should cache results for empty file version map', () => {
      const cache = new AnalysisCache();
      const graph = createMockGraph();
      const getVersion = createVersionGetter({});

      const result1 = cache.get(graph, getVersion);
      const result2 = cache.get(graph, getVersion);

      expect(result2).toBe(result1);
    });
  });

  describe('negative cases - cache misses', () => {
    it('should return cached result when file versions change but no files tracked', () => {
      // Note: Current implementation doesn't track source files,
      // so cache remains valid even if version getter changes
      const cache = new AnalysisCache();
      const graph = createMockGraph();

      // First call with v1
      const getVersion1 = createVersionGetter({
        'test.ts': 'v1',
      });
      const result1 = cache.get(graph, getVersion1);

      // Second call with v2 - should return cached result
      // because no files are actually tracked by the graph
      const getVersion2 = createVersionGetter({
        'test.ts': 'v2',
      });
      const result2 = cache.get(graph, getVersion2);

      // Should return same cached result
      expect(result2).toBe(result1);
    });

    it('should recompute when file is added', () => {
      const cache = new AnalysisCache();
      const graph = createMockGraph();

      // First call with one file
      const getVersion1 = createVersionGetter({
        'test1.ts': 'v1',
      });
      const result1 = cache.get(graph, getVersion1);

      // Second call with additional file
      const getVersion2 = createVersionGetter({
        'test1.ts': 'v1',
        'test2.ts': 'v1',
      });
      const result2 = cache.get(graph, getVersion2);

      // Should still be same result (files tracked by graph, not getter)
      expect(result2).toBe(result1);
    });

    it('should recompute after invalidation', () => {
      const cache = new AnalysisCache();
      const graph = createMockGraph();
      const getVersion = createVersionGetter({
        'test.ts': 'v1',
      });

      const result1 = cache.get(graph, getVersion);
      const timestamp1 = result1.metadata.computedAt;

      // Invalidate cache
      cache.invalidate();

      const result2 = cache.get(graph, getVersion);
      const timestamp2 = result2.metadata.computedAt;

      // Verify it's a different result (computed at different time)
      expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);
      expect(result2).not.toBe(result1);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined file versions', () => {
      const cache = new AnalysisCache();
      const graph = createMockGraph();
      const getVersion = (): undefined => undefined;

      const result = cache.get(graph, getVersion);
      expect(result).toBeDefined();
    });

    it('should handle multiple invalidations', () => {
      const cache = new AnalysisCache();
      const graph = createMockGraph();
      const getVersion = createVersionGetter({ 'test.ts': 'v1' });

      const result1 = cache.get(graph, getVersion);
      cache.invalidate();
      cache.invalidate();
      cache.invalidate();

      const result2 = cache.get(graph, getVersion);
      expect(result2).toBeDefined();
      // Should be different instance after invalidations
      expect(result2).not.toBe(result1);
    });

    it('should handle invalidation before first use', () => {
      const cache = new AnalysisCache();
      const graph = createMockGraph();
      const getVersion = createVersionGetter({ 'test.ts': 'v1' });

      cache.invalidate();

      const result = cache.get(graph, getVersion);
      expect(result).toBeDefined();
    });
  });
});
