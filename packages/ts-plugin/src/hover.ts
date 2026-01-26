/**
 * Provide hover information for migrex field names.
 */

import type * as ts from 'typescript';
import type { AnalysisResult, FieldProfile } from '@migrex/core';

/**
 * Augment hover information with migrex field profile.
 *
 * @param quickInfo - Original quick info from TypeScript
 * @param position - Position in the source file
 * @param sourceFile - Source file being hovered over
 * @param analysis - Migration graph analysis result
 * @param typescript - TypeScript module instance
 * @returns Augmented quick info, or original if no migrex info to add
 */
export function augmentHoverInfo(
  quickInfo: ts.QuickInfo | undefined,
  position: number,
  sourceFile: ts.SourceFile,
  analysis: AnalysisResult,
  typescript: typeof ts
): ts.QuickInfo | undefined {
  // Find the node at the cursor position
  const node = findNodeAtPosition(sourceFile, position, typescript);
  if (!node) {
    return quickInfo;
  }

  // Check if hovering over a field name in consume() or preserve()
  const fieldInfo = extractFieldInfo(node, typescript);
  if (!fieldInfo) {
    return quickInfo;
  }

  // Get field profile
  const profile = analysis.profiles[fieldInfo.fieldName];
  if (!profile) {
    return quickInfo;
  }

  // Create migrex documentation
  const migrexDocs = createFieldProfileDocumentation(
    fieldInfo.fieldName,
    profile,
    fieldInfo.operation
  );

  // Augment or create quick info
  if (quickInfo) {
    // Add migrex info to existing quick info
    const existingDocs =
      typeof quickInfo.documentation === 'string'
        ? quickInfo.documentation
        : quickInfo.documentation
            ?.map((part) => part.text)
            .join('') ?? '';

    const combinedDocs = existingDocs
      ? `${existingDocs}\n\n${migrexDocs}`
      : migrexDocs;

    return {
      ...quickInfo,
      documentation: [
        {
          text: combinedDocs,
          kind: 'text',
        },
      ],
    };
  } else {
    // Create new quick info for the field name
    return {
      kind: typescript.ScriptElementKind.constElement,
      kindModifiers: '',
      textSpan: {
        start: node.getStart(sourceFile),
        length: node.getWidth(sourceFile),
      },
      displayParts: [
        {
          text: `field: "${fieldInfo.fieldName}"`,
          kind: 'text',
        },
      ],
      documentation: [
        {
          text: migrexDocs,
          kind: 'text',
        },
      ],
    };
  }
}

/**
 * Information about a field name in a migrex operation.
 */
interface FieldInfo {
  fieldName: string;
  operation: 'consume' | 'preserve';
}

/**
 * Extract field information from a node if it's a field name in a migrex operation.
 */
function extractFieldInfo(
  node: ts.Node,
  typescript: typeof ts
): FieldInfo | undefined {
  // Check if we're hovering over a string literal argument
  if (!typescript.isStringLiteral(node)) {
    return undefined;
  }

  // Check if parent is a call expression
  const callExpr = node.parent;
  if (!typescript.isCallExpression(callExpr)) {
    return undefined;
  }

  // Check if it's the first argument
  if (callExpr.arguments[0] !== node) {
    return undefined;
  }

  // Check if it's consume() or preserve()
  const operation = getOperationName(callExpr, typescript);
  if (!operation) {
    return undefined;
  }

  return {
    fieldName: node.text,
    operation,
  };
}

/**
 * Get operation name if call expression is a migrex operation.
 */
function getOperationName(
  callExpr: ts.CallExpression,
  typescript: typeof ts
): 'consume' | 'preserve' | undefined {
  // Check for property access: ctx.consume or ctx.preserve
  if (!typescript.isPropertyAccessExpression(callExpr.expression)) {
    return undefined;
  }

  const propAccess = callExpr.expression;
  if (
    !typescript.isIdentifier(propAccess.name) ||
    !typescript.isIdentifier(propAccess.expression)
  ) {
    return undefined;
  }

  const receiverName = propAccess.expression.text;
  const methodName = propAccess.name.text;

  // Check for ctx or context receiver
  if (receiverName !== 'ctx' && receiverName !== 'context') {
    return undefined;
  }

  // Check for consume or preserve method
  if (methodName === 'consume') {
    return 'consume';
  } else if (methodName === 'preserve') {
    return 'preserve';
  }

  return undefined;
}

/**
 * Create documentation text for a field profile.
 */
function createFieldProfileDocumentation(
  fieldName: string,
  profile: FieldProfile,
  operation: 'consume' | 'preserve'
): string {
  const sections: string[] = [];

  sections.push('**migrex field profile**');

  if (profile === 'always-single') {
    sections.push(
      `Field \`${fieldName}\` is preserved at most once on any migration path.`
    );
    if (operation === 'consume') {
      sections.push('Safe to use: `field.kind === "single"` is always true.');
    }
  } else {
    sections.push(
      `Field \`${fieldName}\` can be preserved multiple times on some migration paths.`
    );
    if (operation === 'consume') {
      sections.push(
        'Must handle both `kind === "single"` and `kind === "multi"` cases.'
      );
      sections.push('');
      sections.push('**Example:**');
      sections.push('```typescript');
      sections.push(`const field = ctx.consume('${fieldName}');`);
      sections.push('if (field) {');
      sections.push('  if (field.kind === "single") {');
      sections.push('    // Handle single value: field.value');
      sections.push('  } else {');
      sections.push('    // Handle multiple values: field.values');
      sections.push('  }');
      sections.push('}');
      sections.push('```');
    }
  }

  return sections.join('\n');
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
