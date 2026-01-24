import { describe, it, expect } from 'vitest';
import { createMigrationGraph } from '../src/graph.js';
import {
  analyzeGraph,
  analyzeIncremental,
  findLossyPaths,
  suggestMigrations,
  getDeprecatedVersions,
} from '../src/analysis/index.js';
import { semverStrategy } from '../src/strategies/index.js';

describe('Analysis Engine', () => {
  describe('analyzeGraph', () => {
    it('should analyze empty graph', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });
      const result = analyzeGraph(graph);

      expect(result.connectivity.fullyConnected).toBe(true);
      expect(result.connectivity.components).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.metadata.versionCount).toBe(0);
    });

    it('should handle graph with no migrations', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });
      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
      });

      const result = analyzeGraph(graph);

      expect(result.connectivity.fullyConnected).toBe(true);
      expect(result.metadata.versionCount).toBe(1);
      expect(result.metadata.migrationCount).toBe(0);
    });

    it('should detect disconnected components', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      // Register schemas for two disconnected versions
      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
      });
      graph.registerSchema({
        version: '2.0.0',
        schema: () => ({ success: true, data: {} }),
      });

      const result = analyzeGraph(graph);

      expect(result.connectivity.fullyConnected).toBe(false);
      expect(result.connectivity.components).toHaveLength(2);
      expect(
        result.diagnostics.some((d) => d.code === 'DISCONNECTED_VERSIONS')
      ).toBe(true);
    });

    it('should report connected graph', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
      });
      graph.registerSchema({
        version: '2.0.0',
        schema: () => ({ success: true, data: {} }),
      });
      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => data,
        down: (data) => data,
      });

      const result = analyzeGraph(graph);

      expect(result.connectivity.fullyConnected).toBe(true);
      expect(result.connectivity.components).toHaveLength(1);
    });

    it('should detect lossy migrations', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => data,
        down: (data) => data,
        traits: {
          down: { lossy: 'field removed' },
        },
      });

      const result = analyzeGraph(graph);

      // Should have warning about lossy field
      expect(result.profiles).toBeDefined();
    });

    it('should handle single version', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
      });

      const result = analyzeGraph(graph);

      expect(result.connectivity.fullyConnected).toBe(true);
      expect(result.connectivity.components).toHaveLength(1);
      expect(result.metadata.versionCount).toBe(1);
      expect(result.metadata.pathsAnalyzed).toBe(0); // No paths from a version to itself
    });

    it('should count unreachable pairs in disconnected graph', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      // Create 3 disconnected components
      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
      });
      graph.registerSchema({
        version: '2.0.0',
        schema: () => ({ success: true, data: {} }),
      });
      graph.registerSchema({
        version: '3.0.0',
        schema: () => ({ success: true, data: {} }),
      });

      const result = analyzeGraph(graph);

      expect(result.connectivity.fullyConnected).toBe(false);
      expect(result.connectivity.components).toHaveLength(3);
      expect(result.connectivity.unreachablePairs).toHaveLength(3); // 3 choose 2
    });
  });

  describe('findLossyPaths', () => {
    it('should find lossy paths', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => data,
        down: (data) => data,
        traits: {
          down: { lossy: 'theme field is lost' },
        },
      });

      const report = findLossyPaths(graph);

      expect(report.lossyPairCount).toBeGreaterThan(0);
      expect(report.lossyPairs.some((p) => p.analysis.isLossy)).toBe(true);
    });

    it('should report unreachable pairs', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      // Two disconnected versions
      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
      });
      graph.registerSchema({
        version: '2.0.0',
        schema: () => ({ success: true, data: {} }),
      });

      const report = findLossyPaths(graph);

      expect(report.unreachablePairCount).toBeGreaterThan(0);
    });

    it('should return empty report for empty graph', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      const report = findLossyPaths(graph);

      expect(report.lossyPairCount).toBe(0);
      expect(report.unreachablePairCount).toBe(0);
      expect(report.totalVersionPairs).toBe(0);
    });

    it('should detect lossy path details', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => data,
        down: (data) => data,
        traits: {
          down: { lossy: 'theme field removed' },
        },
      });

      const report = findLossyPaths(graph);

      // Should have lossy path from 2.0.0 to 1.0.0
      const lossyPair = report.lossyPairs.find(
        (p) => p.from === '2.0.0' && p.to === '1.0.0'
      );
      expect(lossyPair).toBeDefined();
      expect(lossyPair?.analysis.isLossy).toBe(true);
      expect(lossyPair?.analysis.lossySteps).toHaveLength(1);
      expect(lossyPair?.analysis.lossySteps[0].reason).toBe(
        'theme field removed'
      );
    });
  });

  describe('suggestMigrations', () => {
    it('should suggest bridges for disconnected components', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
      });
      graph.registerSchema({
        version: '2.0.0',
        schema: () => ({ success: true, data: {} }),
      });

      const suggestions = suggestMigrations(graph);

      expect(suggestions.some((s) => s.reason === 'bridges_components')).toBe(
        true
      );
    });

    it('should return empty for connected graph', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => data,
        down: (data) => data,
      });

      const suggestions = suggestMigrations(graph);

      expect(
        suggestions.filter((s) => s.reason === 'bridges_components')
      ).toHaveLength(0);
    });

    it('should return empty for empty graph', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      const suggestions = suggestMigrations(graph);

      expect(suggestions).toHaveLength(0);
    });

    it('should suggest multiple bridges for multiple components', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      // Create 3 disconnected components
      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
      });
      graph.registerSchema({
        version: '2.0.0',
        schema: () => ({ success: true, data: {} }),
      });
      graph.registerSchema({
        version: '3.0.0',
        schema: () => ({ success: true, data: {} }),
      });

      const suggestions = suggestMigrations(graph);

      const bridges = suggestions.filter(
        (s) => s.reason === 'bridges_components'
      );
      expect(bridges.length).toBeGreaterThan(0);
    });
  });

  describe('getDeprecatedVersions', () => {
    it('should return deprecated versions', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
        deprecated: {
          since: '2024-01-01',
          successor: '2.0.0',
          message: 'Use v2 instead',
        },
      });

      const deprecated = getDeprecatedVersions(graph);

      expect(deprecated).toHaveLength(1);
      expect(deprecated[0].version).toBe('1.0.0');
      expect(deprecated[0].deprecated.successor).toBe('2.0.0');
    });

    it('should return empty for no deprecated versions', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
      });

      const deprecated = getDeprecatedVersions(graph);

      expect(deprecated).toHaveLength(0);
    });

    it('should return empty for empty graph', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      const deprecated = getDeprecatedVersions(graph);

      expect(deprecated).toHaveLength(0);
    });

    it('should include all deprecated version metadata', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
        deprecated: {
          since: '2024-01-01',
          deadline: '2025-01-01',
          successor: '2.0.0',
          message: 'Use v2 instead',
        },
      });

      const deprecated = getDeprecatedVersions(graph);

      expect(deprecated[0].deprecated.since).toBe('2024-01-01');
      expect(deprecated[0].deprecated.deadline).toBe('2025-01-01');
      expect(deprecated[0].deprecated.message).toBe('Use v2 instead');
    });
  });

  describe('field profile analysis', () => {
    it('should detect sometimes-multi fields', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      // Create a path where a field is preserved multiple times
      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => data,
        down: (data) => data,
        traits: {
          down: { lossy: 'theme' },
        },
      });

      graph.registerMigration({
        fromVersion: '2.0.0',
        toVersion: '3.0.0',
        up: (data) => data,
        down: (data) => data,
        traits: {
          down: { lossy: 'theme' },
        },
      });

      const result = analyzeGraph(graph);

      // Field 'theme' should be 'sometimes-multi' because it's preserved twice on path 3.0.0 -> 1.0.0
      expect(result.profiles.theme).toBe('sometimes-multi');
      expect(
        result.diagnostics.some((d) => d.code === 'FIELD_PROFILE_MISMATCH')
      ).toBe(true);
    });

    it('should detect always-single fields', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => data,
        down: (data) => data,
        traits: {
          down: { lossy: 'theme' },
        },
      });

      const result = analyzeGraph(graph);

      // Field 'theme' should be 'always-single' because it's only preserved once
      expect(result.profiles.theme).toBe('always-single');
    });

    it('should handle no lossy fields', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => data,
        down: (data) => data,
      });

      const result = analyzeGraph(graph);

      expect(Object.keys(result.profiles)).toHaveLength(0);
    });
  });

  describe('analyzeIncremental', () => {
    it('should return analysis result with same structure', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerSchema({
        version: '1.0.0',
        schema: () => ({ success: true, data: {} }),
      });
      graph.registerSchema({
        version: '2.0.0',
        schema: () => ({ success: true, data: {} }),
      });
      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => data,
        down: (data) => data,
      });

      const initial = analyzeGraph(graph);
      const incremental = analyzeIncremental(graph, initial, ['schemas.ts']);

      expect(incremental).toHaveProperty('profiles');
      expect(incremental).toHaveProperty('diagnostics');
      expect(incremental).toHaveProperty('connectivity');
      expect(incremental).toHaveProperty('metadata');
    });

    it('should handle empty changed files list', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      graph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => data,
        down: (data) => data,
      });

      const initial = analyzeGraph(graph);
      const incremental = analyzeIncremental(graph, initial, []);

      expect(incremental.diagnostics).toHaveLength(0);
    });

    it('should handle empty graph', () => {
      const graph = createMigrationGraph({
        id: 'test',
        versionStrategy: semverStrategy,
      });

      const initial = analyzeGraph(graph);
      const incremental = analyzeIncremental(graph, initial, ['test.ts']);

      expect(incremental.metadata.versionCount).toBe(0);
      expect(incremental.connectivity.fullyConnected).toBe(true);
    });
  });
});
