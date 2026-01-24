import { describe, expect, it } from 'vitest';
import {
  calverStrategy,
  integerStrategy,
  semverStrategy,
} from '../src/strategies/index.js';

describe('semverStrategy', () => {
  describe('isValid', () => {
    it('should accept valid semver strings', () => {
      expect(semverStrategy.isValid('1.0.0')).toBe(true);
      expect(semverStrategy.isValid('0.0.1')).toBe(true);
      expect(semverStrategy.isValid('10.20.30')).toBe(true);
      expect(semverStrategy.isValid('1.0.0-alpha')).toBe(true);
      expect(semverStrategy.isValid('1.0.0-alpha.1')).toBe(true);
      expect(semverStrategy.isValid('1.0.0+build')).toBe(true);
      expect(semverStrategy.isValid('1.0.0-alpha+build')).toBe(true);
      expect(semverStrategy.isValid('1.0.0-0.3.7')).toBe(true);
      expect(semverStrategy.isValid('1.0.0-x.7.z.92')).toBe(true);
    });

    it('should reject invalid semver strings', () => {
      expect(semverStrategy.isValid('1.0')).toBe(false);
      expect(semverStrategy.isValid('1')).toBe(false);
      expect(semverStrategy.isValid('v1.0.0')).toBe(false);
      expect(semverStrategy.isValid('1.0.0.0')).toBe(false);
      expect(semverStrategy.isValid('not-a-version')).toBe(false);
      expect(semverStrategy.isValid('')).toBe(false);
      expect(semverStrategy.isValid('1.0.0-')).toBe(false);
      expect(semverStrategy.isValid('1.0.0+')).toBe(false);
    });

    it('should reject leading zeros in numeric parts', () => {
      expect(semverStrategy.isValid('01.0.0')).toBe(false);
      expect(semverStrategy.isValid('1.01.0')).toBe(false);
      expect(semverStrategy.isValid('1.0.01')).toBe(false);
    });
  });

  describe('compare', () => {
    it('should compare major versions', () => {
      expect(semverStrategy.compare('2.0.0', '1.0.0')).toBe(1);
      expect(semverStrategy.compare('1.0.0', '2.0.0')).toBe(-1);
      expect(semverStrategy.compare('10.0.0', '2.0.0')).toBe(1);
    });

    it('should compare minor versions', () => {
      expect(semverStrategy.compare('1.2.0', '1.1.0')).toBe(1);
      expect(semverStrategy.compare('1.1.0', '1.2.0')).toBe(-1);
      expect(semverStrategy.compare('1.10.0', '1.2.0')).toBe(1);
    });

    it('should compare patch versions', () => {
      expect(semverStrategy.compare('1.0.2', '1.0.1')).toBe(1);
      expect(semverStrategy.compare('1.0.1', '1.0.2')).toBe(-1);
      expect(semverStrategy.compare('1.0.10', '1.0.2')).toBe(1);
    });

    it('should return 0 for equal versions', () => {
      expect(semverStrategy.compare('1.0.0', '1.0.0')).toBe(0);
      expect(semverStrategy.compare('10.20.30', '10.20.30')).toBe(0);
    });

    it('should handle prerelease versions', () => {
      // Release > prerelease
      expect(semverStrategy.compare('1.0.0', '1.0.0-alpha')).toBe(1);
      expect(semverStrategy.compare('1.0.0-alpha', '1.0.0')).toBe(-1);

      // Numeric prerelease comparison
      expect(semverStrategy.compare('1.0.0-alpha.2', '1.0.0-alpha.1')).toBe(1);
      expect(semverStrategy.compare('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1);

      // Lexical prerelease comparison
      expect(semverStrategy.compare('1.0.0-beta', '1.0.0-alpha')).toBe(1);
      expect(semverStrategy.compare('1.0.0-alpha', '1.0.0-beta')).toBe(-1);

      // Longer prerelease > shorter
      expect(semverStrategy.compare('1.0.0-alpha.1', '1.0.0-alpha')).toBe(1);
      expect(semverStrategy.compare('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);

      // Numeric < non-numeric
      expect(semverStrategy.compare('1.0.0-1', '1.0.0-alpha')).toBe(-1);
      expect(semverStrategy.compare('1.0.0-alpha', '1.0.0-1')).toBe(1);
    });

    it('should ignore build metadata in comparison', () => {
      expect(semverStrategy.compare('1.0.0+build1', '1.0.0+build2')).toBe(0);
      expect(semverStrategy.compare('1.0.0', '1.0.0+build')).toBe(0);
    });
  });

  describe('normalize', () => {
    it('should remove leading v', () => {
      expect(semverStrategy.normalize!('v1.0.0')).toBe('1.0.0');
      expect(semverStrategy.normalize!('V1.0.0')).toBe('1.0.0');
    });

    it('should trim whitespace', () => {
      expect(semverStrategy.normalize!(' 1.0.0 ')).toBe('1.0.0');
      expect(semverStrategy.normalize!('\t1.0.0\n')).toBe('1.0.0');
    });

    it('should preserve valid versions', () => {
      expect(semverStrategy.normalize!('1.0.0')).toBe('1.0.0');
      expect(semverStrategy.normalize!('1.0.0-alpha')).toBe('1.0.0-alpha');
      expect(semverStrategy.normalize!('1.0.0+build')).toBe('1.0.0+build');
    });

    it('should throw for invalid versions', () => {
      expect(() => semverStrategy.normalize!('invalid')).toThrow(
        /Invalid semver/,
      );
      expect(() => semverStrategy.normalize!('1.0')).toThrow(/Invalid semver/);
      expect(() => semverStrategy.normalize!('')).toThrow(/Invalid semver/);
    });
  });

  describe('parse', () => {
    it('should parse basic semver', () => {
      const result = semverStrategy.parse!('1.2.3');
      expect(result.parts).toEqual([1, 2, 3]);
      expect(result.prerelease).toBeUndefined();
      expect(result.build).toBeUndefined();
    });

    it('should parse semver with prerelease', () => {
      const result = semverStrategy.parse!('1.2.3-alpha.1');
      expect(result.parts).toEqual([1, 2, 3]);
      expect(result.prerelease).toBe('alpha.1');
      expect(result.build).toBeUndefined();
    });

    it('should parse semver with build metadata', () => {
      const result = semverStrategy.parse!('1.2.3+build.123');
      expect(result.parts).toEqual([1, 2, 3]);
      expect(result.prerelease).toBeUndefined();
      expect(result.build).toBe('build.123');
    });

    it('should parse semver with both prerelease and build', () => {
      const result = semverStrategy.parse!('1.2.3-alpha+build');
      expect(result.parts).toEqual([1, 2, 3]);
      expect(result.prerelease).toBe('alpha');
      expect(result.build).toBe('build');
    });

    it('should normalize before parsing', () => {
      const result = semverStrategy.parse!('v1.2.3');
      expect(result.parts).toEqual([1, 2, 3]);
    });

    it('should throw for invalid versions', () => {
      expect(() => semverStrategy.parse!('invalid')).toThrow(/Invalid semver/);
      expect(() => semverStrategy.parse!('1.0')).toThrow(/Invalid semver/);
    });
  });

  describe('increment', () => {
    it('should increment major version', () => {
      expect(semverStrategy.increment!('1.2.3', 'major')).toBe('2.0.0');
      expect(semverStrategy.increment!('0.0.1', 'major')).toBe('1.0.0');
      expect(semverStrategy.increment!('1.2.3-alpha', 'major')).toBe('2.0.0');
    });

    it('should increment minor version', () => {
      expect(semverStrategy.increment!('1.2.3', 'minor')).toBe('1.3.0');
      expect(semverStrategy.increment!('1.0.0', 'minor')).toBe('1.1.0');
      expect(semverStrategy.increment!('1.2.3-alpha', 'minor')).toBe('1.3.0');
    });

    it('should increment patch version', () => {
      expect(semverStrategy.increment!('1.2.3', 'patch')).toBe('1.2.4');
      expect(semverStrategy.increment!('1.2.0', 'patch')).toBe('1.2.1');
      expect(semverStrategy.increment!('1.2.3-alpha', 'patch')).toBe('1.2.4');
    });

    it('should increment prerelease version', () => {
      // Add prerelease to version without one
      expect(semverStrategy.increment!('1.2.3', 'prerelease')).toBe(
        '1.2.4-0',
      );

      // Increment numeric prerelease
      expect(semverStrategy.increment!('1.2.3-0', 'prerelease')).toBe(
        '1.2.3-1',
      );
      expect(semverStrategy.increment!('1.2.3-alpha.1', 'prerelease')).toBe(
        '1.2.3-alpha.2',
      );

      // Append .1 to non-numeric prerelease
      expect(semverStrategy.increment!('1.2.3-alpha', 'prerelease')).toBe(
        '1.2.3-alpha.1',
      );
    });

    it('should handle edge cases', () => {
      expect(semverStrategy.increment!('0.0.0', 'major')).toBe('1.0.0');
      expect(semverStrategy.increment!('999.999.999', 'patch')).toBe(
        '999.999.1000',
      );
    });
  });
});

describe('calverStrategy', () => {
  describe('isValid', () => {
    it('should accept valid calver strings', () => {
      expect(calverStrategy.isValid('2024-01-15')).toBe(true);
      expect(calverStrategy.isValid('2024.01.15')).toBe(true);
      expect(calverStrategy.isValid('20240115')).toBe(true);
      expect(calverStrategy.isValid('2025-12-31')).toBe(true);
    });

    it('should reject invalid calver strings', () => {
      expect(calverStrategy.isValid('2024-1-15')).toBe(false);
      expect(calverStrategy.isValid('2024-01-5')).toBe(false);
      expect(calverStrategy.isValid('24-01-15')).toBe(false);
      expect(calverStrategy.isValid('not-a-date')).toBe(false);
      expect(calverStrategy.isValid('')).toBe(false);
      expect(calverStrategy.isValid('2024-13-01')).toBe(true); // Note: doesn't validate actual date validity
    });
  });

  describe('compare', () => {
    it('should compare dates correctly', () => {
      expect(calverStrategy.compare('2024-02-01', '2024-01-01')).toBe(1);
      expect(calverStrategy.compare('2024-01-01', '2024-02-01')).toBe(-1);
      expect(calverStrategy.compare('2024-01-01', '2024-01-01')).toBe(0);
    });

    it('should compare years', () => {
      expect(calverStrategy.compare('2025-01-01', '2024-01-01')).toBe(1);
      expect(calverStrategy.compare('2023-01-01', '2024-01-01')).toBe(-1);
    });

    it('should compare months', () => {
      expect(calverStrategy.compare('2024-02-01', '2024-01-31')).toBe(1);
      expect(calverStrategy.compare('2024-01-15', '2024-02-01')).toBe(-1);
    });

    it('should compare days', () => {
      expect(calverStrategy.compare('2024-01-15', '2024-01-14')).toBe(1);
      expect(calverStrategy.compare('2024-01-14', '2024-01-15')).toBe(-1);
    });

    it('should handle different formats', () => {
      expect(calverStrategy.compare('2024.01.15', '2024-01-14')).toBe(1);
      expect(calverStrategy.compare('20240115', '2024-01-14')).toBe(1);
    });
  });

  describe('normalize', () => {
    it('should normalize to YYYY-MM-DD format', () => {
      expect(calverStrategy.normalize!('2024.01.15')).toBe('2024-01-15');
      expect(calverStrategy.normalize!('20240115')).toBe('2024-01-15');
      expect(calverStrategy.normalize!('2024-01-15')).toBe('2024-01-15');
    });

    it('should throw for invalid versions', () => {
      expect(() => calverStrategy.normalize!('invalid')).toThrow(
        /Invalid calver/,
      );
      expect(() => calverStrategy.normalize!('2024-1-15')).toThrow(
        /Invalid calver/,
      );
      expect(() => calverStrategy.normalize!('')).toThrow(/Invalid calver/);
    });
  });

  describe('parse', () => {
    it('should parse calver into numeric parts', () => {
      const result = calverStrategy.parse!('2024-01-15');
      expect(result.parts).toEqual([2024, 1, 15]);
    });

    it('should normalize before parsing', () => {
      const result1 = calverStrategy.parse!('2024.01.15');
      expect(result1.parts).toEqual([2024, 1, 15]);

      const result2 = calverStrategy.parse!('20240115');
      expect(result2.parts).toEqual([2024, 1, 15]);
    });
  });

  describe('increment', () => {
    it('should return current date regardless of input version', () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      expect(calverStrategy.increment!('2020-01-01', 'major')).toBe(expected);
      expect(calverStrategy.increment!('2024-06-15', 'minor')).toBe(expected);
      expect(calverStrategy.increment!('2025-12-31', 'patch')).toBe(expected);
    });

    it('should ignore increment type parameter', () => {
      const result1 = calverStrategy.increment!('2024-01-01', 'major');
      const result2 = calverStrategy.increment!('2024-01-01', 'minor');
      const result3 = calverStrategy.increment!('2024-01-01', 'patch');

      // All should return the same date (today)
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });
});

describe('integerStrategy', () => {
  describe('isValid', () => {
    it('should accept valid integer strings', () => {
      expect(integerStrategy.isValid('1')).toBe(true);
      expect(integerStrategy.isValid('100')).toBe(true);
      expect(integerStrategy.isValid('0')).toBe(true);
      expect(integerStrategy.isValid('999999')).toBe(true);
    });

    it('should reject invalid integer strings', () => {
      expect(integerStrategy.isValid('1.0')).toBe(false);
      expect(integerStrategy.isValid('-1')).toBe(false);
      expect(integerStrategy.isValid('v1')).toBe(false);
      expect(integerStrategy.isValid('not-a-number')).toBe(false);
      expect(integerStrategy.isValid('')).toBe(false);
      expect(integerStrategy.isValid('1.2.3')).toBe(false);
      expect(integerStrategy.isValid('+1')).toBe(false);
    });

    it('should reject leading zeros for multi-digit numbers', () => {
      expect(integerStrategy.isValid('01')).toBe(false);
      expect(integerStrategy.isValid('001')).toBe(false);
    });
  });

  describe('compare', () => {
    it('should compare integers correctly', () => {
      expect(integerStrategy.compare('2', '1')).toBe(1);
      expect(integerStrategy.compare('1', '2')).toBe(-1);
      expect(integerStrategy.compare('1', '1')).toBe(0);
    });

    it('should handle multi-digit numbers', () => {
      expect(integerStrategy.compare('10', '9')).toBe(1);
      expect(integerStrategy.compare('100', '99')).toBe(1);
      expect(integerStrategy.compare('9', '10')).toBe(-1);
    });

    it('should handle zero', () => {
      expect(integerStrategy.compare('0', '1')).toBe(-1);
      expect(integerStrategy.compare('1', '0')).toBe(1);
      expect(integerStrategy.compare('0', '0')).toBe(0);
    });

    it('should handle large numbers', () => {
      expect(integerStrategy.compare('1000000', '999999')).toBe(1);
      expect(integerStrategy.compare('999999', '1000000')).toBe(-1);
    });
  });

  describe('normalize', () => {
    it('should return valid integers unchanged', () => {
      expect(integerStrategy.normalize!('1')).toBe('1');
      expect(integerStrategy.normalize!('100')).toBe('100');
      expect(integerStrategy.normalize!('0')).toBe('0');
    });

    it('should throw for invalid integers', () => {
      expect(() => integerStrategy.normalize!('invalid')).toThrow(
        /Invalid integer version/,
      );
      expect(() => integerStrategy.normalize!('1.0')).toThrow(
        /Invalid integer version/,
      );
      expect(() => integerStrategy.normalize!('-1')).toThrow(
        /Invalid integer version/,
      );
      expect(() => integerStrategy.normalize!('')).toThrow(
        /Invalid integer version/,
      );
    });
  });

  describe('parse', () => {
    it('should parse integer into single-element array', () => {
      const result = integerStrategy.parse!('42');
      expect(result.parts).toEqual([42]);
    });

    it('should handle zero', () => {
      const result = integerStrategy.parse!('0');
      expect(result.parts).toEqual([0]);
    });

    it('should handle large numbers', () => {
      const result = integerStrategy.parse!('999999');
      expect(result.parts).toEqual([999999]);
    });

    it('should throw for invalid integers', () => {
      expect(() => integerStrategy.parse!('invalid')).toThrow(
        /Invalid integer version/,
      );
      expect(() => integerStrategy.parse!('1.0')).toThrow(
        /Invalid integer version/,
      );
    });
  });

  describe('increment', () => {
    it('should increment by 1', () => {
      expect(integerStrategy.increment!('1', 'patch')).toBe('2');
      expect(integerStrategy.increment!('99', 'major')).toBe('100');
      expect(integerStrategy.increment!('0', 'minor')).toBe('1');
    });

    it('should ignore increment type parameter', () => {
      expect(integerStrategy.increment!('5', 'major')).toBe('6');
      expect(integerStrategy.increment!('5', 'minor')).toBe('6');
      expect(integerStrategy.increment!('5', 'patch')).toBe('6');
      expect(integerStrategy.increment!('5', 'prerelease')).toBe('6');
    });

    it('should handle large numbers', () => {
      expect(integerStrategy.increment!('999999', 'patch')).toBe('1000000');
    });
  });
});
