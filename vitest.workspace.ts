import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
  {
    test: {
      name: 'unit',
      include: ['packages/*/test/**/*.test.ts'],
    },
  },
]);
