import { describe, it, expect, beforeEach } from 'vitest';
import {
  createVersionedRESTEndpoint,
  type RESTEndpointVersion,
  type RESTEndpointMigration,
  extractVersionFromHeader,
} from '../src/index.js';
import { semverStrategy, type VersionedSchema } from '@migrex/core';

// Test types for request schemas
interface CreateUserRequestV1 {
  name: string;
  email: string;
}

interface CreateUserRequestV2 {
  firstName: string;
  lastName: string;
  email: string;
}

// Test types for response schemas (includes server-generated fields)
interface UserResponseV1 {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface UserResponseV2 {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

describe('createVersionedRESTEndpoint', () => {
  // Schemas
  let requestV1Schema: VersionedSchema<CreateUserRequestV1>;
  let requestV2Schema: VersionedSchema<CreateUserRequestV2>;
  let responseV1Schema: VersionedSchema<UserResponseV1>;
  let responseV2Schema: VersionedSchema<UserResponseV2>;

  // Version configurations
  let v1Config: RESTEndpointVersion<CreateUserRequestV1, UserResponseV1>;
  let v2Config: RESTEndpointVersion<CreateUserRequestV2, UserResponseV2>;

  // Migrations
  let migration: RESTEndpointMigration;

  beforeEach(() => {
    // Define request schemas
    requestV1Schema = {
      version: '1.0.0',
      schema: (data: unknown) => {
        const d = data as CreateUserRequestV1;
        if (typeof d.name !== 'string' || typeof d.email !== 'string') {
          return {
            success: false,
            errors: [{ path: [], message: 'Invalid request data' }],
          };
        }
        return { success: true, data: d };
      },
    };

    requestV2Schema = {
      version: '2.0.0',
      schema: (data: unknown) => {
        const d = data as CreateUserRequestV2;
        if (
          typeof d.firstName !== 'string' ||
          typeof d.lastName !== 'string' ||
          typeof d.email !== 'string'
        ) {
          return {
            success: false,
            errors: [{ path: [], message: 'Invalid request data' }],
          };
        }
        return { success: true, data: d };
      },
    };

    // Define response schemas (include server-generated fields)
    responseV1Schema = {
      version: '1.0.0',
      schema: (data: unknown) => {
        const d = data as UserResponseV1;
        if (
          typeof d.id !== 'string' ||
          typeof d.name !== 'string' ||
          typeof d.email !== 'string' ||
          typeof d.createdAt !== 'string'
        ) {
          return {
            success: false,
            errors: [{ path: [], message: 'Invalid response data' }],
          };
        }
        return { success: true, data: d };
      },
    };

    responseV2Schema = {
      version: '2.0.0',
      schema: (data: unknown) => {
        const d = data as UserResponseV2;
        if (
          typeof d.id !== 'string' ||
          typeof d.firstName !== 'string' ||
          typeof d.lastName !== 'string' ||
          typeof d.email !== 'string' ||
          typeof d.createdAt !== 'string'
        ) {
          return {
            success: false,
            errors: [{ path: [], message: 'Invalid response data' }],
          };
        }
        return { success: true, data: d };
      },
    };

    // Version configurations
    v1Config = {
      request: requestV1Schema,
      response: responseV1Schema,
    };

    v2Config = {
      request: requestV2Schema,
      response: responseV2Schema,
    };

    // Define migrations (note: response migrations preserve id and createdAt)
    migration = {
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      request: {
        up: (data: unknown): CreateUserRequestV2 => {
          const req = data as CreateUserRequestV1;
          const [firstName, ...rest] = req.name.split(' ');
          return {
            firstName,
            lastName: rest.join(' ') || '',
            email: req.email,
          };
        },
        down: (data: unknown): CreateUserRequestV1 => {
          const req = data as CreateUserRequestV2;
          return {
            name: `${req.firstName} ${req.lastName}`.trim(),
            email: req.email,
          };
        },
      },
      response: {
        up: (data: unknown): UserResponseV2 => {
          const res = data as UserResponseV1;
          const [firstName, ...rest] = res.name.split(' ');
          return {
            id: res.id, // Preserve server-generated field
            firstName,
            lastName: rest.join(' ') || '',
            email: res.email,
            createdAt: res.createdAt, // Preserve server-generated field
          };
        },
        down: (data: unknown): UserResponseV1 => {
          const res = data as UserResponseV2;
          return {
            id: res.id, // Preserve server-generated field
            name: `${res.firstName} ${res.lastName}`.trim(),
            email: res.email,
            createdAt: res.createdAt, // Preserve server-generated field
          };
        },
      },
    };
  });

  describe('Positive tests', () => {
    it('should create endpoint with multiple versions', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        defaultVersion: '1.0.0',
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      expect(endpoint).toBeDefined();
      expect(endpoint.getRequestGraph).toBeDefined();
      expect(endpoint.getResponseGraph).toBeDefined();
      expect(endpoint.parseRequest).toBeDefined();
      expect(endpoint.formatResponse).toBeDefined();
    });

    it('should parseRequest and migrate v1 → v2 correctly', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      const result = endpoint.parseRequest<CreateUserRequestV2>(
        {
          body: { name: 'John Doe', email: 'john@example.com' },
          headers: { 'X-API-Version': '1.0.0' },
        },
        '2.0.0'
      );

      expect(result.version).toBe('1.0.0');
      expect(result.body).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });
    });

    it('should formatResponse and migrate v2 → v1 correctly', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      const v2Response: UserResponseV2 = {
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = endpoint.formatResponse(v2Response, '1.0.0', '2.0.0');

      expect(result).toEqual({
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01T00:00:00Z',
      });
    });

    it('should handle same version request (no migration)', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      const requestBody = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      const result = endpoint.parseRequest<CreateUserRequestV2>(
        {
          body: requestBody,
          headers: { 'X-API-Version': '2.0.0' },
        },
        '2.0.0'
      );

      expect(result.version).toBe('2.0.0');
      expect(result.body).toBe(requestBody); // Same object reference
    });

    it('should handle same version response (no migration)', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      const responseData: UserResponseV2 = {
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = endpoint.formatResponse(responseData, '2.0.0', '2.0.0');

      expect(result).toBe(responseData); // Same object reference
    });

    it('should use default version when header missing', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        defaultVersion: '1.0.0',
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      const result = endpoint.parseRequest<CreateUserRequestV2>(
        {
          body: { name: 'John Doe', email: 'john@example.com' },
          headers: {},
        },
        '2.0.0'
      );

      expect(result.version).toBe('1.0.0');
      expect(result.body).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });
    });

    it('should preserve server-only fields (id, createdAt) in response migration', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      const v2Response: UserResponseV2 = {
        id: 'server-generated-id',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        createdAt: '2024-12-25T12:00:00Z',
      };

      const result = endpoint.formatResponse(v2Response, '1.0.0', '2.0.0');

      expect(result).toEqual({
        id: 'server-generated-id', // Preserved
        name: 'Jane Smith',
        email: 'jane@example.com',
        createdAt: '2024-12-25T12:00:00Z', // Preserved
      });
    });

    it('should expose request and response graphs for advanced usage', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      const requestGraph = endpoint.getRequestGraph();
      const responseGraph = endpoint.getResponseGraph();

      expect(requestGraph).toBeDefined();
      expect(responseGraph).toBeDefined();
      expect(requestGraph.getVersions()).toEqual(['1.0.0', '2.0.0']);
      expect(responseGraph.getVersions()).toEqual(['1.0.0', '2.0.0']);
    });
  });

  describe('Negative tests', () => {
    it('should throw error when version not specified and no default', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      expect(() =>
        endpoint.parseRequest(
          {
            body: { name: 'John Doe', email: 'john@example.com' },
            headers: {},
          },
          '2.0.0'
        )
      ).toThrow('API version not specified and no default version provided');
    });

    it('should throw error when migration path does not exist (request)', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      expect(() =>
        endpoint.parseRequest(
          {
            body: { some: 'data' },
            headers: { 'X-API-Version': '3.0.0' },
          },
          '2.0.0'
        )
      ).toThrow('Failed to migrate request');
    });

    it('should throw error when migration path does not exist (response)', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      const responseData: UserResponseV2 = {
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01T00:00:00Z',
      };

      expect(() =>
        endpoint.formatResponse(responseData, '3.0.0', '2.0.0')
      ).toThrow('Failed to migrate response');
    });

    it('should throw error when request schema validation fails', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      expect(() =>
        endpoint.parseRequest(
          {
            body: { invalid: 'data' }, // Missing required fields
            headers: { 'X-API-Version': '1.0.0' },
          },
          '2.0.0'
        )
      ).toThrow('Failed to migrate request');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty request body gracefully', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        defaultVersion: '1.0.0',
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      // Empty body will fail validation
      expect(() =>
        endpoint.parseRequest(
          {
            body: {},
            headers: { 'X-API-Version': '1.0.0' },
          },
          '2.0.0'
        )
      ).toThrow();
    });

    it('should handle undefined headers gracefully', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        defaultVersion: '1.0.0',
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      const result = endpoint.parseRequest<CreateUserRequestV2>(
        {
          body: { name: 'John Doe', email: 'john@example.com' },
          // No headers property
        },
        '2.0.0'
      );

      expect(result.version).toBe('1.0.0'); // Uses default
      expect(result.body).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });
    });

    it('should handle single-word names correctly', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      const result = endpoint.parseRequest<CreateUserRequestV2>(
        {
          body: { name: 'Madonna', email: 'madonna@example.com' },
          headers: { 'X-API-Version': '1.0.0' },
        },
        '2.0.0'
      );

      expect(result.body).toEqual({
        firstName: 'Madonna',
        lastName: '',
        email: 'madonna@example.com',
      });
    });

    it('should handle round-trip migration (v1 → v2 → v1)', () => {
      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
        },
        migrations: [migration],
      });

      // Start with v1 response
      const originalV1Response: UserResponseV1 = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01T00:00:00Z',
      };

      // Migrate up to v2
      const v2Response = endpoint.formatResponse(
        originalV1Response,
        '2.0.0',
        '1.0.0'
      ) as UserResponseV2;

      expect(v2Response).toEqual({
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01T00:00:00Z',
      });

      // Migrate back down to v1
      const backToV1 = endpoint.formatResponse(v2Response, '1.0.0', '2.0.0');

      expect(backToV1).toEqual(originalV1Response);
    });

    it('should handle multi-version chain with three versions', () => {
      // Add a third version
      interface CreateUserRequestV3 {
        givenName: string;
        familyName: string;
        emailAddress: string;
      }

      interface UserResponseV3 {
        userId: string;
        givenName: string;
        familyName: string;
        emailAddress: string;
        timestamp: string;
      }

      const requestV3Schema: VersionedSchema<CreateUserRequestV3> = {
        version: '3.0.0',
        schema: (data: unknown) => {
          const d = data as CreateUserRequestV3;
          if (
            typeof d.givenName !== 'string' ||
            typeof d.familyName !== 'string' ||
            typeof d.emailAddress !== 'string'
          ) {
            return {
              success: false,
              errors: [{ path: [], message: 'Invalid request data' }],
            };
          }
          return { success: true, data: d };
        },
      };

      const responseV3Schema: VersionedSchema<UserResponseV3> = {
        version: '3.0.0',
        schema: (data: unknown) => {
          const d = data as UserResponseV3;
          if (
            typeof d.userId !== 'string' ||
            typeof d.givenName !== 'string' ||
            typeof d.familyName !== 'string' ||
            typeof d.emailAddress !== 'string' ||
            typeof d.timestamp !== 'string'
          ) {
            return {
              success: false,
              errors: [{ path: [], message: 'Invalid response data' }],
            };
          }
          return { success: true, data: d };
        },
      };

      const v3Config: RESTEndpointVersion<CreateUserRequestV3, UserResponseV3> =
        {
          request: requestV3Schema,
          response: responseV3Schema,
        };

      const migrationV2ToV3: RESTEndpointMigration = {
        fromVersion: '2.0.0',
        toVersion: '3.0.0',
        request: {
          up: (data: unknown): CreateUserRequestV3 => {
            const req = data as CreateUserRequestV2;
            return {
              givenName: req.firstName,
              familyName: req.lastName,
              emailAddress: req.email,
            };
          },
          down: (data: unknown): CreateUserRequestV2 => {
            const req = data as CreateUserRequestV3;
            return {
              firstName: req.givenName,
              lastName: req.familyName,
              email: req.emailAddress,
            };
          },
        },
        response: {
          up: (data: unknown): UserResponseV3 => {
            const res = data as UserResponseV2;
            return {
              userId: res.id,
              givenName: res.firstName,
              familyName: res.lastName,
              emailAddress: res.email,
              timestamp: res.createdAt,
            };
          },
          down: (data: unknown): UserResponseV2 => {
            const res = data as UserResponseV3;
            return {
              id: res.userId,
              firstName: res.givenName,
              lastName: res.familyName,
              email: res.emailAddress,
              createdAt: res.timestamp,
            };
          },
        },
      };

      const endpoint = createVersionedRESTEndpoint({
        id: 'users',
        versionStrategy: semverStrategy,
        extractVersion: extractVersionFromHeader('X-API-Version'),
        versions: {
          '1.0.0': v1Config,
          '2.0.0': v2Config,
          '3.0.0': v3Config,
        },
        migrations: [migration, migrationV2ToV3],
      });

      // Migrate from v1 all the way to v3
      const result = endpoint.parseRequest<CreateUserRequestV3>(
        {
          body: { name: 'John Doe', email: 'john@example.com' },
          headers: { 'X-API-Version': '1.0.0' },
        },
        '3.0.0'
      );

      expect(result.version).toBe('1.0.0');
      expect(result.body).toEqual({
        givenName: 'John',
        familyName: 'Doe',
        emailAddress: 'john@example.com',
      });
    });
  });
});
