import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConfigGraph } from '../src/index.js';
import { loadVersionedFile, saveVersionedFile } from '@migrex/files';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ConfigV1, ConfigV2, ConfigV4 } from '../src/index.js';

describe('Files Integration', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migrex-test-'));
    configPath = path.join(tempDir, 'config.json');
  });

  afterEach(async () => {
    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should save and load a config file without migration', async () => {
    const graph = createConfigGraph();

    const config: ConfigV1 = {
      version: '1.0.0',
      appName: 'Test App',
      port: 3000,
      debug: true,
    };

    // Save the config
    await saveVersionedFile(graph, configPath, config);

    // Verify file exists
    const fileExists = await fs
      .access(configPath)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    // Load the config with explicit target version to avoid auto-migration
    const result = await loadVersionedFile<ConfigV1>(graph, configPath, {
      targetVersion: '1.0.0',
    });

    expect(result.data).toEqual(config);
    expect(result.sourceVersion).toBe('1.0.0');
    expect(result.targetVersion).toBe('1.0.0');
    expect(result.wasUpgraded).toBe(false);
  });

  it('should auto-migrate to latest version on load', async () => {
    const graph = createConfigGraph();

    // Save a v1 config
    const v1Config: ConfigV1 = {
      version: '1.0.0',
      appName: 'Auto Migrate Test',
      port: 8080,
      debug: false,
    };

    await saveVersionedFile(graph, configPath, v1Config);

    // Load and auto-migrate to latest (v4)
    const result = await loadVersionedFile<ConfigV4>(graph, configPath);

    expect(result.sourceVersion).toBe('1.0.0');
    expect(result.targetVersion).toBe('4.0.0');
    expect(result.wasUpgraded).toBe(true);

    // Verify the migration was correct
    expect(result.data.version).toBe('4.0.0');
    expect(result.data.appName).toBe('Auto Migrate Test');
    expect(result.data.port).toBe(8080);
    expect(result.data.verbose).toBe(false); // debug -> verbose
    expect(result.data.logging).toBeDefined();
    expect(result.data.metrics).toBeDefined();
    expect(result.data.features).toEqual([]);
  });

  it('should migrate to a specific target version', async () => {
    const graph = createConfigGraph();

    // Save a v1 config
    const v1Config: ConfigV1 = {
      version: '1.0.0',
      appName: 'Target Version Test',
      port: 9000,
      debug: true,
    };

    await saveVersionedFile(graph, configPath, v1Config);

    // Load and migrate to v2 specifically
    const result = await loadVersionedFile<ConfigV2>(graph, configPath, {
      targetVersion: '2.0.0',
    });

    expect(result.sourceVersion).toBe('1.0.0');
    expect(result.targetVersion).toBe('2.0.0');
    expect(result.wasUpgraded).toBe(true);

    expect(result.data.version).toBe('2.0.0');
    expect(result.data.appName).toBe('Target Version Test');
    expect(result.data.debug).toBe(true);
    expect(result.data.logging).toBeDefined();
    // Should not have v3/v4 fields
    expect('verbose' in result.data).toBe(false);
    expect('metrics' in result.data).toBe(false);
  });

  it('should handle missing file gracefully', async () => {
    const graph = createConfigGraph();
    const nonExistentPath = path.join(tempDir, 'does-not-exist.json');

    await expect(loadVersionedFile(graph, nonExistentPath)).rejects.toThrow();
  });

  it('should handle invalid JSON gracefully', async () => {
    const graph = createConfigGraph();

    // Write invalid JSON
    await fs.writeFile(configPath, 'not valid json');

    await expect(loadVersionedFile(graph, configPath)).rejects.toThrow();
  });

  it('should persist pretty-printed JSON by default', async () => {
    const graph = createConfigGraph();

    const config: ConfigV1 = {
      version: '1.0.0',
      appName: 'Pretty Print Test',
      port: 3000,
      debug: true,
    };

    await saveVersionedFile(graph, configPath, config);

    const fileContents = await fs.readFile(configPath, 'utf-8');

    // Should be pretty-printed (contains newlines and indentation)
    expect(fileContents).toContain('\n');
    expect(fileContents).toMatch(/\s{2,}/); // At least 2 spaces (indentation)
  });

  it('should save compact JSON when pretty is false', async () => {
    const graph = createConfigGraph();

    const config: ConfigV1 = {
      version: '1.0.0',
      appName: 'Compact Test',
      port: 3000,
      debug: true,
    };

    await saveVersionedFile(graph, configPath, config, { pretty: false });

    const fileContents = await fs.readFile(configPath, 'utf-8');

    // Should be compact (minimal whitespace)
    const parsed = JSON.parse(fileContents);
    expect(parsed).toEqual(config);
    expect(fileContents.split('\n').length).toBe(1); // Single line
  });

  it('should provide migration path information', async () => {
    const graph = createConfigGraph();

    // Save a v1 config
    const v1Config: ConfigV1 = {
      version: '1.0.0',
      appName: 'Migration Path Test',
      port: 5000,
      debug: true,
    };

    await saveVersionedFile(graph, configPath, v1Config);

    // Load and migrate to v4
    const result = await loadVersionedFile<ConfigV4>(graph, configPath, {
      targetVersion: '4.0.0',
    });

    // Check migration path
    expect(result.migrationPath).toBeDefined();
    if (result.migrationPath) {
      expect(result.migrationPath.steps.length).toBe(3); // v1->v2->v3->v4
      expect(result.migrationPath.direction).toBe('up');
    }
  });
});
