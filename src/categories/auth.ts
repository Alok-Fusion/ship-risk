import { CategoryScanner, Finding, ParsedFile, ResolvedConfig } from '../types';
import { traverse } from '../utils/ast';
import { RULES } from '../utils/rules';

const SENSITIVE_ROUTE_KEYWORDS = [
  'admin',
  'user',
  'billing',
  'payment',
  'checkout',
  'account',
  'wallet',
  'subscription',
  'payroll',
  'security',
];

const AUTH_MIDDLEWARE_NAMES = [
  'auth',
  'requireauth',
  'authenticate',
  'verifytoken',
  'jwt',
  'passport',
  'isauth',
  'isauthenticated',
  'session',
  'checkauth',
  'authguard',
  'verifyuser',
  'protect',
  'authorized',
  'authorize',
];

const AUTH_CALL_PATTERNS = [
  'getserversession',
  'auth()',
  'verifytoken',
  'jwt.verify',
  'req.user',
  'req.auth',
  'req.session',
  'supabase.auth',
  'clerkclient',
  'currentuser',
  'getuser',
  'authoptions',
  'nextauth',
  'verifyidtoken',
];

const ROLE_CHECK_PATTERNS = [
  'role',
  'isadmin',
  'hasrole',
  'checkrole',
  'checkpermission',
  'requirepermission',
  'req.user.role',
  'user.role',
  'role ===',
  'roles.includes',
  'allowedroles',
];

export const authCategory: CategoryScanner = {
  id: 'auth',
  name: 'Auth & Access Control',
  description: 'Missing authentication middleware, unprotected sensitive endpoints, and absent role checks.',
  scan: (files: ParsedFile[], projectRoot: string, config: ResolvedConfig): Finding[] => {
    const findings: Finding[] = [];
    const ruleNoAuth = RULES['no-auth-middleware'];
    const ruleSensitive = RULES['unprotected-sensitive-route'];
    const ruleRoleCheck = RULES['missing-role-check'];

    for (const file of files) {
      if (file.isTestFile || file.isEnvFile || file.isConfigFile) continue;

      const lowerPath = file.relativeFilePath.toLowerCase();
      const isNextApiRoute =
        lowerPath.includes('pages/api/') ||
        lowerPath.includes('pages/api.') ||
        lowerPath.includes('app/api/') ||
        (lowerPath.includes('/api/') && lowerPath.endsWith('route.ts')) ||
        (lowerPath.includes('/api/') && lowerPath.endsWith('route.js'));

      const isExpressFile =
        file.content.includes('express()') ||
        file.content.includes('Router()') ||
        file.content.includes('express.Router') ||
        file.content.includes('app.get(') ||
        file.content.includes('app.post(') ||
        file.content.includes('router.get(') ||
        file.content.includes('router.post(');

      // Strip comments for clean content matching
      const contentNoComments = file.content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .toLowerCase();

      // 1. Next.js API Routes check
      if (isNextApiRoute) {
        const hasAuthCheck = AUTH_CALL_PATTERNS.some((pattern) =>
          contentNoComments.includes(pattern)
        );
        const isSensitiveRoute = SENSITIVE_ROUTE_KEYWORDS.some((kw) => lowerPath.includes(kw));

        if (!hasAuthCheck) {
          if (isSensitiveRoute) {
            findings.push({
              file: file.relativeFilePath,
              line: 1,
              rule: ruleSensitive.id,
              category: 'auth',
              severity: ruleSensitive.defaultSeverity,
              message: `Sensitive Next.js API route (${file.relativeFilePath}) has no authentication or session check.`,
              fix: ruleSensitive.fix,
            });
          } else {
            findings.push({
              file: file.relativeFilePath,
              line: 1,
              rule: ruleNoAuth.id,
              category: 'auth',
              severity: ruleNoAuth.defaultSeverity,
              message: `Next.js API route handler (${file.relativeFilePath}) detected with no auth guard or session check.`,
              fix: ruleNoAuth.fix,
            });
          }
        } else if (lowerPath.includes('admin')) {
          const hasRoleCheck = ROLE_CHECK_PATTERNS.some((p) => contentNoComments.includes(p));
          if (!hasRoleCheck) {
            findings.push({
              file: file.relativeFilePath,
              line: 1,
              rule: ruleRoleCheck.id,
              category: 'auth',
              severity: ruleRoleCheck.defaultSeverity,
              message: `Privileged admin route (${file.relativeFilePath}) does not verify admin role or permissions.`,
              fix: ruleRoleCheck.fix,
            });
          }
        }
      }

      // 2. Express Route AST Traversal
      if (file.ast && isExpressFile) {
        try {
          traverse(file.ast, {
            CallExpression(pathRef) {
              const callee = pathRef.node.callee;
              if (
                callee.type === 'MemberExpression' &&
                callee.property &&
                callee.property.type === 'Identifier'
              ) {
                const method = callee.property.name.toLowerCase();
                const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'];

                if (HTTP_METHODS.includes(method)) {
                  const args = pathRef.node.arguments;
                  if (args.length >= 2) {
                    const firstArg = args[0];
                    let routePath = '';

                    if (firstArg.type === 'StringLiteral') {
                      routePath = firstArg.value;
                    }

                    if (routePath) {
                      const lowerRoute = routePath.toLowerCase();
                      const isSensitive = SENSITIVE_ROUTE_KEYWORDS.some((kw) =>
                        lowerRoute.includes(`/${kw}`)
                      );

                      // Check middleware arguments between routePath and final handler
                      const middlewareArgs = args.slice(1, args.length - 1);
                      let hasAuthMiddleware = false;

                      for (const arg of middlewareArgs) {
                        if (arg.type === 'Identifier') {
                          const argName = arg.name.toLowerCase();
                          if (AUTH_MIDDLEWARE_NAMES.some((m) => argName.includes(m))) {
                            hasAuthMiddleware = true;
                            break;
                          }
                        } else if (arg.type === 'CallExpression') {
                          if (arg.callee.type === 'Identifier') {
                            const fnName = arg.callee.name.toLowerCase();
                            if (AUTH_MIDDLEWARE_NAMES.some((m) => fnName.includes(m))) {
                              hasAuthMiddleware = true;
                              break;
                            }
                          }
                        }
                      }

                      // Check if global auth middleware exists in file: app.use(auth...)
                      const hasFileLevelAuth =
                        file.content.includes('requireAuth') ||
                        file.content.includes('authenticate') ||
                        file.content.includes('verifyToken') ||
                        file.content.includes('passport.authenticate');

                      const line = pathRef.node.loc?.start.line ?? 1;

                      if (!hasAuthMiddleware && !hasFileLevelAuth) {
                        if (isSensitive) {
                          findings.push({
                            file: file.relativeFilePath,
                            line,
                            rule: ruleSensitive.id,
                            category: 'auth',
                            severity: ruleSensitive.defaultSeverity,
                            message: `Sensitive Express route "${method.toUpperCase()} ${routePath}" has no auth middleware.`,
                            fix: ruleSensitive.fix,
                            snippet: file.lines[line - 1]?.trim(),
                          });
                        } else if (
                          lowerRoute.startsWith('/api') ||
                          lowerRoute.startsWith('/v1') ||
                          lowerRoute.startsWith('/v2')
                        ) {
                          findings.push({
                            file: file.relativeFilePath,
                            line,
                            rule: ruleNoAuth.id,
                            category: 'auth',
                            severity: ruleNoAuth.defaultSeverity,
                            message: `Express API endpoint "${method.toUpperCase()} ${routePath}" has no auth middleware.`,
                            fix: ruleNoAuth.fix,
                            snippet: file.lines[line - 1]?.trim(),
                          });
                        }
                      }

                      // Check role checks for admin endpoints
                      if (lowerRoute.includes('/admin')) {
                        const handlerNode = args[args.length - 1];
                        const handlerCode = file.content.slice(
                          handlerNode.start ?? 0,
                          handlerNode.end ?? 0
                        );
                        const hasRoleCheck =
                          ROLE_CHECK_PATTERNS.some((p) => handlerCode.toLowerCase().includes(p)) ||
                          middlewareArgs.some((arg) => {
                            if (arg.type === 'Identifier') {
                              return arg.name.toLowerCase().includes('role');
                            }
                            if (arg.type === 'CallExpression' && arg.callee.type === 'Identifier') {
                              return arg.callee.name.toLowerCase().includes('role');
                            }
                            return false;
                          });

                        if (!hasRoleCheck) {
                          findings.push({
                            file: file.relativeFilePath,
                            line,
                            rule: ruleRoleCheck.id,
                            category: 'auth',
                            severity: ruleRoleCheck.defaultSeverity,
                            message: `Admin endpoint "${method.toUpperCase()} ${routePath}" does not enforce role or permission checks.`,
                            fix: ruleRoleCheck.fix,
                            snippet: file.lines[line - 1]?.trim(),
                          });
                        }
                      }
                    }
                  }
                }
              }
            },
          });
        } catch {
          // AST traversal error handled
        }
      }
    }

    return findings;
  },
};
