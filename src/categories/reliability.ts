import { CategoryScanner, Finding, ParsedFile, ResolvedConfig } from '../types';
import { traverse } from '../utils/ast';
import { RULES } from '../utils/rules';

export const reliabilityCategory: CategoryScanner = {
  id: 'reliability',
  name: 'Reliability & Security Config Hygiene',
  description: 'Leftover console.log, unconfigured rate limiting, wildcard CORS, and missing security headers.',
  scan: (files: ParsedFile[], projectRoot: string, config: ResolvedConfig): Finding[] => {
    const findings: Finding[] = [];
    const ruleConsole = RULES['console-log-in-production'];
    const ruleRateLimit = RULES['missing-rate-limiting'];
    const ruleCors = RULES['cors-wildcard'];
    const ruleHelmet = RULES['missing-security-headers'];

    let hasExpressApp = false;
    let expressAppFile: ParsedFile | null = null;
    let hasRateLimiting = false;
    let hasHelmet = false;

    for (const file of files) {
      if (file.isTestFile || file.isEnvFile || file.isConfigFile) continue;

      const isCliOrBin =
        file.relativeFilePath.includes('bin/') ||
        file.relativeFilePath.includes('cli.') ||
        file.relativeFilePath.includes('scripts/');

      const content = file.content;

      // Check if Express app exists in codebase
      const hasExpressImport =
        /(?:require\(['"]express['"]\)|from\s+['"]express['"])/.test(content);
      const hasAppInstantiation =
        /(?:const|let|var)\s+(?:app|server)\s*=\s*express\(/.test(content);

      if (hasExpressImport && (hasAppInstantiation || content.includes('app.listen'))) {
        hasExpressApp = true;
        expressAppFile = file;
      }

      // Check for rate limiting usage (actual middleware or require)
      if (
        /(?:require\(['"]express-rate-limit['"]\)|from\s+['"]express-rate-limit['"]|rateLimit\(|limiter\s*=|app\.use\(.*limiter)/i.test(
          content
        )
      ) {
        hasRateLimiting = true;
      }

      // Check for Helmet usage (actual middleware or require)
      if (
        /(?:require\(['"]helmet['"]\)|from\s+['"]helmet['"]|app\.use\(helmet\(\)\)|helmet\()/i.test(
          content
        )
      ) {
        hasHelmet = true;
      }

      // Check for CORS wildcard '*'
      if (
        /cors\(\s*\{\s*origin\s*:\s*['"`]\*['"`]/i.test(content) ||
        /origin\s*:\s*['"`]\*['"`]/i.test(content) ||
        /['"`]Access-Control-Allow-Origin['"`]\s*,\s*['"`]\*['"`]/i.test(content) ||
        /app\.use\(cors\(\)\)/.test(content)
      ) {
        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];
          if (
            line.includes('*') &&
            (line.includes('origin') || line.includes('Access-Control') || line.includes('cors'))
          ) {
            findings.push({
              file: file.relativeFilePath,
              line: i + 1,
              rule: ruleCors.id,
              category: 'reliability',
              severity: ruleCors.defaultSeverity,
              message: `CORS configured with wildcard origin ('*'). Allows unauthorized third-party cross-origin requests.`,
              fix: ruleCors.fix,
              snippet: line.trim(),
            });
            break;
          }
        }
      }

      // AST check for console.log in non-CLI code
      if (file.ast && !isCliOrBin) {
        try {
          traverse(file.ast, {
            CallExpression(pathRef) {
              const callee = pathRef.node.callee;
              if (
                callee.type === 'MemberExpression' &&
                callee.object.type === 'Identifier' &&
                callee.object.name === 'console' &&
                callee.property.type === 'Identifier' &&
                ['log', 'info', 'debug', 'dir'].includes(callee.property.name)
              ) {
                const line = pathRef.node.loc?.start.line ?? 1;
                findings.push({
                  file: file.relativeFilePath,
                  line,
                  rule: ruleConsole.id,
                  category: 'reliability',
                  severity: ruleConsole.defaultSeverity,
                  message: `Leftover \`console.${callee.property.name}()\` detected in production code path.`,
                  fix: ruleConsole.fix,
                  snippet: file.lines[line - 1]?.trim(),
                });
              }
            },
          });
        } catch {
          return findings;
        }
      }
    }

    // Express security hygiene checks
    if (hasExpressApp && expressAppFile) {
      if (!hasRateLimiting) {
        findings.push({
          file: expressAppFile.relativeFilePath,
          line: 1,
          rule: ruleRateLimit.id,
          category: 'reliability',
          severity: ruleRateLimit.defaultSeverity,
          message: `Express application lacks rate limiting middleware (risk of DoS / brute-force attacks).`,
          fix: ruleRateLimit.fix,
        });
      }

      if (!hasHelmet) {
        findings.push({
          file: expressAppFile.relativeFilePath,
          line: 1,
          rule: ruleHelmet.id,
          category: 'reliability',
          severity: ruleHelmet.defaultSeverity,
          message: `Express application does not use Helmet or security headers middleware.`,
          fix: ruleHelmet.fix,
        });
      }
    }

    return findings;
  },
};
