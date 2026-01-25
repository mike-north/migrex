/**
 * Tests for preserve-metadata ESLint rule.
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { preserveMetadata } from '../src/rules/preserve-metadata.js';

// Set up the test framework for RuleTester
RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
});

describe('preserve-metadata', () => {

  it('should pass when preserve() is called with metadata', () => {
    ruleTester.run(
      'preserve-metadata - with metadata',
      preserveMetadata,
      {
        valid: [
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('theme', data.theme, {
                  description: 'User theme preference',
                  sourceVersion: '1.0.0'
                });
              }
            `,
            options: [{ requireMetadata: true }],
          },
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('color', data.color, {
                  description: 'Primary color',
                  sourceVersion: '1.0.0',
                  fieldSchema: undefined
                });
              }
            `,
            options: [{ requireMetadata: true }],
          },
        ],
        invalid: [],
      }
    );
  });

  it('should fail when preserve() is called without metadata', () => {
    ruleTester.run(
      'preserve-metadata - without metadata',
      preserveMetadata,
      {
        valid: [],
        invalid: [
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('theme', data.theme);
              }
            `,
            options: [{ requireMetadata: true }],
            errors: [
              {
                messageId: 'missingMetadata',
                data: { field: 'theme' },
                suggestions: [
                  {
                    messageId: 'addMetadata',
                  },
                ],
              },
            ],
          },
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('color', { r: 255, g: 0, b: 0 });
              }
            `,
            options: [{ requireMetadata: true }],
            errors: [
              {
                messageId: 'missingMetadata',
                data: { field: 'color' },
              },
            ],
          },
        ],
      }
    );
  });

  it('should not require metadata when requireMetadata is false', () => {
    ruleTester.run(
      'preserve-metadata - not required',
      preserveMetadata,
      {
        valid: [
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('theme', data.theme);
              }
            `,
            options: [{ requireMetadata: false }],
          },
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('color', data.color);
              }
            `,
            options: [{ requireMetadata: false }],
          },
        ],
        invalid: [],
      }
    );
  });

  it('should fail when required fields are missing from metadata', () => {
    ruleTester.run(
      'preserve-metadata - missing required fields',
      preserveMetadata,
      {
        valid: [
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('theme', data.theme, {
                  description: 'Theme setting',
                  sourceVersion: '1.0.0'
                });
              }
            `,
            options: [
              { requireMetadata: true, requiredFields: ['description'] },
            ],
          },
        ],
        invalid: [
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('theme', data.theme, {
                  sourceVersion: '1.0.0'
                });
              }
            `,
            options: [
              {
                requireMetadata: true,
                requiredFields: ['description', 'sourceVersion'],
              },
            ],
            errors: [
              {
                messageId: 'missingRequiredField',
                data: {
                  field: 'theme',
                  requiredField: 'description',
                },
                suggestions: [
                  {
                    messageId: 'addMetadataWithFields',
                  },
                ],
              },
            ],
          },
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('color', data.color, {
                  description: 'Color value'
                });
              }
            `,
            options: [
              {
                requireMetadata: true,
                requiredFields: ['description', 'sourceVersion'],
              },
            ],
            errors: [
              {
                messageId: 'missingRequiredField',
                data: {
                  field: 'color',
                  requiredField: 'sourceVersion',
                },
              },
            ],
          },
        ],
      }
    );
  });

  it('should check for fieldSchema when required', () => {
    ruleTester.run(
      'preserve-metadata - fieldSchema required',
      preserveMetadata,
      {
        valid: [
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('config', data.config, {
                  description: 'Config object',
                  sourceVersion: '1.0.0',
                  fieldSchema: configSchema
                });
              }
            `,
            options: [
              {
                requireMetadata: true,
                requiredFields: ['description', 'sourceVersion', 'fieldSchema'],
              },
            ],
          },
        ],
        invalid: [
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('config', data.config, {
                  description: 'Config object',
                  sourceVersion: '1.0.0'
                });
              }
            `,
            options: [
              {
                requireMetadata: true,
                requiredFields: ['fieldSchema'],
              },
            ],
            errors: [
              {
                messageId: 'missingRequiredField',
                data: {
                  field: 'config',
                  requiredField: 'fieldSchema',
                },
              },
            ],
          },
        ],
      }
    );
  });

  it('should handle multiple preserve() calls', () => {
    ruleTester.run(
      'preserve-metadata - multiple calls',
      preserveMetadata,
      {
        valid: [
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('theme', data.theme, {
                  description: 'Theme',
                  sourceVersion: '1.0.0'
                });
                ctx.preserve('color', data.color, {
                  description: 'Color',
                  sourceVersion: '1.0.0'
                });
              }
            `,
            options: [{ requireMetadata: true }],
          },
        ],
        invalid: [
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('theme', data.theme);
                ctx.preserve('color', data.color);
              }
            `,
            options: [{ requireMetadata: true }],
            errors: [
              {
                messageId: 'missingMetadata',
                data: { field: 'theme' },
              },
              {
                messageId: 'missingMetadata',
                data: { field: 'color' },
              },
            ],
          },
        ],
      }
    );
  });

  it('should handle edge cases', () => {
    ruleTester.run('preserve-metadata - edge cases', preserveMetadata, {
      valid: [
        // Non-preserve call
        {
          code: `
            function migrate(data, ctx) {
              ctx.consume('theme');
            }
          `,
          options: [{ requireMetadata: true }],
        },
        // Preserve with non-string literal field name
        {
          code: `
            function migrate(data, ctx) {
              const fieldName = 'theme';
              ctx.preserve(fieldName, data.theme);
            }
          `,
          options: [{ requireMetadata: true }],
        },
        // Different context variable name
        {
          code: `
            function migrate(data, context) {
              context.preserve('theme', data.theme, {
                description: 'Theme',
                sourceVersion: '1.0.0'
              });
            }
          `,
          options: [{ requireMetadata: true }],
        },
      ],
      invalid: [],
    });
  });

  it('should pass when metadata is present but some required fields are missing and others are present', () => {
    ruleTester.run(
      'preserve-metadata - partial required fields',
      preserveMetadata,
      {
        valid: [],
        invalid: [
          {
            code: `
              function migrate(data, ctx) {
                ctx.preserve('settings', data.settings, {
                  description: 'User settings'
                });
              }
            `,
            options: [
              {
                requireMetadata: true,
                requiredFields: ['description', 'sourceVersion', 'fieldSchema'],
              },
            ],
            errors: [
              {
                messageId: 'missingRequiredField',
                data: {
                  field: 'settings',
                  requiredField: 'sourceVersion',
                },
              },
              {
                messageId: 'missingRequiredField',
                data: {
                  field: 'settings',
                  requiredField: 'fieldSchema',
                },
              },
            ],
          },
        ],
      }
    );
  });
});
