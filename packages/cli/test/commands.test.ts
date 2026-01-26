/**
 * Tests for CLI commands.
 *
 * These tests verify command behavior by mocking dependencies:
 * - loadGraph: Mocked to return controlled graph objects
 * - logger: Mocked to capture log output
 * - console.log: Mocked for JSON output verification
 * - fs operations: Mocked for file system commands
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { ExitCode } from '../src/utils/exit-codes.js';
import type { MigrationGraph, AnalysisResult, MigrationPath } from '@migrex/core';

// Mock dependencies
vi.mock('../src/loaders/graph-loader.js', () => ({
  loadGraph: vi.fn(),
}));

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@migrex/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@migrex/core')>();
  return {
    ...actual,
    analyzeGraph: vi.fn(),
    findLossyPaths: vi.fn(),
    suggestMigrations: vi.fn(),
    getDeprecatedVersions: vi.fn(),
    NoPathError: actual.NoPathError,
  };
});

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

vi.mock('../src/formatters/text.js', () => ({
  formatAnalysisText: vi.fn().mockReturnValue('Analysis text output'),
  formatLossyPathsText: vi.fn().mockReturnValue('Lossy paths text output'),
  formatSuggestionsText: vi.fn().mockReturnValue('Suggestions text output'),
  formatDeprecatedVersionsText: vi.fn().mockReturnValue('Deprecated versions text output'),
  formatMigrationPath: vi.fn().mockReturnValue('Migration path text output'),
}));

vi.mock('../src/formatters/json.js', () => ({
  formatMigrationPathJson: vi.fn().mockReturnValue('{"path":"json"}'),
}));

// Import after mocks are set up
import { loadGraph } from '../src/loaders/graph-loader.js';
import { logger } from '../src/utils/logger.js';
import {
  analyzeGraph,
  findLossyPaths,
  suggestMigrations,
  getDeprecatedVersions,
  NoPathError,
} from '@migrex/core';
import { writeFile, mkdir, access } from 'node:fs/promises';

// Import commands
import { checkCommand } from '../src/commands/check.js';
import { analyzeCommand } from '../src/commands/analyze.js';
import { pathCommand } from '../src/commands/path.js';
import { diffCommand } from '../src/commands/diff.js';
import { generateTypesCommand } from '../src/commands/generate-types.js';
import { initCommand } from '../src/commands/init.js';
import { newSchemaCommand, newMigrationCommand } from '../src/commands/new.js';

// Helper to create a mock graph
function createMockGraph(
  options: Partial<{
    versions: string[];
    hasPath: boolean;
    path: MigrationPath;
  }> = {}
): MigrationGraph {
  const { versions = ['1.0.0', '2.0.0'], hasPath = true, path } = options;

  const mockPath: MigrationPath = path ?? {
    steps: [
      {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        direction: 'up',
        migration: {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: () => ({}),
          down: () => ({}),
        },
      },
    ],
    direction: 'up',
    hasIrreversibleStep: false,
  };

  return {
    id: 'test-graph',
    getVersions: vi.fn().mockReturnValue(versions),
    getSchema: vi.fn().mockReturnValue(undefined),
    getMigrations: vi.fn().mockReturnValue([]),
    hasPath: vi.fn().mockReturnValue(hasPath),
    getPath: vi.fn().mockImplementation((from, to) => {
      if (!hasPath) {
        throw new NoPathError(from, to);
      }
      return mockPath;
    }),
    registerSchema: vi.fn(),
    registerMigration: vi.fn(),
    migrate: vi.fn(),
    migrateAsync: vi.fn(),
    migrateBatch: vi.fn(),
    migrateBatchAsync: vi.fn(),
    getLatestVersion: vi.fn().mockReturnValue(versions[versions.length - 1]),
    getVersionStrategy: vi.fn(),
  } as unknown as MigrationGraph;
}

// Helper to create mock analysis result
function createMockAnalysis(
  options: Partial<{
    errors: number;
    warnings: number;
    profiles: Record<string, 'always-single' | 'sometimes-multi'>;
  }> = {}
): AnalysisResult {
  const { errors = 0, warnings = 0, profiles = {} } = options;

  const diagnostics = [];
  for (let i = 0; i < errors; i++) {
    diagnostics.push({
      code: `ERR_${i}` as const,
      message: `Test error ${i}`,
      severity: 'error' as const,
    });
  }
  for (let i = 0; i < warnings; i++) {
    diagnostics.push({
      code: `WARN_${i}` as const,
      message: `Test warning ${i}`,
      severity: 'warning' as const,
    });
  }

  return {
    graphId: 'test-graph',
    connectivity: {
      isFullyConnected: true,
      disconnectedVersions: [],
      components: [],
    },
    diagnostics,
    profiles,
    metadata: {
      versionCount: 2,
      migrationCount: 1,
      hasReversibleMigrations: true,
      hasIrreversibleMigrations: false,
    },
  };
}

describe('CLI Commands', () => {
  let consoleLogSpy: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('checkCommand', () => {
    it('should return FILE_NOT_FOUND when graph is not found', async () => {
      (loadGraph as Mock).mockResolvedValue(null);

      const result = await checkCommand({});

      expect(result.exitCode).toBe(ExitCode.FILE_NOT_FOUND);
      expect(result.error).toContain('No migrex config file found');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return FILE_NOT_FOUND with custom path message', async () => {
      (loadGraph as Mock).mockResolvedValue(null);

      const result = await checkCommand({ graph: '/custom/path.ts' });

      expect(result.exitCode).toBe(ExitCode.FILE_NOT_FOUND);
      expect(result.error).toContain('/custom/path.ts');
    });

    it('should return SUCCESS when graph is healthy', async () => {
      const mockGraph = createMockGraph();
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });
      (analyzeGraph as Mock).mockReturnValue(createMockAnalysis());

      const result = await checkCommand({});

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(logger.success).toHaveBeenCalled();
    });

    it('should return VALIDATION_ERROR when errors exist', async () => {
      const mockGraph = createMockGraph();
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });
      (analyzeGraph as Mock).mockReturnValue(createMockAnalysis({ errors: 2 }));

      const result = await checkCommand({});

      expect(result.exitCode).toBe(ExitCode.VALIDATION_ERROR);
      expect(logger.error).toHaveBeenCalledWith('Graph check failed');
    });

    it('should treat warnings as errors in strict mode', async () => {
      const mockGraph = createMockGraph();
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });
      (analyzeGraph as Mock).mockReturnValue(createMockAnalysis({ warnings: 1 }));

      const result = await checkCommand({ strict: true });

      expect(result.exitCode).toBe(ExitCode.VALIDATION_ERROR);
    });

    it('should output JSON when json option is set', async () => {
      const mockGraph = createMockGraph();
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });
      (analyzeGraph as Mock).mockReturnValue(createMockAnalysis());

      const result = await checkCommand({ json: true });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalled();
      const jsonOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(jsonOutput.success).toBe(true);
    });

    it('should return GENERAL_ERROR on unexpected error', async () => {
      (loadGraph as Mock).mockRejectedValue(new Error('Unexpected'));

      const result = await checkCommand({});

      expect(result.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(result.error).toBe('Unexpected');
    });
  });

  describe('analyzeCommand', () => {
    it('should return FILE_NOT_FOUND when graph is not found', async () => {
      (loadGraph as Mock).mockResolvedValue(null);

      const result = await analyzeCommand({});

      expect(result.exitCode).toBe(ExitCode.FILE_NOT_FOUND);
    });

    it('should return SUCCESS and call analysis functions', async () => {
      const mockGraph = createMockGraph();
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });
      (analyzeGraph as Mock).mockReturnValue(createMockAnalysis());
      (findLossyPaths as Mock).mockReturnValue([]);
      (suggestMigrations as Mock).mockReturnValue([]);
      (getDeprecatedVersions as Mock).mockReturnValue([]);

      const result = await analyzeCommand({});

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(analyzeGraph).toHaveBeenCalledWith(mockGraph);
      expect(findLossyPaths).toHaveBeenCalledWith(mockGraph);
      expect(suggestMigrations).toHaveBeenCalledWith(mockGraph);
      expect(getDeprecatedVersions).toHaveBeenCalledWith(mockGraph);
    });

    it('should output JSON when format is json', async () => {
      const mockGraph = createMockGraph();
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });
      (analyzeGraph as Mock).mockReturnValue(createMockAnalysis());
      (findLossyPaths as Mock).mockReturnValue([]);
      (suggestMigrations as Mock).mockReturnValue([]);
      (getDeprecatedVersions as Mock).mockReturnValue([]);

      const result = await analyzeCommand({ format: 'json' });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalled();
      const jsonOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(jsonOutput).toHaveProperty('analysis');
      expect(jsonOutput).toHaveProperty('lossyPaths');
      expect(jsonOutput).toHaveProperty('suggestions');
      expect(jsonOutput).toHaveProperty('deprecatedVersions');
    });

    it('should return GENERAL_ERROR on unexpected error', async () => {
      (loadGraph as Mock).mockRejectedValue(new Error('Analyze failed'));

      const result = await analyzeCommand({});

      expect(result.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(result.error).toBe('Analyze failed');
    });
  });

  describe('pathCommand', () => {
    it('should return FILE_NOT_FOUND when graph is not found', async () => {
      (loadGraph as Mock).mockResolvedValue(null);

      const result = await pathCommand({ from: '1.0.0', to: '2.0.0' });

      expect(result.exitCode).toBe(ExitCode.FILE_NOT_FOUND);
    });

    it('should return SUCCESS when path exists', async () => {
      const mockGraph = createMockGraph({ hasPath: true });
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });

      const result = await pathCommand({ from: '1.0.0', to: '2.0.0' });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(mockGraph.getPath).toHaveBeenCalledWith('1.0.0', '2.0.0');
    });

    it('should return GENERAL_ERROR when path does not exist', async () => {
      const mockGraph = createMockGraph({ hasPath: false });
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });

      const result = await pathCommand({ from: '1.0.0', to: '3.0.0' });

      expect(result.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(result.error).toContain('No migration path');
    });

    it('should output JSON when format is json', async () => {
      const mockGraph = createMockGraph({ hasPath: true });
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });

      const result = await pathCommand({
        from: '1.0.0',
        to: '2.0.0',
        format: 'json',
      });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('diffCommand', () => {
    it('should return FILE_NOT_FOUND when graph is not found', async () => {
      (loadGraph as Mock).mockResolvedValue(null);

      const result = await diffCommand({ from: '1.0.0', to: '2.0.0' });

      expect(result.exitCode).toBe(ExitCode.FILE_NOT_FOUND);
    });

    it('should return SUCCESS when path exists', async () => {
      const mockGraph = createMockGraph({ hasPath: true });
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });

      const result = await diffCommand({ from: '1.0.0', to: '2.0.0' });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
    });

    it('should return GENERAL_ERROR when path does not exist', async () => {
      const mockGraph = createMockGraph({ hasPath: false });
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });

      const result = await diffCommand({ from: '1.0.0', to: '3.0.0' });

      expect(result.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(result.error).toContain('No migration path');
    });

    it('should output JSON when format is json', async () => {
      const mockGraph = createMockGraph({ hasPath: true });
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });

      const result = await diffCommand({
        from: '1.0.0',
        to: '2.0.0',
        format: 'json',
      });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalled();
      const jsonOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(jsonOutput.from).toBe('1.0.0');
      expect(jsonOutput.to).toBe('2.0.0');
    });
  });

  describe('generateTypesCommand', () => {
    it('should return FILE_NOT_FOUND when graph is not found', async () => {
      (loadGraph as Mock).mockResolvedValue(null);

      const result = await generateTypesCommand({});

      expect(result.exitCode).toBe(ExitCode.FILE_NOT_FOUND);
    });

    it('should generate types and write to default path', async () => {
      const mockGraph = createMockGraph();
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });
      (analyzeGraph as Mock).mockReturnValue(
        createMockAnalysis({
          profiles: {
            'user.email': 'always-single',
            'user.avatar': 'sometimes-multi',
          },
        })
      );
      (mkdir as Mock).mockResolvedValue(undefined);
      (writeFile as Mock).mockResolvedValue(undefined);

      const result = await generateTypesCommand({});

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(result.outputPath).toContain('migrex-types.d.ts');
      expect(writeFile).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalled();
    });

    it('should generate types to custom output path', async () => {
      const mockGraph = createMockGraph();
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });
      (analyzeGraph as Mock).mockReturnValue(createMockAnalysis({ profiles: {} }));
      (mkdir as Mock).mockResolvedValue(undefined);
      (writeFile as Mock).mockResolvedValue(undefined);

      const result = await generateTypesCommand({ output: 'types/custom.d.ts' });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(result.outputPath).toContain('custom.d.ts');
    });

    it('should return GENERAL_ERROR on write failure', async () => {
      const mockGraph = createMockGraph();
      (loadGraph as Mock).mockResolvedValue({ graph: mockGraph, path: 'test' });
      (analyzeGraph as Mock).mockReturnValue(createMockAnalysis({ profiles: {} }));
      (mkdir as Mock).mockRejectedValue(new Error('Write failed'));

      const result = await generateTypesCommand({});

      expect(result.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(result.error).toBe('Write failed');
    });
  });

  describe('initCommand', () => {
    it('should return GENERAL_ERROR when config already exists', async () => {
      (access as Mock).mockResolvedValue(undefined); // File exists

      const result = await initCommand({});

      expect(result.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(result.error).toBe('Config file already exists');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('migrex.config.ts already exists')
      );
    });

    it('should create project structure with default options', async () => {
      // First access (config) fails - file doesn't exist
      // Second access (gitignore) fails - file doesn't exist
      (access as Mock)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));
      (mkdir as Mock).mockResolvedValue(undefined);
      (writeFile as Mock).mockResolvedValue(undefined);

      const result = await initCommand({});

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(result.filesCreated).toContain('migrex.config.ts');
      expect(result.filesCreated).toContain('schemas/v1_0_0.ts');
      expect(result.filesCreated).toContain('.gitignore');
      expect(result.filesCreated).toContain('MIGREX.md');
      expect(logger.success).toHaveBeenCalledWith('Initialized migrex project');
    });

    it('should use custom plugin option', async () => {
      (access as Mock)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));
      (mkdir as Mock).mockResolvedValue(undefined);
      (writeFile as Mock).mockResolvedValue(undefined);

      const result = await initCommand({ plugin: 'json-schema' });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(writeFile).toHaveBeenCalled();
    });

    it('should use custom version option', async () => {
      (access as Mock)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));
      (mkdir as Mock).mockResolvedValue(undefined);
      (writeFile as Mock).mockResolvedValue(undefined);

      const result = await initCommand({ version: '2.0.0' });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(result.filesCreated).toContain('schemas/v2_0_0.ts');
    });

    it('should append to existing gitignore', async () => {
      // First access (config) fails - file doesn't exist
      // Second access (gitignore) succeeds - file exists
      (access as Mock)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(undefined);
      (mkdir as Mock).mockResolvedValue(undefined);
      (writeFile as Mock).mockResolvedValue(undefined);

      const result = await initCommand({});

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(result.filesCreated).toContain('.gitignore (updated)');
    });

    it('should return GENERAL_ERROR on file write failure', async () => {
      (access as Mock).mockRejectedValue(new Error('ENOENT'));
      (mkdir as Mock).mockRejectedValue(new Error('Permission denied'));

      const result = await initCommand({});

      expect(result.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(result.error).toBe('Permission denied');
    });
  });

  describe('newSchemaCommand', () => {
    it('should return GENERAL_ERROR when schema file already exists', async () => {
      (access as Mock).mockResolvedValue(undefined); // File exists

      const result = await newSchemaCommand({ version: '2.0.0' });

      expect(result.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(result.error).toBe('Schema file already exists');
    });

    it('should create schema file', async () => {
      (access as Mock).mockRejectedValue(new Error('ENOENT'));
      (writeFile as Mock).mockResolvedValue(undefined);

      const result = await newSchemaCommand({ version: '2.0.0' });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(result.fileCreated).toBe('schemas/v2_0_0.ts');
      expect(logger.success).toHaveBeenCalled();
    });

    it('should use custom plugin option', async () => {
      (access as Mock).mockRejectedValue(new Error('ENOENT'));
      (writeFile as Mock).mockResolvedValue(undefined);

      const result = await newSchemaCommand({
        version: '3.0.0',
        plugin: 'json-schema',
      });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
    });

    it('should return GENERAL_ERROR on write failure', async () => {
      (access as Mock).mockRejectedValue(new Error('ENOENT'));
      (writeFile as Mock).mockRejectedValue(new Error('Permission denied'));

      const result = await newSchemaCommand({ version: '2.0.0' });

      expect(result.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(result.error).toBe('Permission denied');
    });
  });

  describe('newMigrationCommand', () => {
    it('should return GENERAL_ERROR when migration file already exists', async () => {
      (access as Mock).mockResolvedValue(undefined); // File exists

      const result = await newMigrationCommand({ from: '1.0.0', to: '2.0.0' });

      expect(result.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(result.error).toBe('Migration file already exists');
    });

    it('should create migration file', async () => {
      (access as Mock).mockRejectedValue(new Error('ENOENT'));
      (writeFile as Mock).mockResolvedValue(undefined);

      const result = await newMigrationCommand({ from: '1.0.0', to: '2.0.0' });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
      expect(result.fileCreated).toBe('migrations/v1_0_0_to_v2_0_0.ts');
      expect(logger.success).toHaveBeenCalled();
    });

    it('should use custom plugin option', async () => {
      (access as Mock).mockRejectedValue(new Error('ENOENT'));
      (writeFile as Mock).mockResolvedValue(undefined);

      const result = await newMigrationCommand({
        from: '2.0.0',
        to: '3.0.0',
        plugin: 'json-schema',
      });

      expect(result.exitCode).toBe(ExitCode.SUCCESS);
    });

    it('should return GENERAL_ERROR on write failure', async () => {
      (access as Mock).mockRejectedValue(new Error('ENOENT'));
      (writeFile as Mock).mockRejectedValue(new Error('Permission denied'));

      const result = await newMigrationCommand({ from: '1.0.0', to: '2.0.0' });

      expect(result.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(result.error).toBe('Permission denied');
    });
  });
});
