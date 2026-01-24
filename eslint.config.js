import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            '*.config.ts',
            'packages/*/tsup.config.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-plusplus': 'off',
      // Allow non-null assertions where we know the value exists
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Allow Array<T> syntax
      '@typescript-eslint/array-type': 'off',
      // Template literals with numbers is fine
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/temp/**',
      '**/*.js',
      '**/*.mjs',
      // Config files not part of a tsconfig project
      '*.config.ts',
      '**/tsup.config.ts',
      'vitest.workspace.ts',
      // Test files (linted by their respective tsconfig)
      '**/test/**',
      '**/test-d/**',
      // Example files not part of tsconfig
      '**/examples/**',
    ],
  }
);
