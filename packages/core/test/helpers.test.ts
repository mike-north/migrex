import { describe, it, expect } from 'vitest';
import {
  addField,
  removeField,
  renameField,
  restructure,
} from '../src/helpers/index.js';
import { createMigrationGraph } from '../src/graph.js';
import { semverStrategy } from '../src/strategies/index.js';
import { createMigrationContext } from '../src/context.js';
import type { VersionedSchema } from '../src/types.js';

// ============================================================================
// Test Data Types
// ============================================================================

type V1Simple = { version: string; name: string; email: string };
type V2WithLogLevel = {
  version: string;
  name: string;
  email: string;
  logLevel: string;
};

type V1WithDeprecated = {
  version: string;
  name: string;
  deprecated: string;
};
type V2WithoutDeprecated = { version: string; name: string };

type V1SnakeCase = { version: string; user_name: string };
type V2CamelCase = { version: string; userName: string };

type V1Flat = {
  version: string;
  appName: string;
  appVersion: string;
  port: number;
  host: string;
};

type V2Nested = {
  version: string;
  app: {
    name: string;
    version: string;
  };
  server: {
    port: number;
    host: string;
  };
};

// ============================================================================
// Helper: Create Simple Schema
// ============================================================================

function createSimpleSchema<T>(version: string): VersionedSchema<T> {
  return {
    version,
    schema: (data) => {
      if (
        typeof data === 'object' &&
        data !== null &&
        'version' in data &&
        data.version === version
      ) {
        return { success: true, data: data as T };
      }
      return {
        success: false,
        errors: [{ path: [], message: `Invalid data for version ${version}` }],
      };
    },
  };
}

// ============================================================================
// Tests: addField
// ============================================================================

describe('addField', () => {
  it('should add a field with default value in up migration', () => {
    const migration = addField<V1Simple, V2WithLogLevel, 'logLevel'>({
      from: '1.0.0',
      to: '1.1.0',
      field: 'logLevel',
      defaultValue: 'info',
    });

    const ctx = createMigrationContext({
      from: '1.0.0',
      to: '1.1.0',
      direction: 'up',
      index: 0,
      totalSteps: 1,
    });

    const input: V1Simple = {
      version: '1.0.0',
      name: 'Alice',
      email: 'alice@example.com',
    };

    const result = migration.up(input, ctx);

    expect(result).toEqual({
      version: '1.1.0',
      name: 'Alice',
      email: 'alice@example.com',
      logLevel: 'info',
    });
  });

  it('should remove the added field in down migration', () => {
    const migration = addField<V1Simple, V2WithLogLevel, 'logLevel'>({
      from: '1.0.0',
      to: '1.1.0',
      field: 'logLevel',
      defaultValue: 'info',
    });

    const ctx = createMigrationContext({
      from: '1.1.0',
      to: '1.0.0',
      direction: 'down',
      index: 0,
      totalSteps: 1,
    });

    const input: V2WithLogLevel = {
      version: '1.1.0',
      name: 'Alice',
      email: 'alice@example.com',
      logLevel: 'debug', // Note: different from default
    };

    const result = migration.down(input, ctx);

    expect(result).toEqual({
      version: '1.0.0',
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('should mark down migration as lossy', () => {
    const migration = addField<V1Simple, V2WithLogLevel, 'logLevel'>({
      from: '1.0.0',
      to: '1.1.0',
      field: 'logLevel',
      defaultValue: 'info',
    });

    expect(migration.traits?.down?.lossy).toBe(
      "Field 'logLevel' is removed and cannot be restored"
    );
  });

  it('should work with a migration graph', () => {
    const graph = createMigrationGraph({
      id: 'test-add-field',
      versionStrategy: semverStrategy,
    });

    const schemaV1 = createSimpleSchema<V1Simple>('1.0.0');
    const schemaV2 = createSimpleSchema<V2WithLogLevel>('1.1.0');

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);

    const migration = addField<V1Simple, V2WithLogLevel, 'logLevel'>({
      from: '1.0.0',
      to: '1.1.0',
      field: 'logLevel',
      defaultValue: 'warn',
    });

    graph.registerMigration(migration);

    const input: V1Simple = {
      version: '1.0.0',
      name: 'Bob',
      email: 'bob@example.com',
    };

    const result = graph.migrate(input, '1.0.0', '1.1.0');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      version: '1.1.0',
      name: 'Bob',
      email: 'bob@example.com',
      logLevel: 'warn',
    });
  });
});

// ============================================================================
// Tests: removeField
// ============================================================================

describe('removeField', () => {
  it('should remove a field in up migration', () => {
    const migration = removeField<
      V1WithDeprecated,
      V2WithoutDeprecated,
      'deprecated'
    >({
      from: '1.0.0',
      to: '1.1.0',
      field: 'deprecated',
    });

    const ctx = createMigrationContext({
      from: '1.0.0',
      to: '1.1.0',
      direction: 'up',
      index: 0,
      totalSteps: 1,
    });

    const input: V1WithDeprecated = {
      version: '1.0.0',
      name: 'Alice',
      deprecated: 'old-value',
    };

    const result = migration.up(input, ctx);

    expect(result).toEqual({
      version: '1.1.0',
      name: 'Alice',
    });
  });

  it('should not restore field in down migration without preservation', () => {
    const migration = removeField<
      V1WithDeprecated,
      V2WithoutDeprecated,
      'deprecated'
    >({
      from: '1.0.0',
      to: '1.1.0',
      field: 'deprecated',
    });

    const ctx = createMigrationContext({
      from: '1.1.0',
      to: '1.0.0',
      direction: 'down',
      index: 0,
      totalSteps: 1,
    });

    const input: V2WithoutDeprecated = {
      version: '1.1.0',
      name: 'Alice',
    };

    const result = migration.down(input, ctx);

    expect(result).toEqual({
      version: '1.0.0',
      name: 'Alice',
      deprecated: undefined,
    });
  });

  it('should preserve field when preserveAs is specified', () => {
    const migration = removeField<
      V1WithDeprecated,
      V2WithoutDeprecated,
      'deprecated'
    >({
      from: '1.0.0',
      to: '1.1.0',
      field: 'deprecated',
      preserveAs: 'old.deprecated',
    });

    const ctx = createMigrationContext({
      from: '1.0.0',
      to: '1.1.0',
      direction: 'up',
      index: 0,
      totalSteps: 1,
    });

    const input: V1WithDeprecated = {
      version: '1.0.0',
      name: 'Alice',
      deprecated: 'preserved-value',
    };

    migration.up(input, ctx);

    expect(ctx.hasPreserved('old.deprecated')).toBe(true);
    const preserved = ctx.peek('old.deprecated');
    expect(preserved?.kind).toBe('single');
    if (preserved?.kind === 'single') {
      expect(preserved.value).toBe('preserved-value');
    }
  });

  it('should restore preserved field in down migration', () => {
    const migration = removeField<
      V1WithDeprecated,
      V2WithoutDeprecated,
      'deprecated'
    >({
      from: '1.0.0',
      to: '1.1.0',
      field: 'deprecated',
      preserveAs: 'old.deprecated',
    });

    // First migrate up and preserve
    const ctxUp = createMigrationContext({
      from: '1.0.0',
      to: '1.1.0',
      direction: 'up',
      index: 0,
      totalSteps: 1,
    });

    const input: V1WithDeprecated = {
      version: '1.0.0',
      name: 'Alice',
      deprecated: 'restored-value',
    };

    const upResult = migration.up(input, ctxUp);

    // Now migrate down with the preserved context
    const ctxDown = createMigrationContext(
      {
        from: '1.1.0',
        to: '1.0.0',
        direction: 'down',
        index: 0,
        totalSteps: 1,
      },
      ctxUp.listPreserved()
    );

    const result = migration.down(upResult, ctxDown);

    expect(result).toEqual({
      version: '1.0.0',
      name: 'Alice',
      deprecated: 'restored-value',
    });
  });

  it('should mark migrations as lossy when not preserving', () => {
    const migration = removeField<
      V1WithDeprecated,
      V2WithoutDeprecated,
      'deprecated'
    >({
      from: '1.0.0',
      to: '1.1.0',
      field: 'deprecated',
    });

    expect(migration.traits?.up?.lossy).toBe(
      "Field 'deprecated' is removed and not preserved"
    );
    expect(migration.traits?.down?.lossy).toBe(
      "Field 'deprecated' cannot be restored (was not preserved)"
    );
  });

  it('should not mark migrations as lossy when preserving', () => {
    const migration = removeField<
      V1WithDeprecated,
      V2WithoutDeprecated,
      'deprecated'
    >({
      from: '1.0.0',
      to: '1.1.0',
      field: 'deprecated',
      preserveAs: 'old.deprecated',
    });

    expect(migration.traits?.up?.lossy).toBe(false);
    expect(migration.traits?.down?.lossy).toBe(false);
  });
});

// ============================================================================
// Tests: renameField
// ============================================================================

describe('renameField', () => {
  it('should rename field in up migration', () => {
    const migration = renameField<V1SnakeCase, V2CamelCase>({
      from: '1.0.0',
      to: '2.0.0',
      oldName: 'user_name',
      newName: 'userName',
    });

    const ctx = createMigrationContext({
      from: '1.0.0',
      to: '2.0.0',
      direction: 'up',
      index: 0,
      totalSteps: 1,
    });

    const input: V1SnakeCase = {
      version: '1.0.0',
      user_name: 'alice_smith',
    };

    const result = migration.up(input, ctx);

    expect(result).toEqual({
      version: '2.0.0',
      userName: 'alice_smith',
    });
  });

  it('should restore original field name in down migration', () => {
    const migration = renameField<V1SnakeCase, V2CamelCase>({
      from: '1.0.0',
      to: '2.0.0',
      oldName: 'user_name',
      newName: 'userName',
    });

    const ctx = createMigrationContext({
      from: '2.0.0',
      to: '1.0.0',
      direction: 'down',
      index: 0,
      totalSteps: 1,
    });

    const input: V2CamelCase = {
      version: '2.0.0',
      userName: 'bob_jones',
    };

    const result = migration.down(input, ctx);

    expect(result).toEqual({
      version: '1.0.0',
      user_name: 'bob_jones',
    });
  });

  it('should preserve field value through round-trip', () => {
    const migration = renameField<V1SnakeCase, V2CamelCase>({
      from: '1.0.0',
      to: '2.0.0',
      oldName: 'user_name',
      newName: 'userName',
    });

    const ctxUp = createMigrationContext({
      from: '1.0.0',
      to: '2.0.0',
      direction: 'up',
      index: 0,
      totalSteps: 1,
    });

    const ctxDown = createMigrationContext({
      from: '2.0.0',
      to: '1.0.0',
      direction: 'down',
      index: 0,
      totalSteps: 1,
    });

    const original: V1SnakeCase = {
      version: '1.0.0',
      user_name: 'test_user',
    };

    const upgraded = migration.up(original, ctxUp);
    const downgraded = migration.down(upgraded, ctxDown);

    expect(downgraded).toEqual(original);
  });

  it('should not have lossy traits', () => {
    const migration = renameField<V1SnakeCase, V2CamelCase>({
      from: '1.0.0',
      to: '2.0.0',
      oldName: 'user_name',
      newName: 'userName',
    });

    expect(migration.traits?.up?.lossy).toBeUndefined();
    expect(migration.traits?.down?.lossy).toBeUndefined();
  });

  it('should work with a migration graph', () => {
    const graph = createMigrationGraph({
      id: 'test-rename-field',
      versionStrategy: semverStrategy,
    });

    const schemaV1 = createSimpleSchema<V1SnakeCase>('1.0.0');
    const schemaV2 = createSimpleSchema<V2CamelCase>('2.0.0');

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);

    const migration = renameField<V1SnakeCase, V2CamelCase>({
      from: '1.0.0',
      to: '2.0.0',
      oldName: 'user_name',
      newName: 'userName',
    });

    graph.registerMigration(migration);

    const input: V1SnakeCase = {
      version: '1.0.0',
      user_name: 'charlie',
    };

    const result = graph.migrate(input, '1.0.0', '2.0.0');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      version: '2.0.0',
      userName: 'charlie',
    });
  });
});

// ============================================================================
// Tests: restructure
// ============================================================================

describe('restructure', () => {
  it('should convert flat structure to nested in up migration', () => {
    const migration = restructure<V1Flat, V2Nested>({
      from: '1.0.0',
      to: '2.0.0',
      transform: {
        'app.name': 'appName',
        'app.version': 'appVersion',
        'server.port': 'port',
        'server.host': 'host',
      },
    });

    const ctx = createMigrationContext({
      from: '1.0.0',
      to: '2.0.0',
      direction: 'up',
      index: 0,
      totalSteps: 1,
    });

    const input: V1Flat = {
      version: '1.0.0',
      appName: 'MyApp',
      appVersion: '3.2.1',
      port: 8080,
      host: 'localhost',
    };

    const result = migration.up(input, ctx);

    expect(result).toEqual({
      version: '2.0.0',
      app: {
        name: 'MyApp',
        version: '3.2.1',
      },
      server: {
        port: 8080,
        host: 'localhost',
      },
    });
  });

  it('should convert nested structure to flat in down migration', () => {
    const migration = restructure<V1Flat, V2Nested>({
      from: '1.0.0',
      to: '2.0.0',
      transform: {
        'app.name': 'appName',
        'app.version': 'appVersion',
        'server.port': 'port',
        'server.host': 'host',
      },
    });

    const ctx = createMigrationContext({
      from: '2.0.0',
      to: '1.0.0',
      direction: 'down',
      index: 0,
      totalSteps: 1,
    });

    const input: V2Nested = {
      version: '2.0.0',
      app: {
        name: 'MyApp',
        version: '3.2.1',
      },
      server: {
        port: 8080,
        host: 'localhost',
      },
    };

    const result = migration.down(input, ctx);

    expect(result).toEqual({
      version: '1.0.0',
      appName: 'MyApp',
      appVersion: '3.2.1',
      port: 8080,
      host: 'localhost',
    });
  });

  it('should preserve values through round-trip', () => {
    const migration = restructure<V1Flat, V2Nested>({
      from: '1.0.0',
      to: '2.0.0',
      transform: {
        'app.name': 'appName',
        'app.version': 'appVersion',
        'server.port': 'port',
        'server.host': 'host',
      },
    });

    const ctxUp = createMigrationContext({
      from: '1.0.0',
      to: '2.0.0',
      direction: 'up',
      index: 0,
      totalSteps: 1,
    });

    const ctxDown = createMigrationContext({
      from: '2.0.0',
      to: '1.0.0',
      direction: 'down',
      index: 0,
      totalSteps: 1,
    });

    const original: V1Flat = {
      version: '1.0.0',
      appName: 'TestApp',
      appVersion: '1.2.3',
      port: 3000,
      host: '0.0.0.0',
    };

    const upgraded = migration.up(original, ctxUp);
    const downgraded = migration.down(upgraded, ctxDown);

    expect(downgraded).toEqual(original);
  });

  it('should mark migrations as restructuring', () => {
    const migration = restructure<V1Flat, V2Nested>({
      from: '1.0.0',
      to: '2.0.0',
      transform: {
        'app.name': 'appName',
        'app.version': 'appVersion',
        'server.port': 'port',
        'server.host': 'host',
      },
    });

    expect(migration.traits?.up?.restructures).toBe(
      'Converts flat structure to nested hierarchy'
    );
    expect(migration.traits?.down?.restructures).toBe(
      'Converts nested hierarchy to flat structure'
    );
  });

  it('should work with a migration graph', () => {
    const graph = createMigrationGraph({
      id: 'test-restructure',
      versionStrategy: semverStrategy,
    });

    const schemaV1 = createSimpleSchema<V1Flat>('1.0.0');
    const schemaV2 = createSimpleSchema<V2Nested>('2.0.0');

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);

    const migration = restructure<V1Flat, V2Nested>({
      from: '1.0.0',
      to: '2.0.0',
      transform: {
        'app.name': 'appName',
        'app.version': 'appVersion',
        'server.port': 'port',
        'server.host': 'host',
      },
    });

    graph.registerMigration(migration);

    const input: V1Flat = {
      version: '1.0.0',
      appName: 'GraphTest',
      appVersion: '5.0.0',
      port: 9000,
      host: '127.0.0.1',
    };

    const result = graph.migrate(input, '1.0.0', '2.0.0');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      version: '2.0.0',
      app: {
        name: 'GraphTest',
        version: '5.0.0',
      },
      server: {
        port: 9000,
        host: '127.0.0.1',
      },
    });
  });

  it('should reject prototype pollution attempts in transform paths', () => {
    expect(() =>
      restructure({
        from: '1.0.0',
        to: '2.0.0',
        transform: {
          '__proto__.polluted': 'value',
        },
      })
    ).toThrow('forbidden for security reasons');

    expect(() =>
      restructure({
        from: '1.0.0',
        to: '2.0.0',
        transform: {
          'constructor.prototype.polluted': 'value',
        },
      })
    ).toThrow('forbidden for security reasons');

    expect(() =>
      restructure({
        from: '1.0.0',
        to: '2.0.0',
        transform: {
          'nested.__proto__.polluted': 'value',
        },
      })
    ).toThrow('forbidden for security reasons');
  });

  it('should handle deeply nested paths', () => {
    type V1DeepFlat = {
      version: string;
      configValue: string;
    };

    type V2DeepNested = {
      version: string;
      system: {
        config: {
          advanced: {
            value: string;
          };
        };
      };
    };

    const migration = restructure<V1DeepFlat, V2DeepNested>({
      from: '1.0.0',
      to: '2.0.0',
      transform: {
        'system.config.advanced.value': 'configValue',
      },
    });

    const ctx = createMigrationContext({
      from: '1.0.0',
      to: '2.0.0',
      direction: 'up',
      index: 0,
      totalSteps: 1,
    });

    const input: V1DeepFlat = {
      version: '1.0.0',
      configValue: 'deep-value',
    };

    const result = migration.up(input, ctx);

    expect(result).toEqual({
      version: '2.0.0',
      system: {
        config: {
          advanced: {
            value: 'deep-value',
          },
        },
      },
    });
  });
});

// ============================================================================
// Tests: Chaining Helpers
// ============================================================================

describe('chaining helpers', () => {
  type V1 = { version: string; old_name: string };
  type V2 = { version: string; name: string };
  type V3 = { version: string; name: string; role: string };

  it('should chain renameField and addField', () => {
    const graph = createMigrationGraph({
      id: 'test-chaining',
      versionStrategy: semverStrategy,
    });

    const schemaV1 = createSimpleSchema<V1>('1.0.0');
    const schemaV2 = createSimpleSchema<V2>('2.0.0');
    const schemaV3 = createSimpleSchema<V3>('3.0.0');

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerSchema(schemaV3);

    // Migration 1: Rename old_name to name
    const migration1 = renameField<V1, V2>({
      from: '1.0.0',
      to: '2.0.0',
      oldName: 'old_name',
      newName: 'name',
    });

    // Migration 2: Add role field
    const migration2 = addField<V2, V3, 'role'>({
      from: '2.0.0',
      to: '3.0.0',
      field: 'role',
      defaultValue: 'user',
    });

    graph.registerMigration(migration1);
    graph.registerMigration(migration2);

    const input: V1 = {
      version: '1.0.0',
      old_name: 'Alice',
    };

    const result = graph.migrate(input, '1.0.0', '3.0.0');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      version: '3.0.0',
      name: 'Alice',
      role: 'user',
    });
  });

  it('should chain all helpers together', () => {
    type Step1 = { version: string; user_name: string; deprecated: string };
    type Step2 = { version: string; userName: string; deprecated: string };
    type Step3 = { version: string; userName: string };
    type Step4 = { version: string; userName: string; status: string };

    const graph = createMigrationGraph({
      id: 'test-chaining-all',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(createSimpleSchema<Step1>('1.0.0'));
    graph.registerSchema(createSimpleSchema<Step2>('2.0.0'));
    graph.registerSchema(createSimpleSchema<Step3>('3.0.0'));
    graph.registerSchema(createSimpleSchema<Step4>('4.0.0'));

    // Step 1→2: Rename user_name to userName
    graph.registerMigration(
      renameField<Step1, Step2>({
        from: '1.0.0',
        to: '2.0.0',
        oldName: 'user_name',
        newName: 'userName',
      })
    );

    // Step 2→3: Remove deprecated field
    graph.registerMigration(
      removeField<Step2, Step3, 'deprecated'>({
        from: '2.0.0',
        to: '3.0.0',
        field: 'deprecated',
      })
    );

    // Step 3→4: Add status field
    graph.registerMigration(
      addField<Step3, Step4, 'status'>({
        from: '3.0.0',
        to: '4.0.0',
        field: 'status',
        defaultValue: 'active',
      })
    );

    const input: Step1 = {
      version: '1.0.0',
      user_name: 'Bob',
      deprecated: 'old-stuff',
    };

    const result = graph.migrate(input, '1.0.0', '4.0.0');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      version: '4.0.0',
      userName: 'Bob',
      status: 'active',
    });
  });
});
