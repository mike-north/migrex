# @migrex/rest

REST API integration for migrex - middleware and utilities for versioned REST APIs.

## Features

- **Versioned middleware** - Automatically migrate request/response data between API versions
- **Version extraction** - Extract API versions from headers, URL paths, or query parameters
- **Deprecation headers** - Automatically set RFC 8594 deprecation headers for deprecated versions
- **Framework agnostic** - Works with Express, Hono, and other Node.js frameworks
- **Lossy migration warnings** - Optional warnings when lossy migrations are performed

## Installation

```bash
npm install @migrex/rest @migrex/core
```

## Usage

### Versioned Middleware

```typescript
import { createVersionedMiddleware, extractVersionFromHeader } from '@migrex/rest';
import { createMigrationGraph, semverStrategy } from '@migrex/core';

const graph = createMigrationGraph({
  id: 'api',
  versionStrategy: semverStrategy,
});

// Register schemas and migrations...

const middleware = createVersionedMiddleware(graph, {
  extractVersion: extractVersionFromHeader('X-API-Version'),
  defaultVersion: '1.0.0',
  targetVersion: '2.0.0', // Version your handlers expect
  warnOnLossy: true,
});

// Express
app.use(middleware);

// The middleware will:
// 1. Extract version from X-API-Version header
// 2. Upgrade request body from requested version to 2.0.0
// 3. Downgrade response from 2.0.0 to requested version
// 4. Set deprecation headers if version is deprecated
```

### Version Extraction

```typescript
import {
  extractVersionFromHeader,
  extractVersionFromPath,
  extractVersionFromQuery,
} from '@migrex/rest';

// From header: X-API-Version: 1.0.0
const fromHeader = extractVersionFromHeader('X-API-Version');

// From URL path: /api/v1.0.0/users
const fromPath = extractVersionFromPath(/\/api\/v([^\/]+)/);

// From query parameter: ?version=1.0.0
const fromQuery = extractVersionFromQuery('version');
```

### Versioned Endpoint Builder

For more control over individual endpoints:

```typescript
import { createVersionedEndpoint, extractVersionFromHeader } from '@migrex/rest';

const endpoint = createVersionedEndpoint(graph, {
  extractVersion: extractVersionFromHeader('X-API-Version'),
  defaultVersion: '1.0.0',
});

app.post('/users', async (req, res) => {
  // Parse and upgrade request to v2.0.0
  const { version, body } = endpoint.parseRequest(req, '2.0.0');

  // Handle business logic with v2.0.0 data
  const user = await createUser(body);

  // Send response in the client's requested version
  endpoint.sendResponse(res, user, version, '2.0.0');
});
```

### Request vs Response Schemas

REST APIs typically have different schemas for requests and responses. For example, a POST request might have `{ name: string }` but the response includes server-generated fields like `{ id: string, name: string, createdAt: string }`.

**Important**: When request and response schemas differ, you need **separate migration graphs** for each:

```typescript
import { z } from 'zod';
import { fromZod } from '@migrex/zod';
import { createMigrationGraph, semverStrategy } from '@migrex/core';
import { createVersionedEndpoint, extractVersionFromHeader } from '@migrex/rest';

// REQUEST schemas (what clients send)
const UserRequestV1 = z.object({ name: z.string() });
const UserRequestV2 = z.object({ firstName: z.string(), lastName: z.string() });

// RESPONSE schemas (what we return - includes server fields)
const UserResponseV1 = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
});
const UserResponseV2 = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  createdAt: z.string(),
});

// Request migration graph
const requestGraph = createMigrationGraph({ id: 'user-request', versionStrategy: semverStrategy });
requestGraph.registerSchema(fromZod('1.0.0', UserRequestV1));
requestGraph.registerSchema(fromZod('2.0.0', UserRequestV2));
requestGraph.registerMigration({
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data) => {
    const [firstName, ...rest] = data.name.split(' ');
    return { firstName: firstName || '', lastName: rest.join(' ') || '' };
  },
  down: (data) => ({ name: `${data.firstName} ${data.lastName}`.trim() }),
});

// Response migration graph (separate!)
const responseGraph = createMigrationGraph({ id: 'user-response', versionStrategy: semverStrategy });
responseGraph.registerSchema(fromZod('1.0.0', UserResponseV1));
responseGraph.registerSchema(fromZod('2.0.0', UserResponseV2));
responseGraph.registerMigration({
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  up: (data) => {
    const [firstName, ...rest] = data.name.split(' ');
    return { id: data.id, firstName: firstName || '', lastName: rest.join(' ') || '', createdAt: data.createdAt };
  },
  down: (data) => ({ id: data.id, name: `${data.firstName} ${data.lastName}`.trim(), createdAt: data.createdAt }),
});

// Create separate endpoints
const requestEndpoint = createVersionedEndpoint(requestGraph, {
  extractVersion: extractVersionFromHeader('X-API-Version'),
  defaultVersion: '1.0.0',
});

const responseEndpoint = createVersionedEndpoint(responseGraph, {
  extractVersion: extractVersionFromHeader('X-API-Version'),
  defaultVersion: '1.0.0',
});

// Handler uses both endpoints
app.post('/users', async (req, res) => {
  // Parse request with request graph
  const { version, body } = requestEndpoint.parseRequest(req, '2.0.0');

  // Business logic (always v2.0.0)
  const user = {
    id: generateId(),
    firstName: body.firstName,
    lastName: body.lastName,
    createdAt: new Date().toISOString(),
  };

  // Send response with response graph
  responseEndpoint.sendResponse(res, user, version, '2.0.0');
});
```

> **Why separate graphs?** If you use a single graph, response fields like `id` and `createdAt` will be stripped during migration because they're not in the request schema. Separate graphs ensure each migration only transforms the fields relevant to that direction.

### Deprecation Headers

When a client requests a deprecated version, the middleware automatically sets:

```
Deprecation: true
Sunset: 2025-06-01
Link: <2.0.0>; rel="successor-version"
Deprecation-Message: Version 1.0.0 is deprecated. Use 2.0.0 instead
```

## API Reference

### `createVersionedMiddleware(graph, options)`

Create middleware that handles request/response migrations.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `extractVersion` | `VersionExtractor` | required | Function to extract version from request |
| `defaultVersion` | `string` | - | Default version when not specified |
| `targetVersion` | `string` | - | Version to migrate request bodies to |
| `warnOnLossy` | `boolean` | `false` | Log warnings for lossy migrations |
| `deprecationHeader` | `string` | `'Deprecation'` | Header name for deprecation flag |

### `createVersionedEndpoint(graph, options)`

Create a versioned endpoint builder for manual control.

Returns an object with:
- `parseRequest<T>(req, targetVersion)` - Parse and upgrade request body
- `sendResponse<T>(res, data, requestedVersion, currentVersion)` - Downgrade and send response
- `getRequestedVersion(req)` - Get the requested version from the request

### Version Extractors

| Function | Description |
|----------|-------------|
| `extractVersionFromHeader(headerName)` | Read version from a header |
| `extractVersionFromPath(pattern)` | Extract version from URL using regex |
| `extractVersionFromQuery(paramName)` | Read version from query parameter |

## Types

```typescript
interface Request {
  headers: Record<string, string | string[] | undefined>;
  url: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  params?: Record<string, string>;
}

interface Response {
  setHeader(name: string, value: string): void;
  json(data: unknown): void;
}

type VersionExtractor = (req: Request) => string | undefined;
type MiddlewareFunction = (req: Request, res: Response, next: NextFunction) => void;
```

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Build types
pnpm build:types

# Update API report
pnpm api:update
```

## License

UNLICENSED
