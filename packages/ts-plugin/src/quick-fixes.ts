/**
 * Provide code fixes for migrex diagnostics.
 */

import type * as ts from 'typescript';
import { DiagnosticCodes } from './diagnostics.js';

/**
 * Get code fixes for migrex diagnostics at a position.
 *
 * @param fileName - Name of the source file
 * @param start - Start position of the diagnostic
 * @param end - End position of the diagnostic
 * @param errorCodes - Array of error codes to fix
 * @param sourceFile - Source file containing the diagnostic
 * @param typescript - TypeScript module instance
 * @returns Array of code fix actions
 */
export function getCodeFixes(
  fileName: string,
  start: number,
  end: number,
  errorCodes: readonly number[],
  sourceFile: ts.SourceFile,
  typescript: typeof ts
): ts.CodeFixAction[] {
  const fixes: ts.CodeFixAction[] = [];

  // Check if any migrex diagnostic codes are present
  const hasMigrexDiagnostic = errorCodes.some(
    (code) =>
      code === DiagnosticCodes.UNHANDLED_MULTI_VALUE ||
      code === DiagnosticCodes.MISSING_KIND_CHECK
  );

  if (!hasMigrexDiagnostic) {
    return fixes;
  }

  // Find the consume() call at the diagnostic position
  const node = findNodeAtPosition(sourceFile, start, typescript);
  if (!node || !typescript.isCallExpression(node)) {
    return fixes;
  }

  // Generate fix for unhandled multi-value field
  const fix = createMultiValueHandlingFix(
    node,
    fileName,
    sourceFile,
    typescript
  );
  if (fix) {
    fixes.push(fix);
  }

  return fixes;
}

/**
 * Create a code fix to add multi-value handling.
 */
function createMultiValueHandlingFix(
  callExpr: ts.CallExpression,
  fileName: string,
  sourceFile: ts.SourceFile,
  typescript: typeof ts
): ts.CodeFixAction | undefined {
  // Extract field name
  const fieldName = extractFieldName(callExpr, typescript);
  if (!fieldName) {
    return undefined;
  }

  // Find the variable declaration or expression statement containing the consume call
  const statement = findContainingStatement(callExpr);
  if (!statement) {
    return undefined;
  }

  // Determine variable name (if assigned to a variable)
  const varName = extractVariableName(statement, typescript) ?? 'field';

  // Generate the fix code
  const fixCode = generateMultiValueHandlingCode(fieldName, varName);

  // Calculate positions for the fix
  const statementStart = statement.getStart(sourceFile);
  const statementEnd = statement.getEnd();

  return {
    fixName: 'addMultiValueHandling',
    description: `Add handling for multi-value field "${fieldName}"`,
    changes: [
      {
        fileName,
        textChanges: [
          {
            span: { start: statementStart, length: statementEnd - statementStart },
            newText: fixCode,
          },
        ],
      },
    ],
  };
}

/**
 * Generate code to handle multi-value fields.
 */
function generateMultiValueHandlingCode(
  fieldName: string,
  varName: string
): string {
  return `const ${varName} = ctx.consume('${fieldName}');
if (${varName}) {
  if (${varName}.kind === 'single') {
    // Handle single value
    const value = ${varName}.value;
    // TODO: Use value here
  } else {
    // Handle multiple values
    const values = ${varName}.values;
    // TODO: Use values here (e.g., merge, take first/last, etc.)
  }
}`;
}

/**
 * Extract field name from consume() call.
 */
function extractFieldName(
  callExpr: ts.CallExpression,
  typescript: typeof ts
): string | undefined {
  if (callExpr.arguments.length === 0) {
    return undefined;
  }

  const firstArg = callExpr.arguments[0];
  if (!firstArg || !typescript.isStringLiteral(firstArg)) {
    return undefined;
  }

  return firstArg.text;
}

/**
 * Find the statement containing a node.
 */
function findContainingStatement(node: ts.Node): ts.Statement | undefined {
  let current: ts.Node | undefined = node;
  while (current) {
    if (isStatement(current)) {
      return current as ts.Statement;
    }
    current = current.parent;
  }
  return undefined;
}

/**
 * Check if a node is a statement.
 */
function isStatement(node: ts.Node): boolean {
  // Check for common statement kinds
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const kind = (node as unknown as Record<string, unknown>).kind as number;
  // Statement range in TypeScript: 243-260
  return kind >= 243 && kind <= 260;
}

/**
 * Extract variable name from a variable declaration.
 */
function extractVariableName(
  statement: ts.Statement,
  typescript: typeof ts
): string | undefined {
  // Check if it's a variable statement: const x = ctx.consume(...)
  if (typescript.isVariableStatement(statement)) {
    const declaration = statement.declarationList.declarations[0];
    if (
      declaration &&
      typescript.isIdentifier(declaration.name)
    ) {
      return declaration.name.text;
    }
  }

  return undefined;
}

/**
 * Find the innermost node at a given position.
 */
function findNodeAtPosition(
  sourceFile: ts.SourceFile,
  position: number,
  typescript: typeof ts
): ts.Node | undefined {
  function find(node: ts.Node): ts.Node | undefined {
    if (position < node.getStart(sourceFile) || position >= node.getEnd()) {
      return undefined;
    }

    // Check children first for innermost node
    const child = typescript.forEachChild(node, find);
    return child ?? node;
  }

  return find(sourceFile);
}
