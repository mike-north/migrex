/**
 * AST helper utilities for ESLint rules.
 * @packageDocumentation
 */
import type { TSESTree } from '@typescript-eslint/utils';
/**
 * Check if a node is a call expression to a specific method.
 */
export declare function isMethodCall(node: TSESTree.Node, objectName: string, methodName: string): node is TSESTree.CallExpression;
/**
 * Extract a string literal value from a node.
 */
export declare function getStringLiteralValue(node: TSESTree.Node): string | undefined;
/**
 * Check if a node is accessing a property of an object.
 * e.g., field.value or field?.value
 */
export declare function isPropertyAccess(node: TSESTree.Node, objectName: string, propertyName: string): boolean;
/**
 * Check if code properly handles both single and multi cases for a field.
 * Looks for patterns like:
 * - if (field.kind === 'single') { ... } else { ... }
 * - switch (field.kind) { ... }
 * - field.kind === 'multi'
 */
export declare function hasKindCheck(node: TSESTree.Node, fieldName: string): boolean;
/**
 * Find the enclosing function or block for a given node.
 */
export declare function getEnclosingFunction(node: TSESTree.Node): TSESTree.FunctionLike | undefined;
/**
 * Check if a node is within a conditional that checks field.kind.
 */
export declare function isWithinKindCheck(node: TSESTree.Node, fieldName: string): boolean;
/**
 * Extract the field name from a ctx.consume() call.
 */
export declare function getConsumeFieldName(node: TSESTree.CallExpression): string | undefined;
/**
 * Extract the field name from a ctx.preserve() call.
 */
export declare function getPreserveFieldName(node: TSESTree.CallExpression): string | undefined;
/**
 * Check if a ctx.preserve() call has a third argument (metadata).
 */
export declare function hasPreserveMetadata(node: TSESTree.CallExpression): boolean;
