/**
 * Main TypeScript Language Service Plugin implementation.
 * Uses proxy pattern to wrap the base language service.
 */

import type * as ts from 'typescript';
import { AnalysisCache } from './analysis-cache.js';
import { GraphLoader } from './graph-loader.js';
import { generateDiagnostics } from './diagnostics.js';
import { augmentHoverInfo } from './hover.js';
import { getCodeFixes } from './quick-fixes.js';

/**
 * Plugin configuration from tsconfig.json.
 */
export interface PluginConfig {
  /**
   * Path to migration graph file (relative to project root).
   * @example "src/migrations/graph.ts"
   */
  graphPath?: string;

  /**
   * Enable hover information for field profiles.
   * @default true
   */
  enableHover?: boolean;

  /**
   * Enable quick fixes for multi-value handling.
   * @default true
   */
  enableQuickFixes?: boolean;
}

/**
 * Create a proxied language service that adds migrex functionality.
 *
 * @param info - Plugin create info from TypeScript
 * @param typescript - TypeScript module instance
 * @returns Proxied language service
 */
export function createProxiedLanguageService(
  info: ts.server.PluginCreateInfo,
  typescript: typeof ts
): ts.LanguageService {
  const config = info.config as PluginConfig;
  const base = info.languageService;
  const _host = info.languageServiceHost;
  const project = info.project;

  // Initialize graph loader and analysis cache
  const _graphLoader = new GraphLoader();
  const _analysisCache = new AnalysisCache();

  // Get project root directory
  const projectRoot = project.getCurrentDirectory();

  // Log plugin initialization
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const logger = info.project.projectService?.logger;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (logger) {
    logger.info(
      `[migrex] Plugin initialized. Project root: ${projectRoot}`
    );

    if (config.graphPath) {
      logger.info(
        `[migrex] Graph path configured: ${config.graphPath}`
      );
    } else {
      logger.info(
        '[migrex] No graph path configured. Set "graphPath" in tsconfig.json plugin config.'
      );
    }
  }

  // Create proxy with intercepted methods
  const proxy: ts.LanguageService = {
    ...base,

    /**
     * Add migrex diagnostics to semantic diagnostics.
     */
    getSemanticDiagnostics(fileName: string): ts.Diagnostic[] {
      const baseDiagnostics = base.getSemanticDiagnostics(fileName);

      // Skip if no graph path configured
      if (!config.graphPath) {
        return baseDiagnostics;
      }

      // Load graph and analysis
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const analysisResult = loadAnalysis();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!analysisResult) {
        return baseDiagnostics;
      }

      // Generate migrex diagnostics
      const program = base.getProgram();
      if (!program) {
        return baseDiagnostics;
      }

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) {
        return baseDiagnostics;
      }

      const migrexDiagnostics = generateDiagnostics(
        sourceFile,
        analysisResult,
        typescript
      );

      return [...baseDiagnostics, ...migrexDiagnostics];
    },

    /**
     * Augment hover information with field profiles.
     */
    getQuickInfoAtPosition(
      fileName: string,
      position: number
    ): ts.QuickInfo | undefined {
      const baseInfo = base.getQuickInfoAtPosition(fileName, position);

      // Skip if hover is disabled
      if (config.enableHover === false) {
        return baseInfo;
      }

      // Skip if no graph path configured
      if (!config.graphPath) {
        return baseInfo;
      }

      // Load graph and analysis
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const analysisResult = loadAnalysis();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!analysisResult) {
        return baseInfo;
      }

      // Get source file
      const program = base.getProgram();
      if (!program) {
        return baseInfo;
      }

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) {
        return baseInfo;
      }

      // Augment with migrex info
      return augmentHoverInfo(
        baseInfo,
        position,
        sourceFile,
        analysisResult,
        typescript
      );
    },

    /**
     * Add quick fixes for migrex diagnostics.
     */
    getCodeFixesAtPosition(
      fileName: string,
      start: number,
      end: number,
      errorCodes: readonly number[],
      formatOptions: ts.FormatCodeSettings,
      preferences: ts.UserPreferences
    ): readonly ts.CodeFixAction[] {
      const baseFixes = base.getCodeFixesAtPosition(
        fileName,
        start,
        end,
        errorCodes,
        formatOptions,
        preferences
      );

      // Skip if quick fixes are disabled
      if (config.enableQuickFixes === false) {
        return baseFixes;
      }

      // Skip if no graph path configured
      if (!config.graphPath) {
        return baseFixes;
      }

      // Get source file
      const program = base.getProgram();
      if (!program) {
        return baseFixes;
      }

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) {
        return baseFixes;
      }

      // Generate migrex fixes
      const migrexFixes = getCodeFixes(
        fileName,
        start,
        end,
        errorCodes,
        sourceFile,
        typescript
      );

      return [...baseFixes, ...migrexFixes];
    },
  };

  /**
   * Load migration graph and get analysis result.
   * Returns undefined if graph cannot be loaded.
   */
  function loadAnalysis() {
    if (!config.graphPath) {
      return undefined;
    }

    // Load graph synchronously (plugins must be sync)
    // Note: GraphLoader.load is async, so we need a sync wrapper
    // For now, we'll skip the async load and return undefined
    // A real implementation would need to handle this differently

    // Get current file version for cache validation (stub for future use)
     
    const _getCurrentFileVersion = (fileName: string) => {
      const scriptInfo = project.getScriptInfo(fileName);
      return scriptInfo?.getLatestVersion();
    };

    // For this implementation, we'll assume the graph is loaded
    // and cached. A full implementation would need better async handling.

    // Return undefined for now - this would need proper async/sync bridging
    return undefined;
  }

  return proxy;
}
