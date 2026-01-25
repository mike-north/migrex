/**
 * Tests for exit codes utility.
 */

import { describe, it, expect } from 'vitest';
import { ExitCode } from '../src/utils/exit-codes.js';

describe('ExitCode', () => {
  it('should define SUCCESS as 0', () => {
    expect(ExitCode.SUCCESS).toBe(0);
  });

  it('should define GENERAL_ERROR as 1', () => {
    expect(ExitCode.GENERAL_ERROR).toBe(1);
  });

  it('should define CONFIG_ERROR as 2', () => {
    expect(ExitCode.CONFIG_ERROR).toBe(2);
  });

  it('should define VALIDATION_ERROR as 3', () => {
    expect(ExitCode.VALIDATION_ERROR).toBe(3);
  });

  it('should define FILE_NOT_FOUND as 4', () => {
    expect(ExitCode.FILE_NOT_FOUND).toBe(4);
  });

  it('should have unique values', () => {
    const values = Object.values(ExitCode);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });
});
