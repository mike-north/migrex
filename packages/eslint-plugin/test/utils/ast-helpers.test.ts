/**
 * Tests for AST helper utilities.
 *
 * These tests verify the AST analysis functions used by ESLint rules.
 * We create minimal AST node structures to test the utility functions
 * without running a full parser.
 */

import { describe, it, expect } from 'vitest';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';
import {
  isMethodCall,
  getStringLiteralValue,
  isPropertyAccess,
  hasKindCheck,
  _getEnclosingFunction,
  isWithinKindCheck,
  getConsumeFieldName,
  getPreserveFieldName,
  hasPreserveMetadata,
} from '../../src/utils/ast-helpers.js';

// Helper to create minimal AST nodes for testing
function createIdentifier(name: string): TSESTree.Identifier {
  return {
    type: AST_NODE_TYPES.Identifier,
    name,
  } as TSESTree.Identifier;
}

function createMemberExpression(
  objectName: string,
  propertyName: string,
  optional = false
): TSESTree.MemberExpression {
  return {
    type: AST_NODE_TYPES.MemberExpression,
    object: createIdentifier(objectName),
    property: createIdentifier(propertyName),
    computed: false,
    optional,
  } as TSESTree.MemberExpression;
}

function createCallExpression(
  callee: TSESTree.Expression,
  args: TSESTree.CallExpressionArgument[] = []
): TSESTree.CallExpression {
  return {
    type: AST_NODE_TYPES.CallExpression,
    callee,
    arguments: args,
  } as TSESTree.CallExpression;
}

function createStringLiteral(value: string): TSESTree.StringLiteral {
  return {
    type: AST_NODE_TYPES.Literal,
    value,
  } as TSESTree.StringLiteral;
}

function createNumberLiteral(value: number): TSESTree.NumberLiteral {
  return {
    type: AST_NODE_TYPES.Literal,
    value,
  } as TSESTree.NumberLiteral;
}

function createBinaryExpression(
  left: TSESTree.Expression,
  operator: string,
  right: TSESTree.Expression
): TSESTree.BinaryExpression {
  return {
    type: AST_NODE_TYPES.BinaryExpression,
    left,
    operator,
    right,
  } as TSESTree.BinaryExpression;
}

describe('AST Helpers', () => {
  describe('isMethodCall', () => {
    it('should return true for matching method call', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'consume')
      );

      expect(isMethodCall(node, 'ctx', 'consume')).toBe(true);
    });

    it('should return false for wrong object name', () => {
      const node = createCallExpression(
        createMemberExpression('other', 'consume')
      );

      expect(isMethodCall(node, 'ctx', 'consume')).toBe(false);
    });

    it('should return false for wrong method name', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'preserve')
      );

      expect(isMethodCall(node, 'ctx', 'consume')).toBe(false);
    });

    it('should return false for non-call expression', () => {
      const node = createIdentifier('consume');

      expect(isMethodCall(node, 'ctx', 'consume')).toBe(false);
    });

    it('should return false for call with non-member callee', () => {
      const node = createCallExpression(createIdentifier('consume'));

      expect(isMethodCall(node, 'ctx', 'consume')).toBe(false);
    });

    it('should return false when object is not identifier', () => {
      const node: TSESTree.CallExpression = {
        type: AST_NODE_TYPES.CallExpression,
        callee: {
          type: AST_NODE_TYPES.MemberExpression,
          object: createCallExpression(createIdentifier('getCtx')), // Not an identifier
          property: createIdentifier('consume'),
          computed: false,
        } as TSESTree.MemberExpression,
        arguments: [],
      } as TSESTree.CallExpression;

      expect(isMethodCall(node, 'ctx', 'consume')).toBe(false);
    });

    it('should return false when property is not identifier', () => {
      const node: TSESTree.CallExpression = {
        type: AST_NODE_TYPES.CallExpression,
        callee: {
          type: AST_NODE_TYPES.MemberExpression,
          object: createIdentifier('ctx'),
          property: createStringLiteral('consume'), // Not an identifier
          computed: true,
        } as TSESTree.MemberExpression,
        arguments: [],
      } as TSESTree.CallExpression;

      expect(isMethodCall(node, 'ctx', 'consume')).toBe(false);
    });
  });

  describe('getStringLiteralValue', () => {
    it('should return string value from string literal', () => {
      const node = createStringLiteral('fieldName');

      expect(getStringLiteralValue(node)).toBe('fieldName');
    });

    it('should return undefined for number literal', () => {
      const node = createNumberLiteral(42);

      expect(getStringLiteralValue(node)).toBeUndefined();
    });

    it('should return undefined for identifier', () => {
      const node = createIdentifier('fieldName');

      expect(getStringLiteralValue(node)).toBeUndefined();
    });
  });

  describe('isPropertyAccess', () => {
    it('should return true for matching property access', () => {
      const node = createMemberExpression('field', 'value');

      expect(isPropertyAccess(node, 'field', 'value')).toBe(true);
    });

    it('should return false for wrong object name', () => {
      const node = createMemberExpression('other', 'value');

      expect(isPropertyAccess(node, 'field', 'value')).toBe(false);
    });

    it('should return false for wrong property name', () => {
      const node = createMemberExpression('field', 'other');

      expect(isPropertyAccess(node, 'field', 'value')).toBe(false);
    });

    it('should handle optional chaining', () => {
      const chainExpression: TSESTree.ChainExpression = {
        type: AST_NODE_TYPES.ChainExpression,
        expression: createMemberExpression('field', 'value', true),
      } as TSESTree.ChainExpression;

      expect(isPropertyAccess(chainExpression, 'field', 'value')).toBe(true);
    });

    it('should return false for non-member expression', () => {
      const node = createIdentifier('field');

      expect(isPropertyAccess(node, 'field', 'value')).toBe(false);
    });

    it('should return false when object is not identifier', () => {
      const node: TSESTree.MemberExpression = {
        type: AST_NODE_TYPES.MemberExpression,
        object: createCallExpression(createIdentifier('getField')),
        property: createIdentifier('value'),
        computed: false,
      } as TSESTree.MemberExpression;

      expect(isPropertyAccess(node, 'field', 'value')).toBe(false);
    });

    it('should return false when property is not identifier', () => {
      const node: TSESTree.MemberExpression = {
        type: AST_NODE_TYPES.MemberExpression,
        object: createIdentifier('field'),
        property: createStringLiteral('value'),
        computed: true,
      } as TSESTree.MemberExpression;

      expect(isPropertyAccess(node, 'field', 'value')).toBe(false);
    });
  });

  describe('hasKindCheck', () => {
    it('should return true for binary expression checking field.kind', () => {
      const node = createBinaryExpression(
        createMemberExpression('field', 'kind'),
        '===',
        createStringLiteral('single')
      );

      expect(hasKindCheck(node, 'field')).toBe(true);
    });

    it('should return true for binary expression with kind on right', () => {
      const node = createBinaryExpression(
        createStringLiteral('single'),
        '===',
        createMemberExpression('field', 'kind')
      );

      expect(hasKindCheck(node, 'field')).toBe(true);
    });

    it('should return true for == operator', () => {
      const node = createBinaryExpression(
        createMemberExpression('field', 'kind'),
        '==',
        createStringLiteral('single')
      );

      expect(hasKindCheck(node, 'field')).toBe(true);
    });

    it('should return false for wrong field name', () => {
      const node = createBinaryExpression(
        createMemberExpression('other', 'kind'),
        '===',
        createStringLiteral('single')
      );

      expect(hasKindCheck(node, 'field')).toBe(false);
    });

    it('should return true for switch statement on field.kind', () => {
      const node: TSESTree.SwitchStatement = {
        type: AST_NODE_TYPES.SwitchStatement,
        discriminant: createMemberExpression('field', 'kind'),
        cases: [],
      } as TSESTree.SwitchStatement;

      expect(hasKindCheck(node, 'field')).toBe(true);
    });

    it('should return true for if statement with kind check', () => {
      const node: TSESTree.IfStatement = {
        type: AST_NODE_TYPES.IfStatement,
        test: createBinaryExpression(
          createMemberExpression('field', 'kind'),
          '===',
          createStringLiteral('single')
        ),
        consequent: { type: AST_NODE_TYPES.BlockStatement, body: [] } as TSESTree.BlockStatement,
      } as TSESTree.IfStatement;

      expect(hasKindCheck(node, 'field')).toBe(true);
    });

    it('should return true for ternary with kind check', () => {
      const node: TSESTree.ConditionalExpression = {
        type: AST_NODE_TYPES.ConditionalExpression,
        test: createBinaryExpression(
          createMemberExpression('field', 'kind'),
          '===',
          createStringLiteral('single')
        ),
        consequent: createIdentifier('a'),
        alternate: createIdentifier('b'),
      } as TSESTree.ConditionalExpression;

      expect(hasKindCheck(node, 'field')).toBe(true);
    });

    it('should return true for logical expression with kind check', () => {
      const node: TSESTree.LogicalExpression = {
        type: AST_NODE_TYPES.LogicalExpression,
        operator: '&&',
        left: createBinaryExpression(
          createMemberExpression('field', 'kind'),
          '===',
          createStringLiteral('single')
        ),
        right: createIdentifier('something'),
      } as TSESTree.LogicalExpression;

      expect(hasKindCheck(node, 'field')).toBe(true);
    });

    it('should return false for unrelated binary expression', () => {
      const node = createBinaryExpression(
        createIdentifier('a'),
        '===',
        createIdentifier('b')
      );

      expect(hasKindCheck(node, 'field')).toBe(false);
    });
  });

  describe('_getEnclosingFunction', () => {
    it('should return undefined when no parent', () => {
      const node = createIdentifier('test');
      node.parent = undefined;

      expect(_getEnclosingFunction(node)).toBeUndefined();
    });

    it('should find enclosing function declaration', () => {
      const funcDecl: TSESTree.FunctionDeclaration = {
        type: AST_NODE_TYPES.FunctionDeclaration,
        id: createIdentifier('myFunc'),
        params: [],
        body: { type: AST_NODE_TYPES.BlockStatement, body: [] } as TSESTree.BlockStatement,
      } as TSESTree.FunctionDeclaration;

      const blockStmt: TSESTree.BlockStatement = {
        type: AST_NODE_TYPES.BlockStatement,
        body: [],
        parent: funcDecl,
      } as TSESTree.BlockStatement;

      const node = createIdentifier('test');
      node.parent = blockStmt;

      expect(_getEnclosingFunction(node)).toBe(funcDecl);
    });

    it('should find enclosing arrow function', () => {
      const arrowFunc: TSESTree.ArrowFunctionExpression = {
        type: AST_NODE_TYPES.ArrowFunctionExpression,
        params: [],
        body: createIdentifier('test'),
      } as TSESTree.ArrowFunctionExpression;

      const node = createIdentifier('test');
      node.parent = arrowFunc;

      expect(_getEnclosingFunction(node)).toBe(arrowFunc);
    });

    it('should find enclosing function expression', () => {
      const funcExpr: TSESTree.FunctionExpression = {
        type: AST_NODE_TYPES.FunctionExpression,
        params: [],
        body: { type: AST_NODE_TYPES.BlockStatement, body: [] } as TSESTree.BlockStatement,
      } as TSESTree.FunctionExpression;

      const blockStmt: TSESTree.BlockStatement = {
        type: AST_NODE_TYPES.BlockStatement,
        body: [],
        parent: funcExpr,
      } as TSESTree.BlockStatement;

      const node = createIdentifier('test');
      node.parent = blockStmt;

      expect(_getEnclosingFunction(node)).toBe(funcExpr);
    });
  });

  describe('isWithinKindCheck', () => {
    it('should return false when no parent', () => {
      const node = createIdentifier('test');
      node.parent = undefined;

      expect(isWithinKindCheck(node, 'field')).toBe(false);
    });

    it('should return true when inside if statement with kind check', () => {
      const ifStmt: TSESTree.IfStatement = {
        type: AST_NODE_TYPES.IfStatement,
        test: createBinaryExpression(
          createMemberExpression('field', 'kind'),
          '===',
          createStringLiteral('single')
        ),
        consequent: { type: AST_NODE_TYPES.BlockStatement, body: [] } as TSESTree.BlockStatement,
      } as TSESTree.IfStatement;

      const blockStmt: TSESTree.BlockStatement = {
        type: AST_NODE_TYPES.BlockStatement,
        body: [],
        parent: ifStmt,
      } as TSESTree.BlockStatement;

      const node = createIdentifier('test');
      node.parent = blockStmt;

      expect(isWithinKindCheck(node, 'field')).toBe(true);
    });

    it('should return false when if statement does not check kind', () => {
      const ifStmt: TSESTree.IfStatement = {
        type: AST_NODE_TYPES.IfStatement,
        test: createBinaryExpression(
          createMemberExpression('other', 'value'),
          '===',
          createStringLiteral('test')
        ),
        consequent: { type: AST_NODE_TYPES.BlockStatement, body: [] } as TSESTree.BlockStatement,
      } as TSESTree.IfStatement;

      const blockStmt: TSESTree.BlockStatement = {
        type: AST_NODE_TYPES.BlockStatement,
        body: [],
        parent: ifStmt,
      } as TSESTree.BlockStatement;

      const node = createIdentifier('test');
      node.parent = blockStmt;

      expect(isWithinKindCheck(node, 'field')).toBe(false);
    });
  });

  describe('getConsumeFieldName', () => {
    it('should extract field name from ctx.consume("fieldName")', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'consume'),
        [createStringLiteral('myField')]
      );

      expect(getConsumeFieldName(node)).toBe('myField');
    });

    it('should return undefined for non-consume call', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'preserve'),
        [createStringLiteral('myField')]
      );

      expect(getConsumeFieldName(node)).toBeUndefined();
    });

    it('should return undefined for call with no arguments', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'consume'),
        []
      );

      expect(getConsumeFieldName(node)).toBeUndefined();
    });

    it('should return undefined when first argument is not string', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'consume'),
        [createIdentifier('fieldName')]
      );

      expect(getConsumeFieldName(node)).toBeUndefined();
    });
  });

  describe('getPreserveFieldName', () => {
    it('should extract field name from ctx.preserve("fieldName", value)', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'preserve'),
        [createStringLiteral('myField'), createIdentifier('value')]
      );

      expect(getPreserveFieldName(node)).toBe('myField');
    });

    it('should return undefined for non-preserve call', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'consume'),
        [createStringLiteral('myField')]
      );

      expect(getPreserveFieldName(node)).toBeUndefined();
    });

    it('should return undefined for call with no arguments', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'preserve'),
        []
      );

      expect(getPreserveFieldName(node)).toBeUndefined();
    });
  });

  describe('hasPreserveMetadata', () => {
    it('should return true when preserve has 3+ arguments', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'preserve'),
        [
          createStringLiteral('myField'),
          createIdentifier('value'),
          { type: AST_NODE_TYPES.ObjectExpression, properties: [] } as TSESTree.ObjectExpression,
        ]
      );

      expect(hasPreserveMetadata(node)).toBe(true);
    });

    it('should return false when preserve has only 2 arguments', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'preserve'),
        [createStringLiteral('myField'), createIdentifier('value')]
      );

      expect(hasPreserveMetadata(node)).toBe(false);
    });

    it('should return false for non-preserve call', () => {
      const node = createCallExpression(
        createMemberExpression('ctx', 'consume'),
        [
          createStringLiteral('myField'),
          createIdentifier('value'),
          { type: AST_NODE_TYPES.ObjectExpression, properties: [] } as TSESTree.ObjectExpression,
        ]
      );

      expect(hasPreserveMetadata(node)).toBe(false);
    });
  });
});
