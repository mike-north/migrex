/**
 * Strict ESLint configuration for migrex projects.
 * @packageDocumentation
 */

import type { Linter } from 'eslint';

/**
 * Strict configuration preset.
 * Enables all rules with strict settings.
 */
export const strict: Linter.Config = {
  rules: {
    '@migrex/consume-check': ['error', { strict: true }],
    '@migrex/graph-health': ['error', { lossyAsError: true }],
    '@migrex/preserve-metadata': [
      'warn',
      {
        requireMetadata: true,
        requiredFields: ['description', 'sourceVersion'],
      },
    ],
  },
};
