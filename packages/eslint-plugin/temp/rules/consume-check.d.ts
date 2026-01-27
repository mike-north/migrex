/**
 * ESLint rule: consume-check
 *
 * Verifies that consume() calls properly handle the field's profile.
 * If a field is 'sometimes-multi', code must handle both single and multi cases.
 *
 * @packageDocumentation
 */
import { ESLintUtils } from '@typescript-eslint/utils';
import type { MigrationGraph } from '@migrex/core';
type MessageIds = 'missingMultiHandling' | 'unsafeFieldAccess' | 'missingKindCheck';
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
export declare const consumeCheck: ESLintUtils.RuleModule<MessageIds, [ConsumeCheckRuleOptions?], unknown, ESLintUtils.RuleListener>;
export {};
//# sourceMappingURL=consume-check.d.ts.map