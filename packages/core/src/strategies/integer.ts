import type {
  IncrementType,
  VersionComponents,
  VersionStrategy,
} from './types.js';

// Matches non-negative integers without leading zeros (except for "0" itself)
const INTEGER_REGEX = /^(0|[1-9]\d*)$/;

/**
 * Simple integer versioning strategy.
 * Versions are non-negative integers (e.g., 0, 1, 2, 3, ...).
 * Leading zeros are not allowed for multi-digit numbers.
 */
export const integerStrategy: VersionStrategy = {
  id: 'integer',

  compare(a: string, b: string): -1 | 0 | 1 {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (numA < numB) return -1;
    if (numA > numB) return 1;
    return 0;
  },

  isValid(version: string): boolean {
    return INTEGER_REGEX.test(version);
  },

  normalize(version: string): string {
    if (!this.isValid(version)) {
      throw new Error(`Invalid integer version: ${version}`);
    }
    return version;
  },

  parse(version: string): VersionComponents {
    if (!this.isValid(version)) {
      throw new Error(`Invalid integer version: ${version}`);
    }
    return { parts: [parseInt(version, 10)] };
  },

  increment(version: string, _type: IncrementType): string {
    const num = parseInt(version, 10);
    return String(num + 1);
  },
};
