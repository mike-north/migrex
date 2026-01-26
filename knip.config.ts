import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    'packages/*': {
      ignore: ['temp/**', 'dist/**'],
      // Test helpers are not directly imported but used for testing
      entry: ['test/**/*.ts'],
    },
    // Core package has examples directory
    'packages/core': {
      ignore: ['temp/**', 'dist/**'],
      entry: ['test/**/*.ts', 'examples/**/*.ts'],
    },
  },
  ignoreDependencies: [
    // Build tools used via scripts, not directly imported
    '@microsoft/api-extractor',
    '@api-extractor-tools/declaration-file-normalizer',
    'tsd',
  ],
  // Library packages export types and functions for consumers
  ignoreExportsUsedInFile: true,
  // Treat unused exports as warnings (internal testing utilities with _ prefix)
  rules: {
    exports: 'warn',
  },
};

export default config;
