/**
 * Recommended ESLint configuration for migrex projects.
 * @packageDocumentation
 */

import type { Linter } from 'eslint';

/**
 * Recommended configuration preset.
 * Enables consume-check as error, graph-health as warning.
 */
export const recommended: Linter.Config = {
  rules: {
    '@migrex/consume-check': 'error',
    '@migrex/graph-health': 'warn',
    '@migrex/preserve-metadata': 'off',
  },
};
