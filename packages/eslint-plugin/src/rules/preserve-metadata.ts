/**
 * ESLint rule: preserve-metadata
 *
 * Warns when preserve() is called without metadata.
 * Optionally requires specific metadata fields (description, sourceVersion).
 *
 * @packageDocumentation
 */

import { ESLintUtils } from '@typescript-eslint/utils';
import {
  getPreserveFieldName,
  hasPreserveMetadata,
} from '../utils/ast-helpers.js';

type MessageIds =
  | 'missingMetadata'
  | 'missingRequiredField'
  | 'addMetadata'
  | 'addMetadataWithFields';

/**
 * Options for the preserve-metadata rule.
 */
export interface PreserveMetadataRuleOptions {
  /**
   * Whether to require metadata on all preserve() calls.
   * @default true
   */
  requireMetadata?: boolean;

  /**
   * Specific metadata fields that are required.
   * @default []
   */
  requiredFields?: ('description' | 'sourceVersion' | 'fieldSchema')[];
}

export const preserveMetadata = ESLintUtils.RuleCreator.withoutDocs<
  [PreserveMetadataRuleOptions?],
  MessageIds
>({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Warn when preserve() is called without metadata',
    },
    messages: {
      missingMetadata:
        'Call to preserve("{{field}}") is missing metadata argument. Add a third argument with description and sourceVersion.',
      missingRequiredField:
        'Metadata for field "{{field}}" is missing required field: {{requiredField}}',
      addMetadata: 'Add metadata argument to preserve() call',
      addMetadataWithFields:
        'Add metadata with {{fields}} to preserve() call',
    },
    schema: [
      {
        type: 'object',
        properties: {
          requireMetadata: { type: 'boolean' },
          requiredFields: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['description', 'sourceVersion', 'fieldSchema'],
            },
          },
        },
        additionalProperties: false,
      },
    ],
    hasSuggestions: true,
  },
  defaultOptions: [{ requireMetadata: true, requiredFields: [] }],
  create(context) {
    const options = context.options[0] ?? {};
    const { requireMetadata = true, requiredFields = [] } = options;

    return {
      CallExpression(node) {
        // Check for ctx.preserve() calls
        const fieldName = getPreserveFieldName(node);
        if (!fieldName) {
          return;
        }

        const hasMetadata = hasPreserveMetadata(node);

        // Check if metadata is required and missing
        if (requireMetadata && !hasMetadata) {
          context.report({
            node,
            messageId: 'missingMetadata',
            data: { field: fieldName },
            suggest: [
              {
                messageId: 'addMetadata',
                fix(fixer) {
                  // Add empty metadata object as third argument
                  const lastArg = node.arguments[node.arguments.length - 1];
                  const insertPos = lastArg?.range[1] ?? node.range[1] - 1;
                  return fixer.insertTextAfterRange(
                    [insertPos, insertPos],
                    ', { description: "", sourceVersion: "" }'
                  );
                },
              },
            ],
          });
          return;
        }

        // Check if required fields are present in metadata
        if (hasMetadata && requiredFields.length > 0) {
          const metadataArg = node.arguments[2];
          if (metadataArg?.type === 'ObjectExpression') {
            const presentFields = new Set<string>();
            for (const prop of metadataArg.properties) {
              if (
                prop.type === 'Property' &&
                prop.key.type === 'Identifier'
              ) {
                presentFields.add(prop.key.name);
              }
            }

            // Check each required field
            for (const requiredField of requiredFields) {
              if (!presentFields.has(requiredField)) {
                context.report({
                  node: metadataArg,
                  messageId: 'missingRequiredField',
                  data: {
                    field: fieldName,
                    requiredField,
                  },
                  suggest: [
                    {
                      messageId: 'addMetadataWithFields',
                      data: { fields: requiredField },
                      fix(fixer) {
                        // Add the missing field to the metadata object
                        const lastProp =
                          metadataArg.properties[
                            metadataArg.properties.length - 1
                          ];
                        if (lastProp) {
                          const insertPos = lastProp.range[1];
                          let defaultValue = '""';
                          if (requiredField === 'fieldSchema') {
                            defaultValue = 'undefined';
                          }
                          return fixer.insertTextAfterRange(
                            [insertPos, insertPos],
                            `, ${requiredField}: ${defaultValue}`
                          );
                        }
                        return null;
                      },
                    },
                  ],
                });
              }
            }
          }
        }
      },
    };
  },
});
