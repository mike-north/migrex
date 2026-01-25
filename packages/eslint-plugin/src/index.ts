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
       
      '@migrex': { rules } as unknown,
    },
    ...recommended,
  } as unknown as Linter.Config,
  strict: {
    plugins: {
       
      '@migrex': { rules } as unknown,
    },
    ...strict,
  } as unknown as Linter.Config,
};

/**
 * Default export for ESLint 9 flat config.
 */
const plugin = {
  rules,
  configs,
};

export default plugin;
