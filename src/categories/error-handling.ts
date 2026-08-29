import { CategoryScanner, Finding, ParsedFile, ResolvedConfig } from '../types';
import { traverse } from '../utils/ast';
import { RULES } from '../utils/rules';

const PROMISE_PRODUCING_CALLS = [
  'fetch',
  'axios',
  'query',
  'save',
  'findone',
  'findmany',
  'create',
  'update',
  'delete',
  'readfile',
  'writefile',
  'sendmail',
  'dispatch',
];

export const errorHandlingCategory: CategoryScanner = {
  id: 'errorHandling',
  name: 'Error Handling & Async Boundaries',
  description: 'Async routes lacking try/catch, unhandled promise rejections, and swallowed errors in empty catch blocks.',
  scan: (files: ParsedFile[], projectRoot: string, config: ResolvedConfig): Finding[] => {
    const findings: Finding[] = [];
    const ruleAsyncRoute = RULES['unhandled-async-route'];
    const ruleUnhandledPromise = RULES['unhandled-promise'];
    const ruleEmptyCatch = RULES['empty-catch-block'];

    for (const file of files) {
      if (file.isTestFile || file.isEnvFile || file.isConfigFile) continue;

      if (file.ast) {
        try {
          traverse(file.ast, {
            // 1. Swallowed errors in empty catch blocks
            CatchClause(pathRef) {
              const body = pathRef.node.body;
              const line = pathRef.node.loc?.start.line ?? 1;

              if (body && body.type === 'BlockStatement') {
                const statements = body.body;
                if (statements.length === 0) {
                  findings.push({
                    file: file.relativeFilePath,
                    line,
                    rule: ruleEmptyCatch.id,
                    category: 'errorHandling',
                    severity: ruleEmptyCatch.defaultSeverity,
                    message: `Empty catch block swallows error silently.`,
                    fix: ruleEmptyCatch.fix,
                    snippet: file.lines[line - 1]?.trim(),
                  });
                }
              }
            },

            // 2. Async Express or Next.js route handlers without try/catch
            CallExpression(pathRef) {
              const callee = pathRef.node.callee;
              let isRouteCall = false;

              if (
                callee.type === 'MemberExpression' &&
                callee.property &&
                callee.property.type === 'Identifier'
              ) {
                const method = callee.property.name.toLowerCase();
                if (['get', 'post', 'put', 'delete', 'patch', 'use'].includes(method)) {
                  isRouteCall = true;
                }
              }

              if (isRouteCall) {
                const args = pathRef.node.arguments;
                // Last argument is typically the route handler
                const handler = args[args.length - 1];

                if (
                  handler &&
                  (handler.type === 'ArrowFunctionExpression' ||
                    handler.type === 'FunctionExpression') &&
                  handler.async
                ) {
                  // Check if wrapped by asyncHandler
                  const isWrapped =
                    handler.extra?.parenthesized ||
                    (args.length > 0 &&
                      pathRef.parent?.type === 'CallExpression' &&
                      (pathRef.parent.callee as any)?.name === 'asyncHandler');

                  // Check if body has a top-level try/catch
                  let hasTryCatch = false;
                  if (handler.body && handler.body.type === 'BlockStatement') {
                    for (const stmt of handler.body.body) {
                      if (stmt.type === 'TryStatement') {
                        hasTryCatch = true;
                        break;
                      }
                    }
                  }

                  if (!hasTryCatch && !isWrapped) {
                    const line = handler.loc?.start.line ?? pathRef.node.loc?.start.line ?? 1;
                    findings.push({
                      file: file.relativeFilePath,
                      line,
                      rule: ruleAsyncRoute.id,
                      category: 'errorHandling',
                      severity: ruleAsyncRoute.defaultSeverity,
                      message: `Async route handler lacks try/catch block. Unhandled rejections will crash or hang the server.`,
                      fix: ruleAsyncRoute.fix,
                      snippet: file.lines[line - 1]?.trim(),
                    });
                  }
                }
              }
            },

            // 3. Unhandled floating promises
            ExpressionStatement(pathRef) {
              const expr = pathRef.node.expression;

              // e.g. fetch(...) without await or .catch
              if (expr.type === 'CallExpression') {
                let calleeName = '';

                if (expr.callee.type === 'Identifier') {
                  calleeName = expr.callee.name.toLowerCase();
                } else if (
                  expr.callee.type === 'MemberExpression' &&
                  expr.callee.property.type === 'Identifier'
                ) {
                  calleeName = expr.callee.property.name.toLowerCase();
                }

                if (PROMISE_PRODUCING_CALLS.includes(calleeName)) {
                  // Ensure it's not chained with .catch or .then
                  let chainedWithCatch = false;
                  if (
                    expr.callee.type === 'MemberExpression' &&
                    expr.callee.property.type === 'Identifier'
                  ) {
                    if (['catch', 'then', 'finally'].includes(expr.callee.property.name)) {
                      chainedWithCatch = true;
                    }
                  }

                  if (!chainedWithCatch) {
                    const line = expr.loc?.start.line ?? 1;
                    findings.push({
                      file: file.relativeFilePath,
                      line,
                      rule: ruleUnhandledPromise.id,
                      category: 'errorHandling',
                      severity: ruleUnhandledPromise.defaultSeverity,
                      message: `Promise invocation \`${calleeName}()\` is neither awaited nor caught with \`.catch()\`.`,
                      fix: ruleUnhandledPromise.fix,
                      snippet: file.lines[line - 1]?.trim(),
                    });
                  }
                }
              }
            },
          });
        } catch {
          // Handled
        }
      }
    }

    return findings;
  },
};
