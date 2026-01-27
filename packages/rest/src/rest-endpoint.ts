/**
 * REST Endpoint Builder for unified request/response versioning.
 *
 * This module provides a high-level API for creating versioned REST endpoints
 * where requests and responses may have different schemas and migration paths.
 *
 * @packageDocumentation
 */

import type {
  MigrationGraph,
  VersionedSchema,
  VersionStrategy,
} from '@migrex/core';
import { createMigrationGraph } from '@migrex/core';
import type { VersionExtractor } from './index.js';

/**
 * Version configuration for both request and response schemas.
 * @public
 */
export interface RESTEndpointVersion<TReq, TRes> {
  /** Schema for validating and parsing request data */
  request: VersionedSchema<TReq>;
  /** Schema for validating and serializing response data */
  response: VersionedSchema<TRes>;
}

/**
 * Migration configuration for both request and response transformations.
 * @public
 */
export interface RESTEndpointMigration {
  /** Source version */
  fromVersion: string;
  /** Target version */
  toVersion: string;
  /** Request migration functions */
  request: {
    /** Upgrade request from fromVersion to toVersion */
    up: (data: unknown) => unknown;
    /** Downgrade request from toVersion to fromVersion */
    down: (data: unknown) => unknown;
  };
  /** Response migration functions */
  response: {
    /** Upgrade response from fromVersion to toVersion */
    up: (data: unknown) => unknown;
    /** Downgrade response from toVersion to fromVersion */
    down: (data: unknown) => unknown;
  };
}

/**
 * Configuration options for creating a versioned REST endpoint.
 * @public
 */
export interface RESTEndpointOptions {
  /** Unique identifier for this endpoint */
  id: string;
  /** Strategy for version comparison and normalization */
  versionStrategy: VersionStrategy;
  /** Function to extract version from incoming requests */
  extractVersion: VersionExtractor;
  /** Default version to use when client doesn't specify one */
  defaultVersion?: string;
  /** Map of version strings to their request/response schemas */
  versions: Record<string, RESTEndpointVersion<unknown, unknown>>;
  /** List of migrations between versions */
  migrations: RESTEndpointMigration[];
}

/**
 * A versioned REST endpoint that handles request parsing and response formatting.
 * @public
 */
export interface VersionedRESTEndpoint {
  /**
   * Parse and migrate an incoming request to the internal version.
   *
   * @param req - Request object containing body and optional headers
   * @param internalVersion - The version your handler logic expects
   * @returns Object containing the client's version and migrated request body
   * @throws {Error} If version cannot be determined or migration fails
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T lets callers specify expected return type
  parseRequest<T>(
    req: { body: unknown; headers?: Record<string, string> },
    internalVersion: string
  ): {
    version: string;
    body: T;
  };

  /**
   * Migrate and format a response back to the client's version.
   *
   * @param data - Response data in the internal version
   * @param clientVersion - The version the client requested
   * @param internalVersion - The version of the provided data
   * @returns Migrated response data in the client's version
   * @throws {Error} If migration fails
   */
  formatResponse<T>(data: T, clientVersion: string, internalVersion: string): T;

  /**
   * Get the underlying request migration graph for advanced usage.
   * @returns The request graph instance
   */
  getRequestGraph(): MigrationGraph;

  /**
   * Get the underlying response migration graph for advanced usage.
   * @returns The response graph instance
   */
  getResponseGraph(): MigrationGraph;
}

/**
 * Create a versioned REST endpoint with unified request/response configuration.
 *
 * This function creates two separate migration graphs internally (one for requests,
 * one for responses) but provides a unified configuration interface. This is useful
 * for REST APIs where requests and responses have different schemas - for example,
 * responses often include server-generated fields like `id` and `createdAt`.
 *
 * @param options - Configuration for the endpoint
 * @returns A versioned REST endpoint instance
 *
 * @example
 * ```typescript
 * const endpoint = createVersionedRESTEndpoint({
 *   id: 'users',
 *   versionStrategy: semverStrategy,
 *   extractVersion: extractVersionFromHeader('X-API-Version'),
 *   defaultVersion: '1.0.0',
 *   versions: {
 *     '1.0.0': {
 *       request: userRequestV1Schema,
 *       response: userResponseV1Schema,
 *     },
 *     '2.0.0': {
 *       request: userRequestV2Schema,
 *       response: userResponseV2Schema,
 *     },
 *   },
 *   migrations: [
 *     {
 *       fromVersion: '1.0.0',
 *       toVersion: '2.0.0',
 *       request: {
 *         up: (data) => migrateRequestV1ToV2(data),
 *         down: (data) => migrateRequestV2ToV1(data),
 *       },
 *       response: {
 *         up: (data) => migrateResponseV1ToV2(data),
 *         down: (data) => migrateResponseV2ToV1(data),
 *       },
 *     },
 *   ],
 * });
 *
 * // In your endpoint handler
 * app.post('/users', (req, res) => {
 *   // Parse request to internal version
 *   const { version, body } = endpoint.parseRequest(req, '2.0.0');
 *
 *   // Process with v2 logic
 *   const user = createUser(body);
 *
 *   // Format response back to client's version
 *   const responseData = endpoint.formatResponse(user, version, '2.0.0');
 *   res.json(responseData);
 * });
 * ```
 *
 * @public
 */
export function createVersionedRESTEndpoint(
  options: RESTEndpointOptions
): VersionedRESTEndpoint {
  const {
    id,
    versionStrategy,
    extractVersion,
    defaultVersion,
    versions,
    migrations,
  } = options;

  // Create separate graphs for requests and responses
  const requestGraph = createMigrationGraph({
    id: `${id}-request`,
    versionStrategy,
  });

  const responseGraph = createMigrationGraph({
    id: `${id}-response`,
    versionStrategy,
  });

  // Register schemas for each version
  for (const [_version, schemas] of Object.entries(versions)) {
    requestGraph.registerSchema(schemas.request);
    responseGraph.registerSchema(schemas.response);
  }

  // Register migrations
  for (const migration of migrations) {
    // Register request migrations
    requestGraph.registerMigration({
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
      up: migration.request.up,
      down: migration.request.down,
    });

    // Register response migrations
    responseGraph.registerMigration({
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
      up: migration.response.up,
      down: migration.response.down,
    });
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T lets callers specify expected return type
    parseRequest<T>(
      req: { body: unknown; headers?: Record<string, string> },
      internalVersion: string
    ): { version: string; body: T } {
      // Extract client version from request
      const clientVersion =
        extractVersion({
          headers: req.headers ?? {},
          url: '',
        }) ?? defaultVersion;

      if (!clientVersion) {
        throw new Error(
          'API version not specified and no default version provided'
        );
      }

      // If versions match, no migration needed
      if (clientVersion === internalVersion) {
        return {
          version: clientVersion,
          body: req.body as T,
        };
      }

      // Migrate request body to internal version
      const migrationResult = requestGraph.migrate<T>(
        req.body,
        clientVersion,
        internalVersion
      );

      if (!migrationResult.success) {
        throw new Error(
          `Failed to migrate request from ${clientVersion} to ${internalVersion}: ${migrationResult.error?.message ?? 'Unknown error'}`
        );
      }

      // Type assertion is safe here because we checked success
      return {
        version: clientVersion,
        body: migrationResult.data as T,
      };
    },

    formatResponse<T>(
      data: T,
      clientVersion: string,
      internalVersion: string
    ): T {
      // If versions match, no migration needed
      if (clientVersion === internalVersion) {
        return data;
      }

      // Migrate response data to client version
      const migrationResult = responseGraph.migrate<T>(
        data,
        internalVersion,
        clientVersion
      );

      if (!migrationResult.success) {
        throw new Error(
          `Failed to migrate response from ${internalVersion} to ${clientVersion}: ${migrationResult.error?.message ?? 'Unknown error'}`
        );
      }

      // Type assertion is safe here because we checked success
      return migrationResult.data as T;
    },

    getRequestGraph(): MigrationGraph {
      return requestGraph;
    },

    getResponseGraph(): MigrationGraph {
      return responseGraph;
    },
  };
}
