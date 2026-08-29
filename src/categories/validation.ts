import { CategoryScanner, Finding, ParsedFile, ResolvedConfig } from '../types';
import { traverse } from '../utils/ast';
import { RULES } from '../utils/rules';

const VALIDATION_LIBRARIES = [
  'zod',
  'joi',
  'yup',
  'valibot',
  'express-validator',
  'class-validator',
  'ajv',
  'superstruct',
];

const VALIDATION_METHODS = [
  '.parse(',
  '.safeparse(',
  '.validate(',
  '.validateasync(',
  'checkschema(',
  'validationresult(',
  'schema.parse',
  'schema.validate',
  'valibot.parse',
  'yup.object',
  'z.object',
];

const SQL_QUERY_CONCAT_REGEX = /['"`]\s*(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE)\b/i;

const DANGEROUS_CALLS = ['eval', 'exec', 'execsync', 'spawnsync'];

export const validationCategory: CategoryScanner = {
  id: 'validation',
  name: 'Input Validation & Sanitization',
  description: 'Unvalidated request inputs, raw SQL string concatenation, and dangerous input execution.',
  scan: (files: ParsedFile[], projectRoot: string, config: ResolvedConfig): Finding[] => {
    const findings: Finding[] = [];
    const ruleUnvalidated = RULES['unvalidated-request-input'];
    const ruleSql = RULES['raw-sql-injection'];
    const ruleUnsafe = RULES['unsafe-input-execution'];

    for (const file of files) {
      if (file.isTestFile || file.isEnvFile || file.isConfigFile) continue;

      const contentLower = file.content.toLowerCase();

      // Check if file uses any validation library or schema validation
      const hasValidationImport = VALIDATION_LIBRARIES.some((lib) =>
        file.content.includes(`'${lib}'`) ||
        file.content.includes(`"${lib}"`) ||
        file.content.includes(`require('${lib}')`) ||
        file.content.includes(`require("${lib}")`)
      );

      const hasValidationMethod = VALIDATION_METHODS.some((method) =>
        contentLower.includes(method)
      );

      const hasValidation = hasValidationImport || hasValidationMethod;

      // Check for SQL concatenation in lines via regex
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i];
        const lineNum = i + 1;

        // Skip import/export statements, comments, or regex definitions
        if (
          line.trim().startsWith('//') ||
          line.trim().startsWith('import ') ||
          line.trim().startsWith('export ') ||
          line.includes('SQL_QUERY_CONCAT_REGEX') ||
          line.includes('RegExp') ||
          line.includes('.test(') ||
          /^\s*const\s+[A-Z_]+\s*=\s*\//.test(line)
        ) {
          continue;
        }

        // Concatenation: "SELECT ... " + var
        if (SQL_QUERY_CONCAT_REGEX.test(line) && line.includes('+')) {
          findings.push({
            file: file.relativeFilePath,
            line: lineNum,
            rule: ruleSql.id,
            category: 'validation',
            severity: ruleSql.defaultSeverity,
            message: `Raw SQL query constructed using string concatenation '+' (SQL injection risk).`,
            fix: ruleSql.fix,
            snippet: line.trim(),
          });
        }
      }

      // AST Traversal for deep checks
      if (file.ast) {
        try {
          traverse(file.ast, {
            // Check for raw SQL queries with template literals
            TemplateLiteral(pathRef) {
              if (pathRef.node.expressions.length > 0) {
                const line = pathRef.node.loc?.start.line ?? 1;
                const rawText = file.lines[line - 1] || '';
                if (
                  /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP\s+TABLE)\b/i.test(rawText) &&
                  !rawText.includes('.test(') &&
                  !rawText.includes('RegExp')
                ) {
                  const exists = findings.some(
                    (f) => f.file === file.relativeFilePath && f.line === line && f.rule === ruleSql.id
                  );
                  if (!exists) {
                    findings.push({
                      file: file.relativeFilePath,
                      line,
                      rule: ruleSql.id,
                      category: 'validation',
                      severity: ruleSql.defaultSeverity,
                      message: `Raw SQL query constructed using template literal interpolation (SQL injection risk).`,
                      fix: ruleSql.fix,
                      snippet: rawText.trim(),
                    });
                  }
                }
              }
            },

            // Dangerous function execution (eval, exec)
            CallExpression(pathRef) {
              const callee = pathRef.node.callee;
              let methodName = '';

              if (
                callee.type === 'MemberExpression' &&
                callee.property &&
                callee.property.type === 'Identifier'
              ) {
                methodName = callee.property.name.toLowerCase();
              } else if (callee.type === 'Identifier') {
                methodName = callee.name.toLowerCase();
              }

              if (DANGEROUS_CALLS.includes(methodName)) {
                const line = pathRef.node.loc?.start.line ?? 1;
                findings.push({
                  file: file.relativeFilePath,
                  line,
                  rule: ruleUnsafe.id,
                  category: 'validation',
                  severity: ruleUnsafe.defaultSeverity,
                  message: `Dangerous invocation of \`${methodName}()\` detected. Potential remote code execution vulnerability.`,
                  fix: ruleUnsafe.fix,
                  snippet: file.lines[line - 1]?.trim(),
                });
              }
            },

            // Check dangerouslySetInnerHTML in JSX
            JSXAttribute(pathRef) {
              if (pathRef.node.name && pathRef.node.name.name === 'dangerouslySetInnerHTML') {
                const line = pathRef.node.loc?.start.line ?? 1;
                const hasPurify =
                  contentLower.includes('dompurify') ||
                  contentLower.includes('sanitize') ||
                  contentLower.includes('purify');

                if (!hasPurify) {
                  findings.push({
                    file: file.relativeFilePath,
                    line,
                    rule: ruleUnsafe.id,
                    category: 'validation',
                    severity: ruleUnsafe.defaultSeverity,
                    message: `dangerouslySetInnerHTML used without sanitization (e.g. DOMPurify). High XSS risk.`,
                    fix: 'Sanitize HTML with DOMPurify.sanitize() before setting dangerouslySetInnerHTML.',
                    snippet: file.lines[line - 1]?.trim(),
                  });
                }
              }
            },

            // Check unvalidated req.body / req.query / req.params access
            MemberExpression(pathRef) {
              if (hasValidation) return;

              let isReqAccess = false;
              let accessedProp = '';

              // Direct req.body / req.query / req.params
              if (
                pathRef.node.object &&
                pathRef.node.object.type === 'Identifier' &&
                (pathRef.node.object.name === 'req' || pathRef.node.object.name === 'request') &&
                pathRef.node.property &&
                pathRef.node.property.type === 'Identifier' &&
                ['body', 'query', 'params'].includes(pathRef.node.property.name)
              ) {
                isReqAccess = true;
                accessedProp = pathRef.node.property.name;
              }

              // Nested req.body.username (object is req.body)
              if (
                pathRef.node.object &&
                pathRef.node.object.type === 'MemberExpression' &&
                pathRef.node.object.object.type === 'Identifier' &&
                (pathRef.node.object.object.name === 'req' || pathRef.node.object.object.name === 'request') &&
                pathRef.node.object.property.type === 'Identifier' &&
                ['body', 'query', 'params'].includes(pathRef.node.object.property.name)
              ) {
                isReqAccess = true;
                accessedProp = pathRef.node.object.property.name;
              }

              if (isReqAccess) {
                const line = pathRef.node.loc?.start.line ?? 1;
                const exists = findings.some(
                  (f) =>
                    f.file === file.relativeFilePath &&
                    f.line === line &&
                    f.rule === ruleUnvalidated.id
                );

                if (!exists) {
                  findings.push({
                    file: file.relativeFilePath,
                    line,
                    rule: ruleUnvalidated.id,
                    category: 'validation',
                    severity: ruleUnvalidated.defaultSeverity,
                    message: `Direct access to \`req.${accessedProp}\` without schema validation library (Zod, Joi, Yup).`,
                    fix: ruleUnvalidated.fix,
                    snippet: file.lines[line - 1]?.trim(),
                  });
                }
              }
            },
          });
        } catch {
          return findings;
        }
      }
    }

    return findings;
  },
};
