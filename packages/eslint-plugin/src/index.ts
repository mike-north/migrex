/**
 * \@migrex/eslint-plugin - ESLint plugin for migrex
 *
 * This plugin provides ESLint rules for migrex migration code.
 *
 * @packageDocumentation
 */

// ESLint plugin structure
export const rules = {
  'consume-check': {
    meta: {
      type: 'problem' as const,
      docs: {
        description: 'Verify consume() calls handle the correct single/multi case',
        recommended: true,
      },
      schema: [],
    },
    create(_context: unknown) {
      // TODO: Implement rule
      return {};
    },
  },
  'graph-health': {
    meta: {
      type: 'suggestion' as const,
      docs: {
        description: 'Report connectivity issues, deprecated version usage, lossy paths',
        recommended: true,
      },
      schema: [],
    },
    create(_context: unknown) {
      // TODO: Implement rule
      return {};
    },
  },
  'preserve-metadata': {
    meta: {
      type: 'suggestion' as const,
      docs: {
        description: 'Warn when preserve() is called without metadata',
        recommended: false,
      },
      schema: [],
    },
    create(_context: unknown) {
      // TODO: Implement rule
      return {};
    },
  },
};

export const configs = {
  recommended: {
    plugins: ['@migrex'],
    rules: {
      '@migrex/consume-check': 'error',
      '@migrex/graph-health': 'warn',
    },
  },
};
