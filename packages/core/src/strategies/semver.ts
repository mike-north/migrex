import type {
  IncrementType,
  VersionComponents,
  VersionStrategy,
} from './types.js';

const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Semantic versioning strategy (semver 2.0.0).
 * Supports MAJOR.MINOR.PATCH with optional prerelease and build metadata.
 */
export const semverStrategy: VersionStrategy = {
  id: 'semver',

  compare(a: string, b: string): -1 | 0 | 1 {
    const parsedA = this.parse!(a);
    const parsedB = this.parse!(b);

    // Compare major, minor, patch
    for (let i = 0; i < 3; i++) {
      const numA = parsedA.parts[i] as number;
      const numB = parsedB.parts[i] as number;
      if (numA < numB) return -1;
      if (numA > numB) return 1;
    }

    // Handle prerelease comparison
    // No prerelease > has prerelease (1.0.0 > 1.0.0-alpha)
    if (!parsedA.prerelease && parsedB.prerelease) return 1;
    if (parsedA.prerelease && !parsedB.prerelease) return -1;
    if (parsedA.prerelease && parsedB.prerelease) {
      return comparePrerelease(parsedA.prerelease, parsedB.prerelease);
    }

    return 0;
  },

  isValid(version: string): boolean {
    return SEMVER_REGEX.test(version);
  },

  normalize(version: string): string {
    // Remove leading 'v' if present, trim whitespace
    const cleaned = version.replace(/^v/i, '').trim();
    if (!this.isValid(cleaned)) {
      throw new Error(`Invalid semver: ${version}`);
    }
    return cleaned;
  },

  parse(version: string): VersionComponents {
    const normalized = this.normalize!(version);
    const match = SEMVER_REGEX.exec(normalized);
    if (!match) {
      throw new Error(`Invalid semver: ${version}`);
    }

    return {
      parts: [
        parseInt(match[1]!, 10),
        parseInt(match[2]!, 10),
        parseInt(match[3]!, 10),
      ],
      ...(match[4] !== undefined && { prerelease: match[4] }),
      ...(match[5] !== undefined && { build: match[5] }),
    };
  },

  increment(version: string, type: IncrementType): string {
    const parsed = this.parse!(version);
    const major = Number(parsed.parts[0] ?? 0);
    const minor = Number(parsed.parts[1] ?? 0);
    const patch = Number(parsed.parts[2] ?? 0);

    switch (type) {
      case 'major':
        return `${String(major + 1)}.0.0`;
      case 'minor':
        return `${String(major)}.${String(minor + 1)}.0`;
      case 'patch':
        return `${String(major)}.${String(minor)}.${String(patch + 1)}`;
      case 'prerelease': {
        if (parsed.prerelease) {
          // Increment existing prerelease
          const parts = parsed.prerelease.split('.');
          const lastPart = parts[parts.length - 1]!;
          const num = parseInt(lastPart, 10);
          if (!isNaN(num)) {
            parts[parts.length - 1] = String(num + 1);
          } else {
            parts.push('1');
          }
          return `${String(major)}.${String(minor)}.${String(patch)}-${parts.join('.')}`;
        }
        // Add prerelease to bumped patch version
        return `${String(major)}.${String(minor)}.${String(patch + 1)}-0`;
      }
    }
  },
};

/**
 * Compare prerelease identifiers according to semver 2.0.0 spec.
 * When comparing, numeric parts have lower precedence than non-numeric.
 */
function comparePrerelease(a: string, b: string): -1 | 0 | 1 {
  const partsA = a.split('.');
  const partsB = b.split('.');
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const partA = partsA[i];
    const partB = partsB[i];

    // Shorter prerelease has lower precedence
    if (partA === undefined) return -1;
    if (partB === undefined) return 1;

    const numA = parseInt(partA, 10);
    const numB = parseInt(partB, 10);
    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);

    // Numeric parts have lower precedence than non-numeric
    if (isNumA && !isNumB) return -1;
    if (!isNumA && isNumB) return 1;

    if (isNumA && isNumB) {
      if (numA < numB) return -1;
      if (numA > numB) return 1;
    } else {
      // Lexical comparison for non-numeric parts
      if (partA < partB) return -1;
      if (partA > partB) return 1;
    }
  }

  return 0;
}
