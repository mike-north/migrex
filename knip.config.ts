import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: ['packages/*/src/index.ts'],
      project: ['packages/*/src/**/*.ts'],
      ignore: ['**/temp/**', '**/dist/**'],
    },
    'packages/*': {
      entry: ['src/index.ts'],
      project: ['src/**/*.ts'],
      ignore: ['temp/**', 'dist/**'],
    },
  },
  ignoreDependencies: [
    // Build tools used via scripts, not directly imported
    '@microsoft/api-extractor',
    'tsd',
    // ESLint is a peer dep for eslint-plugin packages
    'eslint',
    // Peer dependencies that are used at runtime
    '@migrex/core',
  ],
  // These types are exported for library consumers
  ignoreExportsUsedInFile: true,
};

export default config;
