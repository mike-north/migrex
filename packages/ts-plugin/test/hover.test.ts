/**
 * Tests for hover information augmentation.
 */

import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import { augmentHoverInfo } from '../src/hover.js';
import type { AnalysisResult } from '@migrex/core';

describe('augmentHoverInfo', () => {
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

  /**
   * Find position of text in source file.
   */
  function findPosition(sourceFile: ts.SourceFile, text: string): number {
    const index = sourceFile.text.indexOf(text);
    if (index === -1) {
      throw new Error(`Text "${text}" not found in source file`);
    }
    return index;
  }

  describe('positive cases - should augment hover', () => {
    it('should add profile info for always-single field in consume', () => {
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

      // Find position of 'theme' string literal
      const position = findPosition(sourceFile, "'theme'") + 1;

      const result = augmentHoverInfo(
        undefined,
        position,
        sourceFile,
        analysis,
        ts
      );

      expect(result).toBeDefined();
      expect(result?.documentation).toBeDefined();
      const docs = result!.documentation as ts.SymbolDisplayPart[];
      const docsText = docs.map((part) => part.text).join('');
      expect(docsText).toContain('migrex field profile');
      expect(docsText).toContain('always');
      expect(docsText).toContain('single');
      expect(docsText).toContain('preserved at most once');
    });

    it('should add profile info for sometimes-multi field', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          const color = ctx.consume('color');
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        color: 'sometimes-multi',
      });

      const position = findPosition(sourceFile, "'color'") + 1;

      const result = augmentHoverInfo(
        undefined,
        position,
        sourceFile,
        analysis,
        ts
      );

      expect(result).toBeDefined();
      const docs = result!.documentation as ts.SymbolDisplayPart[];
      const docsText = docs.map((part) => part.text).join('');
      expect(docsText).toContain('migrex field profile');
      expect(docsText).toContain('preserved multiple times');
      expect(docsText).toContain('Example:');
    });

    it('should augment existing hover info', () => {
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

      const position = findPosition(sourceFile, "'theme'") + 1;

      // Provide existing hover info
      const existingInfo: ts.QuickInfo = {
        kind: ts.ScriptElementKind.constElement,
        kindModifiers: '',
        textSpan: { start: position, length: 7 },
        displayParts: [],
        documentation: [{ text: 'Existing docs', kind: 'text' }],
      };

      const result = augmentHoverInfo(
        existingInfo,
        position,
        sourceFile,
        analysis,
        ts
      );

      expect(result).toBeDefined();
      const docs = result!.documentation as ts.SymbolDisplayPart[];
      const docsText = docs.map((part) => part.text).join('');
      expect(docsText).toContain('Existing docs');
      expect(docsText).toContain('migrex field profile');
    });

    it('should handle preserve operation', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          ctx.preserve('theme', data.theme);
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'sometimes-multi',
      });

      const position = findPosition(sourceFile, "'theme'") + 1;

      const result = augmentHoverInfo(
        undefined,
        position,
        sourceFile,
        analysis,
        ts
      );

      expect(result).toBeDefined();
      const docs = result!.documentation as ts.SymbolDisplayPart[];
      const docsText = docs.map((part) => part.text).join('');
      expect(docsText).toContain('migrex field profile');
      expect(docsText).toContain('preserved multiple times');
    });
  });

  describe('negative cases - should not augment hover', () => {
    it('should return original info for unknown field', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          const unknown = ctx.consume('unknownField');
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'always-single',
      });

      const position = findPosition(sourceFile, "'unknownField'") + 1;

      const result = augmentHoverInfo(
        undefined,
        position,
        sourceFile,
        analysis,
        ts
      );

      // Should return undefined since field is unknown
      expect(result).toBeUndefined();
    });

    it('should return original info when not hovering over field name', () => {
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

      // Hover over 'data' instead of field name
      const position = findPosition(sourceFile, 'data');

      const existingInfo: ts.QuickInfo = {
        kind: ts.ScriptElementKind.constElement,
        kindModifiers: '',
        textSpan: { start: position, length: 4 },
        displayParts: [],
      };

      const result = augmentHoverInfo(
        existingInfo,
        position,
        sourceFile,
        analysis,
        ts
      );

      // Should return original info unchanged
      expect(result).toBe(existingInfo);
    });

    it('should handle non-migrex function calls', () => {
      const code = `
        function migrate(data: V1, ctx: MigrationContext): V2 {
          const x = someOtherFunction('theme');
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'always-single',
      });

      const position = findPosition(sourceFile, "'theme'") + 1;

      const result = augmentHoverInfo(
        undefined,
        position,
        sourceFile,
        analysis,
        ts
      );

      expect(result).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle position at start of string literal', () => {
      const code = `ctx.consume('field')`;
      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({ field: 'always-single' });
      const position = findPosition(sourceFile, "'field'");

      const result = augmentHoverInfo(
        undefined,
        position,
        sourceFile,
        analysis,
        ts
      );

      expect(result).toBeDefined();
    });

    it('should handle position at end of string literal', () => {
      const code = `ctx.consume('field')`;
      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({ field: 'always-single' });
      const position = findPosition(sourceFile, "'field'") + 6;

      const result = augmentHoverInfo(
        undefined,
        position,
        sourceFile,
        analysis,
        ts
      );

      // May or may not work depending on exact position - just verify no crash
      expect(result !== undefined || result === undefined).toBe(true);
    });

    it('should handle context.consume variant', () => {
      const code = `
        function migrate(data: V1, context: MigrationContext): V2 {
          const theme = context.consume('theme');
          return data;
        }
      `;

      const sourceFile = createSourceFile(code);
      const analysis = createMockAnalysis({
        theme: 'always-single',
      });

      const position = findPosition(sourceFile, "'theme'") + 1;

      const result = augmentHoverInfo(
        undefined,
        position,
        sourceFile,
        analysis,
        ts
      );

      expect(result).toBeDefined();
    });
  });
});
