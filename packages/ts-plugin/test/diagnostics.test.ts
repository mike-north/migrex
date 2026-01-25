/**
 * Tests for diagnostic generation.
 */

import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import { generateDiagnostics, DiagnosticCodes } from '../src/diagnostics.js';
import type { AnalysisResult } from '@migrex/core';

describe('generateDiagnostics', () => {
  /**
   * Helper to create a source file from code string.
   */
  function createSourceFile(code: string): ts.SourceFile {
    return ts.createSourceFile(
      'test.ts',
      code,
      ts.ScriptTarget.Latest,
      true
    );
  }

  /**
   * Helper to create mock analysis result.
   */
  function createMockAnalysis(
    profiles: Record<string, 'always-single' | 'sometimes-multi'>
  ): AnalysisResult {
    return {
      profiles,
      diagnostics: [],
      connectivity: {
        fullyConnected: true,
        components: [[]],
        unreachablePairs: [],
      },
      metadata: {
        versionCount: 0,
        migrationCount: 0,
        pathsAnalyzed: 0,
        computedAt: Date.now(),
      },
    };
  }

  describe('positive cases - should generate diagnostics', () => {
    it('should generate diagnostic for unhandled sometimes-multi field', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          const theme = ctx.consume('theme');
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'sometimes-multi',
      });

      const diagnostics = generateDiagnostics(sourceFile, analysis, ts);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.code).toBe(DiagnosticCodes.UNHANDLED_MULTI_VALUE);
      expect(diagnostics[0]?.messageText).toContain('theme');
      expect(diagnostics[0]?.messageText).toContain('multiple preserved values');
    });

    it('should generate diagnostic for context.consume', () => {
      const code = `
        function migrate(data: V1, context: MigrationContext): V2 {
          const field = context.consume('fieldName');
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        fieldName: 'sometimes-multi',
      });

      const diagnostics = generateDiagnostics(sourceFile, analysis, ts);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.code).toBe(DiagnosticCodes.UNHANDLED_MULTI_VALUE);
    });

    it('should generate multiple diagnostics for multiple unhandled fields', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          const theme = ctx.consume('theme');
          const color = ctx.consume('color');
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'sometimes-multi',
        color: 'sometimes-multi',
      });

      const diagnostics = generateDiagnostics(sourceFile, analysis, ts);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics[0]?.messageText).toContain('theme');
      expect(diagnostics[1]?.messageText).toContain('color');
    });
  });

  describe('negative cases - should not generate diagnostics', () => {
    it('should not generate diagnostic for always-single field', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          const theme = ctx.consume('theme');
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'always-single',
      });

      const diagnostics = generateDiagnostics(sourceFile, analysis, ts);

      expect(diagnostics).toHaveLength(0);
    });

    it('should not generate diagnostic when kind is checked', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          const theme = ctx.consume('theme');
          if (theme && theme.kind === 'single') {
            // handled
          } else if (theme && theme.kind === 'multi') {
            // handled
          }
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'sometimes-multi',
      });

      const diagnostics = generateDiagnostics(sourceFile, analysis, ts);

      expect(diagnostics).toHaveLength(0);
    });

    it('should not generate diagnostic for unknown field', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          const unknown = ctx.consume('unknownField');
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'sometimes-multi',
      });

      const diagnostics = generateDiagnostics(sourceFile, analysis, ts);

      expect(diagnostics).toHaveLength(0);
    });

    it('should not generate diagnostic for non-consume calls', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          const x = ctx.preserve('theme', data.theme);
          const y = someOtherFunction('theme');
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'sometimes-multi',
      });

      const diagnostics = generateDiagnostics(sourceFile, analysis, ts);

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty file', () => {
      const code = '';
      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({});

      const diagnostics = generateDiagnostics(sourceFile, analysis, ts);

      expect(diagnostics).toHaveLength(0);
    });

    it('should handle file with no consume calls', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'sometimes-multi',
      });

      const diagnostics = generateDiagnostics(sourceFile, analysis, ts);

      expect(diagnostics).toHaveLength(0);
    });

    it('should handle consume with non-string-literal argument', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          const fieldName = 'theme';
          const theme = ctx.consume(fieldName);
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'sometimes-multi',
      });

      const diagnostics = generateDiagnostics(sourceFile, analysis, ts);

      // Should not generate diagnostic since field name is not statically known
      expect(diagnostics).toHaveLength(0);
    });
  });
});
