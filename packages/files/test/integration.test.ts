import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMigrationGraph, semverStrategy } from '@migrex/core';
import type {
  VersionedSchema,
  ReversibleMigration,
  MigrationContext,
} from '@migrex/core';
import { loadVersionedFile, saveVersionedFile } from '../src/index.js';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Realistic example: App configuration evolution
type V1AppConfig = {
  version: '1.0.0';
  name: string;
  port: number;
};

type V2AppConfig = {
  version: '2.0.0';
  name: string;
  server: {
    port: number;
    host: string;
  };
};

type V3AppConfig = {
  version: '3.0.0';
  name: string;
  server: {
    port: number;
    host: string;
  };
  features: {
    auth: boolean;
    logging: boolean;
  };
};

// Schemas
const schemaV1: VersionedSchema<V1AppConfig> = {
  version: '1.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'version' in data &&
      data.version === '1.0.0' &&
      'name' in data &&
      'port' in data
    ) {
      return { success: true, data: data as V1AppConfig };
    }
    return { success: false, errors: [{ path: [], message: 'Invalid v1 config' }] };
  },
};

const schemaV2: VersionedSchema<V2AppConfig> = {
  version: '2.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'version' in data &&
      data.version === '2.0.0' &&
      'name' in data &&
      'server' in data
    ) {
      return { success: true, data: data as V2AppConfig };
    }
    return { success: false, errors: [{ path: [], message: 'Invalid v2 config' }] };
  },
};

const schemaV3: VersionedSchema<V3AppConfig> = {
  version: '3.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'version' in data &&
      data.version === '3.0.0' &&
      'name' in data &&
      'server' in data &&
      'features' in data
    ) {
      return { success: true, data: data as V3AppConfig };
    }
    return { success: false, errors: [{ path: [], message: 'Invalid v3 config' }] };
  },
};

// Migrations
const migrationV1toV2: ReversibleMigration<V1AppConfig, V2AppConfig> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data: V1AppConfig, _ctx: MigrationContext) => ({
    version: '2.0.0',
    name: data.name,
    server: {
      port: data.port,
      host: 'localhost',
    },
  }),
  down: (data: V2AppConfig, _ctx: MigrationContext) => ({
    version: '1.0.0',
    name: data.name,
    port: data.server.port,
  }),
};

const migrationV2toV3: ReversibleMigration<V2AppConfig, V3AppConfig> = {
  fromVersion: '2.0.0',
  toVersion: '3.0.0',
  up: (data: V2AppConfig, _ctx: MigrationContext) => ({
    version: '3.0.0',
    name: data.name,
    server: data.server,
    features: {
      auth: true,
      logging: true,
    },
  }),
  down: (data: V3AppConfig, _ctx: MigrationContext) => ({
    version: '2.0.0',
    name: data.name,
    server: data.server,
  }),
};

let testDir: string;
let configPath: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `migrex-integration-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
  configPath = join(testDir, 'app.config.json');
});

afterEach(async () => {
  try {
    await rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe('Integration: Full workflow', () => {
  it('should handle complete lifecycle: save v1 -> load as v3', async () => {
    // Set up graph
    const graph = createMigrationGraph({
      id: 'app-config',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerSchema(schemaV3);
    graph.registerMigration(migrationV1toV2);
    graph.registerMigration(migrationV2toV3);

    // Step 1: Save a v1 config
    const v1Config: V1AppConfig = {
      version: '1.0.0',
      name: 'My App',
      port: 3000,
    };

    await saveVersionedFile(graph, configPath, v1Config);

    // Step 2: Load it and auto-migrate to v3
    const result = await loadVersionedFile<V3AppConfig>(graph, configPath, {
      targetVersion: '3.0.0',
    });

    // Verify migration occurred
    expect(result.wasUpgraded).toBe(true);
    expect(result.sourceVersion).toBe('1.0.0');
    expect(result.targetVersion).toBe('3.0.0');
    expect(result.migrationPath?.steps).toHaveLength(2);

    // Verify data is correct
    expect(result.data).toEqual({
      version: '3.0.0',
      name: 'My App',
      server: {
        port: 3000,
        host: 'localhost',
      },
      features: {
        auth: true,
        logging: true,
      },
    });
  });

  it('should handle saving and loading without migration', async () => {
    const graph = createMigrationGraph({
      id: 'app-config',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(schemaV2);

    const config: V2AppConfig = {
      version: '2.0.0',
      name: 'Test App',
      server: {
        port: 8080,
        host: '0.0.0.0',
      },
    };

    // Save v2
    await saveVersionedFile(graph, configPath, config);

    // Load v2 (no migration)
    const result = await loadVersionedFile<V2AppConfig>(graph, configPath, {
      targetVersion: '2.0.0',
    });

    expect(result.wasUpgraded).toBe(false);
    expect(result.sourceVersion).toBe('2.0.0');
    expect(result.targetVersion).toBe('2.0.0');
    expect(result.data).toEqual(config);
  });

  it('should handle multi-version upgrade path', async () => {
    const graph = createMigrationGraph({
      id: 'app-config',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerSchema(schemaV3);
    graph.registerMigration(migrationV1toV2);
    graph.registerMigration(migrationV2toV3);

    // Start with v1
    const v1Config: V1AppConfig = {
      version: '1.0.0',
      name: 'Legacy App',
      port: 9000,
    };

    await saveVersionedFile(graph, configPath, v1Config);

    // First migration: v1 -> v2
    let result = await loadVersionedFile<V2AppConfig>(graph, configPath, {
      targetVersion: '2.0.0',
    });

    expect(result.data.version).toBe('2.0.0');
    expect(result.data.server.port).toBe(9000);
    expect(result.data.server.host).toBe('localhost');

    // Save the v2 config
    await saveVersionedFile(graph, configPath, result.data);

    // Second migration: v2 -> v3
    result = await loadVersionedFile<V3AppConfig>(graph, configPath, {
      targetVersion: '3.0.0',
    });

    expect(result.data.version).toBe('3.0.0');
    expect(result.data.features).toEqual({
      auth: true,
      logging: true,
    });
  });

  it('should preserve config structure through round-trip', async () => {
    const graph = createMigrationGraph({
      id: 'app-config',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(schemaV3);

    const originalConfig: V3AppConfig = {
      version: '3.0.0',
      name: 'Production App',
      server: {
        port: 443,
        host: 'example.com',
      },
      features: {
        auth: true,
        logging: false,
      },
    };

    // Save
    await saveVersionedFile(graph, configPath, originalConfig);

    // Load
    const result = await loadVersionedFile<V3AppConfig>(graph, configPath, {
      targetVersion: '3.0.0',
    });

    // Should be identical
    expect(result.data).toEqual(originalConfig);
  });
});

describe('Integration: YAML workflow', () => {
  it('should handle complete lifecycle: save YAML v1 -> load as v3', async () => {
    // Set up graph
    const graph = createMigrationGraph({
      id: 'app-config',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerSchema(schemaV3);
    graph.registerMigration(migrationV1toV2);
    graph.registerMigration(migrationV2toV3);

    const yamlPath = join(testDir, 'app.config.yaml');

    // Save v1 config as YAML
    const v1Config: V1AppConfig = {
      version: '1.0.0',
      name: 'YAML Integration Test',
      port: 3000,
    };
    await saveVersionedFile(graph, yamlPath, v1Config);

    // Load and auto-migrate to v3
    const result = await loadVersionedFile<V3AppConfig>(graph, yamlPath, {
      targetVersion: '3.0.0',
    });

    // Verify migration occurred
    expect(result.wasUpgraded).toBe(true);
    expect(result.sourceVersion).toBe('1.0.0');
    expect(result.targetVersion).toBe('3.0.0');
    expect(result.migrationPath?.steps).toHaveLength(2);

    // Verify data is correct
    expect(result.data).toEqual({
      version: '3.0.0',
      name: 'YAML Integration Test',
      server: {
        port: 3000,
        host: 'localhost',
      },
      features: {
        auth: true,
        logging: true,
      },
    });
  });
});

describe('Integration: TOML workflow', () => {
  it('should handle complete lifecycle: save TOML v1 -> load as v3', async () => {
    // Set up graph
    const graph = createMigrationGraph({
      id: 'app-config',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerSchema(schemaV3);
    graph.registerMigration(migrationV1toV2);
    graph.registerMigration(migrationV2toV3);

    const tomlPath = join(testDir, 'app.config.toml');

    // Save v1 config as TOML
    const v1Config: V1AppConfig = {
      version: '1.0.0',
      name: 'TOML Integration Test',
      port: 3000,
    };
    await saveVersionedFile(graph, tomlPath, v1Config);

    // Load and auto-migrate to v3
    const result = await loadVersionedFile<V3AppConfig>(graph, tomlPath, {
      targetVersion: '3.0.0',
    });

    // Verify migration occurred
    expect(result.wasUpgraded).toBe(true);
    expect(result.sourceVersion).toBe('1.0.0');
    expect(result.targetVersion).toBe('3.0.0');
    expect(result.migrationPath?.steps).toHaveLength(2);

    // Verify data is correct
    expect(result.data).toEqual({
      version: '3.0.0',
      name: 'TOML Integration Test',
      server: {
        port: 3000,
        host: 'localhost',
      },
      features: {
        auth: true,
        logging: true,
      },
    });
  });
});
