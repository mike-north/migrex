/**
 * REST API template generator - creates a complete REST endpoint versioning setup.
 *
 * @packageDocumentation
 */

import type { Template, TemplateOptions, GeneratedFile } from './index.js';

/**
 * Generate user request schemas file.
 */
function generateRequestSchemasFile(options: TemplateOptions): string {
  const { plugin } = options;

  if (plugin === 'zod') {
    return `import { z } from 'zod';
import { fromZod } from '@migrex/zod';

/**
 * User creation request v1 - single name field.
 */
export const CreateUserRequestV1 = z.object({
  name: z.string(),
  email: z.string().email(),
});

export type CreateUserRequestV1 = z.infer<typeof CreateUserRequestV1>;

export const requestSchemaV1 = fromZod('1.0.0', CreateUserRequestV1);

/**
 * User creation request v2 - split name into firstName/lastName.
 */
export const CreateUserRequestV2 = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
});

export type CreateUserRequestV2 = z.infer<typeof CreateUserRequestV2>;

export const requestSchemaV2 = fromZod('2.0.0', CreateUserRequestV2);
`;
  } else {
    return `import { fromJsonSchema } from '@migrex/json-schema';
import type { JSONSchema7 } from 'json-schema';

/**
 * User creation request v1 - single name field.
 */
export const createUserRequestV1Schema: JSONSchema7 = {
  type: 'object',
  required: ['name', 'email'],
  properties: {
    name: {
      type: 'string',
    },
    email: {
      type: 'string',
      format: 'email',
    },
  },
  additionalProperties: false,
};

export const requestSchemaV1 = fromJsonSchema('1.0.0', createUserRequestV1Schema);

/**
 * User creation request v2 - split name into firstName/lastName.
 */
export const createUserRequestV2Schema: JSONSchema7 = {
  type: 'object',
  required: ['firstName', 'lastName', 'email'],
  properties: {
    firstName: {
      type: 'string',
    },
    lastName: {
      type: 'string',
    },
    email: {
      type: 'string',
      format: 'email',
    },
  },
  additionalProperties: false,
};

export const requestSchemaV2 = fromJsonSchema('2.0.0', createUserRequestV2Schema);
`;
  }
}

/**
 * Generate user response schemas file (includes server-generated fields).
 */
function generateResponseSchemasFile(options: TemplateOptions): string {
  const { plugin } = options;

  if (plugin === 'zod') {
    return `import { z } from 'zod';
import { fromZod } from '@migrex/zod';

/**
 * User response v1 - includes server-generated fields.
 */
export const UserResponseV1 = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export type UserResponseV1 = z.infer<typeof UserResponseV1>;

export const responseSchemaV1 = fromZod('1.0.0', UserResponseV1);

/**
 * User response v2 - includes server-generated fields.
 */
export const UserResponseV2 = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export type UserResponseV2 = z.infer<typeof UserResponseV2>;

export const responseSchemaV2 = fromZod('2.0.0', UserResponseV2);
`;
  } else {
    return `import { fromJsonSchema } from '@migrex/json-schema';
import type { JSONSchema7 } from 'json-schema';

/**
 * User response v1 - includes server-generated fields.
 */
export const userResponseV1Schema: JSONSchema7 = {
  type: 'object',
  required: ['id', 'name', 'email', 'createdAt'],
  properties: {
    id: {
      type: 'string',
    },
    name: {
      type: 'string',
    },
    email: {
      type: 'string',
      format: 'email',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  additionalProperties: false,
};

export const responseSchemaV1 = fromJsonSchema('1.0.0', userResponseV1Schema);

/**
 * User response v2 - includes server-generated fields.
 */
export const userResponseV2Schema: JSONSchema7 = {
  type: 'object',
  required: ['id', 'firstName', 'lastName', 'email', 'createdAt'],
  properties: {
    id: {
      type: 'string',
    },
    firstName: {
      type: 'string',
    },
    lastName: {
      type: 'string',
    },
    email: {
      type: 'string',
      format: 'email',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  additionalProperties: false,
};

export const responseSchemaV2 = fromJsonSchema('2.0.0', userResponseV2Schema);
`;
  }
}

/**
 * Generate migrations file for both requests and responses.
 */
function generateMigrationsFile(options: TemplateOptions): string {
  const { plugin } = options;

  if (plugin === 'zod') {
    return `import type { CreateUserRequestV1, CreateUserRequestV2 } from './schemas/user-request.js';
import type { UserResponseV1, UserResponseV2 } from './schemas/user-response.js';
import type { RESTEndpointMigration } from '@migrex/rest';

/**
 * Migration from v1 to v2.
 * Request: Split name into firstName/lastName.
 * Response: Split name into firstName/lastName (preserve server fields).
 */
export const migrationV1ToV2: RESTEndpointMigration = {
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
        name: \`\${req.firstName} \${req.lastName}\`.trim(),
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
        name: \`\${res.firstName} \${res.lastName}\`.trim(),
        email: res.email,
        createdAt: res.createdAt, // Preserve server-generated field
      };
    },
  },
};
`;
  } else {
    return `import type { RESTEndpointMigration } from '@migrex/rest';

/**
 * Migration from v1 to v2.
 * Request: Split name into firstName/lastName.
 * Response: Split name into firstName/lastName (preserve server fields).
 */
export const migrationV1ToV2: RESTEndpointMigration = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  request: {
    up: (data: unknown): any => {
      const req = data as any;
      const [firstName, ...rest] = req.name.split(' ');
      return {
        firstName,
        lastName: rest.join(' ') || '',
        email: req.email,
      };
    },
    down: (data: unknown): any => {
      const req = data as any;
      return {
        name: \`\${req.firstName} \${req.lastName}\`.trim(),
        email: req.email,
      };
    },
  },
  response: {
    up: (data: unknown): any => {
      const res = data as any;
      const [firstName, ...rest] = res.name.split(' ');
      return {
        id: res.id, // Preserve server-generated field
        firstName,
        lastName: rest.join(' ') || '',
        email: res.email,
        createdAt: res.createdAt, // Preserve server-generated field
      };
    },
    down: (data: unknown): any => {
      const res = data as any;
      return {
        id: res.id, // Preserve server-generated field
        name: \`\${res.firstName} \${res.lastName}\`.trim(),
        email: res.email,
        createdAt: res.createdAt, // Preserve server-generated field
      };
    },
  },
};
`;
  }
}

/**
 * Generate endpoints configuration file.
 */
function generateEndpointsFile(options: TemplateOptions): string {
  const { projectName } = options;

  return `import { createVersionedRESTEndpoint, extractVersionFromHeader } from '@migrex/rest';
import { semverStrategy } from '@migrex/core';
import { requestSchemaV1, requestSchemaV2 } from './schemas/user-request.js';
import { responseSchemaV1, responseSchemaV2 } from './schemas/user-response.js';
import { migrationV1ToV2 } from './migrations.js';

/**
 * Versioned REST endpoint for user creation.
 */
export const userEndpoint = createVersionedRESTEndpoint({
  id: '${projectName}-users',
  versionStrategy: semverStrategy,
  extractVersion: extractVersionFromHeader('X-API-Version'),
  defaultVersion: '1.0.0',
  versions: {
    '1.0.0': {
      request: requestSchemaV1,
      response: responseSchemaV1,
    },
    '2.0.0': {
      request: requestSchemaV2,
      response: responseSchemaV2,
    },
  },
  migrations: [migrationV1ToV2],
});
`;
}

/**
 * Generate index file with usage example.
 */
function generateIndexFile(options: TemplateOptions): string {
  const { plugin } = options;

  if (plugin === 'zod') {
    return `import { userEndpoint } from './endpoints.js';
import type { UserResponseV2 } from './schemas/user-response.js';

/**
 * Example endpoint handler that uses versioned request/response.
 *
 * This example shows how to:
 * 1. Parse incoming request and migrate to internal version
 * 2. Process with internal logic (always latest version)
 * 3. Format response back to client's version
 */
export function handleCreateUser(req: {
  body: unknown;
  headers?: Record<string, string>;
}): unknown {
  // Parse request to internal version (v2)
  const { version: clientVersion, body } = userEndpoint.parseRequest(
    req,
    '2.0.0'
  );

  // Process with v2 logic (always latest version internally)
  const user: UserResponseV2 = {
    id: crypto.randomUUID(),
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    createdAt: new Date().toISOString(),
  };

  // Format response back to client's version
  const response = userEndpoint.formatResponse(user, clientVersion, '2.0.0');

  return response;
}

// Example usage in an Express-like framework:
//
// app.post('/users', (req, res) => {
//   try {
//     const response = handleCreateUser(req);
//     res.json(response);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });
//
// Example requests:
//
// V1 Client (header: X-API-Version: 1.0.0):
// POST /users
// { "name": "John Doe", "email": "john@example.com" }
//
// V2 Client (header: X-API-Version: 2.0.0):
// POST /users
// { "firstName": "John", "lastName": "Doe", "email": "john@example.com" }
`;
  } else {
    return `import { userEndpoint } from './endpoints.js';

/**
 * Example endpoint handler that uses versioned request/response.
 *
 * This example shows how to:
 * 1. Parse incoming request and migrate to internal version
 * 2. Process with internal logic (always latest version)
 * 3. Format response back to client's version
 */
export function handleCreateUser(req: {
  body: unknown;
  headers?: Record<string, string>;
}): unknown {
  // Parse request to internal version (v2)
  const { version: clientVersion, body } = userEndpoint.parseRequest(
    req,
    '2.0.0'
  );

  // Process with v2 logic (always latest version internally)
  const user: any = {
    id: crypto.randomUUID(),
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    createdAt: new Date().toISOString(),
  };

  // Format response back to client's version
  const response = userEndpoint.formatResponse(user, clientVersion, '2.0.0');

  return response;
}

// Example usage in an Express-like framework:
//
// app.post('/users', (req, res) => {
//   try {
//     const response = handleCreateUser(req);
//     res.json(response);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });
//
// Example requests:
//
// V1 Client (header: X-API-Version: 1.0.0):
// POST /users
// { "name": "John Doe", "email": "john@example.com" }
//
// V2 Client (header: X-API-Version: 2.0.0):
// POST /users
// { "firstName": "John", "lastName": "Doe", "email": "john@example.com" }
`;
  }
}

/**
 * REST API template - generates a complete REST endpoint versioning example.
 * @public
 */
export const restApiTemplate: Template = {
  name: 'rest-api',
  description: 'Versioned REST API endpoint with request/response migrations',

  async generate(options: TemplateOptions): Promise<GeneratedFile[]> {
    return [
      {
        path: 'src/api/schemas/user-request.ts',
        content: generateRequestSchemasFile(options),
      },
      {
        path: 'src/api/schemas/user-response.ts',
        content: generateResponseSchemasFile(options),
      },
      {
        path: 'src/api/migrations.ts',
        content: generateMigrationsFile(options),
      },
      {
        path: 'src/api/endpoints.ts',
        content: generateEndpointsFile(options),
      },
      {
        path: 'src/api/index.ts',
        content: generateIndexFile(options),
      },
    ];
  },
};
