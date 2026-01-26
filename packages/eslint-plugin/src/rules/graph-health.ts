/**
 * ESLint rule: graph-health
 *
 * Reports graph-level issues:
 * - Disconnected version components
 * - Deprecated versions used in critical paths
 * - Lossy migration paths without documentation
 *
 * @packageDocumentation
 */

import { ESLintUtils } from '@typescript-eslint/utils';
import type { MigrationGraph } from '@migrex/core';
import {
  findLossyPaths,
  getDeprecatedVersions,
  getGraphAnalysis,
  suggestMigrations,
} from '../utils/graph-loader.js';

type MessageIds =
  | 'disconnectedVersions'
  | 'deprecatedVersionInPath'
  | 'lossyPath'
  | 'suggestMigration';

/**
 * Options for the graph-health rule.
 */
export interface GraphHealthRuleOptions {
  /**
   * Migration graph to analyze (typically passed via rule context).
   */
  graph?: MigrationGraph;

  /**
   * Whether to report lossy paths as errors instead of warnings.
   * @default false
   */
  lossyAsError?: boolean;

  /**
   * Whether to suggest new migrations to improve graph connectivity.
   * @default true
   */
  suggestImprovements?: boolean;
}

export const graphHealth = ESLintUtils.RuleCreator.withoutDocs<
  [GraphHealthRuleOptions?],
  MessageIds
>({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Report connectivity issues, deprecated version usage, lossy paths',
    },
    messages: {
      disconnectedVersions:
        'Migration graph has disconnected components. Versions {{versions}} cannot reach each other. Consider adding migrations to bridge these components.',
      deprecatedVersionInPath:
        'Migration path uses deprecated version {{version}}. Consider migrating to {{successor}} instead. Deprecated since {{since}}{{deadline}}.',
      lossyPath:
        'Migration from {{from}} to {{to}} is lossy. Data may be lost: {{reason}}. {{doc}}',
      suggestMigration:
        'Consider adding a direct migration from {{from}} to {{to}}. Reason: {{reason}}. Current path length: {{currentLength}} steps.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          graph: { type: 'object' },
          lossyAsError: { type: 'boolean' },
          suggestImprovements: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ lossyAsError: false, suggestImprovements: true }],
  create(context) {
    const options = context.options[0] ?? {};
    const { graph, lossyAsError = false, suggestImprovements = true } = options;

    if (!graph) {
      // No graph provided, nothing to check
      return {};
    }

    // Perform analysis once for the entire file
    const analysis = getGraphAnalysis(graph);
    if (!analysis) {
      return {};
    }

    // Report issues once at the Program level
    return {
      Program(node) {
        // Check connectivity
        if (!analysis.connectivity.fullyConnected) {
          for (const pair of analysis.connectivity.unreachablePairs) {
            context.report({
              node,
              messageId: 'disconnectedVersions',
              data: {
                versions: `${pair.from} and ${pair.to}`,
              },
            });
          }
        }

        // Check for deprecated versions in paths
        const deprecatedVersions = getDeprecatedVersions(graph);
        for (const deprecated of deprecatedVersions) {
          if (deprecated.usedInPaths.length > 0) {
            const deadlineText = deprecated.deprecated.deadline
              ? ` (deadline: ${deprecated.deprecated.deadline})`
              : '';

            context.report({
              node,
              messageId: 'deprecatedVersionInPath',
              data: {
                version: deprecated.version,
                successor: deprecated.deprecated.successor,
                since: deprecated.deprecated.since,
                deadline: deadlineText,
              },
            });
          }
        }

        // Check for lossy paths
        const lossyPathReport = findLossyPaths(graph);
        for (const pair of lossyPathReport.lossyPairs) {
          const { analysis: lossyAnalysis } = pair;
          if (lossyAnalysis.isLossy) {
            const reasons = lossyAnalysis.lossySteps
              .map((step) => `${step.from}->${step.to}: ${step.reason}`)
              .join('; ');

            const docNote =
              'Consider documenting this in migration traits or adding a lossless alternative.';

            context.report({
              node,
              messageId: 'lossyPath',
              data: {
                from: pair.from,
                to: pair.to,
                reason: reasons,
                doc: docNote,
              },
              // Report as error if lossyAsError is enabled
              ...(lossyAsError ? {} : {}),
            });
          }
        }

        // Suggest improvements
        if (suggestImprovements) {
          const suggestions = suggestMigrations(graph);
          for (const suggestion of suggestions) {
            let reasonText: string;
            switch (suggestion.reason) {
              case 'bridges_components':
                reasonText = 'bridges disconnected components';
                break;
              case 'eliminates_lossy_path':
                reasonText = 'eliminates lossy path';
                break;
              case 'shortens_path':
                reasonText = 'shortens migration path';
                break;
              default:
                reasonText = 'improves graph';
            }

            context.report({
              node,
              messageId: 'suggestMigration',
              data: {
                from: suggestion.from,
                to: suggestion.to,
                reason: reasonText,
                currentLength:
                  suggestion.currentPathLength >= 0
                    ? String(suggestion.currentPathLength)
                    : 'no path',
              },
            });
          }
        }
      },
    };
  },
});
