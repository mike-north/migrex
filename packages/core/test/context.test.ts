import { describe, it, expect, beforeEach } from 'vitest';
import { createMigrationContext } from '../src/context.js';
import type { MigrationContextImpl } from '../src/context.js';

describe('MigrationContext', () => {
  let context: MigrationContextImpl;

  beforeEach(() => {
    context = createMigrationContext(3);
    context.setCurrentStep({
      from: '1.0.0',
      to: '2.0.0',
      direction: 'up',
      index: 0,
      totalSteps: 3,
    });
  });

  describe('preserve', () => {
    it('should preserve a field', () => {
      const result = context.preserve('theme', 'dark');
      expect(result.status).toBe('preserved');
      expect(result.field.kind).toBe('single');
      if (result.status === 'preserved' && result.field.kind === 'single') {
        expect(result.field.value).toBe('dark');
        expect(result.field.path).toBe('theme');
      }
    });

    it('should return already_preserved for same value', () => {
      context.preserve('theme', 'dark');
      const result = context.preserve('theme', 'dark');
      expect(result.status).toBe('already_preserved');
      expect(result).toHaveProperty('note');
    });

    it('should create multi-value for different values', () => {
      context.preserve('theme', 'dark');

      // Move to next step
      context.setCurrentStep({
        from: '2.0.0',
        to: '3.0.0',
        direction: 'up',
        index: 1,
        totalSteps: 3,
      });

      const result = context.preserve('theme', 'light');
      expect(result.status).toBe('preserved');
      expect(result.field.kind).toBe('multi');
      if (result.field.kind === 'multi') {
        expect(result.field.entries).toHaveLength(2);
        expect(result.field.entries[0].value).toBe('dark');
        expect(result.field.entries[1].value).toBe('light');
        expect(result.field.valuesEquivalent).toBe(false);
      }
    });

    it('should include metadata', () => {
      const result = context.preserve('theme', 'dark', {
        sourceVersion: '1.0.0',
        description: 'User theme preference',
      });

      expect(result.status).toBe('preserved');
      if (result.status === 'preserved' && result.field.kind === 'single') {
        expect(result.field.metadata?.sourceVersion).toBe('1.0.0');
        expect(result.field.metadata?.description).toBe(
          'User theme preference'
        );
      }
    });

    it('should handle complex object values', () => {
      const complexValue = { nested: { data: [1, 2, 3] } };
      const result = context.preserve('config', complexValue);
      expect(result.status).toBe('preserved');
      if (result.status === 'preserved' && result.field.kind === 'single') {
        expect(result.field.value).toEqual(complexValue);
      }
    });

    it('should detect equivalent complex values', () => {
      const value1 = { a: 1, b: 2 };
      const value2 = { a: 1, b: 2 };
      context.preserve('data', value1);
      const result = context.preserve('data', value2);
      expect(result.status).toBe('already_preserved');
    });
  });

  describe('hasPreserved', () => {
    it('should return true for preserved fields', () => {
      context.preserve('theme', 'dark');
      expect(context.hasPreserved('theme')).toBe(true);
    });

    it('should return false for non-preserved fields', () => {
      expect(context.hasPreserved('theme')).toBe(false);
    });

    it('should return false for consumed fields', () => {
      context.preserve('theme', 'dark');
      context.consume('theme');
      expect(context.hasPreserved('theme')).toBe(false);
    });

    it('should return false for non-existent fields', () => {
      expect(context.hasPreserved('nonexistent')).toBe(false);
    });
  });

  describe('consume', () => {
    it('should consume a preserved field', () => {
      context.preserve('theme', 'dark');
      const result = context.consume('theme');
      expect(result).toBeDefined();
      expect(result?.kind).toBe('single');
      if (result?.kind === 'single') {
        expect(result.value).toBe('dark');
      }
    });

    it('should return undefined for non-preserved fields', () => {
      const result = context.consume('theme');
      expect(result).toBeUndefined();
    });

    it('should mark field as consumed', () => {
      context.preserve('theme', 'dark');
      context.consume('theme');
      expect(context.hasPreserved('theme')).toBe(false);
    });

    it('should not allow consuming the same field twice', () => {
      context.preserve('theme', 'dark');
      const first = context.consume('theme');
      expect(first).toBeDefined();

      const second = context.consume('theme');
      expect(second).toBeUndefined();
    });

    it('should consume multi-value preservation', () => {
      context.preserve('theme', 'dark');
      context.setCurrentStep({
        from: '2.0.0',
        to: '3.0.0',
        direction: 'up',
        index: 1,
        totalSteps: 3,
      });
      context.preserve('theme', 'light');

      const result = context.consume('theme');
      expect(result?.kind).toBe('multi');
    });
  });

  describe('peek', () => {
    it('should return preserved field without consuming', () => {
      context.preserve('theme', 'dark');
      const result = context.peek('theme');
      expect(result).toBeDefined();
      expect(result?.kind).toBe('single');
      expect(context.hasPreserved('theme')).toBe(true);
    });

    it('should return undefined for non-preserved fields', () => {
      const result = context.peek('theme');
      expect(result).toBeUndefined();
    });

    it('should return undefined for consumed fields', () => {
      context.preserve('theme', 'dark');
      context.consume('theme');
      const result = context.peek('theme');
      expect(result).toBeUndefined();
    });

    it('should allow multiple peeks', () => {
      context.preserve('theme', 'dark');
      const first = context.peek('theme');
      const second = context.peek('theme');
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(context.hasPreserved('theme')).toBe(true);
    });
  });

  describe('listPreserved', () => {
    it('should list all preserved fields', () => {
      context.preserve('theme', 'dark');
      context.preserve('fontSize', 14);
      const list = context.listPreserved();
      expect(list).toHaveLength(2);
      expect(list.map((f) => f.path)).toContain('theme');
      expect(list.map((f) => f.path)).toContain('fontSize');
    });

    it('should not include consumed fields', () => {
      context.preserve('theme', 'dark');
      context.preserve('fontSize', 14);
      context.consume('theme');
      const list = context.listPreserved();
      expect(list).toHaveLength(1);
      expect(list[0].path).toBe('fontSize');
    });

    it('should return empty array when no fields preserved', () => {
      const list = context.listPreserved();
      expect(list).toHaveLength(0);
    });

    it('should handle mix of single and multi-value preservations', () => {
      context.preserve('theme', 'dark');
      context.preserve('fontSize', 14);

      context.setCurrentStep({
        from: '2.0.0',
        to: '3.0.0',
        direction: 'up',
        index: 1,
        totalSteps: 3,
      });
      context.preserve('theme', 'light');

      const list = context.listPreserved();
      expect(list).toHaveLength(2);
      const theme = list.find((f) => f.path === 'theme');
      const fontSize = list.find((f) => f.path === 'fontSize');
      expect(theme?.kind).toBe('multi');
      expect(fontSize?.kind).toBe('single');
    });
  });

  describe('currentStep', () => {
    it('should return current step info', () => {
      expect(context.currentStep.from).toBe('1.0.0');
      expect(context.currentStep.to).toBe('2.0.0');
      expect(context.currentStep.direction).toBe('up');
      expect(context.currentStep.index).toBe(0);
      expect(context.currentStep.totalSteps).toBe(3);
    });

    it('should update when setCurrentStep is called', () => {
      context.setCurrentStep({
        from: '2.0.0',
        to: '3.0.0',
        direction: 'up',
        index: 1,
        totalSteps: 3,
      });

      expect(context.currentStep.from).toBe('2.0.0');
      expect(context.currentStep.to).toBe('3.0.0');
      expect(context.currentStep.index).toBe(1);
    });

    it('should return immutable copy', () => {
      const step = context.currentStep;
      expect(() => {
        // @ts-expect-error - Testing immutability
        step.from = '3.0.0';
      }).not.toThrow();
      expect(context.currentStep.from).toBe('1.0.0'); // Should not change
    });
  });

  describe('getSummary', () => {
    it('should return correct summary', () => {
      context.preserve('theme', 'dark');
      context.preserve('fontSize', 14);
      context.consume('theme');

      const summary = context.getSummary();
      expect(summary.consumed).toHaveLength(1);
      expect(summary.unconsumed).toHaveLength(1);
      expect(summary.lossless).toBe(false);
      expect(summary.consumed[0].path).toBe('theme');
      expect(summary.unconsumed[0].path).toBe('fontSize');
    });

    it('should be lossless when all consumed', () => {
      context.preserve('theme', 'dark');
      context.consume('theme');

      const summary = context.getSummary();
      expect(summary.lossless).toBe(true);
      expect(summary.unconsumed).toHaveLength(0);
    });

    it('should not be lossless when nothing consumed', () => {
      context.preserve('theme', 'dark');

      const summary = context.getSummary();
      expect(summary.lossless).toBe(false);
      expect(summary.consumed).toHaveLength(0);
    });

    it('should include preservation history', () => {
      context.preserve('theme', 'dark');
      const summary = context.getSummary();
      expect(summary.unconsumed[0].history).toHaveLength(1);
      expect(summary.unconsumed[0].history[0].type).toBe('preserved');
      expect(summary.unconsumed[0].preservedAt).toBe('1.0.0');
    });

    it('should track consumedAt', () => {
      context.preserve('theme', 'dark');
      context.setCurrentStep({
        from: '2.0.0',
        to: '3.0.0',
        direction: 'up',
        index: 1,
        totalSteps: 3,
      });
      context.consume('theme');

      const summary = context.getSummary();
      expect(summary.consumed[0].consumedAt).toBe('3.0.0');
    });
  });

  describe('getAuditLog', () => {
    it('should return audit log string', () => {
      context.preserve('theme', 'dark');
      const log = context.getAuditLog();
      expect(log).toContain('Preservation Audit Log');
      expect(log).toContain('theme');
      expect(log).toContain('preserved');
    });

    it('should include all events', () => {
      context.preserve('theme', 'dark');
      context.preserve('fontSize', 14);
      context.consume('theme');

      const log = context.getAuditLog();
      expect(log).toContain('[preserved]');
      expect(log).toContain('[consumed]');
      expect(log).toContain('theme');
      expect(log).toContain('fontSize');
    });

    it('should show direction arrows', () => {
      context.preserve('theme', 'dark');
      const log = context.getAuditLog();
      expect(log).toContain('↑'); // up arrow
    });

    it('should show active/consumed status', () => {
      context.preserve('theme', 'dark');
      context.preserve('fontSize', 14);
      context.consume('theme');

      const log = context.getAuditLog();
      expect(log).toContain('(active)');
      expect(log).toContain('(consumed)');
    });
  });

  describe('edge cases', () => {
    it('should handle null values', () => {
      const result = context.preserve('field', null);
      expect(result.status).toBe('preserved');
      if (result.status === 'preserved' && result.field.kind === 'single') {
        expect(result.field.value).toBe(null);
      }
    });

    it('should handle undefined values', () => {
      const result = context.preserve('field', undefined);
      expect(result.status).toBe('preserved');
      if (result.status === 'preserved' && result.field.kind === 'single') {
        expect(result.field.value).toBe(undefined);
      }
    });

    it('should handle array values', () => {
      const arr = [1, 2, 3];
      const result = context.preserve('field', arr);
      expect(result.status).toBe('preserved');
      if (result.status === 'preserved' && result.field.kind === 'single') {
        expect(result.field.value).toEqual(arr);
      }
    });

    it('should handle empty strings', () => {
      const result = context.preserve('field', '');
      expect(result.status).toBe('preserved');
      if (result.status === 'preserved' && result.field.kind === 'single') {
        expect(result.field.value).toBe('');
      }
    });

    it('should handle zero values', () => {
      const result = context.preserve('field', 0);
      expect(result.status).toBe('preserved');
      if (result.status === 'preserved' && result.field.kind === 'single') {
        expect(result.field.value).toBe(0);
      }
    });

    it('should handle boolean values', () => {
      context.preserve('flag1', true);
      context.preserve('flag2', false);
      expect(context.hasPreserved('flag1')).toBe(true);
      expect(context.hasPreserved('flag2')).toBe(true);
    });

    it('should handle down migrations', () => {
      context.setCurrentStep({
        from: '2.0.0',
        to: '1.0.0',
        direction: 'down',
        index: 0,
        totalSteps: 1,
      });

      const result = context.preserve('theme', 'dark');
      expect(result.status).toBe('preserved');

      const log = context.getAuditLog();
      expect(log).toContain('↓'); // down arrow
    });
  });

  describe('preservation conflicts', () => {
    it('should handle re-preserving same field with same value', () => {
      context.preserve('theme', 'dark');
      const result = context.preserve('theme', 'dark');

      // Should return already_preserved status
      expect(result.status).toBe('already_preserved');
      expect(result).toHaveProperty('note');
    });

    it('should handle re-preserving same field with different value in same step', () => {
      context.preserve('theme', 'dark');
      const result = context.preserve('theme', 'light');

      // Different value creates a multi-value preservation even in same step
      expect(result.status).toBe('preserved');
      expect(result.field.kind).toBe('multi');
    });

    it('should create multi-value when preserving different values in different steps', () => {
      context.preserve('theme', 'dark');

      // Move to next step
      context.setCurrentStep({
        from: '2.0.0',
        to: '3.0.0',
        direction: 'up',
        index: 1,
        totalSteps: 3,
      });

      const result = context.preserve('theme', 'light');

      // Now it should create a multi-value field
      expect(result.status).toBe('preserved');
      expect(result.field.kind).toBe('multi');
      if (result.field.kind === 'multi') {
        expect(result.field.entries).toHaveLength(2);
        expect(result.field.valuesEquivalent).toBe(false);
      }
    });

    it('should allow preserving after consuming with different value', () => {
      context.preserve('theme', 'dark');
      const consumed = context.consume('theme');
      expect(consumed).toBeDefined();
      expect(context.hasPreserved('theme')).toBe(false);

      // Preserve again after consuming with different value - creates multi-value
      const result = context.preserve('theme', 'light');
      expect(result.status).toBe('preserved');
      expect(result.field.kind).toBe('multi');
      // But hasPreserved still returns false because the field is marked as consumed
      expect(context.hasPreserved('theme')).toBe(false);
    });

    it('should handle preserving same field multiple times across steps', () => {
      // Preserve in step 0
      context.preserve('theme', 'dark');

      // Move to step 1
      context.setCurrentStep({
        from: '2.0.0',
        to: '3.0.0',
        direction: 'up',
        index: 1,
        totalSteps: 3,
      });
      context.preserve('theme', 'light');

      // Move to step 2
      context.setCurrentStep({
        from: '3.0.0',
        to: '4.0.0',
        direction: 'up',
        index: 2,
        totalSteps: 3,
      });
      const result = context.preserve('theme', 'system');

      // Should have 3 values now
      expect(result.status).toBe('preserved');
      expect(result.field.kind).toBe('multi');
      if (result.field.kind === 'multi') {
        expect(result.field.entries).toHaveLength(3);
      }
    });

    it('should detect equivalent values in multi-value preservation', () => {
      context.preserve('theme', 'dark');

      // Move to next step
      context.setCurrentStep({
        from: '2.0.0',
        to: '3.0.0',
        direction: 'up',
        index: 1,
        totalSteps: 3,
      });

      // Preserve same value again - should return already_preserved
      const result = context.preserve('theme', 'dark');

      expect(result.status).toBe('already_preserved');
      expect(result.field.kind).toBe('single'); // Still single since value is same
    });
  });
});
