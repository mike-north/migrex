/**
 * AST helper utilities for ESLint rules.
 * @packageDocumentation
 */

import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

/**
 * Check if a node is a call expression to a specific method.
 */
export function isMethodCall(
  node: TSESTree.Node,
  objectName: string,
  methodName: string
): node is TSESTree.CallExpression {
  if (node.type !== AST_NODE_TYPES.CallExpression) {
    return false;
  }

  const { callee } = node;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const { object, property } = callee;
  if (object.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }

  if (property.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }

  return object.name === objectName && property.name === methodName;
}

/**
 * Extract a string literal value from a node.
 */
export function getStringLiteralValue(
  node: TSESTree.Node
): string | undefined {
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string') {
    return node.value;
  }
  return undefined;
}

/**
 * Check if a node is accessing a property of an object.
 * e.g., field.value or field?.value
 */
export function isPropertyAccess(
  node: TSESTree.Node,
  objectName: string,
  propertyName: string
): boolean {
  // Direct access: field.value
  if (node.type === AST_NODE_TYPES.MemberExpression) {
    if (node.object.type === AST_NODE_TYPES.Identifier) {
      if (node.property.type === AST_NODE_TYPES.Identifier) {
        return (
          node.object.name === objectName && node.property.name === propertyName
        );
      }
    }
  }

  // Optional chaining: field?.value
  if (node.type === AST_NODE_TYPES.ChainExpression) {
    return isPropertyAccess(node.expression, objectName, propertyName);
  }

  return false;
}

/**
 * Check if code properly handles both single and multi cases for a field.
 * Looks for patterns like:
 * - if (field.kind === 'single') { ... } else { ... }
 * - switch (field.kind) { ... }
 * - field.kind === 'multi'
 */
export function hasKindCheck(
  node: TSESTree.Node,
  fieldName: string
): boolean {
  // Check if node contains a kind check
  function checkNode(n: TSESTree.Node): boolean {
    switch (n.type) {
      case AST_NODE_TYPES.BinaryExpression:
        if (n.operator === '===' || n.operator === '==') {
          // Check if one side is field.kind
          if (isPropertyAccess(n.left, fieldName, 'kind')) {
            return true;
          }
          if (isPropertyAccess(n.right, fieldName, 'kind')) {
            return true;
          }
        }
        break;

      case AST_NODE_TYPES.SwitchStatement:
        // Check if discriminant is field.kind
        if (isPropertyAccess(n.discriminant, fieldName, 'kind')) {
          return true;
        }
        break;

      case AST_NODE_TYPES.IfStatement:
        return checkNode(n.test);

      case AST_NODE_TYPES.ConditionalExpression:
        return checkNode(n.test);

      case AST_NODE_TYPES.LogicalExpression:
        return checkNode(n.left) || checkNode(n.right);

      case AST_NODE_TYPES.UnaryExpression:
        return checkNode(n.argument);

      case AST_NODE_TYPES.ChainExpression:
        return checkNode(n.expression);
    }

    return false;
  }

  return checkNode(node);
}

/**
 * Find the enclosing function or block for a given node.
 * @internal Kept for potential future use in rules
 */
export function _getEnclosingFunction(
  node: TSESTree.Node
): TSESTree.FunctionLike | undefined {
  let current = node.parent;
  while (current) {
    if (
      current.type === AST_NODE_TYPES.FunctionDeclaration ||
      current.type === AST_NODE_TYPES.FunctionExpression ||
      current.type === AST_NODE_TYPES.ArrowFunctionExpression
    ) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}

/**
 * Check if a node is within a conditional that checks field.kind.
 */
export function isWithinKindCheck(
  node: TSESTree.Node,
  fieldName: string
): boolean {
  let current = node.parent;
  while (current) {
    if (
      current.type === AST_NODE_TYPES.IfStatement ||
      current.type === AST_NODE_TYPES.ConditionalExpression ||
      current.type === AST_NODE_TYPES.SwitchStatement
    ) {
      if (hasKindCheck(current, fieldName)) {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
}

/**
 * Extract the field name from a ctx.consume() call.
 */
export function getConsumeFieldName(
  node: TSESTree.CallExpression
): string | undefined {
  if (!isMethodCall(node, 'ctx', 'consume')) {
    return undefined;
  }

  if (node.arguments.length === 0) {
    return undefined;
  }

  const firstArg = node.arguments[0];
  if (!firstArg) {
    return undefined;
  }

  return getStringLiteralValue(firstArg);
}

/**
 * Extract the field name from a ctx.preserve() call.
 */
export function getPreserveFieldName(
  node: TSESTree.CallExpression
): string | undefined {
  if (!isMethodCall(node, 'ctx', 'preserve')) {
    return undefined;
  }

  if (node.arguments.length === 0) {
    return undefined;
  }

  const firstArg = node.arguments[0];
  if (!firstArg) {
    return undefined;
  }

  return getStringLiteralValue(firstArg);
}

/**
 * Check if a ctx.preserve() call has a third argument (metadata).
 */
export function hasPreserveMetadata(
  node: TSESTree.CallExpression
): boolean {
  if (!isMethodCall(node, 'ctx', 'preserve')) {
    return false;
  }

  return node.arguments.length >= 3;
}
