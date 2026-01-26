/**
 * Tests for graph-loader utility.
 *
 * These tests verify the graph analysis caching and helper functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MigrationGraph, AnalysisResult } from '@migrex/core';

// Mock @migrex/core
vi.mock('@migrex/core', () => ({
  analyzeGraph: vi.fn(),
  findLossyPaths: vi.fn(),
  suggestMigrations: vi.fn(),
  getDeprecatedVersions: vi.fn(),
}));

import { analyzeGraph } from '@migrex/core';
import {
  getGraphAnalysis,
  getFieldProfile,
  _clearAnalysisCache,
} from '../../src/utils/graph-loader.js';

// Helper to create a mock graph
function createMockGraph(id = 'test-graph'): MigrationGraph {
  return {
    id,
    getVersions: vi.fn().mockReturnValue(['1.0.0', '2.0.0']),
    getSchema: vi.fn(),
    getMigrations: vi.fn().mockReturnValue([]),
    hasPath: vi.fn().mockReturnValue(true),
    getPath: vi.fn(),
    registerSchema: vi.fn(),
    registerMigration: vi.fn(),
    migrate: vi.fn(),
    migrateAsync: vi.fn(),
    migrateBatch: vi.fn(),
    migrateBatchAsync: vi.fn(),
    getLatestVersion: vi.fn().mockReturnValue('2.0.0'),
    getVersionStrategy: vi.fn(),
  } as unknown as MigrationGraph;
}

// Helper to create a mock analysis result
function createMockAnalysis(
  profiles: Record<string, 'always-single' | 'sometimes-multi'> = {}
): AnalysisResult {
  return {
    graphId: 'test-graph',
    connectivity: {
      isFullyConnected: true,
      disconnectedVersions: [],
      components: [],
    },
    diagnostics: [],
    profiles,
    metadata: {
      versionCount: 2,
      migrationCount: 1,
      hasReversibleMigrations: true,
      hasIrreversibleMigrations: false,
    },
  } as AnalysisResult;
}

describe('Graph Loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearAnalysisCache();
  });

  describe('getGraphAnalysis', () => {
    it('should call analyzeGraph and return result', () => {
      const mockGraph = createMockGraph();
      const mockAnalysis = createMockAnalysis();
      vi.mocked(analyzeGraph).mockReturnValue(mockAnalysis);

      const result = getGraphAnalysis(mockGraph);

      expect(analyzeGraph).toHaveBeenCalledWith(mockGraph);
      expect(result).toBe(mockAnalysis);
    });

    it('should cache analysis results', () => {
      const mockGraph = createMockGraph();
      const mockAnalysis = createMockAnalysis();
      vi.mocked(analyzeGraph).mockReturnValue(mockAnalysis);

      // First call - should analyze
      const result1 = getGraphAnalysis(mockGraph);
      expect(analyzeGraph).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = getGraphAnalysis(mockGraph);
      expect(analyzeGraph).toHaveBeenCalledTimes(1); // Still only 1 call

      expect(result1).toBe(result2);
    });

    it('should analyze different graphs separately', () => {
      const mockGraph1 = createMockGraph('graph-1');
      const mockGraph2 = createMockGraph('graph-2');
      const mockAnalysis1 = createMockAnalysis({ field1: 'always-single' });
      const mockAnalysis2 = createMockAnalysis({ field2: 'sometimes-multi' });

      vi.mocked(analyzeGraph)
        .mockReturnValueOnce(mockAnalysis1)
        .mockReturnValueOnce(mockAnalysis2);

      const result1 = getGraphAnalysis(mockGraph1);
      const result2 = getGraphAnalysis(mockGraph2);

      expect(analyzeGraph).toHaveBeenCalledTimes(2);
      expect(result1).toBe(mockAnalysis1);
      expect(result2).toBe(mockAnalysis2);
    });

    it('should return undefined when analyzeGraph throws', () => {
      const mockGraph = createMockGraph();
      vi.mocked(analyzeGraph).mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      const result = getGraphAnalysis(mockGraph);

      expect(result).toBeUndefined();
    });
  });

  describe('getFieldProfile', () => {
    it('should return field profile for existing field', () => {
      const analysis = createMockAnalysis({
        'user.email': 'always-single',
        'user.avatar': 'sometimes-multi',
      });

      expect(getFieldProfile(analysis, 'user.email')).toBe('always-single');
      expect(getFieldProfile(analysis, 'user.avatar')).toBe('sometimes-multi');
    });

    it('should return undefined for non-existent field', () => {
      const analysis = createMockAnalysis({ 'user.email': 'always-single' });

      expect(getFieldProfile(analysis, 'user.name')).toBeUndefined();
    });

    it('should return undefined for empty profiles', () => {
      const analysis = createMockAnalysis({});

      expect(getFieldProfile(analysis, 'any.field')).toBeUndefined();
    });
  });

  describe('_clearAnalysisCache', () => {
    it('should clear the cache', () => {
      const mockGraph = createMockGraph();
      const mockAnalysis = createMockAnalysis();
      vi.mocked(analyzeGraph).mockReturnValue(mockAnalysis);

      // First call - should analyze
      getGraphAnalysis(mockGraph);
      expect(analyzeGraph).toHaveBeenCalledTimes(1);

      // Clear cache
      _clearAnalysisCache();

      // Next call - should analyze again
      getGraphAnalysis(mockGraph);
      expect(analyzeGraph).toHaveBeenCalledTimes(2);
    });
  });
});
