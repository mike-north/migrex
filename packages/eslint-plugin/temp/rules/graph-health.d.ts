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
type MessageIds = 'disconnectedVersions' | 'deprecatedVersionInPath' | 'lossyPath' | 'suggestMigration';
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
export declare const graphHealth: ESLintUtils.RuleModule<MessageIds, [GraphHealthRuleOptions?], unknown, ESLintUtils.RuleListener>;
export {};
