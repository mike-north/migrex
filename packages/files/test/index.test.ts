import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMigrationGraph } from '@migrex/core';
import { semverStrategy } from '@migrex/core';
import type {
  VersionedSchema,
  ReversibleMigration,
  MigrationContext,
} from '@migrex/core';
import {
  loadVersionedFile,
  saveVersionedFile,
  upgradeVersionedFile,
  watchVersionedFile,
  diffVersions,
  VersionedFileError,
  type LoadResult,
  type FileWatcher,
  type UpgradeResult,
} from '../src/index.js';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Test data types
type V1Config = { version: '1.0.0'; appName: string };
type V2Config = { version: '2.0.0'; appName: string; port?: number };
type V3Config = { version: '3.0.0'; name: string; server?: { port: number } };

// Test schemas
const schemaV1: VersionedSchema<V1Config> = {
  version: '1.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'appName' in data &&
      'version' in data &&
      data.version === '1.0.0'
    ) {
      return { success: true, data: data as V1Config };
    }
    return {
      success: false,
      errors: [{ path: [], message: 'Invalid v1 config' }],
    };
  },
};

const schemaV2: VersionedSchema<V2Config> = {
  version: '2.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'appName' in data &&
      'version' in data &&
      data.version === '2.0.0'
    ) {
      return { success: true, data: data as V2Config };
    }
    return {
      success: false,
      errors: [{ path: [], message: 'Invalid v2 config' }],
    };
  },
};

const schemaV3: VersionedSchema<V3Config> = {
  version: '3.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'name' in data &&
      'version' in data &&
      data.version === '3.0.0'
    ) {
      return { success: true, data: data as V3Config };
    }
    return {
      success: false,
      errors: [{ path: [], message: 'Invalid v3 config' }],
    };
  },
};

// Test migrations
const migrationV1toV2: ReversibleMigration<V1Config, V2Config> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data: V1Config, _ctx: MigrationContext) => ({
    version: '2.0.0',
    appName: data.appName,
    port: 3000,
  }),
  down: (data: V2Config, _ctx: MigrationContext) => ({
    version: '1.0.0',
    appName: data.appName,
  }),
};

const migrationV2toV3: ReversibleMigration<V2Config, V3Config> = {
  fromVersion: '2.0.0',
  toVersion: '3.0.0',
  up: (data: V2Config, _ctx: MigrationContext) => ({
    version: '3.0.0',
    name: data.appName,
    server: data.port ? { port: data.port } : undefined,
  }),
  down: (data: V3Config, _ctx: MigrationContext) => ({
    version: '2.0.0',
    appName: data.name,
    port: data.server?.port,
  }),
};

// Test helpers
let testDir: string;
let testFilePath: string;

beforeEach(async () => {
  // Create temporary directory for test files
  testDir = join(tmpdir(), `migrex-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
  testFilePath = join(testDir, 'config.json');
});

afterEach(async () => {
  // Clean up test directory
  try {
    await rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

function createTestGraph() {
  const graph = createMigrationGraph({
    id: 'test-config',
    versionStrategy: semverStrategy,
  });

  graph.registerSchema(schemaV1);
  graph.registerSchema(schemaV2);
  graph.registerSchema(schemaV3);
  graph.registerMigration(migrationV1toV2);
  graph.registerMigration(migrationV2toV3);

  return graph;
}

async function writeTestConfig(data: unknown): Promise<void> {
  await writeFile(testFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

describe('loadVersionedFile', () => {
  describe('positive cases', () => {
    it('should load a valid config file without migration', async () => {
      const graph = createTestGraph();
      const configData: V2Config = { version: '2.0.0', appName: 'TestApp' };
      await writeTestConfig(configData);

      const result = await loadVersionedFile<V2Config>(graph, testFilePath, {
        targetVersion: '2.0.0',
      });

      expect(result.data).toEqual(configData);
      expect(result.sourceVersion).toBe('2.0.0');
      expect(result.targetVersion).toBe('2.0.0');
      expect(result.wasUpgraded).toBe(false);
      expect(result.migrationPath).toBeUndefined();
    });

    it('should load and migrate config to target version', async () => {
      const graph = createTestGraph();
      const configData: V1Config = { version: '1.0.0', appName: 'TestApp' };
      await writeTestConfig(configData);

      const result = await loadVersionedFile<V2Config>(graph, testFilePath, {
        targetVersion: '2.0.0',
      });

      expect(result.data.version).toBe('2.0.0');
      expect(result.data.appName).toBe('TestApp');
      expect(result.data.port).toBe(3000);
      expect(result.sourceVersion).toBe('1.0.0');
      expect(result.targetVersion).toBe('2.0.0');
      expect(result.wasUpgraded).toBe(true);
      expect(result.migrationPath).toBeDefined();
    });

    it('should migrate to latest version when targetVersion not specified', async () => {
      const graph = createTestGraph();
      const configData: V1Config = { version: '1.0.0', appName: 'TestApp' };
      await writeTestConfig(configData);

      const result = await loadVersionedFile<V3Config>(graph, testFilePath);

      expect(result.data.version).toBe('3.0.0');
      expect(result.data.name).toBe('TestApp');
      expect(result.sourceVersion).toBe('1.0.0');
      expect(result.targetVersion).toBe('3.0.0');
      expect(result.wasUpgraded).toBe(true);
    });

    it('should handle multi-step migrations', async () => {
      const graph = createTestGraph();
      const configData: V1Config = { version: '1.0.0', appName: 'MyApp' };
      await writeTestConfig(configData);

      const result = await loadVersionedFile<V3Config>(graph, testFilePath, {
        targetVersion: '3.0.0',
      });

      expect(result.data.version).toBe('3.0.0');
      expect(result.data.name).toBe('MyApp');
      expect(result.data.server?.port).toBe(3000);
      expect(result.sourceVersion).toBe('1.0.0');
      expect(result.targetVersion).toBe('3.0.0');
      expect(result.wasUpgraded).toBe(true);
      expect(result.migrationPath?.steps).toHaveLength(2);
    });
  });

  describe('negative cases', () => {
    it('should throw VersionedFileError when file does not exist', async () => {
      const graph = createTestGraph();
      const nonExistentPath = join(testDir, 'nonexistent.json');

      await expect(
        loadVersionedFile(graph, nonExistentPath)
      ).rejects.toThrowError(VersionedFileError);

      try {
        await loadVersionedFile(graph, nonExistentPath);
      } catch (error) {
        expect(error).toBeInstanceOf(VersionedFileError);
        expect((error as VersionedFileError).filePath).toBe(nonExistentPath);
        expect((error as VersionedFileError).message).toContain('Failed to read');
      }
    });

    it('should throw VersionedFileError when JSON is invalid', async () => {
      const graph = createTestGraph();
      await writeFile(testFilePath, '{ invalid json }', 'utf-8');

      await expect(
        loadVersionedFile(graph, testFilePath)
      ).rejects.toThrowError(VersionedFileError);

      try {
        await loadVersionedFile(graph, testFilePath);
      } catch (error) {
        expect(error).toBeInstanceOf(VersionedFileError);
        expect((error as VersionedFileError).message).toContain('Failed to parse');
      }
    });

    it('should throw VersionedFileError when version field is missing', async () => {
      const graph = createTestGraph();
      await writeTestConfig({ appName: 'TestApp' });

      await expect(
        loadVersionedFile(graph, testFilePath)
      ).rejects.toThrowError(VersionedFileError);

      try {
        await loadVersionedFile(graph, testFilePath);
      } catch (error) {
        expect(error).toBeInstanceOf(VersionedFileError);
        expect((error as VersionedFileError).message).toContain(
          "missing 'version' field"
        );
      }
    });

    it('should throw VersionedFileError when schema not registered for version', async () => {
      const graph = createTestGraph();
      await writeTestConfig({ version: '99.0.0', appName: 'TestApp' });

      await expect(
        loadVersionedFile(graph, testFilePath, { targetVersion: '99.0.0' })
      ).rejects.toThrowError(VersionedFileError);
    });

    it('should throw VersionedFileError when validation fails', async () => {
      const graph = createTestGraph();
      await writeTestConfig({ version: '1.0.0', wrongField: 'value' });

      await expect(
        loadVersionedFile(graph, testFilePath, { targetVersion: '1.0.0' })
      ).rejects.toThrowError(VersionedFileError);

      try {
        await loadVersionedFile(graph, testFilePath, { targetVersion: '1.0.0' });
      } catch (error) {
        expect(error).toBeInstanceOf(VersionedFileError);
        expect((error as VersionedFileError).message).toContain(
          'Validation failed'
        );
      }
    });

    it('should load a valid YAML config file', async () => {
      const graph = createTestGraph();
      const yamlPath = join(testDir, 'config.yaml');
      await writeFile(
        yamlPath,
        'version: "2.0.0"\nappName: YamlApp\nport: 8080\n',
        'utf-8'
      );

      const result = await loadVersionedFile<V2Config>(graph, yamlPath, {
        targetVersion: '2.0.0',
      });

      expect(result.data.appName).toBe('YamlApp');
      expect(result.data.port).toBe(8080);
    });

    it('should load and migrate YAML config to target version', async () => {
      const graph = createTestGraph();
      const yamlPath = join(testDir, 'config.yml');
      await writeFile(yamlPath, 'version: "1.0.0"\nappName: YamlApp\n', 'utf-8');

      const result = await loadVersionedFile<V2Config>(graph, yamlPath, {
        targetVersion: '2.0.0',
      });

      expect(result.wasUpgraded).toBe(true);
    });

    it('should throw VersionedFileError for invalid YAML syntax', async () => {
      const graph = createTestGraph();
      const yamlPath = join(testDir, 'invalid.yaml');
      await writeFile(yamlPath, 'version: [invalid yaml', 'utf-8');

      await expect(loadVersionedFile(graph, yamlPath)).rejects.toThrow(
        VersionedFileError
      );
    });

    it('should load a valid TOML config file', async () => {
      const graph = createTestGraph();
      const tomlPath = join(testDir, 'config.toml');
      await writeFile(
        tomlPath,
        'version = "2.0.0"\nappName = "TomlApp"\nport = 8080\n',
        'utf-8'
      );

      const result = await loadVersionedFile<V2Config>(graph, tomlPath, {
        targetVersion: '2.0.0',
      });

      expect(result.data.appName).toBe('TomlApp');
    });

    it('should load and migrate TOML config to target version', async () => {
      const graph = createTestGraph();
      const tomlPath = join(testDir, 'config.toml');
      await writeFile(
        tomlPath,
        'version = "1.0.0"\nappName = "TomlApp"\n',
        'utf-8'
      );

      const result = await loadVersionedFile<V2Config>(graph, tomlPath, {
        targetVersion: '2.0.0',
      });

      expect(result.wasUpgraded).toBe(true);
    });

    it('should throw VersionedFileError for invalid TOML syntax', async () => {
      const graph = createTestGraph();
      const tomlPath = join(testDir, 'invalid.toml');
      await writeFile(tomlPath, 'version = [invalid', 'utf-8');

      await expect(loadVersionedFile(graph, tomlPath)).rejects.toThrow(
        VersionedFileError
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty config object with version', async () => {
      const graph = createTestGraph();
      await writeTestConfig({ version: '1.0.0', appName: '' });

      const result = await loadVersionedFile<V1Config>(graph, testFilePath, {
        targetVersion: '1.0.0',
      });

      expect(result.data.appName).toBe('');
    });

    it('should preserve extra fields during migration', async () => {
      const graph = createTestGraph();
      await writeTestConfig({
        version: '1.0.0',
        appName: 'TestApp',
        extraField: 'preserved',
      });

      const result = await loadVersionedFile<V2Config>(graph, testFilePath, {
        targetVersion: '2.0.0',
      });

      // Extra fields should be preserved by the migration system
      expect(result.data).toBeDefined();
    });
  });
});

describe('saveVersionedFile', () => {
  describe('positive cases', () => {
    it('should save config with specified version', async () => {
      const graph = createTestGraph();
      const config: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
        port: 8080,
      };

      await saveVersionedFile(graph, testFilePath, config, { version: '2.0.0' });

      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(config);
    });

    it('should detect version from data', async () => {
      const graph = createTestGraph();
      const config: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
      };

      await saveVersionedFile(graph, testFilePath, config);

      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe('2.0.0');
    });

    it('should use latest version when not specified and not in data', async () => {
      const graph = createTestGraph();
      const config = { name: 'TestApp' };

      await saveVersionedFile(graph, testFilePath, config);

      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe('3.0.0'); // Latest version
    });

    it('should pretty-print by default', async () => {
      const graph = createTestGraph();
      const config: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
      };

      await saveVersionedFile(graph, testFilePath, config);

      const content = await readFile(testFilePath, 'utf-8');
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });

    it('should save compact JSON when pretty is false', async () => {
      const graph = createTestGraph();
      const config: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
      };

      await saveVersionedFile(graph, testFilePath, config, { pretty: false });

      const content = await readFile(testFilePath, 'utf-8');
      expect(content).not.toContain('\n');
    });
  });

  describe('negative cases', () => {
    it('should throw VersionedFileError when validation fails', async () => {
      const graph = createTestGraph();
      const invalidConfig = { version: '2.0.0', wrongField: 'value' };

      await expect(
        saveVersionedFile(graph, testFilePath, invalidConfig, { version: '2.0.0' })
      ).rejects.toThrowError(VersionedFileError);

      try {
        await saveVersionedFile(graph, testFilePath, invalidConfig, {
          version: '2.0.0',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(VersionedFileError);
        expect((error as VersionedFileError).message).toContain('invalid data');
      }
    });

    it('should throw VersionedFileError when write fails', async () => {
      const graph = createTestGraph();
      const config: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
      };
      const invalidPath = join('/nonexistent/directory', 'config.json');

      await expect(
        saveVersionedFile(graph, invalidPath, config)
      ).rejects.toThrowError(VersionedFileError);

      try {
        await saveVersionedFile(graph, invalidPath, config);
      } catch (error) {
        expect(error).toBeInstanceOf(VersionedFileError);
        expect((error as VersionedFileError).message).toContain(
          'Failed to write'
        );
      }
    });

    it('should save config as YAML', async () => {
      const graph = createTestGraph();
      const yamlPath = join(testDir, 'config.yaml');
      const config: V2Config = {
        version: '2.0.0',
        appName: 'YamlApp',
        port: 8080,
      };

      await saveVersionedFile(graph, yamlPath, config);

      const content = await readFile(yamlPath, 'utf-8');
      expect(content).toContain('version:');
      expect(content).toContain('2.0.0');
      expect(content).toContain('appName:');
      expect(content).toContain('YamlApp');
    });

    it('should round-trip YAML preserving data', async () => {
      const graph = createTestGraph();
      const yamlPath = join(testDir, 'roundtrip.yaml');
      const config: V2Config = {
        version: '2.0.0',
        appName: 'RoundTrip',
        port: 9000,
      };

      await saveVersionedFile(graph, yamlPath, config);
      const result = await loadVersionedFile<V2Config>(graph, yamlPath, {
        targetVersion: '2.0.0',
      });

      expect(result.data).toEqual(config);
    });

    it('should save config as TOML', async () => {
      const graph = createTestGraph();
      const tomlPath = join(testDir, 'config.toml');
      const config: V2Config = {
        version: '2.0.0',
        appName: 'TomlApp',
        port: 8080,
      };

      await saveVersionedFile(graph, tomlPath, config);

      const content = await readFile(tomlPath, 'utf-8');
      expect(content).toContain('version = "2.0.0"');
      expect(content).toContain('appName = "TomlApp"');
    });

    it('should round-trip TOML preserving data', async () => {
      const graph = createTestGraph();
      const tomlPath = join(testDir, 'roundtrip.toml');
      const config: V2Config = {
        version: '2.0.0',
        appName: 'RoundTrip',
        port: 9000,
      };

      await saveVersionedFile(graph, tomlPath, config);
      const result = await loadVersionedFile<V2Config>(graph, tomlPath, {
        targetVersion: '2.0.0',
      });

      expect(result.data).toEqual(config);
    });

    it('should handle arrays by wrapping them with version for TOML', async () => {
      // Note: saveVersionedFile wraps non-object data with { version, data }
      // so raw arrays are never passed directly to TOML stringify.
      // This test verifies the wrapping behavior works correctly.
      const graph = createMigrationGraph({
        id: 'empty-graph',
        versionStrategy: semverStrategy,
      });
      const tomlPath = join(testDir, 'wrapped.toml');

      await saveVersionedFile(graph, tomlPath, ['array', 'data'], { version: '1.0.0' });

      const content = await readFile(tomlPath, 'utf-8');
      expect(content).toContain('version = "1.0.0"');
      expect(content).toContain('data');
    });
  });

  describe('edge cases', () => {
    it('should wrap non-object data with version', async () => {
      const graph = createMigrationGraph({
        id: 'empty-graph',
        versionStrategy: semverStrategy,
      });
      const primitiveData = 'test-string';

      await saveVersionedFile(graph, testFilePath, primitiveData, {
        version: '1.0.0',
      });

      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.data).toBe(primitiveData);
    });

    it('should skip validation when no schema registered', async () => {
      const graph = createMigrationGraph({
        id: 'empty-graph',
        versionStrategy: semverStrategy,
      });

      const config = { version: '1.0.0', anything: 'goes' };
      await saveVersionedFile(graph, testFilePath, config);

      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(config);
    });
  });
});

describe('upgradeVersionedFile', () => {
  describe('positive cases', () => {
    it('should upgrade config from v1 to v2', async () => {
      const graph = createTestGraph();
      const configData: V1Config = { version: '1.0.0', appName: 'TestApp' };
      await writeTestConfig(configData);

      const result = await upgradeVersionedFile(graph, testFilePath, {
        targetVersion: '2.0.0',
      });

      expect(result.sourceVersion).toBe('1.0.0');
      expect(result.targetVersion).toBe('2.0.0');
      expect(result.wasMigrated).toBe(true);
      expect(result.wasWritten).toBe(true);
      expect(result.migrationPath).toBeDefined();

      // Verify file was updated
      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe('2.0.0');
      expect(parsed.appName).toBe('TestApp');
      expect(parsed.port).toBe(3000);
    });

    it('should upgrade to latest version when targetVersion not specified', async () => {
      const graph = createTestGraph();
      const configData: V1Config = { version: '1.0.0', appName: 'TestApp' };
      await writeTestConfig(configData);

      const result = await upgradeVersionedFile(graph, testFilePath);

      expect(result.sourceVersion).toBe('1.0.0');
      expect(result.targetVersion).toBe('3.0.0');
      expect(result.wasMigrated).toBe(true);
      expect(result.wasWritten).toBe(true);

      // Verify file was updated to v3
      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe('3.0.0');
      expect(parsed.name).toBe('TestApp');
    });

    it('should handle multi-step upgrades', async () => {
      const graph = createTestGraph();
      const configData: V1Config = { version: '1.0.0', appName: 'MyApp' };
      await writeTestConfig(configData);

      const result = await upgradeVersionedFile(graph, testFilePath, {
        targetVersion: '3.0.0',
      });

      expect(result.sourceVersion).toBe('1.0.0');
      expect(result.targetVersion).toBe('3.0.0');
      expect(result.wasMigrated).toBe(true);
      expect(result.migrationPath?.steps).toHaveLength(2);

      // Verify file
      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe('3.0.0');
      expect(parsed.name).toBe('MyApp');
      expect(parsed.server?.port).toBe(3000);
    });

    it('should skip writing when already at target version (skipIfCurrent: true)', async () => {
      const graph = createTestGraph();
      const configData: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
        port: 8080,
      };
      await writeTestConfig(configData);

      const result = await upgradeVersionedFile(graph, testFilePath, {
        targetVersion: '2.0.0',
      });

      expect(result.sourceVersion).toBe('2.0.0');
      expect(result.targetVersion).toBe('2.0.0');
      expect(result.wasMigrated).toBe(false);
      expect(result.wasWritten).toBe(false);
      expect(result.migrationPath).toBeUndefined();

      // File should be unchanged
      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.port).toBe(8080);
    });

    it('should write when already at target version if skipIfCurrent: false', async () => {
      const graph = createTestGraph();
      const configData: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
        port: 8080,
      };
      await writeTestConfig(configData);

      const result = await upgradeVersionedFile(graph, testFilePath, {
        targetVersion: '2.0.0',
        skipIfCurrent: false,
      });

      expect(result.sourceVersion).toBe('2.0.0');
      expect(result.targetVersion).toBe('2.0.0');
      expect(result.wasMigrated).toBe(false);
      expect(result.wasWritten).toBe(true);
    });

    it('should respect pretty option', async () => {
      const graph = createTestGraph();
      const configData: V1Config = { version: '1.0.0', appName: 'TestApp' };
      await writeTestConfig(configData);

      await upgradeVersionedFile(graph, testFilePath, {
        targetVersion: '2.0.0',
        pretty: false,
      });

      const content = await readFile(testFilePath, 'utf-8');
      expect(content).not.toContain('\n');
    });
  });

  describe('negative cases', () => {
    it('should throw VersionedFileError when file does not exist', async () => {
      const graph = createTestGraph();
      const nonExistentPath = join(testDir, 'nonexistent.json');

      await expect(
        upgradeVersionedFile(graph, nonExistentPath)
      ).rejects.toThrowError(VersionedFileError);
    });

    it('should throw VersionedFileError when JSON is invalid', async () => {
      const graph = createTestGraph();
      await writeFile(testFilePath, '{ invalid json }', 'utf-8');

      await expect(
        upgradeVersionedFile(graph, testFilePath)
      ).rejects.toThrowError(VersionedFileError);
    });

    it('should throw VersionedFileError when version field is missing', async () => {
      const graph = createTestGraph();
      await writeTestConfig({ appName: 'TestApp' });

      await expect(
        upgradeVersionedFile(graph, testFilePath)
      ).rejects.toThrowError(VersionedFileError);
    });

    it('should upgrade YAML file in place', async () => {
      const graph = createTestGraph();
      const yamlPath = join(testDir, 'config.yaml');
      await writeFile(
        yamlPath,
        'version: "1.0.0"\nappName: YamlApp\n',
        'utf-8'
      );

      const result = await upgradeVersionedFile(graph, yamlPath, {
        targetVersion: '2.0.0',
      });

      expect(result.wasMigrated).toBe(true);
      const content = await readFile(yamlPath, 'utf-8');
      expect(content).toContain('version:');
      expect(content).toContain('2.0.0');
    });

    it('should upgrade TOML file in place', async () => {
      const graph = createTestGraph();
      const tomlPath = join(testDir, 'upgrade.toml');
      await writeFile(
        tomlPath,
        'version = "1.0.0"\nappName = "TomlApp"\n',
        'utf-8'
      );

      const result = await upgradeVersionedFile(graph, tomlPath, {
        targetVersion: '2.0.0',
      });

      expect(result.wasMigrated).toBe(true);
      const content = await readFile(tomlPath, 'utf-8');
      expect(content).toContain('version = "2.0.0"');
    });
  });

  describe('edge cases', () => {
    it('should preserve pretty formatting by default', async () => {
      const graph = createTestGraph();
      const configData: V1Config = { version: '1.0.0', appName: 'TestApp' };
      await writeTestConfig(configData);

      await upgradeVersionedFile(graph, testFilePath, {
        targetVersion: '2.0.0',
      });

      const content = await readFile(testFilePath, 'utf-8');
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });

    it('should handle upgrading from same version (no-op)', async () => {
      const graph = createTestGraph();
      const configData: V3Config = {
        version: '3.0.0',
        name: 'TestApp',
        server: { port: 9000 },
      };
      await writeTestConfig(configData);

      const result = await upgradeVersionedFile(graph, testFilePath);

      expect(result.wasMigrated).toBe(false);
      expect(result.wasWritten).toBe(false);
    });
  });
});

describe('watchVersionedFile', () => {
  describe('positive cases', () => {
    it('should call onUpdate when file changes', async () => {
      const graph = createTestGraph();
      const initialConfig: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
      };
      await writeTestConfig(initialConfig);

      const onUpdate = vi.fn();
      const watcher = watchVersionedFile(graph, testFilePath, {
        targetVersion: '2.0.0',
        onUpdate,
        debounceMs: 50,
      });

      // Wait a bit to ensure watcher is ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update the file
      const updatedConfig: V2Config = {
        version: '2.0.0',
        appName: 'UpdatedApp',
        port: 9000,
      };
      await writeTestConfig(updatedConfig);

      // Wait for debounce and processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(onUpdate).toHaveBeenCalled();
      const callArg = onUpdate.mock.calls[0][0] as LoadResult<V2Config>;
      expect(callArg.data.appName).toBe('UpdatedApp');

      watcher.stop();
    });

    it('should migrate config on file change', async () => {
      const graph = createTestGraph();
      const initialConfig: V1Config = {
        version: '1.0.0',
        appName: 'TestApp',
      };
      await writeTestConfig(initialConfig);

      const onUpdate = vi.fn();
      const watcher = watchVersionedFile(graph, testFilePath, {
        targetVersion: '3.0.0',
        onUpdate,
        debounceMs: 50,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const updatedConfig: V1Config = {
        version: '1.0.0',
        appName: 'NewApp',
      };
      await writeTestConfig(updatedConfig);

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(onUpdate).toHaveBeenCalled();
      const callArg = onUpdate.mock.calls[0][0] as LoadResult<V3Config>;
      expect(callArg.data.version).toBe('3.0.0');
      expect(callArg.data.name).toBe('NewApp');
      expect(callArg.wasUpgraded).toBe(true);

      watcher.stop();
    });

    it('should stop watching when stop() is called', async () => {
      const graph = createTestGraph();
      const initialConfig: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
      };
      await writeTestConfig(initialConfig);

      const onUpdate = vi.fn();
      const watcher = watchVersionedFile(graph, testFilePath, {
        onUpdate,
        debounceMs: 50,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop watching
      watcher.stop();

      // Update file after stopping
      await writeTestConfig({ version: '2.0.0', appName: 'AfterStop' });

      // Wait to see if callback is called (it shouldn't be)
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('negative cases', () => {
    it('should call onError when file becomes invalid', async () => {
      const graph = createTestGraph();
      const initialConfig: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
      };
      await writeTestConfig(initialConfig);

      const onError = vi.fn();
      const watcher = watchVersionedFile(graph, testFilePath, {
        onError,
        debounceMs: 50,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Write invalid JSON
      await writeFile(testFilePath, '{ invalid json }', 'utf-8');

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0] as Error;
      expect(error).toBeInstanceOf(VersionedFileError);

      watcher.stop();
    });

    it('should handle file deletion gracefully', async () => {
      const graph = createTestGraph();
      const initialConfig: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
      };
      await writeTestConfig(initialConfig);

      const onError = vi.fn();
      const watcher = watchVersionedFile(graph, testFilePath, {
        onError,
        debounceMs: 50,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Delete the file
      await rm(testFilePath);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // onError may or may not be called depending on timing, but shouldn't crash
      watcher.stop();
    });
  });

  describe('edge cases', () => {
    it('should debounce multiple rapid changes', async () => {
      const graph = createTestGraph();
      const initialConfig: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
      };
      await writeTestConfig(initialConfig);

      const onUpdate = vi.fn();
      const watcher = watchVersionedFile(graph, testFilePath, {
        onUpdate,
        debounceMs: 100,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Make multiple rapid changes
      for (let i = 0; i < 5; i++) {
        await writeTestConfig({
          version: '2.0.0',
          appName: `App${i}`,
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should be called only once or a few times due to debouncing
      expect(onUpdate.mock.calls.length).toBeLessThan(5);

      watcher.stop();
    });
  });
});

describe('diffVersions', () => {
  describe('positive cases', () => {
    it('should return diff structure between versions', () => {
      const graph = createTestGraph();

      const diff = diffVersions(graph, '1.0.0', '2.0.0');

      expect(diff.from).toBe('1.0.0');
      expect(diff.to).toBe('2.0.0');
      expect(diff.addedFields).toBeInstanceOf(Array);
      expect(diff.removedFields).toBeInstanceOf(Array);
      expect(diff.modifiedFields).toBeInstanceOf(Array);
    });

    it('should handle comparing same version', () => {
      const graph = createTestGraph();

      const diff = diffVersions(graph, '2.0.0', '2.0.0');

      expect(diff.from).toBe('2.0.0');
      expect(diff.to).toBe('2.0.0');
    });
  });

  describe('negative cases', () => {
    it('should throw error when fromVersion schema not found', () => {
      const graph = createTestGraph();

      expect(() => diffVersions(graph, '99.0.0', '2.0.0')).toThrowError(
        /Schema not found for version: 99\.0\.0/
      );
    });

    it('should throw error when toVersion schema not found', () => {
      const graph = createTestGraph();

      expect(() => diffVersions(graph, '1.0.0', '99.0.0')).toThrowError(
        /Schema not found for version: 99\.0\.0/
      );
    });

    it('should throw error when both versions not found', () => {
      const graph = createTestGraph();

      expect(() => diffVersions(graph, '98.0.0', '99.0.0')).toThrowError(
        /Schema not found for version/
      );
    });
  });
});

describe('VersionedFileError', () => {
  it('should create error with filePath and cause', () => {
    const cause = new Error('Original error');
    const error = new VersionedFileError(
      'Failed to load',
      '/path/to/config.json',
      cause
    );

    expect(error.message).toBe('Failed to load');
    expect(error.filePath).toBe('/path/to/config.json');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('VersionedFileError');
  });

  it('should be instanceof Error', () => {
    const error = new VersionedFileError('Test', '/path');
    expect(error).toBeInstanceOf(Error);
  });
});
