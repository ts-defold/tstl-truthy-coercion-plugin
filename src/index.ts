import * as tstl from "typescript-to-lua";
import * as ts from "typescript";
import * as lua from "typescript-to-lua";
import { FunctionVisitor, TransformationContext } from "typescript-to-lua/dist/transformation/context";
import { performHoisting, popScope, pushScope, ScopeType } from "typescript-to-lua/dist/transformation/utils/scope";
import { transformBlockOrStatement } from "typescript-to-lua/dist/transformation/visitors/block";

function isStringLike(context: TransformationContext, type: ts.Type): boolean {
  const stringFlags =
      ts.TypeFlags.String |
      ts.TypeFlags.StringLiteral;

  if (type.flags & stringFlags) {
      return true;
  } else if (type.isUnion()) {
      return type.types.some(subType => isStringLike(context, subType));
  } else {
      return false;
  }
}

function isNumberLike(context: TransformationContext, type: ts.Type): boolean {
  const stringFlags =
      ts.TypeFlags.Number |
      ts.TypeFlags.NumberLiteral;

  if (type.flags & stringFlags) {
      return true;
  } else if (type.isUnion()) {
      return type.types.some(subType => isNumberLike(context, subType));
  } else {
      return false;
  }
}

function wrapInTruthyness(condition: lua.Expression, source: ts.Expression, context: TransformationContext, alwaysWrap: boolean = false): lua.Expression {
  const type = context.checker.getTypeAtLocation(source);
  if (isStringLike(context, type)) {
    const truthy = tstl.createBinaryExpression(condition, lua.createStringLiteral(""), lua.SyntaxKind.InequalityOperator);
    const truthyCheck = lua.createCallExpression(wrapInFunctionCall(truthy), []);
    condition = tstl.createBinaryExpression(truthyCheck, condition, lua.SyntaxKind.AndOperator);
  }
  else if (isNumberLike(context, type)) {
    const truthy = tstl.createBinaryExpression(condition, lua.createNumericLiteral(0), lua.SyntaxKind.InequalityOperator);
    const notNaN = tstl.createBinaryExpression(condition, condition, lua.SyntaxKind.EqualityOperator);
    const truthyCheck = lua.createCallExpression(wrapInFunctionCall(tstl.createBinaryExpression(truthy, notNaN, lua.SyntaxKind.AndOperator)), []);
    condition = tstl.createBinaryExpression(truthyCheck, condition, lua.SyntaxKind.AndOperator);
  }
  
  return alwaysWrap ? wrapInFunctionCall(condition) : condition;
}

function canBeFalsy(context: TransformationContext, type: ts.Type): boolean {
    const strictNullChecks = context.options.strict === true || context.options.strictNullChecks === true;

    const falsyFlags =
        ts.TypeFlags.Boolean |
        ts.TypeFlags.BooleanLiteral |
        ts.TypeFlags.String |
        ts.TypeFlags.StringLiteral |
        ts.TypeFlags.Number |
        ts.TypeFlags.NumberLiteral |
        ts.TypeFlags.Undefined |
        ts.TypeFlags.Null |
        ts.TypeFlags.Never |
        ts.TypeFlags.Void |
        ts.TypeFlags.Any;

    if (type.flags & falsyFlags) {
        return true;
    } else if (!strictNullChecks && !type.isLiteral()) {
        return true;
    } else if (type.isUnion()) {
        return type.types.some(subType => canBeFalsy(context, subType));
    } else {
        return false;
    }
}

function wrapInFunctionCall(expression: lua.Expression): lua.FunctionExpression {
    const returnStatement = lua.createReturnStatement([expression]);

    return lua.createFunctionExpression(
        lua.createBlock([returnStatement]),
        undefined,
        undefined,
        lua.FunctionExpressionFlags.Inline
    );
}

function transformProtectedConditionalExpression(
    context: TransformationContext,
    expression: ts.ConditionalExpression
): lua.CallExpression {
    const condition = context.transformExpression(expression.condition);
    const val1 = context.transformExpression(expression.whenTrue);
    const val2 = context.transformExpression(expression.whenFalse);

    const conditionFunction = wrapInTruthyness(condition, expression.condition, context);
    const val1Function = wrapInTruthyness(val1, expression.whenTrue, context, true);
    const val2Function = wrapInTruthyness(val2, expression.whenFalse, context, true);

    // (condition and (() => v1) or (() => v2))()
    const conditionAnd = lua.createBinaryExpression(conditionFunction, val1Function, lua.SyntaxKind.AndOperator);
    const orExpression = lua.createBinaryExpression(conditionAnd, val2Function, lua.SyntaxKind.OrOperator);
    return lua.createCallExpression(orExpression, [], expression);
}

export const transformConditionalExpression: FunctionVisitor<ts.ConditionalExpression> = (expression, context) => {
    if (canBeFalsy(context, context.checker.getTypeAtLocation(expression.whenTrue))) {
        return transformProtectedConditionalExpression(context, expression);
    }

    const condition = wrapInTruthyness(context.transformExpression(expression.condition), expression.condition, context);
    const val1 = wrapInTruthyness(context.transformExpression(expression.whenTrue), expression.whenTrue, context);
    const val2 = wrapInTruthyness(context.transformExpression(expression.whenFalse), expression.whenFalse, context);

    // condition and v1 or v2
    const conditionAnd = lua.createBinaryExpression(condition, val1, lua.SyntaxKind.AndOperator);
    return lua.createBinaryExpression(conditionAnd, val2, lua.SyntaxKind.OrOperator, expression);
};

export function transformIfStatement(statement: ts.IfStatement, context: TransformationContext): lua.IfStatement {
    pushScope(context, ScopeType.Conditional);
    const condition = wrapInTruthyness(context.transformExpression(statement.expression), statement.expression, context);
    const statements = performHoisting(context, transformBlockOrStatement(context, statement.thenStatement));
    popScope(context);
    const ifBlock = lua.createBlock(statements);

    if (statement.elseStatement) {
        if (ts.isIfStatement(statement.elseStatement)) {
            const elseStatement = transformIfStatement(statement.elseStatement, context);
            return lua.createIfStatement(condition, ifBlock, elseStatement);
        } else {
            pushScope(context, ScopeType.Conditional);
            const elseStatements = performHoisting(
                context,
                transformBlockOrStatement(context, statement.elseStatement)
            );
            popScope(context);
            const elseBlock = lua.createBlock(elseStatements);
            return lua.createIfStatement(condition, ifBlock, elseBlock);
        }
    }

    return lua.createIfStatement(condition, ifBlock);
}

export default function(): tstl.Plugin {
  return {
    visitors: {
      [ts.SyntaxKind.ConditionalExpression]: transformConditionalExpression,
      [ts.SyntaxKind.IfStatement]: transformIfStatement,
    },
  };
}
