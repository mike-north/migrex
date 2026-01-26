/**
 * Tests for formatters.
 */

import { describe, it, expect } from 'vitest';
import type { AnalysisResult, LossyPathReport } from '@migrex/core';
import {
  formatAnalysisText,
  formatLossyPathsText,
} from '../src/formatters/text.js';
import {
  formatAnalysisJson,
  formatLossyPathsJson,
} from '../src/formatters/json.js';

describe('formatAnalysisText', () => {
  it('should format analysis result as text', () => {
    const analysis: AnalysisResult = {
      profiles: {
        theme: 'always-single',
        tags: 'sometimes-multi',
      },
      diagnostics: [
        {
          severity: 'error',
          code: 'FIELD_PROFILE_MISMATCH',
          message: 'Field tags is preserved multiple times',
        },
      ],
      connectivity: {
        fullyConnected: true,
        components: [['1.0.0', '2.0.0', '3.0.0']],
        unreachablePairs: [],
      },
      metadata: {
        versionCount: 3,
        migrationCount: 2,
        pathsAnalyzed: 6,
        computedAt: Date.now(),
      },
    };

    const text = formatAnalysisText(analysis);

    expect(text).toContain('Migration Graph Analysis');
    expect(text).toContain('Versions: 3');
    expect(text).toContain('Migrations: 2');
    expect(text).toContain('Fully connected: Yes');
    expect(text).toContain('theme');
    expect(text).toContain('tags');
    expect(text).toContain('Errors: 1');
  });

  it('should handle empty profiles', () => {
    const analysis: AnalysisResult = {
      profiles: {},
      diagnostics: [],
      connectivity: {
        fullyConnected: true,
        components: [['1.0.0']],
        unreachablePairs: [],
      },
      metadata: {
        versionCount: 1,
        migrationCount: 0,
        pathsAnalyzed: 0,
        computedAt: Date.now(),
      },
    };

    const text = formatAnalysisText(analysis);

    expect(text).toContain('no preserved fields');
  });

  it('should show disconnected components', () => {
    const analysis: AnalysisResult = {
      profiles: {},
      diagnostics: [],
      connectivity: {
        fullyConnected: false,
        components: [
          ['1.0.0', '2.0.0'],
          ['3.0.0', '4.0.0'],
        ],
        unreachablePairs: [{ from: '1.0.0', to: '3.0.0' }],
      },
      metadata: {
        versionCount: 4,
        migrationCount: 2,
        pathsAnalyzed: 4,
        computedAt: Date.now(),
      },
    };

    const text = formatAnalysisText(analysis);

    expect(text).toContain('Fully connected: No');
    expect(text).toContain('Components: 2');
    expect(text).toContain('1.0.0');
    expect(text).toContain('3.0.0');
  });
});

describe('formatAnalysisJson', () => {
  it('should format analysis result as JSON', () => {
    const analysis: AnalysisResult = {
      profiles: { theme: 'always-single' },
      diagnostics: [],
      connectivity: {
        fullyConnected: true,
        components: [['1.0.0']],
        unreachablePairs: [],
      },
      metadata: {
        versionCount: 1,
        migrationCount: 0,
        pathsAnalyzed: 0,
        computedAt: Date.now(),
      },
    };

    const json = formatAnalysisJson(analysis);
    const parsed = JSON.parse(json);

    expect(parsed.profiles).toEqual({ theme: 'always-single' });
    expect(parsed.metadata.versionCount).toBe(1);
  });
});

describe('formatLossyPathsText', () => {
  it('should format lossy paths report as text', () => {
    const report: LossyPathReport = {
      lossyPairs: [
        {
          from: '1.0.0',
          to: '2.0.0',
          analysis: {
            from: '1.0.0',
            to: '2.0.0',
            pathExists: true,
            isLossy: true,
            lossySteps: [
              {
                from: '1.0.0',
                to: '2.0.0',
                direction: 'up',
                reason: 'Field removed',
              },
            ],
          },
        },
      ],
      totalVersionPairs: 10,
      lossyPairCount: 1,
      unreachablePairCount: 0,
    };

    const text = formatLossyPathsText(report);

    expect(text).toContain('Lossy Paths Report');
    expect(text).toContain('Total version pairs: 10');
    expect(text).toContain('Lossy pairs: 1');
    expect(text).toContain('1.0.0');
    expect(text).toContain('Field removed');
  });

  it('should handle no lossy paths', () => {
    const report: LossyPathReport = {
      lossyPairs: [],
      totalVersionPairs: 5,
      lossyPairCount: 0,
      unreachablePairCount: 0,
    };

    const text = formatLossyPathsText(report);

    expect(text).toContain('No lossy paths found');
  });
});

describe('formatLossyPathsJson', () => {
  it('should format lossy paths as JSON', () => {
    const report: LossyPathReport = {
      lossyPairs: [],
      totalVersionPairs: 5,
      lossyPairCount: 0,
      unreachablePairCount: 0,
    };

    const json = formatLossyPathsJson(report);
    const parsed = JSON.parse(json);

    expect(parsed.totalVersionPairs).toBe(5);
    expect(parsed.lossyPairs).toEqual([]);
  });
});
