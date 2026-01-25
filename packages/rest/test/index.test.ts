import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createVersionedMiddleware,
  extractVersionFromHeader,
  extractVersionFromPath,
  extractVersionFromQuery,
  createVersionedEndpoint,
  type Request,
  type Response,
  type NextFunction,
  type VersionedMiddlewareOptions,
} from '../src/index.js';
import {
  createMigrationGraph,
  semverStrategy,
  type VersionedSchema,
  type ReversibleMigration,
} from '@migrex/core';

// Test schemas
interface UserV1 {
  name: string;
  email: string;
}

interface UserV2 {
  firstName: string;
  lastName: string;
  email: string;
}

// Helper to create a mock request
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    url: '/api/users',
    query: {},
    body: undefined,
    params: {},
    ...overrides,
  };
}

// Helper to create a mock response
function createMockResponse(): Response & {
  _headers: Record<string, string>;
  _jsonData?: unknown;
} {
  const headers: Record<string, string> = {};
  return {
    _headers: headers,
    _jsonData: undefined,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    json(data: unknown) {
      this._jsonData = data;
    },
  };
}

describe('@migrex/rest', () => {
  describe('extractVersionFromHeader', () => {
    it('should extract version from header', () => {
      const extractor = extractVersionFromHeader('X-API-Version');
      const req = createMockRequest({
        headers: { 'X-API-Version': '1.0.0' },
      });

      expect(extractor(req)).toBe('1.0.0');
    });

    it('should handle lowercase header names', () => {
      const extractor = extractVersionFromHeader('X-API-Version');
      const req = createMockRequest({
        headers: { 'x-api-version': '1.0.0' },
      });

      expect(extractor(req)).toBe('1.0.0');
    });

    it('should handle array header values', () => {
      const extractor = extractVersionFromHeader('X-API-Version');
      const req = createMockRequest({
        headers: { 'X-API-Version': ['1.0.0', '2.0.0'] },
      });

      expect(extractor(req)).toBe('1.0.0');
    });

    it('should return undefined when header is missing', () => {
      const extractor = extractVersionFromHeader('X-API-Version');
      const req = createMockRequest();

      expect(extractor(req)).toBeUndefined();
    });
  });

  describe('extractVersionFromPath', () => {
    it('should extract version from URL path with regex', () => {
      const extractor = extractVersionFromPath(/\/api\/v([^/]+)/);
      const req = createMockRequest({
        url: '/api/v1.0.0/users',
      });

      expect(extractor(req)).toBe('1.0.0');
    });

    it('should extract version from URL path with string pattern', () => {
      const extractor = extractVersionFromPath('/v([0-9.]+)');
      const req = createMockRequest({
        url: '/v2.1.0/api/users',
      });

      expect(extractor(req)).toBe('2.1.0');
    });

    it('should return undefined when pattern does not match', () => {
      const extractor = extractVersionFromPath(/\/api\/v([^/]+)/);
      const req = createMockRequest({
        url: '/api/users',
      });

      expect(extractor(req)).toBeUndefined();
    });

    it('should extract simple version numbers', () => {
      const extractor = extractVersionFromPath(/\/v(\d+)/);
      const req = createMockRequest({
        url: '/v2/api/users',
      });

      expect(extractor(req)).toBe('2');
    });
  });

  describe('extractVersionFromQuery', () => {
    it('should extract version from query parameter', () => {
      const extractor = extractVersionFromQuery('version');
      const req = createMockRequest({
        query: { version: '1.0.0' },
      });

      expect(extractor(req)).toBe('1.0.0');
    });

    it('should handle array query values', () => {
      const extractor = extractVersionFromQuery('version');
      const req = createMockRequest({
        query: { version: ['1.0.0', '2.0.0'] },
      });

      expect(extractor(req)).toBe('1.0.0');
    });

    it('should parse from URL when query object is not available', () => {
      const extractor = extractVersionFromQuery('version');
      const req = createMockRequest({
        url: '/api/users?version=1.0.0',
        query: undefined,
      });

      expect(extractor(req)).toBe('1.0.0');
    });

    it('should return undefined when query parameter is missing', () => {
      const extractor = extractVersionFromQuery('version');
      const req = createMockRequest({
        query: {},
      });

      expect(extractor(req)).toBeUndefined();
    });
  });

  describe('createVersionedMiddleware', () => {
    let graph: ReturnType<typeof createMigrationGraph>;
    let v1Schema: VersionedSchema<UserV1>;
    let v2Schema: VersionedSchema<UserV2>;
    let migration_v1_to_v2: ReversibleMigration<UserV1, UserV2>;

    beforeEach(() => {
      graph = createMigrationGraph({
        id: 'test-api',
        versionStrategy: semverStrategy,
      });

      // Define schemas
      v1Schema = {
        version: '1.0.0',
        schema: (data: unknown) => {
          const d = data as UserV1;
          if (typeof d.name !== 'string' || typeof d.email !== 'string') {
            return {
              success: false,
              errors: [{ path: [], message: 'Invalid data' }],
            };
          }
          return { success: true, data: d };
        },
      };

      v2Schema = {
        version: '2.0.0',
        schema: (data: unknown) => {
          const d = data as UserV2;
          if (
            typeof d.firstName !== 'string' ||
            typeof d.lastName !== 'string' ||
            typeof d.email !== 'string'
          ) {
            return {
              success: false,
              errors: [{ path: [], message: 'Invalid data' }],
            };
          }
          return { success: true, data: d };
        },
      };

      // Define migration
      migration_v1_to_v2 = {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: UserV1): UserV2 => {
          const [firstName, ...rest] = data.name.split(' ');
          return {
            firstName,
            lastName: rest.join(' ') || '',
            email: data.email,
          };
        },
        down: (data: UserV2): UserV1 => {
          return {
            name: `${data.firstName} ${data.lastName}`.trim(),
            email: data.email,
          };
        },
      };

      graph.registerSchema(v1Schema);
      graph.registerSchema(v2Schema);
      graph.registerMigration(migration_v1_to_v2);
    });

    it('should extract version and pass through when no target version', () => {
      const middleware = createVersionedMiddleware(graph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
        defaultVersion: '1.0.0',
      });

      const req = createMockRequest({
        headers: { 'X-API-Version': '2.0.0' },
        body: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect((req as { _requestedVersion?: string })._requestedVersion).toBe('2.0.0');
    });

    it('should use default version when not specified', () => {
      const middleware = createVersionedMiddleware(graph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
        defaultVersion: '1.0.0',
      });

      const req = createMockRequest({
        body: { name: 'John Doe', email: 'john@example.com' },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect((req as { _requestedVersion?: string })._requestedVersion).toBe('1.0.0');
    });

    it('should throw error when version is not specified and no default', () => {
      const middleware = createVersionedMiddleware(graph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'API version not specified and no default version provided',
        })
      );
    });

    it('should upgrade request body to target version', () => {
      const middleware = createVersionedMiddleware(graph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
        defaultVersion: '1.0.0',
        targetVersion: '2.0.0',
      });

      const req = createMockRequest({
        headers: { 'X-API-Version': '1.0.0' },
        body: { name: 'John Doe', email: 'john@example.com' },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });
    });

    it('should not upgrade when request version matches target version', () => {
      const middleware = createVersionedMiddleware(graph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
        targetVersion: '2.0.0',
      });

      const originalBody = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };
      const req = createMockRequest({
        headers: { 'X-API-Version': '2.0.0' },
        body: originalBody,
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toBe(originalBody);
    });

    it('should downgrade response to requested version', () => {
      const middleware = createVersionedMiddleware(graph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
        targetVersion: '2.0.0',
      });

      const req = createMockRequest({
        headers: { 'X-API-Version': '1.0.0' },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      // Call the wrapped json method
      res.json({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });

      expect(res._jsonData).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('should not downgrade when response version matches requested version', () => {
      const middleware = createVersionedMiddleware(graph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
        targetVersion: '2.0.0',
      });

      const req = createMockRequest({
        headers: { 'X-API-Version': '2.0.0' },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      const responseData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };
      res.json(responseData);

      expect(res._jsonData).toBe(responseData);
    });

    it('should set deprecation headers for deprecated versions', () => {
      const deprecatedSchema: VersionedSchema<UserV1> = {
        version: '1.0.0',
        schema: v1Schema.schema,
        deprecated: {
          since: '2.0.0',
          successor: '2.0.0',
          deadline: '2025-12-31',
          message: 'Use v2.0.0 for better structure',
        },
      };

      const deprecatedGraph = createMigrationGraph({
        id: 'deprecated-test',
        versionStrategy: semverStrategy,
      });
      deprecatedGraph.registerSchema(deprecatedSchema);
      deprecatedGraph.registerSchema(v2Schema);
      deprecatedGraph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: UserV1): UserV2 => {
          const [firstName, ...rest] = data.name.split(' ');
          return {
            firstName,
            lastName: rest.join(' ') || '',
            email: data.email,
          };
        },
        down: (data: UserV2): UserV1 => {
          return {
            name: `${data.firstName} ${data.lastName}`.trim(),
            email: data.email,
          };
        },
      });

      const middleware = createVersionedMiddleware(deprecatedGraph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
      });

      const req = createMockRequest({
        headers: { 'X-API-Version': '1.0.0' },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res._headers['Deprecation']).toBe('true');
      expect(res._headers['Sunset']).toBe('2025-12-31');
      expect(res._headers['Link']).toBe('<2.0.0>; rel="successor-version"');
      expect(res._headers['Deprecation-Message']).toContain(
        'Use v2.0.0 for better structure'
      );
    });

    it('should handle migration errors in request body', () => {
      const middleware = createVersionedMiddleware(graph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
        targetVersion: '2.0.0',
      });

      const req = createMockRequest({
        headers: { 'X-API-Version': '3.0.0' }, // Non-existent version
        body: { some: 'data' },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to migrate request'),
        })
      );
    });

    it('should handle migration errors in response gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const middleware = createVersionedMiddleware(graph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
        targetVersion: '2.0.0',
      });

      const req = createMockRequest({
        headers: { 'X-API-Version': '3.0.0' }, // Non-existent version
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      const responseData = { firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
      res.json(responseData);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(res._jsonData).toBe(responseData);

      consoleErrorSpy.mockRestore();
    });

    it('should call console.warn when warnOnLossy is enabled and migration is lossy', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create a graph with lossy migration traits
      const lossyGraph = createMigrationGraph({
        id: 'lossy-test',
        versionStrategy: semverStrategy,
      });

      const lossyV1Schema: VersionedSchema<UserV1> = {
        version: '1.0.0',
        schema: (data: unknown) => {
          const d = data as UserV1;
          return { success: true, data: d };
        },
      };

      const lossyV2Schema: VersionedSchema<UserV2> = {
        version: '2.0.0',
        schema: (data: unknown) => {
          const d = data as UserV2;
          return { success: true, data: d };
        },
      };

      lossyGraph.registerSchema(lossyV1Schema);
      lossyGraph.registerSchema(lossyV2Schema);

      lossyGraph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: UserV1): UserV2 => {
          const [firstName, ...rest] = data.name.split(' ');
          return {
            firstName,
            lastName: rest.join(' ') || '',
            email: data.email,
          };
        },
        down: (data: UserV2): UserV1 => {
          return {
            name: `${data.firstName} ${data.lastName}`.trim(),
            email: data.email,
          };
        },
        traits: {
          up: { lossy: 'middleName' },
        },
      });

      const middleware = createVersionedMiddleware(lossyGraph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
        targetVersion: '2.0.0',
        warnOnLossy: true,
      });

      const req = createMockRequest({
        headers: { 'X-API-Version': '1.0.0' },
        body: { name: 'John Doe', email: 'john@example.com' },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Lossy migration from 1.0.0 to 2.0.0 in request body'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should not call console.warn when warnOnLossy is disabled', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create a graph with lossy migration traits
      const lossyGraph = createMigrationGraph({
        id: 'lossy-test-disabled',
        versionStrategy: semverStrategy,
      });

      const lossyV1Schema: VersionedSchema<UserV1> = {
        version: '1.0.0',
        schema: (data: unknown) => {
          const d = data as UserV1;
          return { success: true, data: d };
        },
      };

      const lossyV2Schema: VersionedSchema<UserV2> = {
        version: '2.0.0',
        schema: (data: unknown) => {
          const d = data as UserV2;
          return { success: true, data: d };
        },
      };

      lossyGraph.registerSchema(lossyV1Schema);
      lossyGraph.registerSchema(lossyV2Schema);

      lossyGraph.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: UserV1): UserV2 => {
          const [firstName, ...rest] = data.name.split(' ');
          return {
            firstName,
            lastName: rest.join(' ') || '',
            email: data.email,
          };
        },
        down: (data: UserV2): UserV1 => {
          return {
            name: `${data.firstName} ${data.lastName}`.trim(),
            email: data.email,
          };
        },
        traits: {
          up: { lossy: 'middleName' },
        },
      });

      const middleware = createVersionedMiddleware(lossyGraph, {
        extractVersion: extractVersionFromHeader('X-API-Version'),
        targetVersion: '2.0.0',
        warnOnLossy: false, // Explicitly disabled
      });

      const req = createMockRequest({
        headers: { 'X-API-Version': '1.0.0' },
        body: { name: 'John Doe', email: 'john@example.com' },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('createVersionedEndpoint', () => {
    let graph: ReturnType<typeof createMigrationGraph>;
    let v1Schema: VersionedSchema<UserV1>;
    let v2Schema: VersionedSchema<UserV2>;

    beforeEach(() => {
      graph = createMigrationGraph({
        id: 'test-api',
        versionStrategy: semverStrategy,
      });

      v1Schema = {
        version: '1.0.0',
        schema: (data: unknown) => {
          const d = data as UserV1;
          if (typeof d.name !== 'string' || typeof d.email !== 'string') {
            return {
              success: false,
              errors: [{ path: [], message: 'Invalid data' }],
            };
          }
          return { success: true, data: d };
        },
      };

      v2Schema = {
        version: '2.0.0',
        schema: (data: unknown) => {
          const d = data as UserV2;
          if (
            typeof d.firstName !== 'string' ||
            typeof d.lastName !== 'string' ||
            typeof d.email !== 'string'
          ) {
            return {
              success: false,
              errors: [{ path: [], message: 'Invalid data' }],
            };
          }
          return { success: true, data: d };
        },
      };

      const migration: ReversibleMigration<UserV1, UserV2> = {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data: UserV1): UserV2 => {
          const [firstName, ...rest] = data.name.split(' ');
          return {
            firstName,
            lastName: rest.join(' ') || '',
            email: data.email,
          };
        },
        down: (data: UserV2): UserV1 => {
          return {
            name: `${data.firstName} ${data.lastName}`.trim(),
            email: data.email,
          };
        },
      };

      graph.registerSchema(v1Schema);
      graph.registerSchema(v2Schema);
      graph.registerMigration(migration);
    });

    describe('parseRequest', () => {
      it('should parse and upgrade request body', () => {
        const endpoint = createVersionedEndpoint(graph, {
          extractVersion: extractVersionFromHeader('X-API-Version'),
        });

        const req = createMockRequest({
          headers: { 'X-API-Version': '1.0.0' },
          body: { name: 'John Doe', email: 'john@example.com' },
        });

        const result = endpoint.parseRequest<UserV2>(req, '2.0.0');

        expect(result.version).toBe('1.0.0');
        expect(result.body).toEqual({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        });
      });

      it('should throw error when version is not specified', () => {
        const endpoint = createVersionedEndpoint(graph, {
          extractVersion: extractVersionFromHeader('X-API-Version'),
        });

        const req = createMockRequest({
          body: { name: 'John Doe', email: 'john@example.com' },
        });

        expect(() => endpoint.parseRequest(req, '2.0.0')).toThrow(
          'API version not specified and no default version provided'
        );
      });

      it('should throw error when body is missing', () => {
        const endpoint = createVersionedEndpoint(graph, {
          extractVersion: extractVersionFromHeader('X-API-Version'),
        });

        const req = createMockRequest({
          headers: { 'X-API-Version': '1.0.0' },
        });

        expect(() => endpoint.parseRequest(req, '2.0.0')).toThrow(
          'Request body is required'
        );
      });

      it('should throw error when migration fails', () => {
        const endpoint = createVersionedEndpoint(graph, {
          extractVersion: extractVersionFromHeader('X-API-Version'),
        });

        const req = createMockRequest({
          headers: { 'X-API-Version': '3.0.0' },
          body: { some: 'data' },
        });

        expect(() => endpoint.parseRequest(req, '2.0.0')).toThrow(
          'Failed to migrate request'
        );
      });
    });

    describe('sendResponse', () => {
      it('should downgrade and send response', () => {
        const endpoint = createVersionedEndpoint(graph, {
          extractVersion: extractVersionFromHeader('X-API-Version'),
        });

        const res = createMockResponse();
        const data: UserV2 = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        };

        endpoint.sendResponse(res, data, '1.0.0', '2.0.0');

        expect(res._jsonData).toEqual({
          name: 'John Doe',
          email: 'john@example.com',
        });
      });

      it('should send data without migration when versions match', () => {
        const endpoint = createVersionedEndpoint(graph, {
          extractVersion: extractVersionFromHeader('X-API-Version'),
        });

        const res = createMockResponse();
        const data: UserV2 = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        };

        endpoint.sendResponse(res, data, '2.0.0', '2.0.0');

        expect(res._jsonData).toBe(data);
      });

      it('should set deprecation headers for deprecated versions', () => {
        const deprecatedSchema: VersionedSchema<UserV1> = {
          version: '1.0.0',
          schema: v1Schema.schema,
          deprecated: {
            since: '2.0.0',
            successor: '2.0.0',
            message: 'Deprecated version',
          },
        };

        const deprecatedGraph = createMigrationGraph({
          id: 'deprecated-test',
          versionStrategy: semverStrategy,
        });
        deprecatedGraph.registerSchema(deprecatedSchema);
        deprecatedGraph.registerSchema(v2Schema);
        deprecatedGraph.registerMigration({
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: (data: UserV1): UserV2 => {
            const [firstName, ...rest] = data.name.split(' ');
            return { firstName, lastName: rest.join(' ') || '', email: data.email };
          },
          down: (data: UserV2): UserV1 => {
            return { name: `${data.firstName} ${data.lastName}`.trim(), email: data.email };
          },
        });

        const endpoint = createVersionedEndpoint(deprecatedGraph, {
          extractVersion: extractVersionFromHeader('X-API-Version'),
        });

        const res = createMockResponse();
        const data: UserV2 = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        };

        endpoint.sendResponse(res, data, '1.0.0', '2.0.0');

        expect(res._headers['Deprecation']).toBe('true');
        expect(res._headers['Link']).toBe('<2.0.0>; rel="successor-version"');
      });

      it('should throw error when migration fails', () => {
        const endpoint = createVersionedEndpoint(graph, {
          extractVersion: extractVersionFromHeader('X-API-Version'),
        });

        const res = createMockResponse();
        const data: UserV2 = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        };

        expect(() => endpoint.sendResponse(res, data, '3.0.0', '2.0.0')).toThrow(
          'Failed to migrate response'
        );
      });
    });

    describe('getRequestedVersion', () => {
      it('should return requested version from request', () => {
        const endpoint = createVersionedEndpoint(graph, {
          extractVersion: extractVersionFromHeader('X-API-Version'),
        });

        const req = createMockRequest({
          headers: { 'X-API-Version': '1.0.0' },
        });

        expect(endpoint.getRequestedVersion(req)).toBe('1.0.0');
      });

      it('should return default version when not specified', () => {
        const endpoint = createVersionedEndpoint(graph, {
          extractVersion: extractVersionFromHeader('X-API-Version'),
          defaultVersion: '1.0.0',
        });

        const req = createMockRequest();

        expect(endpoint.getRequestedVersion(req)).toBe('1.0.0');
      });

      it('should throw error when version not specified and no default', () => {
        const endpoint = createVersionedEndpoint(graph, {
          extractVersion: extractVersionFromHeader('X-API-Version'),
        });

        const req = createMockRequest();

        expect(() => endpoint.getRequestedVersion(req)).toThrow(
          'API version not specified and no default version provided'
        );
      });
    });
  });
});
