import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    'packages/*': {
      ignore: ['temp/**', 'dist/**'],
    },
  },
  ignoreDependencies: [
    // Build tools used via scripts, not directly imported
    '@microsoft/api-extractor',
    'tsd',
  ],
  // Library packages export types and functions for consumers
  ignoreExportsUsedInFile: true,
};

export default config;
