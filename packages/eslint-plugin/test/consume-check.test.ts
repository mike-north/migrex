/**
 * Tests for consume-check ESLint rule.
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { consumeCheck } from '../src/rules/consume-check.js';
import type { MigrationGraph, FieldProfile } from '@migrex/core';
import { createMigrationGraph, semverStrategy } from '@migrex/core';

// Set up the test framework for RuleTester
RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

// Create a mock graph for testing
function createMockGraph(
  fieldProfiles: Record<string, FieldProfile>
): MigrationGraph {
  // Create a simple graph with two versions
  const graph = createMigrationGraph({
    id: 'test-graph',
    versionStrategy: semverStrategy,
    schemas: [
      {
        version: '1.0.0',
        schema: () => ({ success: true }),
      },
      {
        version: '2.0.0',
        schema: () => ({ success: true }),
      },
    ],
    migrations: [
      {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        up: (data) => data,
        down: (data) => data,
      },
    ],
  });

  return graph;
}

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
});

describe('consume-check', () => {

  it('should pass when field.kind is checked before accessing field.value', () => {
    ruleTester.run('consume-check - with kind check', consumeCheck, {
      valid: [
        {
          code: `
            function migrate(data, ctx) {
              const field = ctx.consume('theme');
              if (field && field.kind === 'single') {
                return field.value;
              }
            }
          `,
        },
        {
          code: `
            function migrate(data, ctx) {
              const field = ctx.consume('color');
              switch (field.kind) {
                case 'single':
                  return field.value;
                case 'multi':
                  return field.entries[0].value;
              }
            }
          `,
        },
        {
          code: `
            function migrate(data, ctx) {
              const field = ctx.consume('settings');
              if (field?.kind === 'multi') {
                return field.entries;
              }
              return field?.value;
            }
          `,
        },
      ],
      invalid: [],
    });
  });

  it('should fail when field.value is accessed without kind check', () => {
    ruleTester.run(
      'consume-check - without kind check',
      consumeCheck,
      {
        valid: [],
        invalid: [
          {
            code: `
              function migrate(data, ctx) {
                const field = ctx.consume('theme');
                return field.value;
              }
            `,
            errors: [
              {
                messageId: 'unsafeFieldAccess',
              },
            ],
          },
          {
            code: `
              function migrate(data, ctx) {
                const field = ctx.consume('color');
                const value = field?.value;
                return value;
              }
            `,
            errors: [
              {
                messageId: 'unsafeFieldAccess',
              },
            ],
          },
        ],
      }
    );
  });

  it('should fail for sometimes-multi fields without kind check', () => {
    const graph = createMockGraph({
      theme: 'sometimes-multi',
    });

    ruleTester.run(
      'consume-check - sometimes-multi field',
      consumeCheck,
      {
        valid: [
          {
            code: `
              function migrate(data, ctx) {
                const field = ctx.consume('theme');
                if (field.kind === 'single') {
                  return field.value;
                }
                return field.entries.map(e => e.value);
              }
            `,
            options: [{ graph }],
          },
        ],
        invalid: [
          {
            code: `
              function migrate(data, ctx) {
                const field = ctx.consume('theme');
                return field.value;
              }
            `,
            options: [{ graph }],
            errors: [
              {
                messageId: 'missingMultiHandling',
                data: { field: 'theme' },
              },
              {
                messageId: 'unsafeFieldAccess',
              },
            ],
          },
        ],
      }
    );
  });

  it('should handle always-single fields without requiring kind check in non-strict mode', () => {
    const graph = createMockGraph({
      color: 'always-single',
    });

    ruleTester.run(
      'consume-check - always-single field non-strict',
      consumeCheck,
      {
        valid: [
          {
            code: `
              function migrate(data, ctx) {
                const field = ctx.consume('color');
                if (field.kind === 'single') {
                  return field.value;
                }
              }
            `,
            options: [{ graph, strict: false }],
          },
        ],
        invalid: [
          // Still requires kind check for safe access
          {
            code: `
              function migrate(data, ctx) {
                const field = ctx.consume('color');
                return field.value;
              }
            `,
            options: [{ graph, strict: false }],
            errors: [
              {
                messageId: 'unsafeFieldAccess',
              },
            ],
          },
        ],
      }
    );
  });

  it('should require kind check for always-single fields in strict mode', () => {
    const graph = createMockGraph({
      color: 'always-single',
    });

    ruleTester.run(
      'consume-check - always-single field strict',
      consumeCheck,
      {
        valid: [
          {
            code: `
              function migrate(data, ctx) {
                const field = ctx.consume('color');
                if (field.kind === 'single') {
                  return field.value;
                }
              }
            `,
            options: [{ graph, strict: true }],
          },
        ],
        invalid: [
          {
            code: `
              function migrate(data, ctx) {
                ctx.consume('color');
              }
            `,
            options: [{ graph, strict: true }],
            errors: [
              {
                messageId: 'missingKindCheck',
                data: { field: 'color' },
              },
            ],
          },
        ],
      }
    );
  });

  it('should handle nested conditionals with kind checks', () => {
    ruleTester.run(
      'consume-check - nested conditionals',
      consumeCheck,
      {
        valid: [
          {
            code: `
              function migrate(data, ctx) {
                const field = ctx.consume('theme');
                if (field) {
                  if (field.kind === 'single') {
                    return field.value;
                  } else if (field.kind === 'multi') {
                    return field.entries[0].value;
                  }
                }
              }
            `,
          },
          {
            code: `
              function migrate(data, ctx) {
                const field = ctx.consume('settings');
                const result = field && field.kind === 'single' ? field.value : null;
                return result;
              }
            `,
          },
        ],
        invalid: [],
      }
    );
  });

  it('should handle edge cases', () => {
    ruleTester.run('consume-check - edge cases', consumeCheck, {
      valid: [
        // No consume call
        {
          code: `
            function migrate(data, ctx) {
              return data;
            }
          `,
        },
        // Consume with non-string literal
        {
          code: `
            function migrate(data, ctx) {
              const fieldName = 'theme';
              ctx.consume(fieldName);
            }
          `,
        },
        // Different context variable name
        {
          code: `
            function migrate(data, context) {
              const field = context.consume('theme');
              if (field.kind === 'single') {
                return field.value;
              }
            }
          `,
        },
      ],
      invalid: [],
    });
  });
});
