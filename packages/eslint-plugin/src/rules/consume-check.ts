/**
 * ESLint rule: consume-check
 *
 * Verifies that consume() calls properly handle the field's profile.
 * If a field is 'sometimes-multi', code must handle both single and multi cases.
 *
 * @packageDocumentation
 */

import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import type { MigrationGraph } from '@migrex/core';
import {
  getConsumeFieldName,
  isPropertyAccess,
  isWithinKindCheck,
} from '../utils/ast-helpers.js';
import { getFieldProfile, getGraphAnalysis } from '../utils/graph-loader.js';

type MessageIds =
  | 'missingMultiHandling'
  | 'unsafeFieldAccess'
  | 'missingKindCheck';

/**
 * Options for the consume-check rule.
 */
export interface ConsumeCheckRuleOptions {
  /**
   * Whether to require kind checks even for 'always-single' fields.
   * @default false
   */
  strict?: boolean;

  /**
   * Migration graph to analyze (typically passed via rule context).
   * If not provided, the rule will not perform profile-based checks.
   */
  graph?: MigrationGraph;
}

export const consumeCheck = ESLintUtils.RuleCreator.withoutDocs<
  [ConsumeCheckRuleOptions?],
  MessageIds
>({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Verify consume() calls handle the correct single/multi case',
    },
    messages: {
      missingMultiHandling:
        'Field "{{field}}" has profile "sometimes-multi" but code does not handle multi-value case. Check field.kind before accessing field.value.',
      unsafeFieldAccess:
        'Unsafe access to field.value without checking field.kind. Use field.kind to determine if field is "single" or "multi".',
      missingKindCheck:
        'Missing kind check for consumed field "{{field}}". Always check field.kind before accessing field.value.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          strict: { type: 'boolean' },
          graph: { type: 'object' },
        },
        additionalProperties: false,
      },
    ],
    hasSuggestions: true,
  },
  defaultOptions: [{ strict: false }],
  create(context) {
    const options = context.options[0] ?? {};
    const { graph, strict = false } = options;

    // Track consumed fields in the current scope
    const consumedFields = new Map<string, TSESTree.CallExpression>();

    return {
      CallExpression(node) {
        // Check for ctx.consume() calls
        const fieldName = getConsumeFieldName(node);
        if (!fieldName) {
          return;
        }

        // Track this consumed field
        consumedFields.set(fieldName, node);

        // If we have a graph, check the field profile
        if (graph) {
          const analysis = getGraphAnalysis(graph);
          if (analysis) {
            const profile = getFieldProfile(analysis, fieldName);

            if (profile === 'sometimes-multi') {
              // Field can be multi-valued, must check kind
              // Check if there's a kind check in the surrounding code
              const hasCheck = isWithinKindCheck(node, 'field');
              if (!hasCheck) {
                context.report({
                  node,
                  messageId: 'missingMultiHandling',
                  data: { field: fieldName },
                });
              }
            } else if (profile === 'always-single' && strict) {
              // In strict mode, require kind checks even for always-single
              const hasCheck = isWithinKindCheck(node, 'field');
              if (!hasCheck) {
                context.report({
                  node,
                  messageId: 'missingKindCheck',
                  data: { field: fieldName },
                });
              }
            }
          }
        }
      },

      MemberExpression(node) {
        // Check for unsafe field.value access
        // This catches patterns like: const x = field.value
        if (isPropertyAccess(node, 'field', 'value')) {
          // Check if this is within a kind check
          const hasCheck = isWithinKindCheck(node, 'field');
          if (!hasCheck) {
            context.report({
              node,
              messageId: 'unsafeFieldAccess',
            });
          }
        }

        // Also check for field?.value (optional chaining)
        if (node.optional && node.property.type === 'Identifier') {
          if (
            node.object.type === 'Identifier' &&
            node.object.name === 'field' &&
            node.property.name === 'value'
          ) {
            const hasCheck = isWithinKindCheck(node, 'field');
            if (!hasCheck) {
              context.report({
                node,
                messageId: 'unsafeFieldAccess',
              });
            }
          }
        }
      },
    };
  },
});
