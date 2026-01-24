/**
 * Example demonstrating async migration support in migrex.
 *
 * This example shows how to:
 * - Define async migrations
 * - Execute async migrations with migrateAsync
 * - Mix sync and async migrations in the same graph
 * - Preserve fields across async migrations
 */

import {
  createMigrationGraph,
  semverStrategy,
  type VersionedSchema,
  type AsyncReversibleMigration,
} from '../src/index.js';

// Define data types for different versions
type V1Data = {
  version: '1.0.0';
  name: string;
};

type V2Data = {
  version: '2.0.0';
  name: string;
  email: string;
  avatarUrl?: string;
};

type V3Data = {
  version: '3.0.0';
  fullName: string;
  contactEmail: string;
  profileData?: {
    avatar: string;
    bio: string;
  };
};

// Schemas for each version
const schemaV1: VersionedSchema<V1Data> = {
  version: '1.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'version' in data &&
      data.version === '1.0.0' &&
      'name' in data
    ) {
      return { success: true, data: data as V1Data };
    }
    return { success: false, errors: [{ path: [], message: 'Invalid v1 data' }] };
  },
};

const schemaV2: VersionedSchema<V2Data> = {
  version: '2.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'version' in data &&
      data.version === '2.0.0' &&
      'name' in data &&
      'email' in data
    ) {
      return { success: true, data: data as V2Data };
    }
    return { success: false, errors: [{ path: [], message: 'Invalid v2 data' }] };
  },
};

const schemaV3: VersionedSchema<V3Data> = {
  version: '3.0.0',
  schema: (data) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'version' in data &&
      data.version === '3.0.0' &&
      'fullName' in data &&
      'contactEmail' in data
    ) {
      return { success: true, data: data as V3Data };
    }
    return { success: false, errors: [{ path: [], message: 'Invalid v3 data' }] };
  },
};

// Async migration: V1 -> V2
// Simulates fetching user email from an external API
const migrationV1ToV2: AsyncReversibleMigration<V1Data, V2Data> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  description: 'Add email field by fetching from user API',

  up: async (data, _ctx) => {
    // Simulate async API call to fetch user email
    await new Promise((resolve) => setTimeout(resolve, 100));

    // In a real app, you might call:
    // const userProfile = await fetch(`/api/users/${userId}/email`).then(r => r.json());

    return {
      version: '2.0.0',
      name: data.name,
      email: `${data.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    };
  },

  down: async (data, _ctx) => {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      version: '1.0.0',
      name: data.name,
    };
  },

  traits: {
    up: {
      lossy: 'Email is generated, may not match actual user email',
    },
    down: {
      lossy: 'Email field is discarded',
    },
  },
};

// Async migration: V2 -> V3
// Simulates enriching user profile with async data fetch
const migrationV2ToV3: AsyncReversibleMigration<V2Data, V3Data> = {
  fromVersion: '2.0.0',
  toVersion: '3.0.0',
  description: 'Restructure and enrich user profile with async data',

  up: async (data, ctx) => {
    // Preserve avatar URL if present
    if (data.avatarUrl) {
      ctx.preserve('avatarUrl', data.avatarUrl, {
        description: 'User avatar URL from v2',
        sourceVersion: '2.0.0',
      });
    }

    // Simulate async API call to fetch user bio
    await new Promise((resolve) => setTimeout(resolve, 150));
    const bio = `Software engineer passionate about TypeScript`;

    return {
      version: '3.0.0',
      fullName: data.name,
      contactEmail: data.email,
      profileData: data.avatarUrl
        ? {
            avatar: data.avatarUrl,
            bio,
          }
        : undefined,
    };
  },

  down: async (data, ctx) => {
    // Restore preserved avatar URL
    const preserved = ctx.consume('avatarUrl');

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      version: '2.0.0',
      name: data.fullName,
      email: data.contactEmail,
      avatarUrl:
        preserved?.kind === 'single' ? (preserved.value as string) : undefined,
    };
  },

  traits: {
    up: {
      restructures: 'Reorganizes data into nested profileData structure',
    },
    down: {
      restructures: 'Flattens nested profile data',
      lossy: 'Bio information is discarded',
    },
  },
};

// Create migration graph and register everything
const graph = createMigrationGraph({
  id: 'user-profile-api',
  versionStrategy: semverStrategy,
});

graph.registerSchema(schemaV1);
graph.registerSchema(schemaV2);
graph.registerSchema(schemaV3);

graph.registerMigration(migrationV1ToV2);
graph.registerMigration(migrationV2ToV3);

// Example 1: Migrate forward with async migrations
async function example1() {
  console.log('\n=== Example 1: Forward Migration (V1 -> V3) ===');

  const v1Data: V1Data = {
    version: '1.0.0',
    name: 'Alice Smith',
  };

  console.log('Original V1 data:', v1Data);

  const result = await graph.migrateAsync<V3Data>(v1Data, '1.0.0', '3.0.0');

  if (result.success) {
    console.log('Migrated to V3:', result.data);
    console.log('Migration path:', result.path.direction);
    console.log('Steps executed:', result.path.steps.length);
  } else {
    console.error('Migration failed:', result.error);
  }
}

// Example 2: Round-trip migration with field preservation
async function example2() {
  console.log('\n=== Example 2: Round-Trip Migration with Stash ===');

  const v2Data: V2Data = {
    version: '2.0.0',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    avatarUrl: 'https://example.com/avatars/bob.jpg',
  };

  console.log('Original V2 data:', v2Data);

  // Migrate forward to V3 (preserves avatarUrl in stash)
  const upResult = await graph.migrateAsync<V3Data>(v2Data, '2.0.0', '3.0.0');

  if (upResult.success) {
    console.log('Migrated to V3:', upResult.data);
    console.log('Preserved fields:', upResult.stash.unconsumed.length);

    // Migrate back to V2 (restores avatarUrl from stash)
    const downResult = await graph.migrateAsync<V2Data>(
      upResult.data!,
      '3.0.0',
      '2.0.0',
      { initialStash: upResult.preservedFields }
    );

    if (downResult.success) {
      console.log('Migrated back to V2:', downResult.data);
      console.log('Stash was lossless:', downResult.stash.lossless);
      console.log('Avatar preserved:', downResult.data?.avatarUrl === v2Data.avatarUrl);
    }
  }
}

// Example 3: Migration with validation
async function example3() {
  console.log('\n=== Example 3: Migration with Validation ===');

  const v1Data: V1Data = {
    version: '1.0.0',
    name: 'Charlie Davis',
  };

  // Migrate with intermediate validation
  const result = await graph.migrateAsync<V3Data>(v1Data, '1.0.0', '3.0.0', {
    validateIntermediate: true,
  });

  if (result.success) {
    console.log('Migration successful with validation at each step');
    console.log('Final data:', result.data);
  } else {
    console.error('Migration failed validation:', result.error);
  }
}

// Run all examples
async function main() {
  console.log('Async Migration Examples');
  console.log('========================\n');

  await example1();
  await example2();
  await example3();

  console.log('\n=== Graph Statistics ===');
  console.log('Versions:', graph.getVersions());
  console.log('Total migrations:', graph.getMigrations().length);
  console.log('Has path V1->V3:', graph.hasPath('1.0.0', '3.0.0'));
  console.log('Has path V3->V1:', graph.hasPath('3.0.0', '1.0.0'));
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
