/**
 * Tests for graph-health ESLint rule.
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { graphHealth } from '../src/rules/graph-health.js';
import { createMigrationGraph } from '@migrex/core';

// Set up the test framework for RuleTester
RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
});

describe('graph-health', () => {

  it('should pass for a fully connected graph', () => {
    const graph = createMigrationGraph({
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

    ruleTester.run('graph-health - fully connected', graphHealth, {
      valid: [
        {
          code: 'const x = 1;',
          options: [{ graph }],
        },
      ],
      invalid: [],
    });
  });

  it('should report disconnected components', () => {
    const graph = createMigrationGraph({
      schemas: [
        {
          version: '1.0.0',
          schema: () => ({ success: true }),
        },
        {
          version: '2.0.0',
          schema: () => ({ success: true }),
        },
        {
          version: '3.0.0',
          schema: () => ({ success: true }),
        },
      ],
      migrations: [
        // Only connect 1.0.0 to 2.0.0, leave 3.0.0 isolated
        {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          up: (data) => data,
          down: (data) => data,
        },
      ],
    });

    ruleTester.run('graph-health - disconnected', graphHealth, {
      valid: [],
      invalid: [
        {
          code: 'const x = 1;',
          options: [{ graph }],
          errors: [
            {
              messageId: 'disconnectedVersions',
            },
          ],
        },
      ],
    });
  });

  it('should report deprecated versions in paths', () => {
    const graph = createMigrationGraph({
      schemas: [
        {
          version: '1.0.0',
          schema: () => ({ success: true }),
          deprecated: {
            since: '2.0.0',
            successor: '2.0.0',
            message: 'Use version 2.0.0 instead',
          },
        },
        {
          version: '2.0.0',
          schema: () => ({ success: true }),
        },
        {
          version: '3.0.0',
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
        {
          fromVersion: '2.0.0',
          toVersion: '3.0.0',
          up: (data) => data,
          down: (data) => data,
        },
      ],
    });

    ruleTester.run('graph-health - deprecated version', graphHealth, {
      valid: [],
      invalid: [
        {
          code: 'const x = 1;',
          options: [{ graph }],
          errors: [
            {
              messageId: 'deprecatedVersionInPath',
            },
          ],
        },
      ],
    });
  });

  it('should report lossy paths', () => {
    const graph = createMigrationGraph({
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
          irreversibleReason: 'Data transformation is not reversible',
          traits: {
            up: {
              lossy: 'Removes legacy field',
            },
          },
        },
      ],
    });

    ruleTester.run('graph-health - lossy path', graphHealth, {
      valid: [],
      invalid: [
        {
          code: 'const x = 1;',
          options: [{ graph }],
          errors: [
            {
              messageId: 'lossyPath',
            },
          ],
        },
      ],
    });
  });

  it('should suggest migrations to improve graph', () => {
    const graph = createMigrationGraph({
      schemas: [
        {
          version: '1.0.0',
          schema: () => ({ success: true }),
        },
        {
          version: '2.0.0',
          schema: () => ({ success: true }),
        },
        {
          version: '3.0.0',
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
        {
          fromVersion: '2.0.0',
          toVersion: '3.0.0',
          up: (data) => data,
          down: (data) => data,
        },
      ],
    });

    ruleTester.run('graph-health - suggest improvements', graphHealth, {
      valid: [],
      invalid: [
        {
          code: 'const x = 1;',
          options: [{ graph, suggestImprovements: true }],
          errors: [
            {
              messageId: 'suggestMigration',
            },
          ],
        },
      ],
    });
  });

  it('should not suggest improvements when disabled', () => {
    const graph = createMigrationGraph({
      schemas: [
        {
          version: '1.0.0',
          schema: () => ({ success: true }),
        },
        {
          version: '2.0.0',
          schema: () => ({ success: true }),
        },
        {
          version: '3.0.0',
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
        {
          fromVersion: '2.0.0',
          toVersion: '3.0.0',
          up: (data) => data,
          down: (data) => data,
        },
      ],
    });

    ruleTester.run(
      'graph-health - no suggestions when disabled',
      graphHealth,
      {
        valid: [
          {
            code: 'const x = 1;',
            options: [{ graph, suggestImprovements: false }],
          },
        ],
        invalid: [],
      }
    );
  });

  it('should handle lossy paths as errors when configured', () => {
    const graph = createMigrationGraph({
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
          irreversibleReason: 'Cannot reverse',
          traits: {
            up: {
              lossy: true,
            },
          },
        },
      ],
    });

    ruleTester.run('graph-health - lossy as error', graphHealth, {
      valid: [],
      invalid: [
        {
          code: 'const x = 1;',
          options: [{ graph, lossyAsError: true }],
          errors: [
            {
              messageId: 'lossyPath',
            },
          ],
        },
      ],
    });
  });

  it('should handle missing graph gracefully', () => {
    ruleTester.run('graph-health - no graph', graphHealth, {
      valid: [
        {
          code: 'const x = 1;',
          options: [{}],
        },
      ],
      invalid: [],
    });
  });

  it('should handle edge cases', () => {
    // Empty graph (no schemas)
    const emptyGraph = createMigrationGraph({
      schemas: [],
      migrations: [],
    });

    ruleTester.run('graph-health - empty graph', graphHealth, {
      valid: [
        {
          code: 'const x = 1;',
          options: [{ graph: emptyGraph }],
        },
      ],
      invalid: [],
    });
  });
});
