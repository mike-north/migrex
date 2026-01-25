/**
 * Generate TypeScript diagnostics for migrex consume() calls.
 */

import type * as ts from 'typescript';
import type { AnalysisResult, FieldProfile } from '@migrex/core';

/**
 * Custom diagnostic category for migrex issues.
 */
const MIGREX_DIAGNOSTIC_CATEGORY = 9000;

/**
 * Diagnostic codes for migrex issues.
 */
export const DiagnosticCodes = {
  UNHANDLED_MULTI_VALUE: MIGREX_DIAGNOSTIC_CATEGORY + 1,
  MISSING_KIND_CHECK: MIGREX_DIAGNOSTIC_CATEGORY + 2,
} as const;

/**
 * Generate diagnostics for consume() calls in a source file.
 *
 * @param sourceFile - TypeScript source file to analyze
 * @param analysis - Migration graph analysis result
 * @param typescript - TypeScript module instance
 * @returns Array of diagnostics for the file
 */
export function generateDiagnostics(
  sourceFile: ts.SourceFile,
  analysis: AnalysisResult,
  typescript: typeof ts
): ts.Diagnostic[] {
  const diagnostics: ts.Diagnostic[] = [];

  // Visit all nodes in the file
  visitNode(sourceFile);

  function visitNode(node: ts.Node): void {
    // Check if this is a consume() call
    if (isConsumeCall(node, typescript)) {
      const diagnostic = checkConsumeCall(
        node as ts.CallExpression,
        analysis,
        sourceFile,
        typescript
      );
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }

    // Recursively visit children
    typescript.forEachChild(node, visitNode);
  }

  return diagnostics;
}

/**
 * Check if a node is a consume() call expression.
 */
function isConsumeCall(node: ts.Node, typescript: typeof ts): boolean {
  if (!typescript.isCallExpression(node)) {
    return false;
  }

  const callExpr = node;

  // Check if it's a property access: ctx.consume or context.consume
  if (typescript.isPropertyAccessExpression(callExpr.expression)) {
    const propAccess = callExpr.expression;
    return (
      typescript.isIdentifier(propAccess.name) &&
      propAccess.name.text === 'consume' &&
      typescript.isIdentifier(propAccess.expression) &&
      (propAccess.expression.text === 'ctx' ||
        propAccess.expression.text === 'context')
    );
  }

  return false;
}

/**
 * Check a consume() call for potential issues with multi-value fields.
 */
function checkConsumeCall(
  callExpr: ts.CallExpression,
  analysis: AnalysisResult,
  sourceFile: ts.SourceFile,
  typescript: typeof ts
): ts.Diagnostic | undefined {
  // Extract field name from consume('fieldName')
  const fieldName = extractFieldName(callExpr, typescript);
  if (!fieldName) {
    return undefined;
  }

  // Get field profile from analysis
  const profile = analysis.profiles[fieldName];
  if (!profile) {
    // Field not in analysis - might be from a different graph
    return undefined;
  }

  // Only report diagnostic for sometimes-multi fields
  if (profile !== 'sometimes-multi') {
    return undefined;
  }

  // Check if code handles multi-value case
  const hasKindCheck = checkForKindHandling(callExpr, typescript);
  if (hasKindCheck) {
    // Code already handles multi-value case
    return undefined;
  }

  // Create diagnostic for unhandled multi-value field
  return {
    file: sourceFile,
    start: callExpr.getStart(sourceFile),
    length: callExpr.getWidth(sourceFile),
    messageText: `Field "${fieldName}" can have multiple preserved values. Check 'kind' property to handle both 'single' and 'multi' cases.`,
    category: typescript.DiagnosticCategory.Warning,
    code: DiagnosticCodes.UNHANDLED_MULTI_VALUE,
    source: 'migrex',
  };
}

/**
 * Extract field name from consume() call.
 * Returns undefined if field name cannot be determined statically.
 */
function extractFieldName(
  callExpr: ts.CallExpression,
  typescript: typeof ts
): string | undefined {
  if (callExpr.arguments.length === 0) {
    return undefined;
  }

  const firstArg = callExpr.arguments[0];
  if (!firstArg) {
    return undefined;
  }

  // Only handle string literals
  if (typescript.isStringLiteral(firstArg)) {
    return firstArg.text;
  }

  return undefined;
}

/**
 * Check if code following consume() call handles the 'kind' property.
 * This is a simplified heuristic - a full implementation would need
 * more sophisticated control flow analysis.
 */
function checkForKindHandling(
  callExpr: ts.CallExpression,
  typescript: typeof ts
): boolean {
  // Look for pattern: const field = ctx.consume('x'); if (field.kind === ...)
  // This is a simplified check - real implementation would need proper control flow analysis

  // Get parent statement
  let parent = callExpr.parent;
  while (parent && !typescript.isStatement(parent)) {
    parent = parent.parent;
  }

  if (!parent) {
    return false;
  }

  // Search for 'kind' property access in nearby code
  let foundKindCheck = false;

  // Get the next few statements
  const parentBlock = parent.parent;
  if (!parentBlock || !typescript.isBlock(parentBlock)) {
    return false;
  }

  const statements = parentBlock.statements;
  const currentIndex = statements.indexOf(parent);
  if (currentIndex === -1) {
    return false;
  }

  // Check next 5 statements for kind checks
  const endIndex = Math.min(currentIndex + 5, statements.length);
  for (let i = currentIndex; i < endIndex; i++) {
    const stmt = statements[i];
    if (stmt && hasKindCheck(stmt, typescript)) {
      foundKindCheck = true;
      break;
    }
  }

  return foundKindCheck;
}

/**
 * Check if a statement contains a check of the 'kind' property.
 */
function hasKindCheck(node: ts.Node, typescript: typeof ts): boolean {
  let found = false;

  visitNode(node);

  function visitNode(n: ts.Node): void {
    if (found) return;

    // Check for property access to 'kind'
    if (
      typescript.isPropertyAccessExpression(n) &&
      typescript.isIdentifier(n.name) &&
      n.name.text === 'kind'
    ) {
      found = true;
      return;
    }

    typescript.forEachChild(n, visitNode);
  }

  return found;
}

/**
 * Get field profile for hover information.
 * @internal Kept for future hover provider integration
 */
export function _getFieldProfile(
  fieldName: string,
  analysis: AnalysisResult
): FieldProfile | undefined {
  return analysis.profiles[fieldName];
}
