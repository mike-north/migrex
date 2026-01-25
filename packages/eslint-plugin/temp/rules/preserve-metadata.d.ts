/**
 * ESLint rule: preserve-metadata
 *
 * Warns when preserve() is called without metadata.
 * Optionally requires specific metadata fields (description, sourceVersion).
 *
 * @packageDocumentation
 */
import { ESLintUtils } from '@typescript-eslint/utils';
type MessageIds = 'missingMetadata' | 'missingRequiredField' | 'addMetadata' | 'addMetadataWithFields';
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
export declare const preserveMetadata: ESLintUtils.RuleModule<MessageIds, [PreserveMetadataRuleOptions?], unknown, ESLintUtils.RuleListener>;
export {};
