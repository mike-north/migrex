/**
 * \@migrex/eslint-plugin - ESLint plugin for migrex
 *
 * This plugin provides ESLint rules for migrex migration code.
 *
 * @packageDocumentation
 */

import type { Linter } from 'eslint';
import { consumeCheck, graphHealth, preserveMetadata } from './rules/index.js';
import { recommended, strict } from './configs/index.js';

/**
 * ESLint rules provided by this plugin.
 */
export const rules = {
  'consume-check': consumeCheck,
  'graph-health': graphHealth,
  'preserve-metadata': preserveMetadata,
} as const;

/**
 * ESLint configuration presets.
 */
export const configs: {
  readonly recommended: Linter.Config;
  readonly strict: Linter.Config;
} = {
  recommended: {
    plugins: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      '@migrex': { rules } as any,
    },
    ...recommended,
  },
  strict: {
    plugins: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      '@migrex': { rules } as any,
    },
    ...strict,
  },
};

/**
 * Default export for ESLint 9 flat config.
 */
const plugin = {
  rules,
  configs,
};

export default plugin;
