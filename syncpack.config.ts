import type { RcFile } from 'syncpack';

const config: RcFile = {
  dependencyTypes: ['prod', 'dev', 'peer'],
  semverGroups: [
    {
      range: '^',
      dependencyTypes: ['prod', 'dev'],
      dependencies: ['**'],
      packages: ['**'],
    },
  ],
  versionGroups: [
    {
      dependencies: ['typescript'],
      packages: ['**'],
      policy: 'sameRange',
    },
    {
      dependencies: ['vitest', '@vitest/*'],
      packages: ['**'],
      policy: 'sameRange',
    },
  ],
};

export default config;
