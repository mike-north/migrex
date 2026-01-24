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
    // Add any dependencies that are used but KNIP can't detect
  ],
};

export default config;
