import type {
  AnyMigration,
  MigrationPath,
  MigrationStep,
  VersionStrategy,
} from './types.js';

/**
 * Find the shortest migration path between two versions using BFS.
 *
 * @param from - Source version (already normalized)
 * @param to - Target version (already normalized)
 * @param adjacencyList - Graph representation of version connectivity
 * @param migrations - Map of registered migrations (sync or async)
 * @param versionStrategy - Strategy for comparing versions
 * @param getMigrationKey - Function to generate migration lookup keys
 * @returns MigrationPath if found, null otherwise
 */
export function findPath(
  from: string,
  to: string,
  adjacencyList: Map<string, Set<string>>,
  migrations: Map<string, AnyMigration<unknown, unknown>>,
  versionStrategy: VersionStrategy,
  getMigrationKey: (from: string, to: string) => string
): MigrationPath | null {
  // BFS to find shortest path
  const visited = new Set<string>();
  const queue: Array<{ version: string; path: string[] }> = [
    { version: from, path: [from] },
  ];

  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Queue length checked above
    const current = queue.shift()!;

    if (current.version === to) {
      // Found path, build MigrationPath
      return buildMigrationPath(
        current.path,
        migrations,
        versionStrategy,
        getMigrationKey
      );
    }

    if (visited.has(current.version)) {
      continue;
    }
    visited.add(current.version);

    const neighbors = adjacencyList.get(current.version);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({
            version: neighbor,
            path: [...current.path, neighbor],
          });
        }
      }
    }
  }

  return null;
}

/**
 * Build a MigrationPath from a sequence of versions.
 *
 * @param versionPath - Ordered list of versions from source to target
 * @param migrations - Map of registered migrations (sync or async)
 * @param versionStrategy - Strategy for comparing versions
 * @param getMigrationKey - Function to generate migration lookup keys
 * @returns Complete MigrationPath with steps and metadata
 */
function buildMigrationPath(
  versionPath: string[],
  migrations: Map<string, AnyMigration<unknown, unknown>>,
  versionStrategy: VersionStrategy,
  getMigrationKey: (from: string, to: string) => string
): MigrationPath {
  const steps: MigrationStep[] = [];
  let hasIrreversibleStep = false;
  let overallDirection: 'up' | 'down' | 'mixed' = 'up';
  let hasUp = false;
  let hasDown = false;

  for (let i = 0; i < versionPath.length - 1; i++) {
    const fromVersion = versionPath[i];
    const toVersion = versionPath[i + 1];
    const key = getMigrationKey(fromVersion, toVersion);
    const migration = migrations.get(key);

    if (!migration) {
      throw new Error(`Migration not found for ${fromVersion} -> ${toVersion}`);
    }

    // Determine direction based on version comparison
    const comparison = versionStrategy.compare(fromVersion, toVersion);
    const direction: 'up' | 'down' = comparison < 0 ? 'up' : 'down';

    if (direction === 'up') {
      hasUp = true;
    } else {
      hasDown = true;
    }

    // Check if this direction is irreversible
    if (direction === 'down' && !('down' in migration)) {
      hasIrreversibleStep = true;
    }

    steps.push({
      fromVersion,
      toVersion,
      direction,
      migration,
    });
  }

  if (hasUp && hasDown) {
    overallDirection = 'mixed';
  } else if (hasDown) {
    overallDirection = 'down';
  }

  return {
    steps,
    direction: overallDirection,
    hasIrreversibleStep,
  };
}
