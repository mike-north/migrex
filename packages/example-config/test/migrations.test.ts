import { describe, it, expect } from 'vitest';
import { createConfigGraph, LATEST_VERSION } from '../src/index.js';
import type { ConfigV1, ConfigV2, ConfigV3, ConfigV4 } from '../src/index.js';

describe('Config Migration Graph', () => {
  it('should create a graph with all versions registered', () => {
    const graph = createConfigGraph();
    expect(graph).toBeDefined();
  });

  describe('v1 to v2 migration', () => {
    it('should add default logging configuration', () => {
      const graph = createConfigGraph();

      const v1Config: ConfigV1 = {
        version: '1.0.0',
        appName: 'Test App',
        port: 3000,
        debug: true,
      };

      const result = graph.migrate<ConfigV2>(v1Config, '1.0.0', '2.0.0');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('2.0.0');
        expect(result.data.appName).toBe('Test App');
        expect(result.data.port).toBe(3000);
        expect(result.data.debug).toBe(true);
        expect(result.data.logging).toEqual({
          level: 'debug',
          output: 'console',
        });
      }
    });

    it('should use info level when debug is false', () => {
      const graph = createConfigGraph();

      const v1Config: ConfigV1 = {
        version: '1.0.0',
        appName: 'Test App',
        port: 3000,
        debug: false,
      };

      const result = graph.migrate<ConfigV2>(v1Config, '1.0.0', '2.0.0');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.logging.level).toBe('info');
      }
    });

    it('should migrate back from v2 to v1', () => {
      const graph = createConfigGraph();

      const v2Config: ConfigV2 = {
        version: '2.0.0',
        appName: 'Test App',
        port: 3000,
        debug: true,
        logging: {
          level: 'warn',
          output: 'file',
        },
      };

      const result = graph.migrate<ConfigV1>(v2Config, '2.0.0', '1.0.0');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0.0');
        expect(result.data.appName).toBe('Test App');
        expect(result.data.port).toBe(3000);
        expect(result.data.debug).toBe(true);
        // Logging config should be lost
        expect('logging' in result.data).toBe(false);
      }
    });
  });

  describe('v2 to v3 migration', () => {
    it('should rename debug to verbose and add empty features', () => {
      const graph = createConfigGraph();

      const v2Config: ConfigV2 = {
        version: '2.0.0',
        appName: 'Test App',
        port: 3000,
        debug: true,
        logging: {
          level: 'info',
          output: 'console',
        },
      };

      const result = graph.migrate<ConfigV3>(v2Config, '2.0.0', '3.0.0');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('3.0.0');
        expect(result.data.verbose).toBe(true);
        expect('debug' in result.data).toBe(false);
        expect(result.data.features).toEqual([]);
      }
    });

    it('should migrate back from v3 to v2', () => {
      const graph = createConfigGraph();

      const v3Config: ConfigV3 = {
        version: '3.0.0',
        appName: 'Test App',
        port: 3000,
        verbose: false,
        logging: {
          level: 'error',
          output: 'file',
        },
        features: ['feature-a', 'feature-b'],
      };

      const result = graph.migrate<ConfigV2>(v3Config, '3.0.0', '2.0.0');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('2.0.0');
        expect(result.data.debug).toBe(false);
        expect('verbose' in result.data).toBe(false);
        // Features should be lost
        expect('features' in result.data).toBe(false);
      }
    });
  });

  describe('v3 to v4 migration', () => {
    it('should add default metrics configuration', () => {
      const graph = createConfigGraph();

      const v3Config: ConfigV3 = {
        version: '3.0.0',
        appName: 'Test App',
        port: 3000,
        verbose: true,
        logging: {
          level: 'debug',
          output: 'console',
        },
        features: ['dashboard'],
      };

      const result = graph.migrate<ConfigV4>(v3Config, '3.0.0', '4.0.0');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('4.0.0');
        expect(result.data.metrics).toEqual({
          enabled: false,
          port: 9090,
        });
        expect(result.data.features).toEqual(['dashboard']);
      }
    });

    it('should migrate back from v4 to v3', () => {
      const graph = createConfigGraph();

      const v4Config: ConfigV4 = {
        version: '4.0.0',
        appName: 'Test App',
        port: 3000,
        verbose: true,
        logging: {
          level: 'info',
          output: 'console',
        },
        metrics: {
          enabled: true,
          port: 8080,
        },
        features: [],
      };

      const result = graph.migrate<ConfigV3>(v4Config, '4.0.0', '3.0.0');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('3.0.0');
        // Metrics should be lost
        expect('metrics' in result.data).toBe(false);
      }
    });
  });

  describe('multi-step migrations', () => {
    it('should migrate from v1 to v4 in one call', () => {
      const graph = createConfigGraph();

      const v1Config: ConfigV1 = {
        version: '1.0.0',
        appName: 'My Application',
        port: 8080,
        debug: true,
      };

      const result = graph.migrate<ConfigV4>(v1Config, '1.0.0', '4.0.0');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('4.0.0');
        expect(result.data.appName).toBe('My Application');
        expect(result.data.port).toBe(8080);
        expect(result.data.verbose).toBe(true); // debug -> verbose
        expect(result.data.logging).toEqual({
          level: 'debug',
          output: 'console',
        });
        expect(result.data.metrics).toEqual({
          enabled: false,
          port: 9090,
        });
        expect(result.data.features).toEqual([]);
      }
    });

    it('should migrate from v4 back to v1', () => {
      const graph = createConfigGraph();

      const v4Config: ConfigV4 = {
        version: '4.0.0',
        appName: 'My Application',
        port: 8080,
        verbose: false,
        logging: {
          level: 'warn',
          output: 'file',
        },
        metrics: {
          enabled: true,
          port: 9090,
        },
        features: ['auth', 'analytics'],
      };

      const result = graph.migrate<ConfigV1>(v4Config, '4.0.0', '1.0.0');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0.0');
        expect(result.data.appName).toBe('My Application');
        expect(result.data.port).toBe(8080);
        expect(result.data.debug).toBe(false); // verbose -> debug
        // All advanced features should be lost
        expect('logging' in result.data).toBe(false);
        expect('metrics' in result.data).toBe(false);
        expect('features' in result.data).toBe(false);
        expect('verbose' in result.data).toBe(false);
      }
    });

    it('should support round-trip migration', () => {
      const graph = createConfigGraph();

      const original: ConfigV1 = {
        version: '1.0.0',
        appName: 'Round Trip Test',
        port: 9000,
        debug: true,
      };

      // Migrate up to v4
      const upResult = graph.migrate<ConfigV4>(original, '1.0.0', '4.0.0');
      expect(upResult.success).toBe(true);

      if (upResult.success) {
        // Migrate back down to v1
        const downResult = graph.migrate<ConfigV1>(
          upResult.data,
          '4.0.0',
          '1.0.0'
        );
        expect(downResult.success).toBe(true);

        if (downResult.success) {
          // Core fields should be preserved
          expect(downResult.data.appName).toBe(original.appName);
          expect(downResult.data.port).toBe(original.port);
          expect(downResult.data.debug).toBe(original.debug);
        }
      }
    });
  });

  describe('validation', () => {
    it('should reject invalid v1 config', () => {
      const graph = createConfigGraph();

      const invalidConfig = {
        version: '1.0.0',
        appName: '', // invalid: empty string
        port: -1, // invalid: negative
        debug: true,
      };

      const result = graph.migrate(invalidConfig, '1.0.0', '2.0.0');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should use latest version constant correctly', () => {
      expect(LATEST_VERSION).toBe('4.0.0');
    });
  });

  describe('path finding', () => {
    it('should find path from v1 to v4', () => {
      const graph = createConfigGraph();
      expect(graph.hasPath('1.0.0', '4.0.0')).toBe(true);
    });

    it('should find path from v4 to v1', () => {
      const graph = createConfigGraph();
      expect(graph.hasPath('4.0.0', '1.0.0')).toBe(true);
    });

    it('should return empty path for same version', () => {
      const graph = createConfigGraph();
      const path = graph.getPath('2.0.0', '2.0.0');
      expect(path.steps).toEqual([]);
    });
  });
});
