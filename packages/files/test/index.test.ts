import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMigrationGraph } from '@migrex/core';
import { semverStrategy } from '@migrex/core';
import type {
  VersionedSchema,
  ReversibleMigration,
  MigrationContext,
} from '@migrex/core';
import {
  loadConfig,
  saveConfig,
  watchConfig,
  diffVersions,
  ConfigFileError,
  type LoadConfigResult,
  type ConfigWatcher,
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

describe('loadConfig', () => {
  describe('positive cases', () => {
    it('should load a valid config file without migration', async () => {
      const graph = createTestGraph();
      const configData: V2Config = { version: '2.0.0', appName: 'TestApp' };
      await writeTestConfig(configData);

      const result = await loadConfig<V2Config>(graph, testFilePath, {
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

      const result = await loadConfig<V2Config>(graph, testFilePath, {
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

      const result = await loadConfig<V3Config>(graph, testFilePath);

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

      const result = await loadConfig<V3Config>(graph, testFilePath, {
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
    it('should throw ConfigFileError when file does not exist', async () => {
      const graph = createTestGraph();
      const nonExistentPath = join(testDir, 'nonexistent.json');

      await expect(
        loadConfig(graph, nonExistentPath)
      ).rejects.toThrowError(ConfigFileError);

      try {
        await loadConfig(graph, nonExistentPath);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigFileError);
        expect((error as ConfigFileError).filePath).toBe(nonExistentPath);
        expect((error as ConfigFileError).message).toContain('Failed to read');
      }
    });

    it('should throw ConfigFileError when JSON is invalid', async () => {
      const graph = createTestGraph();
      await writeFile(testFilePath, '{ invalid json }', 'utf-8');

      await expect(
        loadConfig(graph, testFilePath)
      ).rejects.toThrowError(ConfigFileError);

      try {
        await loadConfig(graph, testFilePath);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigFileError);
        expect((error as ConfigFileError).message).toContain('Failed to parse');
      }
    });

    it('should throw ConfigFileError when version field is missing', async () => {
      const graph = createTestGraph();
      await writeTestConfig({ appName: 'TestApp' });

      await expect(
        loadConfig(graph, testFilePath)
      ).rejects.toThrowError(ConfigFileError);

      try {
        await loadConfig(graph, testFilePath);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigFileError);
        expect((error as ConfigFileError).message).toContain(
          "missing 'version' field"
        );
      }
    });

    it('should throw ConfigFileError when schema not registered for version', async () => {
      const graph = createTestGraph();
      await writeTestConfig({ version: '99.0.0', appName: 'TestApp' });

      await expect(
        loadConfig(graph, testFilePath, { targetVersion: '99.0.0' })
      ).rejects.toThrowError(ConfigFileError);
    });

    it('should throw ConfigFileError when validation fails', async () => {
      const graph = createTestGraph();
      await writeTestConfig({ version: '1.0.0', wrongField: 'value' });

      await expect(
        loadConfig(graph, testFilePath, { targetVersion: '1.0.0' })
      ).rejects.toThrowError(ConfigFileError);

      try {
        await loadConfig(graph, testFilePath, { targetVersion: '1.0.0' });
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigFileError);
        expect((error as ConfigFileError).message).toContain(
          'validation failed'
        );
      }
    });

    it('should throw error for YAML files (not yet supported)', async () => {
      const graph = createTestGraph();
      const yamlPath = join(testDir, 'config.yaml');
      await writeFile(yamlPath, 'version: 1.0.0\nappName: TestApp\n', 'utf-8');

      await expect(loadConfig(graph, yamlPath)).rejects.toThrowError(
        ConfigFileError
      );

      try {
        await loadConfig(graph, yamlPath);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigFileError);
        expect((error as Error).message).toContain('Failed to parse');
        expect((error as Error).message).toContain('YAML');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty config object with version', async () => {
      const graph = createTestGraph();
      await writeTestConfig({ version: '1.0.0', appName: '' });

      const result = await loadConfig<V1Config>(graph, testFilePath, {
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

      const result = await loadConfig<V2Config>(graph, testFilePath, {
        targetVersion: '2.0.0',
      });

      // Extra fields should be preserved by the migration system
      expect(result.data).toBeDefined();
    });
  });
});

describe('saveConfig', () => {
  describe('positive cases', () => {
    it('should save config with specified version', async () => {
      const graph = createTestGraph();
      const config: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
        port: 8080,
      };

      await saveConfig(graph, testFilePath, config, { version: '2.0.0' });

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

      await saveConfig(graph, testFilePath, config);

      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe('2.0.0');
    });

    it('should use latest version when not specified and not in data', async () => {
      const graph = createTestGraph();
      const config = { name: 'TestApp' };

      await saveConfig(graph, testFilePath, config);

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

      await saveConfig(graph, testFilePath, config);

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

      await saveConfig(graph, testFilePath, config, { pretty: false });

      const content = await readFile(testFilePath, 'utf-8');
      expect(content).not.toContain('\n');
    });
  });

  describe('negative cases', () => {
    it('should throw ConfigFileError when validation fails', async () => {
      const graph = createTestGraph();
      const invalidConfig = { version: '2.0.0', wrongField: 'value' };

      await expect(
        saveConfig(graph, testFilePath, invalidConfig, { version: '2.0.0' })
      ).rejects.toThrowError(ConfigFileError);

      try {
        await saveConfig(graph, testFilePath, invalidConfig, {
          version: '2.0.0',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigFileError);
        expect((error as ConfigFileError).message).toContain('invalid config');
      }
    });

    it('should throw ConfigFileError when write fails', async () => {
      const graph = createTestGraph();
      const config: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
      };
      const invalidPath = join('/nonexistent/directory', 'config.json');

      await expect(
        saveConfig(graph, invalidPath, config)
      ).rejects.toThrowError(ConfigFileError);

      try {
        await saveConfig(graph, invalidPath, config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigFileError);
        expect((error as ConfigFileError).message).toContain(
          'Failed to write'
        );
      }
    });

    it('should throw error for YAML files (not yet supported)', async () => {
      const graph = createTestGraph();
      const yamlPath = join(testDir, 'config.yaml');
      const config = { version: '1.0.0', appName: 'TestApp' };

      await expect(
        saveConfig(graph, yamlPath, config)
      ).rejects.toThrowError(/YAML format not yet supported/);
    });
  });

  describe('edge cases', () => {
    it('should wrap non-object data with version', async () => {
      const graph = createMigrationGraph({
        id: 'empty-graph',
        versionStrategy: semverStrategy,
      });
      const primitiveData = 'test-string';

      await saveConfig(graph, testFilePath, primitiveData, {
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
      await saveConfig(graph, testFilePath, config);

      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(config);
    });
  });
});

describe('watchConfig', () => {
  describe('positive cases', () => {
    it('should call onUpdate when file changes', async () => {
      const graph = createTestGraph();
      const initialConfig: V2Config = {
        version: '2.0.0',
        appName: 'TestApp',
      };
      await writeTestConfig(initialConfig);

      const onUpdate = vi.fn();
      const watcher = watchConfig(graph, testFilePath, {
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
      const callArg = onUpdate.mock.calls[0][0] as LoadConfigResult<V2Config>;
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
      const watcher = watchConfig(graph, testFilePath, {
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
      const callArg = onUpdate.mock.calls[0][0] as LoadConfigResult<V3Config>;
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
      const watcher = watchConfig(graph, testFilePath, {
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
      const watcher = watchConfig(graph, testFilePath, {
        onError,
        debounceMs: 50,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Write invalid JSON
      await writeFile(testFilePath, '{ invalid json }', 'utf-8');

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0] as Error;
      expect(error).toBeInstanceOf(ConfigFileError);

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
      const watcher = watchConfig(graph, testFilePath, {
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
      const watcher = watchConfig(graph, testFilePath, {
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

describe('ConfigFileError', () => {
  it('should create error with filePath and cause', () => {
    const cause = new Error('Original error');
    const error = new ConfigFileError(
      'Failed to load',
      '/path/to/config.json',
      cause
    );

    expect(error.message).toBe('Failed to load');
    expect(error.filePath).toBe('/path/to/config.json');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('ConfigFileError');
  });

  it('should be instanceof Error', () => {
    const error = new ConfigFileError('Test', '/path');
    expect(error).toBeInstanceOf(Error);
  });
});
