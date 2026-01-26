/**
 * Migration definitions between configuration versions
 *
 * This file demonstrates bidirectional migrations with field preservation.
 */

import type { ReversibleMigration, MigrationContext } from '@migrex/core';
import type { ConfigV1, ConfigV2, ConfigV3, ConfigV4 } from './schemas.js';

// ============================================================================
// v1.0.0 <-> v2.0.0: Add structured logging
// ============================================================================

export const migrationV1ToV2: ReversibleMigration<ConfigV1, ConfigV2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',

  up(data: ConfigV1, _ctx: MigrationContext): ConfigV2 {
    // Add default logging configuration based on debug flag
    return {
      version: '2.0.0',
      appName: data.appName,
      port: data.port,
      debug: data.debug,
      logging: {
        level: data.debug ? 'debug' : 'info',
        output: 'console',
      },
    };
  },

  down(data: ConfigV2, _ctx: MigrationContext): ConfigV1 {
    // Logging config is lost when downgrading - this is expected
    return {
      version: '1.0.0',
      appName: data.appName,
      port: data.port,
      debug: data.debug,
    };
  },
};

// ============================================================================
// v2.0.0 <-> v3.0.0: Rename debug -> verbose, add features array
// ============================================================================

export const migrationV2ToV3: ReversibleMigration<ConfigV2, ConfigV3> = {
  fromVersion: '2.0.0',
  toVersion: '3.0.0',

  up(data: ConfigV2, _ctx: MigrationContext): ConfigV3 {
    return {
      version: '3.0.0',
      appName: data.appName,
      port: data.port,
      verbose: data.debug, // rename debug -> verbose
      logging: data.logging,
      features: [], // new field starts empty
    };
  },

  down(data: ConfigV3, _ctx: MigrationContext): ConfigV2 {
    // Note: features array is lost when downgrading
    return {
      version: '2.0.0',
      appName: data.appName,
      port: data.port,
      debug: data.verbose, // rename back verbose -> debug
      logging: data.logging,
    };
  },
};

// ============================================================================
// v3.0.0 <-> v4.0.0: Add metrics configuration
// ============================================================================

export const migrationV3ToV4: ReversibleMigration<ConfigV3, ConfigV4> = {
  fromVersion: '3.0.0',
  toVersion: '4.0.0',

  up(data: ConfigV3, _ctx: MigrationContext): ConfigV4 {
    return {
      version: '4.0.0',
      appName: data.appName,
      port: data.port,
      verbose: data.verbose,
      logging: data.logging,
      metrics: {
        enabled: false, // default to disabled
        port: 9090, // standard metrics port
      },
      features: data.features,
    };
  },

  down(data: ConfigV4, _ctx: MigrationContext): ConfigV3 {
    // Metrics configuration is lost when downgrading
    return {
      version: '3.0.0',
      appName: data.appName,
      port: data.port,
      verbose: data.verbose,
      logging: data.logging,
      features: data.features,
    };
  },
};
