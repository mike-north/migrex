import { describe, it, expect } from 'vitest';
import { createMigrationGraph, semverStrategy } from '@migrex/core';
import { fromZod } from '@migrex/zod';
import { z } from 'zod';
import type {
  ReversibleMigration,
  MigrationContext,
} from '@migrex/core';

/**
 * This test demonstrates field preservation across migrations.
 *
 * Scenario: A "theme" field exists in v1, is removed in v2 (to simplify),
 * but is restored in v3 (due to user demand).
 *
 * Without preservation, migrating v1 -> v2 -> v3 would lose the theme value.
 * With preservation, the theme is saved in v2 and restored in v3.
 */

// Version 1: Has a theme field
const ThemeV1Schema = z.object({
  version: z.literal('1.0.0'),
  appName: z.string(),
  theme: z.enum(['light', 'dark', 'auto']),
});
type ThemeV1 = z.infer<typeof ThemeV1Schema>;

const schemaV1 = fromZod('1.0.0', ThemeV1Schema);

// Version 2: Theme removed (temporarily)
const ThemeV2Schema = z.object({
  version: z.literal('2.0.0'),
  appName: z.string(),
});
type ThemeV2 = z.infer<typeof ThemeV2Schema>;

const schemaV2 = fromZod('2.0.0', ThemeV2Schema);

// Version 3: Theme restored
const ThemeV3Schema = z.object({
  version: z.literal('3.0.0'),
  appName: z.string(),
  theme: z.enum(['light', 'dark', 'auto']),
});
type ThemeV3 = z.infer<typeof ThemeV3Schema>;

const schemaV3 = fromZod('3.0.0', ThemeV3Schema);

// Migration v1 -> v2: Preserve the theme
const migrationV1ToV2: ReversibleMigration<ThemeV1, ThemeV2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',

  up(data: ThemeV1, ctx: MigrationContext): ThemeV2 {
    // Preserve theme for potential restoration in v3
    ctx.preserve('theme', data.theme, {
      requiredForVersion: '3.0.0',
      reason: 'Theme preference is restored in v3',
    });

    return {
      version: '2.0.0',
      appName: data.appName,
    };
  },

  down(data: ThemeV2, ctx: MigrationContext): ThemeV1 {
    // Restore theme when migrating back to v1
    const preserved = ctx.consume('theme');
    const theme =
      preserved?.kind === 'single'
        ? (preserved.value as ThemeV1['theme'])
        : 'light'; // fallback

    return {
      version: '1.0.0',
      appName: data.appName,
      theme,
    };
  },
};

// Migration v2 -> v3: Restore the theme
const migrationV2ToV3: ReversibleMigration<ThemeV2, ThemeV3> = {
  fromVersion: '2.0.0',
  toVersion: '3.0.0',

  up(data: ThemeV2, ctx: MigrationContext): ThemeV3 {
    // Consume the preserved theme
    const preserved = ctx.consume('theme');
    const theme =
      preserved?.kind === 'single'
        ? (preserved.value as ThemeV3['theme'])
        : 'light'; // fallback

    return {
      version: '3.0.0',
      appName: data.appName,
      theme,
    };
  },

  down(data: ThemeV3, ctx: MigrationContext): ThemeV2 {
    // Preserve theme when migrating back through v2
    ctx.preserve('theme', data.theme, {
      requiredForVersion: '1.0.0',
      reason: 'Theme preference exists in v1',
    });

    return {
      version: '2.0.0',
      appName: data.appName,
    };
  },
};

describe('Field Preservation', () => {
  it('should preserve theme field across v1 -> v2 -> v3 migration', () => {
    const graph = createMigrationGraph({
      id: 'theme-test',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerSchema(schemaV3);
    graph.registerMigration(migrationV1ToV2);
    graph.registerMigration(migrationV2ToV3);

    const v1Config: ThemeV1 = {
      version: '1.0.0',
      appName: 'Theme Test App',
      theme: 'dark',
    };

    // Migrate from v1 to v3 (through v2)
    const result = graph.migrate<ThemeV3>(v1Config, '1.0.0', '3.0.0');

    expect(result.success).toBe(true);
    if (result.success) {
      // The theme should be preserved!
      expect(result.data.version).toBe('3.0.0');
      expect(result.data.appName).toBe('Theme Test App');
      expect(result.data.theme).toBe('dark');

      // Check stash summary
      expect(result.stash.consumed).toHaveLength(1);
      expect(result.stash.consumed[0]?.path).toBe('theme');
      expect(result.stash.unconsumed).toHaveLength(0);
      expect(result.stash.lossless).toBe(true);
    }
  });

  it('should preserve theme when migrating back v3 -> v2 -> v1', () => {
    const graph = createMigrationGraph({
      id: 'theme-test-reverse',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerSchema(schemaV3);
    graph.registerMigration(migrationV1ToV2);
    graph.registerMigration(migrationV2ToV3);

    const v3Config: ThemeV3 = {
      version: '3.0.0',
      appName: 'Reverse Migration',
      theme: 'auto',
    };

    // Migrate from v3 to v1 (through v2)
    const result = graph.migrate<ThemeV1>(v3Config, '3.0.0', '1.0.0');

    expect(result.success).toBe(true);
    if (result.success) {
      // The theme should be preserved!
      expect(result.data.version).toBe('1.0.0');
      expect(result.data.appName).toBe('Reverse Migration');
      expect(result.data.theme).toBe('auto');

      // Check stash summary
      expect(result.stash.consumed).toHaveLength(1);
      expect(result.stash.consumed[0]?.path).toBe('theme');
      expect(result.stash.unconsumed).toHaveLength(0);
      expect(result.stash.lossless).toBe(true);
    }
  });

  it('should show preserved field metadata', () => {
    const graph = createMigrationGraph({
      id: 'theme-test-metadata',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerSchema(schemaV3);
    graph.registerMigration(migrationV1ToV2);
    graph.registerMigration(migrationV2ToV3);

    const v1Config: ThemeV1 = {
      version: '1.0.0',
      appName: 'Metadata Test',
      theme: 'light',
    };

    const result = graph.migrate<ThemeV3>(v1Config, '1.0.0', '3.0.0');

    expect(result.success).toBe(true);
    if (result.success) {
      // Check that we have consumed field metadata
      const consumedField = result.stash.consumed[0];
      expect(consumedField).toBeDefined();
      expect(consumedField?.path).toBe('theme');
      expect(consumedField?.consumedAt).toBe('3.0.0');
    }
  });

  it('should use fallback when theme is not preserved', () => {
    const graph = createMigrationGraph({
      id: 'theme-test-fallback',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(schemaV2);
    graph.registerSchema(schemaV3);
    graph.registerMigration(migrationV2ToV3);

    // Start with v2 (no theme preserved)
    const v2Config: ThemeV2 = {
      version: '2.0.0',
      appName: 'Fallback Test',
    };

    const result = graph.migrate<ThemeV3>(v2Config, '2.0.0', '3.0.0');

    expect(result.success).toBe(true);
    if (result.success) {
      // Should use the fallback value
      expect(result.data.theme).toBe('light');

      // No fields were consumed (because none were preserved)
      expect(result.stash.consumed).toHaveLength(0);
      expect(result.stash.unconsumed).toHaveLength(0);
      expect(result.stash.lossless).toBe(true); // Still lossless because nothing was lost
    }
  });

  it('should detect when field is preserved but not consumed', () => {
    const graph = createMigrationGraph({
      id: 'theme-test-unconsumed',
      versionStrategy: semverStrategy,
    });

    graph.registerSchema(schemaV1);
    graph.registerSchema(schemaV2);
    graph.registerMigration(migrationV1ToV2);
    // Note: We're NOT registering v3, so the theme won't be consumed

    const v1Config: ThemeV1 = {
      version: '1.0.0',
      appName: 'Unconsumed Test',
      theme: 'dark',
    };

    const result = graph.migrate<ThemeV2>(v1Config, '1.0.0', '2.0.0');

    expect(result.success).toBe(true);
    if (result.success) {
      // The theme was preserved but not consumed
      expect(result.stash.consumed).toHaveLength(0);
      expect(result.stash.unconsumed).toHaveLength(1);
      expect(result.stash.unconsumed[0]?.path).toBe('theme');
      expect(result.stash.lossless).toBe(false); // Not lossless!
    }
  });
});
