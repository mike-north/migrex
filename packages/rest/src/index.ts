/**
 * \@migrex/rest - REST API integration for migrex
 *
 * This package provides middleware and utilities for versioned REST APIs.
 *
 * @packageDocumentation
 */

import type { MigrationGraph, MigrationStep, MigrationPath } from '@migrex/core';

/**
 * Check if a migration path contains any lossy steps.
 *
 * @param path - The migration path to check
 * @returns True if any step in the path has lossy traits
 * @internal
 */
function hasLossySteps(path: MigrationPath): boolean {
  return path.steps.some((step: MigrationStep) => {
    const traits =
      step.direction === 'up'
        ? step.migration.traits?.up
        : step.migration.traits && 'down' in step.migration.traits
          ? step.migration.traits.down
          : undefined;
    return traits?.lossy !== undefined;
  });
}

/**
 * Generic request interface compatible with Express, Hono, and other frameworks.
 * @public
 */
export interface Request {
  /** Request headers */
  headers: Record<string, string | string[] | undefined>;
  /** Request URL */
  url: string;
  /** Query parameters (optional, framework-dependent) */
  query?: Record<string, string | string[] | undefined>;
  /** Request body (optional) */
  body?: unknown;
  /** URL parameters (optional, framework-dependent) */
  params?: Record<string, string>;
}

/**
 * Generic response interface compatible with Express, Hono, and other frameworks.
 * @public
 */
export interface Response {
  /** Set a response header */
  setHeader(name: string, value: string): void;
  /** Send a JSON response */
  json(data: unknown): void;
}

/**
 * Function that extracts a version string from a request.
 * @public
 */
export type VersionExtractor = (req: Request) => string | undefined;

/**
 * Options for creating versioned middleware.
 * @public
 */
export interface VersionedMiddlewareOptions {
  /**
   * Function to extract the version from the request.
   * Use extractVersionFromHeader, extractVersionFromPath, or extractVersionFromQuery.
   */
  extractVersion: VersionExtractor;

  /**
   * Default version to use when no version is specified in the request.
   * If not provided and version cannot be extracted, an error will be thrown.
   */
  defaultVersion?: string;

  /**
   * Target version to migrate data to (the version your handlers expect).
   * If not provided, no migration will be performed on the request body.
   */
  targetVersion?: string;

  /**
   * Whether to warn (via console) when a lossy migration is performed.
   * @defaultValue false
   */
  warnOnLossy?: boolean;

  /**
   * Name of the header to set when responding with a deprecated version.
   * @defaultValue 'Deprecation'
   */
  deprecationHeader?: string;
}

/**
 * Next function type for middleware chaining.
 * @public
 */
export type NextFunction = (error?: unknown) => void;

/**
 * Middleware function type.
 * @public
 */
export type MiddlewareFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Create versioned API middleware that handles request/response migrations.
 *
 * The middleware:
 * 1. Extracts the API version from the request using the provided extractor
 * 2. Upgrades the request body to the target version (if specified)
 * 3. Wraps the response to downgrade data back to the requested version
 * 4. Sets deprecation headers if the requested version is deprecated
 *
 * @param graph - The migration graph to use for transformations
 * @param options - Configuration options
 * @returns Express/Hono compatible middleware function
 *
 * @example
 * ```typescript
 * const graph = createMigrationGraph({ id: 'api', versionStrategy: semverStrategy });
 * // Register schemas and migrations...
 *
 * const middleware = createVersionedMiddleware(graph, {
 *   extractVersion: extractVersionFromHeader('X-API-Version'),
 *   defaultVersion: '1.0.0',
 *   targetVersion: '2.0.0',
 *   warnOnLossy: true,
 * });
 *
 * app.use(middleware);
 * ```
 *
 * @public
 */
export function createVersionedMiddleware(
  graph: MigrationGraph,
  options: VersionedMiddlewareOptions
): MiddlewareFunction {
  const {
    extractVersion,
    defaultVersion,
    targetVersion,
    warnOnLossy = false,
    deprecationHeader = 'Deprecation',
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract version from request
      const requestedVersion = extractVersion(req) ?? defaultVersion;

      if (!requestedVersion) {
        throw new Error(
          'API version not specified and no default version provided'
        );
      }

      // Store the requested version for response downgrade
      (req as { _requestedVersion?: string })._requestedVersion =
        requestedVersion;

      // Check if the requested version is deprecated
      const schema = graph.getSchema(requestedVersion);
      if (schema?.deprecated) {
        const deprecationInfo = schema.deprecated;
        const message = deprecationInfo.message
          ? `${deprecationInfo.message} Migrate to ${deprecationInfo.successor}`
          : `Version ${requestedVersion} is deprecated since ${deprecationInfo.since}. Use ${deprecationInfo.successor} instead`;

        res.setHeader(deprecationHeader, 'true');
        res.setHeader('Sunset', deprecationInfo.deadline ?? '');
        res.setHeader('Link', `<${deprecationInfo.successor}>; rel="successor-version"`);
        res.setHeader('Deprecation-Message', message);
      }

      // Upgrade request body if target version is specified
      if (targetVersion && req.body !== undefined) {
        if (requestedVersion !== targetVersion) {
          const migrationResult = graph.migrate(
            req.body,
            requestedVersion,
            targetVersion
          );

          if (!migrationResult.success) {
            throw new Error(
              `Failed to migrate request from ${requestedVersion} to ${targetVersion}: ${migrationResult.error}`
            );
          }

          // Warn about lossy migrations if enabled
          if (warnOnLossy && hasLossySteps(migrationResult.path)) {
            console.warn(
              `Lossy migration from ${requestedVersion} to ${targetVersion} in request body`
            );
          }

          req.body = migrationResult.data;
        }
      }

      // Wrap the response.json method to downgrade response data
      const originalJson = res.json.bind(res);
      res.json = function (data: unknown) {
        if (targetVersion && requestedVersion !== targetVersion) {
          const downgradeMigrationResult = graph.migrate(
            data,
            targetVersion,
            requestedVersion
          );

          if (!downgradeMigrationResult.success) {
            // Log error but send original data to avoid breaking the response
            console.error(
              `Failed to migrate response from ${targetVersion} to ${requestedVersion}: ${downgradeMigrationResult.error}`
            );
            originalJson(data);
            return;
          }

          // Warn about lossy migrations if enabled
          if (warnOnLossy && hasLossySteps(downgradeMigrationResult.path)) {
            console.warn(
              `Lossy migration from ${targetVersion} to ${requestedVersion} in response`
            );
          }

          originalJson(downgradeMigrationResult.data);
          return;
        }

        originalJson(data);
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Create a version extractor that reads from a request header.
 *
 * @param headerName - Name of the header to read (case-insensitive)
 * @returns Version extractor function
 *
 * @example
 * ```typescript
 * const extractVersion = extractVersionFromHeader('X-API-Version');
 * const middleware = createVersionedMiddleware(graph, {
 *   extractVersion,
 *   defaultVersion: '1.0.0',
 *   targetVersion: '2.0.0',
 * });
 * ```
 *
 * @public
 */
export function extractVersionFromHeader(
  headerName: string
): VersionExtractor {
  const lowerHeaderName = headerName.toLowerCase();

  return (req: Request): string | undefined => {
    // Check both the original case and lowercase
    const value = req.headers[headerName] ?? req.headers[lowerHeaderName];

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  };
}

/**
 * Create a version extractor that reads from the URL path.
 *
 * @param pattern - Regular expression pattern with a capture group for the version.
 *                  The first capture group will be used as the version.
 * @returns Version extractor function
 *
 * @example
 * ```typescript
 * // Extract from /api/v1.0.0/users
 * const extractVersion = extractVersionFromPath(/\/api\/v([^\/]+)/);
 *
 * // Extract from /v2/api/users
 * const extractVersion = extractVersionFromPath(/\/v(\d+)/);
 * ```
 *
 * @public
 */
export function extractVersionFromPath(pattern: string | RegExp): VersionExtractor {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

  return (req: Request): string | undefined => {
    const match = regex.exec(req.url);
    return match?.[1];
  };
}

/**
 * Create a version extractor that reads from a query parameter.
 *
 * @param paramName - Name of the query parameter
 * @returns Version extractor function
 *
 * @example
 * ```typescript
 * // Extract from ?version=1.0.0 or ?api-version=1.0.0
 * const extractVersion = extractVersionFromQuery('version');
 * const middleware = createVersionedMiddleware(graph, {
 *   extractVersion,
 *   defaultVersion: '1.0.0',
 *   targetVersion: '2.0.0',
 * });
 * ```
 *
 * @public
 */
export function extractVersionFromQuery(paramName: string): VersionExtractor {
  return (req: Request): string | undefined => {
    if (!req.query) {
      // Try to parse from URL if query is not provided by the framework
      const url = new URL(req.url, 'http://localhost');
      return url.searchParams.get(paramName) ?? undefined;
    }

    const value = req.query[paramName];

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  };
}

/**
 * Options for creating a versioned endpoint.
 * @public
 */
export interface VersionedEndpointOptions {
  /**
   * Function to extract the version from the request.
   */
  extractVersion: VersionExtractor;

  /**
   * Default version to use when no version is specified.
   */
  defaultVersion?: string;

  /**
   * Whether to warn when a lossy migration is performed.
   * @defaultValue false
   */
  warnOnLossy?: boolean;

  /**
   * Name of the header to set for deprecated versions.
   * @defaultValue 'Deprecation'
   */
  deprecationHeader?: string;
}

/**
 * Create a versioned endpoint builder that provides a simpler alternative to middleware.
 * This is useful for endpoints that need version-specific handling logic.
 *
 * @param graph - The migration graph to use for transformations
 * @param options - Configuration options
 * @returns Builder object with helper methods
 *
 * @example
 * ```typescript
 * const endpoint = createVersionedEndpoint(graph, {
 *   extractVersion: extractVersionFromHeader('X-API-Version'),
 *   defaultVersion: '1.0.0',
 * });
 *
 * app.post('/users', async (req, res) => {
 *   const { version, body } = endpoint.parseRequest(req, '2.0.0');
 *
 *   // Handle business logic with v2.0.0 data
 *   const user = await createUser(body);
 *
 *   // Send response in requested version
 *   endpoint.sendResponse(res, user, version, '2.0.0');
 * });
 * ```
 *
 * @public
 */
export function createVersionedEndpoint(
  graph: MigrationGraph,
  options: VersionedEndpointOptions
) {
  const {
    extractVersion,
    defaultVersion,
    warnOnLossy = false,
    deprecationHeader = 'Deprecation',
  } = options;

  return {
    /**
     * Parse and upgrade request body to target version.
     */
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    parseRequest<T>(req: Request, targetVersion: string): { version: string; body: T } {
      const requestedVersion = extractVersion(req) ?? defaultVersion;

      if (!requestedVersion) {
        throw new Error(
          'API version not specified and no default version provided'
        );
      }

      if (!req.body) {
        throw new Error('Request body is required');
      }

      const migrationResult = graph.migrate<T>(
        req.body,
        requestedVersion,
        targetVersion
      );

      if (!migrationResult.success) {
        throw new Error(
          `Failed to migrate request from ${requestedVersion} to ${targetVersion}: ${migrationResult.error}`
        );
      }

      // Warn about lossy migrations if enabled
      if (warnOnLossy && hasLossySteps(migrationResult.path)) {
        console.warn(
          `Lossy migration from ${requestedVersion} to ${targetVersion} in request`
        );
      }

      // Type assertion is safe here because we checked success
      return {
        version: requestedVersion,
        body: migrationResult.data as T,
      };
    },

    /**
     * Downgrade and send response data in the requested version.
     */
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    sendResponse<T>(
      res: Response,
      data: T,
      requestedVersion: string,
      currentVersion: string
    ): void {
      // Check if requested version is deprecated
      const schema = graph.getSchema(requestedVersion);
      if (schema?.deprecated) {
        const deprecationInfo = schema.deprecated;
        const message = deprecationInfo.message
          ? `${deprecationInfo.message} Migrate to ${deprecationInfo.successor}`
          : `Version ${requestedVersion} is deprecated since ${deprecationInfo.since}. Use ${deprecationInfo.successor} instead`;

        res.setHeader(deprecationHeader, 'true');
        if (deprecationInfo.deadline) {
          res.setHeader('Sunset', deprecationInfo.deadline);
        }
        res.setHeader('Link', `<${deprecationInfo.successor}>; rel="successor-version"`);
        res.setHeader('Deprecation-Message', message);
      }

      if (requestedVersion === currentVersion) {
        res.json(data);
        return;
      }

      const migrationResult = graph.migrate(
        data,
        currentVersion,
        requestedVersion
      );

      if (!migrationResult.success) {
        throw new Error(
          `Failed to migrate response from ${currentVersion} to ${requestedVersion}: ${migrationResult.error}`
        );
      }

      // Warn about lossy migrations if enabled
      if (warnOnLossy && hasLossySteps(migrationResult.path)) {
        console.warn(
          `Lossy migration from ${currentVersion} to ${requestedVersion} in response`
        );
      }

      res.json(migrationResult.data);
    },

    /**
     * Get the requested version from the request.
     */
    getRequestedVersion(req: Request): string {
      const requestedVersion = extractVersion(req) ?? defaultVersion;

      if (!requestedVersion) {
        throw new Error(
          'API version not specified and no default version provided'
        );
      }

      return requestedVersion;
    },
  };
}
