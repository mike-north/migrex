import type {
  IncrementType,
  VersionComponents,
  VersionStrategy,
} from './types.js';

const CALVER_REGEX = /^(\d{4})[-.]?(\d{2})[-.]?(\d{2})$/;

/**
 * Calendar versioning strategy.
 * Supports YYYY-MM-DD, YYYY.MM.DD, and YYYYMMDD formats.
 */
export const calverStrategy: VersionStrategy = {
  id: 'calver',

  compare(a: string, b: string): -1 | 0 | 1 {
    const dateA = parseCalverToNumber(a);
    const dateB = parseCalverToNumber(b);
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
    return 0;
  },

  isValid(version: string): boolean {
    return CALVER_REGEX.test(version);
  },

  normalize(version: string): string {
    const match = CALVER_REGEX.exec(version);
    if (!match) {
      throw new Error(`Invalid calver: ${version}`);
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
  },

  parse(version: string): VersionComponents {
    const normalized = this.normalize!(version);
    const parts = normalized.split('-').map(Number);
    return { parts };
  },

  increment(_version: string, _type: IncrementType): string {
    // For calver, increment always produces today's date
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
};

/**
 * Convert calver string to YYYYMMDD number for easy comparison.
 */
function parseCalverToNumber(version: string): number {
  const match = CALVER_REGEX.exec(version);
  if (!match) {
    throw new Error(`Invalid calver: ${version}`);
  }
  // Convert to YYYYMMDD number for easy comparison
  return parseInt(`${match[1]}${match[2]}${match[3]}`, 10);
}
